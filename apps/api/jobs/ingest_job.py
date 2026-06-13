"""
jobs/ingest_job.py — Tâche procrastinate d'ingestion (T1.3).

Réutilise run_ingest_sync (la même logique que le mode inline) et met à jour le
statut du job dans ingest_jobs.
"""

from __future__ import annotations

from jobs import app
from services import ingest_jobs


@app.task(name="ingest_task", queue="ingest")
def ingest_task(company_id: int, job_id: str) -> None:
    # Import tardif pour éviter un cycle au chargement du module routers.
    from routers.ingest import run_ingest_sync

    ingest_jobs.set_status(job_id, "processing", company_id=company_id)
    try:
        run_ingest_sync(company_id)
        ingest_jobs.set_status(job_id, "done", company_id=company_id)
    except Exception as exc:  # noqa: BLE001
        ingest_jobs.set_status(job_id, "failed", company_id=company_id, error=str(exc))
        raise
