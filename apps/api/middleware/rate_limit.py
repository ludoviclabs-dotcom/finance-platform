"""
rate_limit.py — In-memory token-bucket rate limiter pour FastAPI.

Stratégie : chaque (route_group, identifier) a son propre bucket.
L'identifier est :
  - le JWT `sub` si Authorization header valide
  - sinon l'IP client (x-forwarded-for → fallback request.client.host)

Règles (limite / fenêtre) :
  /auth/login    : 5 / 60s   (anti brute-force, par IP)
  /excel/*       : 20 / 60s  (upload Excel, par user)
  /ingest/*      : 10 / 60s  (ingest coûteux, par user)
  /report/*      : 10 / 60s  (génération PDF coûteuse, par user)
  /copilot/*     : 20 / 60s  (fallback si front bypass)

Limites :
  - Mémoire locale par instance → un attaquant avec N instances parallèles
    voit N× la limite. Acceptable en v1, migration Redis prévue en P4.
  - Token expiré (signature invalide) retombe sur IP automatiquement.
"""

from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass, field

from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from services.auth_service import decode_token

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Rule table : préfixe → (limit, window_seconds, scope)
# scope = "ip" (identifiant IP) ou "user" (identifiant JWT sub, fallback IP)
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class RateRule:
    limit: int
    window_seconds: int
    scope: str  # "ip" | "user"


RULES: dict[str, RateRule] = {
    "/auth/login": RateRule(limit=5, window_seconds=60, scope="ip"),
    "/excel": RateRule(limit=20, window_seconds=60, scope="user"),
    "/ingest": RateRule(limit=10, window_seconds=60, scope="user"),
    "/report": RateRule(limit=10, window_seconds=60, scope="user"),
    "/copilot": RateRule(limit=20, window_seconds=60, scope="user"),
    "/export": RateRule(limit=5, window_seconds=60, scope="user"),   # génération ZIP coûteuse
    "/verify": RateRule(limit=30, window_seconds=60, scope="ip"),    # public, anti-scraping
}

# ---------------------------------------------------------------------------
# Token bucket en mémoire
# ---------------------------------------------------------------------------
@dataclass
class Bucket:
    tokens: float
    last_refill: float = field(default_factory=time.monotonic)


_BUCKETS: dict[tuple[str, str], Bucket] = {}
_MAX_BUCKETS = 10_000  # GC : purge si on dépasse


def _gc_if_needed() -> None:
    """Vide les buckets les plus anciens si on dépasse le plafond."""
    if len(_BUCKETS) <= _MAX_BUCKETS:
        return
    now = time.monotonic()
    stale = [
        key for key, b in _BUCKETS.items()
        if now - b.last_refill > 600  # 10 min d'inactivité
    ]
    for key in stale:
        _BUCKETS.pop(key, None)


def _match_rule(path: str) -> tuple[str, RateRule] | None:
    """Trouve la règle qui matche le path (préfixe le plus spécifique)."""
    best: tuple[str, RateRule] | None = None
    for prefix, rule in RULES.items():
        if path.startswith(prefix):
            if best is None or len(prefix) > len(best[0]):
                best = (prefix, rule)
    return best


def _get_client_ip(request: Request) -> str:
    """Extrait l'IP client (proxy-aware)."""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client:
        return request.client.host
    return "unknown"


def _get_identifier(request: Request, scope: str) -> str:
    """Retourne l'identifier pour le rate limit, selon le scope."""
    if scope == "user":
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
            user = decode_token(token)
            if user:
                return f"u:{user.email}"
    # scope == "ip" ou fallback
    return f"ip:{_get_client_ip(request)}"


def _consume(route_prefix: str, identifier: str, rule: RateRule) -> tuple[bool, int]:
    """
    Consomme un token du bucket (route_prefix, identifier).
    Retourne (allowed, retry_after_seconds).
    """
    key = (route_prefix, identifier)
    now = time.monotonic()
    bucket = _BUCKETS.get(key)

    if bucket is None:
        bucket = Bucket(tokens=float(rule.limit - 1))
        _BUCKETS[key] = bucket
        _gc_if_needed()
        return True, 0

    # Refill : tokens = min(limit, tokens + elapsed * (limit / window))
    elapsed = now - bucket.last_refill
    refill_rate = rule.limit / rule.window_seconds
    bucket.tokens = min(float(rule.limit), bucket.tokens + elapsed * refill_rate)
    bucket.last_refill = now

    if bucket.tokens >= 1.0:
        bucket.tokens -= 1.0
        return True, 0

    # Bucket vide — calcule le temps d'attente pour 1 token
    deficit = 1.0 - bucket.tokens
    retry_after = max(1, int(deficit / refill_rate) + 1)
    return False, retry_after


# ---------------------------------------------------------------------------
# Middleware FastAPI
# ---------------------------------------------------------------------------
_ENABLED = os.environ.get("RATE_LIMIT_DISABLED", "").lower() not in ("1", "true", "yes")


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not _ENABLED:
            return await call_next(request)

        match = _match_rule(request.url.path)
        if match is None:
            return await call_next(request)

        prefix, rule = match
        try:
            identifier = _get_identifier(request, rule.scope)
            allowed, retry_after = _consume(prefix, identifier, rule)
        except Exception as exc:
            logger.warning("Rate limit check failed, fail-open: %s", exc)
            return await call_next(request)

        if not allowed:
            # Import tardif pour éviter un cycle d'imports
            from middleware.request_logger import log_obs_event
            log_obs_event(
                "rate_limit_hit",
                prefix=prefix,
                identifier=identifier,
                retry_after_seconds=retry_after,
                path=request.url.path,
            )
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "Trop de requêtes. Réessayez plus tard.",
                    "retry_after_seconds": retry_after,
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(rule.limit),
                    "X-RateLimit-Window": str(rule.window_seconds),
                },
            )

        return await call_next(request)
