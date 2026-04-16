"""
snapshot_cache.py — Lecture-écriture des snapshots de domaine.

Stratégie double :
  - Si PostgreSQL disponible (DATABASE_URL) → stockage en table `snapshots`
    avec historique versionné (24 versions max par domaine × company)
  - Sinon → fallback /tmp JSON (comportement Phase 1 inchangé)

Tous les appels externes utilisent les mêmes fonctions (read_snapshot,
write_snapshot, cache_status, invalidate) — aucun routeur n'est modifié.
"""

from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from db.database import db_available, get_db

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = int(os.environ.get("CARBONCO_CACHE_TTL", "3600"))
MAX_HISTORY_PER_DOMAIN = int(os.environ.get("CARBONCO_SNAPSHOT_HISTORY", "24"))

# Entreprise par défaut (avant multi-tenant complet)
DEFAULT_COMPANY_ID = 1

_DEFAULT_CACHE_DIR = Path(os.environ.get("CARBONCO_CACHE_DIR", "/tmp/carbonco_snapshots"))


# ---------------------------------------------------------------------------
# Helpers /tmp (fallback)
# ---------------------------------------------------------------------------

def _cache_dir() -> Path:
    d = Path(os.environ.get("CARBONCO_CACHE_DIR", str(_DEFAULT_CACHE_DIR)))
    d.mkdir(parents=True, exist_ok=True)
    return d


def _cache_path(domain: str) -> Path:
    return _cache_dir() / f"{domain}.json"


# ---------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------

def write_snapshot(
    domain: str,
    data: dict[str, Any],
    company_id: int = DEFAULT_COMPANY_ID,
    *,
    source: str = "ingest",
) -> dict[str, Any] | None:
    """Persist a snapshot. Writes to PostgreSQL if available, else /tmp JSON.

    Returns a small dict with {id, version, generatedAt, source} when PG is
    used, or None when falling back to /tmp JSON.
    """
    if db_available():
        return _write_pg(domain, data, company_id, source)
    _write_file(domain, data)
    return None


def _write_pg(
    domain: str,
    data: dict[str, Any],
    company_id: int,
    source: str,
) -> dict[str, Any] | None:
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                # Calculer le prochain numéro de version
                cur.execute(
                    "SELECT COALESCE(MAX(version), 0) + 1 FROM snapshots WHERE company_id = %s AND domain = %s",
                    (company_id, domain),
                )
                row = cur.fetchone()
                next_version = row[0] if row else 1

                cur.execute(
                    """
                    INSERT INTO snapshots (company_id, domain, version, data, generated_at, source)
                    VALUES (%s, %s, %s, %s, now(), %s)
                    RETURNING id, generated_at
                    """,
                    (
                        company_id,
                        domain,
                        next_version,
                        json.dumps(data, default=str),
                        source,
                    ),
                )
                inserted = cur.fetchone()
                inserted_id = inserted["id"] if inserted else None
                inserted_at = inserted["generated_at"] if inserted else None

                # Purger les anciens snapshots au-delà de MAX_HISTORY_PER_DOMAIN
                cur.execute(
                    """
                    DELETE FROM snapshots
                    WHERE company_id = %s AND domain = %s
                      AND id NOT IN (
                          SELECT id FROM snapshots
                          WHERE company_id = %s AND domain = %s
                          ORDER BY generated_at DESC
                          LIMIT %s
                      )
                    """,
                    (company_id, domain, company_id, domain, MAX_HISTORY_PER_DOMAIN),
                )
        return {
            "id": inserted_id,
            "version": next_version,
            "generatedAt": inserted_at.isoformat() if hasattr(inserted_at, "isoformat") else str(inserted_at) if inserted_at else None,
            "source": source,
        }
    except Exception as exc:
        logger.warning("Écriture PostgreSQL échouée pour %s, fallback /tmp : %s", domain, exc)
        _write_file(domain, data)
        return None


def _write_file(domain: str, data: dict[str, Any]) -> None:
    payload = {
        "_cachedAt": datetime.now(timezone.utc).isoformat(),
        "_domain": domain,
        "data": data,
    }
    path = _cache_path(domain)
    path.write_text(json.dumps(payload, ensure_ascii=False, default=str), encoding="utf-8")


# ---------------------------------------------------------------------------
# Read (latest snapshot)
# ---------------------------------------------------------------------------

def read_snapshot(domain: str, company_id: int = DEFAULT_COMPANY_ID) -> dict[str, Any] | None:
    """
    Return the latest cached snapshot for *domain* if within TTL.
    Returns None if absent or stale.
    """
    if db_available():
        return _read_pg(domain, company_id)
    return _read_file(domain)


