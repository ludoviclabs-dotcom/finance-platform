"""
request_logger.py — Middleware de logs structurés JSON par requête.

Chaque requête produit une ligne JSON sur stdout, ingérée telle quelle par
Vercel Logs (et exploitable par n'importe quel log drain Datadog/Logtail/etc).

Format :
  {
    "ts": "2026-04-14T15:23:45.123Z",
    "event": "http_request",
    "method": "POST",
    "path": "/auth/login",
    "status": 200,
    "duration_ms": 47,
    "ip": "1.2.3.4",
    "user": "admin@carbonco.fr",
    "request_id": "r_abcd1234"
  }

Events métiers supplémentaires produits par ce module :
  - auth_login_success / auth_login_failed
  - rate_limit_hit     (via RateLimitMiddleware qui log déjà)
  - jwt_invalid        (décodage échoué)

Les secrets ne sont jamais loggés : pas de body, pas de headers Authorization,
pas de cookies.
"""

from __future__ import annotations

import json
import logging
import secrets
import sys
import time
from datetime import datetime, timezone

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from services.auth_service import decode_token

logger = logging.getLogger("http")
# Force un handler stdout dédié pour sortir en JSON pur, sans le formatter
# global (qui pourrait ajouter des préfixes "INFO:" etc).
if not logger.handlers:
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(h)
    logger.setLevel(logging.INFO)
    logger.propagate = False


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _get_client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    xri = request.headers.get("x-real-ip")
    if xri:
        return xri.strip()
    if request.client:
        return request.client.host
    return "unknown"


def _get_user_email(request: Request) -> str | None:
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[7:].strip()
    if not token:
        return None
    try:
        user = decode_token(token)
        return user.email if user else None
    except Exception:
        return None


def log_obs_event(event: str, **fields) -> None:
    """
    Émet une ligne JSON structurée pour un événement d'observabilité.

    À ne pas confondre avec services.audit_service.log_event qui persiste
    un événement métier en base (audit trail). Ce helper-ci émet uniquement
    dans stdout pour ingestion par Vercel Logs / log drain.

    Usage : log_obs_event("auth_login_failed", email=..., reason="invalid_password")
    """
    payload = {"ts": _iso_now(), "event": event, **fields}
    logger.info(json.dumps(payload, default=str, ensure_ascii=False))


class RequestLoggerMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.monotonic()
        request_id = "r_" + secrets.token_hex(6)

        # Injecte le request_id dans les headers de request pour que les
        # routers puissent le récupérer et l'inclure dans leurs logs métier.
        request.state.request_id = request_id

        try:
            response = await call_next(request)
        except Exception as exc:
            duration_ms = int((time.monotonic() - start) * 1000)
            log_obs_event(
                "http_request",
                method=request.method,
                path=request.url.path,
                status=500,
                duration_ms=duration_ms,
                ip=_get_client_ip(request),
                user=_get_user_email(request),
                request_id=request_id,
                error=type(exc).__name__,
            )
            raise

        duration_ms = int((time.monotonic() - start) * 1000)
        log_obs_event(
            "http_request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=duration_ms,
            ip=_get_client_ip(request),
            user=_get_user_email(request),
            request_id=request_id,
        )

        # Expose le request_id au client pour corréler côté frontend
        response.headers["x-request-id"] = request_id
        return response
