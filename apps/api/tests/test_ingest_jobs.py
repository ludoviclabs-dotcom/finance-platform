"""
test_ingest_jobs.py — T1.3 : suivi des jobs d'ingestion (mode /tmp, sans DB).

Vérifie le cycle de vie pending -> processing -> done|failed, le no-op sans job,
et le câblage POST /ingest -> ingestId -> GET /ingests/{id}.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from services import ingest_jobs


def test_job_lifecycle():
    job_id = ingest_jobs.create_job(company_id=1, kind="ingest")
    job = ingest_jobs.get_job(job_id, company_id=1)
    assert job is not None
    assert job["status"] == "pending"

    ingest_jobs.set_status(job_id, "processing", company_id=1)
    assert ingest_jobs.get_job(job_id, company_id=1)["status"] == "processing"

    ingest_jobs.set_status(job_id, "done", company_id=1)
    done = ingest_jobs.get_job(job_id, company_id=1)
    assert done["status"] == "done"
    assert done["finished_at"] is not None


def test_failed_job_records_error():
    job_id = ingest_jobs.create_job(company_id=1)
    ingest_jobs.set_status(job_id, "failed", company_id=1, error="boom")
    job = ingest_jobs.get_job(job_id, company_id=1)
    assert job["status"] == "failed"
    assert job["error"] == "boom"


def test_get_unknown_job_returns_none():
    assert ingest_jobs.get_job("does-not-exist", company_id=1) is None


def test_ingest_returns_ingest_id_and_status(client: TestClient, admin_token: str):
    resp = client.post("/ingest", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 202, resp.text
    body = resp.json()
    assert body.get("ingestId"), "ingestId manquant dans la réponse /ingest"
    assert body["status"] in ("ok", "partial")

    # Le job est suivable.
    status = client.get(f"/ingests/{body['ingestId']}", headers={"Authorization": f"Bearer {admin_token}"})
    assert status.status_code == 200, status.text
    assert status.json()["status"] in ("done", "processing", "pending")


def test_ingest_job_unknown_404(client: TestClient, admin_token: str):
    resp = client.get("/ingests/unknown-id", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 404
