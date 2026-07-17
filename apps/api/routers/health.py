"""routers/health.py — Liveness + état des dépendances (T1.7)."""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from db.database import db_available, get_db

router = APIRouter()


def _version() -> str:
    return (
        os.environ.get("VERCEL_GIT_COMMIT_SHA")
        or os.environ.get("GITHUB_SHA")
        or "dev"
    )[:12]


def _db_status() -> str:
    if not db_available():
        return "not_configured"
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
        return "ok"
    except Exception:
        return "down"


async def _storage_status() -> str:
    """local | not_configured | ok | down.

    En mode vercel-blob, sonde RÉELLE : PUT + GET + DELETE d'une clé fixe
    (health/probe — écrasée à chaque appel, aucune accumulation). Un token
    présent mais invalide/expiré rend donc "down", plus jamais un faux "ok".

    Le SDK vercel.blob n'expose un timeout par appel que sur get() ; put()/
    delete() n'ont pas ce paramètre. asyncio.wait_for borne donc la sonde
    entière à 5 s depuis l'extérieur, pour ne jamais bloquer le monitoring
    si l'API Blob est dégradée (le thread de la sonde peut continuer en
    arrière-plan, mais /health répond dans le budget annoncé).
    """
    backend = os.environ.get("STORAGE_BACKEND", "local").lower()
    if backend != "vercel-blob":
        return "local"  # dev : filesystem local, pas de sonde
    if not os.environ.get("BLOB_READ_WRITE_TOKEN"):
        return "not_configured"

    def _probe() -> bool:
        from services.storage.vercel_blob import VercelBlobStorage

        storage = VercelBlobStorage(timeout=5.0)
        payload = b"carbonco-health-probe"
        url = storage.put("health/probe", payload, content_type="text/plain")
        data = storage.get(url)
        storage.delete(url)
        return data == payload

    try:
        ok = await asyncio.wait_for(asyncio.to_thread(_probe), timeout=5.0)
        return "ok" if ok else "down"
    except Exception:
        return "down"


def _worker_status() -> str:
    if os.environ.get("WORKER_MODE") == "worker":
        return "worker" if os.environ.get("DATABASE_URL_DIRECT") else "not_configured"
    return "inline"


@router.get("/health", tags=["health"])
async def health_check():
    """Liveness + état des dépendances (DB, stockage, worker).

    Budget : < 1 s en nominal ; la sonde stockage est bornée à 5 s par appel
    HTTP (3 appels max) si l'API Blob est dégradée.
    """
    return {
        "status": "ok",
        "service": "finance-platform-api",
        "version": _version(),
        "time": datetime.now(tz=timezone.utc).isoformat(),
        "db": _db_status(),
        "storage": await _storage_status(),
        "worker": _worker_status(),
    }


def _schema_probe() -> dict:
    """Calcul synchrone du statut schéma — exécuté hors event-loop via to_thread.

    Volontairement PAS `MigrationRunner.build_plan()` (qui hashe chaque
    fichier via `calculate_checksum` — coûteux, réservé au CLI, §16). Utilise
    seulement `discover_migrations()` (liste + regex, sans hashage) et une
    lecture du ledger.
    """
    from db.migration_runner import MigrationRunner

    runner = MigrationRunner()
    files = runner.discover_migrations()
    records = runner.load_records()
    manual_required = sum(1 for r in records.values() if r.status == "manual_required")
    pending = sum(1 for f in files if f.version not in records)
    resolved_versions = [v for v, r in records.items() if r.status in ("applied", "baseline")]
    schema_version = max(resolved_versions, key=lambda v: (int(v[:3]), v[3:]), default=None)
    # up_to_date exige que CHAQUE version découverte ait une ligne applied/baseline —
    # pas seulement pending_count==0 et manual_required_count==0 (revue Codex,
    # corrigé 2026-07-17) : une ligne 'failed' n'est ni pending (elle existe)
    # ni manual_required, donc l'ancien calcul déclarait up_to_date=true pour
    # un schéma dont une migration a réellement échoué — signal de monitoring
    # trompeur dès qu'apply()/run réel existera (PR-02C).
    up_to_date = all(
        f.version in records and records[f.version].status in ("applied", "baseline") for f in files
    )
    return {
        "schema_version": schema_version,
        "up_to_date": up_to_date,
        "pending_count": pending,
        "manual_required_count": manual_required,
    }


@router.get("/health/schema", tags=["health"])
async def health_schema():
    """État minimal et public du ledger de migrations (PR02_ARCHITECTURE_PLAN.md §16).

    Aucun secret, aucun SQL exposé — le détail par version (checksums,
    messages d'erreur) reste réservé à `python -m db.migration_cli status
    --json` (D-5). 200 toujours si l'endpoint répond, y compris
    `up_to_date: false` (état informationnel, pas une erreur HTTP) ; 503
    uniquement si la base est configurée mais injoignable pendant le calcul —
    distinct de `not_configured` (mode /tmp, normal en local), qui reste 200.
    Borné à 2 s, même pattern que `_storage_status()`.
    """
    checked_at = datetime.now(tz=timezone.utc).isoformat()
    if not db_available():
        return {
            "schema_version": None,
            "up_to_date": None,
            "pending_count": None,
            "manual_required_count": None,
            "checked_at": checked_at,
            "db": "not_configured",
        }
    try:
        result = await asyncio.wait_for(asyncio.to_thread(_schema_probe), timeout=2.0)
    except Exception:
        return JSONResponse(
            status_code=503,
            content={
                "schema_version": None,
                "up_to_date": None,
                "pending_count": None,
                "manual_required_count": None,
                "checked_at": checked_at,
                "db": "down",
            },
        )
    result["checked_at"] = checked_at
    return result
