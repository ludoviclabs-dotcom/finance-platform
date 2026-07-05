"""routers/health.py — Liveness + état des dépendances (T1.7)."""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone

from fastapi import APIRouter

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
