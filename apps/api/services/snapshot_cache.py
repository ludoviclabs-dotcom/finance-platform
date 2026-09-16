"""
snapshot_cache.py — Lecture-écriture des snapshots de domaine.

Deux modes, jamais mélangés :
  - PostgreSQL configuré (DATABASE_URL) → table `snapshots`, historique
    versionné (24 versions max par domaine × organisation), sous RLS : chaque
    accès pose le contexte tenant. Un snapshot en base est une DONNÉE importée
    par l'organisation : il n'expire pas. Une erreur d'écriture ou de lecture
    REMONTE à l'appelant.
  - Sans base (développement, CI) → fichiers JSON sous CARBONCO_CACHE_DIR,
    cloisonnés par organisation, avec une durée de vie (cache de calcul).

Historique du correctif B-04 : l'écriture PostgreSQL lisait `row[0]` sur un
RealDictCursor (KeyError), l'exception était avalée et le snapshot partait
dans un fichier /tmp GLOBAL, commun à toutes les organisations — l'API
répondait 200 alors que rien n'était enregistré, et une lecture en échec
pouvait servir le snapshot d'une autre organisation.
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

# Valeur par défaut historique des signatures — les routes passent toujours
# le company_id issu du jeton.
DEFAULT_COMPANY_ID = 1

DOMAINS = ("carbon", "vsme", "esg", "finance")

_DEFAULT_CACHE_DIR = Path(os.environ.get("CARBONCO_CACHE_DIR", "/tmp/carbonco_snapshots"))


class SnapshotStoreError(RuntimeError):
    """Échec de persistance/lecture d'un snapshot en base."""


# ---------------------------------------------------------------------------
# Helpers fichiers (mode sans base uniquement)
# ---------------------------------------------------------------------------

def _cache_dir() -> Path:
    d = Path(os.environ.get("CARBONCO_CACHE_DIR", str(_DEFAULT_CACHE_DIR)))
    d.mkdir(parents=True, exist_ok=True)
    return d


def _cache_path(domain: str, company_id: int) -> Path:
    if domain not in DOMAINS:
        raise ValueError(f"Domaine de snapshot inconnu : {domain}")
    company_dir = _cache_dir() / f"company_{int(company_id)}"
    company_dir.mkdir(parents=True, exist_ok=True)
    return company_dir / f"{domain}.json"


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def _as_datetime(value: Any) -> datetime:
    if isinstance(value, str):
        value = datetime.fromisoformat(value)
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value


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
    """Persiste un snapshot.

    Base configurée → {id, version, generatedAt, source} ; lève
    SnapshotStoreError si l'écriture échoue (jamais de succès simulé).
    Sans base → fichier cloisonné par organisation, retourne None.
    """
    if db_available():
        return _write_pg(domain, data, company_id, source)
    _write_file(domain, data, company_id)
    return None


def _write_pg(
    domain: str,
    data: dict[str, Any],
    company_id: int,
    source: str,
) -> dict[str, Any]:
    try:
        with get_db(company_id=company_id) as conn:
            with conn.cursor() as cur:
                # Sérialise les écritures concurrentes d'une même organisation
                # sur un même domaine (sinon deux versions identiques).
                cur.execute(
                    "SELECT pg_advisory_xact_lock(hashtext(%s), %s)",
                    (f"snapshots:{domain}", int(company_id)),
                )
                cur.execute(
                    "SELECT COALESCE(MAX(version), 0) + 1 AS next_version "
                    "FROM snapshots WHERE company_id = %s AND domain = %s",
                    (company_id, domain),
                )
                next_version = cur.fetchone()["next_version"]

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

                # Purger les anciens snapshots au-delà de MAX_HISTORY_PER_DOMAIN
                cur.execute(
                    """
                    DELETE FROM snapshots
                    WHERE company_id = %s AND domain = %s
                      AND id NOT IN (
                          SELECT id FROM snapshots
                          WHERE company_id = %s AND domain = %s
                          ORDER BY generated_at DESC, id DESC
                          LIMIT %s
                      )
                    """,
                    (company_id, domain, company_id, domain, MAX_HISTORY_PER_DOMAIN),
                )
    except Exception as exc:
        logger.error("Écriture du snapshot %s (company %s) échouée : %s", domain, company_id, exc)
        raise SnapshotStoreError(f"Enregistrement du snapshot {domain} impossible.") from exc
    return {
        "id": inserted["id"],
        "version": next_version,
        "generatedAt": _iso(inserted["generated_at"]),
        "source": source,
    }


def _write_file(domain: str, data: dict[str, Any], company_id: int) -> None:
    payload = {
        "_cachedAt": datetime.now(timezone.utc).isoformat(),
        "_domain": domain,
        "_companyId": int(company_id),
        "data": data,
    }
    path = _cache_path(domain, company_id)
    path.write_text(json.dumps(payload, ensure_ascii=False, default=str), encoding="utf-8")


# ---------------------------------------------------------------------------
# Read (latest snapshot)
# ---------------------------------------------------------------------------

def read_snapshot(domain: str, company_id: int = DEFAULT_COMPANY_ID) -> dict[str, Any] | None:
    """Dernier snapshot de l'organisation pour *domain*, ou None.

    Base : dernier snapshot enregistré, sans expiration (lève
    SnapshotStoreError en cas d'erreur). Sans base : fichier de l'organisation
    s'il a moins de CACHE_TTL_SECONDS.
    """
    if db_available():
        return _read_pg(domain, company_id)
    return _read_file(domain, company_id)