def _read_pg(domain: str, company_id: int) -> dict[str, Any] | None:
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT data, generated_at
                    FROM snapshots
                    WHERE company_id = %s AND domain = %s
                    ORDER BY generated_at DESC
                    LIMIT 1
                    """,
                    (company_id, domain),
                )
                row = cur.fetchone()
        if not row:
            return None
        generated_at = row["generated_at"]
        if isinstance(generated_at, str):
            generated_at = datetime.fromisoformat(generated_at)
        age = time.time() - generated_at.timestamp()
        if age > CACHE_TTL_SECONDS:
            return None
        data = row["data"]
        return data if isinstance(data, dict) else json.loads(data)
    except Exception as exc:
        logger.warning("Lecture PostgreSQL échouée pour %s, fallback /tmp : %s", domain, exc)
        return _read_file(domain)


def _read_file(domain: str) -> dict[str, Any] | None:
    path = _cache_path(domain)
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        cached_at_str = payload.get("_cachedAt", "")
        cached_at = datetime.fromisoformat(cached_at_str)
        age = time.time() - cached_at.timestamp()
        if age > CACHE_TTL_SECONDS:
            return None
        return payload["data"]
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Snapshot history (PostgreSQL only)
# ---------------------------------------------------------------------------

def read_snapshot_history(
    domain: str,
    company_id: int = DEFAULT_COMPANY_ID,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Return the N most recent snapshots for a domain with metadata."""
    if not db_available():
        return []
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, version, generated_at, source, data
                    FROM snapshots
                    WHERE company_id = %s AND domain = %s
                    ORDER BY generated_at DESC
                    LIMIT %s
                    """,
                    (company_id, domain, limit),
                )
                rows = cur.fetchall()
        result = []
        for row in rows:
            data = row["data"]
            result.append({
                "id": row["id"],
                "version": row["version"],
                "generatedAt": row["generated_at"].isoformat() if hasattr(row["generated_at"], "isoformat") else str(row["generated_at"]),
                "source": row["source"],
                "summary": _snapshot_summary(domain, data if isinstance(data, dict) else json.loads(data)),
            })
        return result
    except Exception as exc:
        logger.warning("Erreur lecture historique snapshots : %s", exc)
        return []


def _snapshot_summary(domain: str, data: dict[str, Any]) -> dict[str, Any]:
    """Extract a few key KPIs from a snapshot for display in history."""
    if domain == "carbon":
        c = data.get("carbon", {}) or {}
        return {
            "totalS123Tco2e": c.get("totalS123Tco2e"),
            "scope1Tco2e": c.get("scope1Tco2e"),
            "company": (data.get("company", {}) or {}).get("name"),
        }
    if domain == "esg":
        s = data.get("scores", {}) or {}
        return {
            "scoreGlobal": s.get("scoreGlobal"),
            "enjeuxMateriels": (data.get("materialite", {}) or {}).get("enjeuxMateriels"),
        }
    if domain == "vsme":
        c = data.get("completude", {}) or {}
        return {
            "scorePct": c.get("scorePct"),
            "indicateursCompletes": c.get("indicateursCompletes"),
        }
    if domain == "finance":
        f = data.get("financeClimat", {}) or {}
        return {
            "expositionTotaleEur": f.get("expositionTotaleEur"),
            "greenCapexPct": f.get("greenCapexPct"),
        }
    return {}


# ---------------------------------------------------------------------------
# Cache meta / status
# ---------------------------------------------------------------------------

def cache_status(company_id: int = DEFAULT_COMPANY_ID) -> dict[str, Any]:
    """Return age and existence info for all domain caches."""
    domains = ["carbon", "vsme", "esg", "finance"]
    result: dict[str, Any] = {}

    if db_available():
        try:
            with get_db() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT DISTINCT ON (domain)
                            domain, generated_at
                        FROM snapshots
                        WHERE company_id = %s
                        ORDER BY domain, generated_at DESC
                        """,
                        (company_id,),
                    )
                    rows = {r["domain"]: r["generated_at"] for r in cur.fetchall()}

            for domain in domains:
                if domain not in rows:
                    result[domain] = {"exists": False}
                    continue
                generated_at = rows[domain]
                if isinstance(generated_at, str):
                    generated_at = datetime.fromisoformat(generated_at)
                age_s = int(time.time() - generated_at.timestamp())
                result[domain] = {
                    "exists": True,
                    "cachedAt": generated_at.isoformat(),
                    "ageSeconds": age_s,
                    "stale": age_s > CACHE_TTL_SECONDS,
                }
            return result
        except Exception as exc:
            logger.warning("Erreur cache_status PostgreSQL, fallback /tmp : %s", exc)

    # Fallback fichiers
    for domain in domains:
        path = _cache_path(domain)
        if not path.exists():
            result[domain] = {"exists": False}
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            cached_at_str = payload.get("_cachedAt", "")
            cached_at = datetime.fromisoformat(cached_at_str)
            age_s = int(time.time() - cached_at.timestamp())
            result[domain] = {
                "exists": True,
                "cachedAt": cached_at_str,
                "ageSeconds": age_s,
                "stale": age_s > CACHE_TTL_SECONDS,
            }
        except Exception as exc:
            result[domain] = {"exists": True, "error": str(exc)}
    return result


# ---------------------------------------------------------------------------
# Invalidate
# ---------------------------------------------------------------------------

def invalidate(domain: str | None = None, company_id: int = DEFAULT_COMPANY_ID) -> None:
    """Delete cache for one or all domains (keeps history in PG, purges /tmp)."""
    domains = [domain] if domain else ["carbon", "vsme", "esg", "finance"]

    if db_available():
        try:
            with get_db() as conn:
                with conn.cursor() as cur:
                    for d in domains:
                        cur.execute(
                            "DELETE FROM snapshots WHERE company_id = %s AND domain = %s",
                            (company_id, d),
                        )
        except Exception as exc:
            logger.warning("Erreur invalidation PostgreSQL : %s", exc)

    # Toujours purger les fichiers /tmp aussi
    for d in domains:
        p = _cache_path(d)
        if p.exists():
            p.unlink()
