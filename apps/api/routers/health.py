"""routers/health.py — Liveness + état des dépendances (T1.7)."""

from __future__ import annotations

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


def _storage_status() -> str:
    backend = os.environ.get("STORAGE_BACKEND", "local").lower()
    if backend == "vercel-blob":
        return "ok" if os.environ.get("BLOB_READ_WRITE_TOKEN") else "not_configured"
    return "ok"  # local : toujours disponible


def _worker_status() -> str:
    if os.environ.get("WORKER_MODE") == "worker":
        return "worker" if os.environ.get("DATABASE_URL_DIRECT") else "not_configured"
    return "inline"


@router.get("/health", tags=["health"])
async def health_check():
    """Liveness + état des dépendances (DB, stockage, worker). < 1 s."""
    return {
        "status": "ok",
        "service": "finance-platform-api",
        "version": _version(),
        "time": datetime.now(tz=timezone.utc).isoformat(),
        "db": _db_status(),
        "storage": _storage_status(),
        "worker": _worker_status(),
    }
