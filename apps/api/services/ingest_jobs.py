"""
ingest_jobs.py — Suivi des jobs d'ingestion (T1.3 du PLAN_ACTION_CARBONCO).

Un job = une ingestion (rebuild des snapshots + émission des facts). Statuts :
  pending -> processing -> done | failed

Double stockage (comme audit_service) :
  - PostgreSQL -> table ingest_jobs (migration 010)
  - sinon /tmp JSON (CI, dev sans Neon)

Le job est créé immédiatement par POST /ingest (réponse rapide avec ingest_id),
exécuté soit en ligne (WORKER_MODE=inline, défaut), soit déféré à un worker
procrastinate (WORKER_MODE=worker). Le client suit l'avancement via GET /ingests/{id}.
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from db.database import db_available, get_db

logger = logging.getLogger(__name__)

JobStatus = Literal["pending", "processing", "done", "failed"]


def _now() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


# --------------------------------------------------------------------------- #
# /tmp fallback                                                               #
# --------------------------------------------------------------------------- #

def _jobs_path() -> Path:
    cache_dir = Path(os.environ.get("CARBONCO_CACHE_DIR", "/tmp/carbonco_snapshots"))
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir / "ingest_jobs.json"


def _load_file() -> dict[str, Any]:
    path = _jobs_path()
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_file(data: dict[str, Any]) -> None:
    _jobs_path().write_text(json.dumps(data, ensure_ascii=False, default=str), encoding="utf-8")


# --------------------------------------------------------------------------- #
# Public API                                                                  #
# --------------------------------------------------------------------------- #

def create_job(company_id: int, kind: str = "ingest", payload: dict[str, Any] | None = None) -> str:
    """Crée un job en statut `pending`. Retourne son id (uuid)."""
    job_id = str(uuid.uuid4())
    if db_available():
        try:
            with get_db(company_id=company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO ingest_jobs (id, company_id, kind, status, payload, created_at)
                        VALUES (%s, %s, %s, 'pending', %s, now())
                        """,
                        (job_id, company_id, kind, json.dumps(payload or {})),
                    )
            return job_id
        except Exception as exc:
            logger.warning("create_job PG échoué, fallback /tmp : %s", exc)
    jobs = _load_file()
    jobs[job_id] = {
        "id": job_id, "company_id": company_id, "kind": kind, "status": "pending",
        "error": None, "payload": payload or {}, "created_at": _now(),
        "started_at": None, "finished_at": None,
    }
    _save_file(jobs)
    return job_id


def set_status(job_id: str, status: JobStatus, *, company_id: int | None = None, error: str | None = None) -> None:
    """Met à jour le statut d'un job (+ timestamps started/finished)."""
    started = "started_at = now()" if status == "processing" else ""
    finished = "finished_at = now()" if status in ("done", "failed") else ""
    sets = ", ".join(p for p in ["status = %s", "error = %s", started, finished] if p)
    if db_available():
        try:
            with get_db(company_id=company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(f"UPDATE ingest_jobs SET {sets} WHERE id = %s", (status, error, job_id))
            return
        except Exception as exc:
            logger.warning("set_status PG échoué, fallback /tmp : %s", exc)
    jobs = _load_file()
    job = jobs.get(job_id)
    if job:
        job["status"] = status
        job["error"] = error
        if status == "processing":
            job["started_at"] = _now()
        if status in ("done", "failed"):
            job["finished_at"] = _now()
        _save_file(jobs)


def get_job(job_id: str, *, company_id: int | None = None) -> dict[str, Any] | None:
    """Retourne le job (dict) ou None."""
    if db_available():
        try:
            with get_db(company_id=company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT id, company_id, kind, status, error, created_at, started_at, finished_at
                        FROM ingest_jobs WHERE id = %s
                        """,
                        (job_id,),
                    )
                    row = cur.fetchone()
            if row:
                return {k: (v.isoformat() if hasattr(v, "isoformat") else v) for k, v in dict(row).items()}
            return None
        except Exception as exc:
            logger.warning("get_job PG échoué, fallback /tmp : %s", exc)
    return _load_file().get(job_id)