def _read_pg(domain: str, company_id: int) -> dict[str, Any] | None:
    try:
        with get_db(company_id=company_id) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT data
                    FROM snapshots
                    WHERE company_id = %s AND domain = %s
                    ORDER BY generated_at DESC, id DESC
                    LIMIT 1
                    """,
                    (company_id, domain),
                )
                row = cur.fetchone()
    except Exception as exc:
        logger.error("Lecture du snapshot %s (company %s) échouée : %s", domain, company_id, exc)
        raise SnapshotStoreError(f"Lecture du snapshot {domain} impossible.") from exc
    if not row:
        return None
    data = row["data"]
    return data if isinstance(data, dict) else json.loads(data)


def _read_file(domain: str, company_id: int) -> dict[str, Any] | None:
    path = _cache_path(domain, company_id)
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        if payload.get("_companyId") != int(company_id):
            return None
        cached_at = _as_datetime(payload.get("_cachedAt", ""))
        if time.time() - cached_at.timestamp() > CACHE_TTL_SECONDS:
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
        with get_db(company_id=company_id) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, version, generated_at, source, data
                    FROM snapshots
                    WHERE company_id = %s AND domain = %s
                    ORDER BY generated_at DESC, id DESC
                    LIMIT %s
                    """,
                    (company_id, domain, limit),
                )
                rows = cur.fetchall()
    except Exception as exc:
        logger.error("Lecture de l'historique %s (company %s) échouée : %s", domain, company_id, exc)
        raise SnapshotStoreError(f"Lecture de l'historique {domain} impossible.") from exc
    result = []
    for row in rows:
        data = row["data"]
        result.append({
            "id": row["id"],
            "version": row["version"],
            "generatedAt": _iso(row["generated_at"]),
            "source": row["source"],
            "summary": _snapshot_summary(domain, data if isinstance(data, dict) else json.loads(data)),
        })
    return result


def read_snapshot_versions(
    domain: str,
    company_id: int = DEFAULT_COMPANY_ID,
    limit: int = 2,
) -> list[dict[str, Any]]:
    """Retourne les N derniers snapshots COMPLETS (data brute) du plus récent au
    plus ancien — utilisé par les alertes pour comparer N vs N-1 (T5.3)."""
    if not db_available():
        return []
    try:
        with get_db(company_id=company_id) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT data FROM snapshots WHERE company_id = %s AND domain = %s "
                    "ORDER BY generated_at DESC, id DESC LIMIT %s",
                    (company_id, domain, limit),
                )
                rows = cur.fetchall()
    except Exception as exc:
        logger.error("Lecture des versions %s (company %s) échouée : %s", domain, company_id, exc)
        raise SnapshotStoreError(f"Lecture des versions {domain} impossible.") from exc
    out: list[dict[str, Any]] = []
    for row in rows:
        d = row["data"]
        out.append(d if isinstance(d, dict) else json.loads(d))
    return out


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
    """Existence et âge du dernier snapshot de chaque domaine pour l'organisation.

    En base, un snapshot importé n'est jamais « périmé » (stale=False) : c'est
    une donnée, pas un cache de calcul.
    """
    result: dict[str, Any] = {}

    if db_available():
        try:
            with get_db(company_id=company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT DISTINCT ON (domain)
                            domain, generated_at, source
                        FROM snapshots
                        WHERE company_id = %s
                        ORDER BY domain, generated_at DESC, id DESC
                        """,
                        (company_id,),
                    )
                    rows = {r["domain"]: r for r in cur.fetchall()}
        except Exception as exc:
            logger.error("cache_status (company %s) échoué : %s", company_id, exc)
            raise SnapshotStoreError("Lecture de l'état des snapshots impossible.") from exc

        for domain in DOMAINS:
            row = rows.get(domain)
            if row is None:
                result[domain] = {"exists": False}
                continue
            generated_at = _as_datetime(row["generated_at"])
            result[domain] = {
                "exists": True,
                "cachedAt": generated_at.isoformat(),
                "ageSeconds": int(time.time() - generated_at.timestamp()),
                "stale": False,
                "source": row.get("source"),
            }
        return result

    for domain in DOMAINS:
        path = _cache_path(domain, company_id)
        if not path.exists():
            result[domain] = {"exists": False}
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            cached_at_str = payload.get("_cachedAt", "")
            age_s = int(time.time() - _as_datetime(cached_at_str).timestamp())
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
    """Supprime le(s) snapshot(s) de l'organisation pour un ou tous les domaines."""
    domains = [domain] if domain else list(DOMAINS)
    for d in domains:
        if d not in DOMAINS:
            raise ValueError(f"Domaine de snapshot inconnu : {d}")

    if db_available():
        with get_db(company_id=company_id) as conn:
            with conn.cursor() as cur:
                for d in domains:
                    cur.execute(
                        "DELETE FROM snapshots WHERE company_id = %s AND domain = %s",
                        (company_id, d),
                    )
        return

    for d in domains:
        p = _cache_path(d, company_id)
        if p.exists():
            p.unlink()
