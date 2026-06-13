from __future__ import annotations

import logging
import os
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db.tenant import get_company_id
from routers.auth import require_admin
from services import ingest_jobs
from services.audit_service import log_event
from services.auth_service import AuthUser
from services.carbon_service import build_carbon_snapshot
from services.esg_service import build_esg_snapshot, build_vsme_snapshot, emit_esg_facts
from services.finance_service import build_finance_snapshot, emit_finance_facts
from services.snapshot_cache import (
    cache_status,
    invalidate,
    write_snapshot,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class IngestDomainResult(BaseModel):
    domain: str
    status: str
    detail: str | None = None
    cachedAt: str | None = None


class IngestResponse(BaseModel):
    status: str
    domains: list[IngestDomainResult]
    ingestId: str | None = None


class IngestJobResponse(BaseModel):
    id: str
    status: str
    error: str | None = None


class CacheStatusResponse(BaseModel):
    domains: dict[str, Any]


# ---------------------------------------------------------------------------
# POST /ingest
# ---------------------------------------------------------------------------

def run_ingest_sync(company_id: int) -> tuple[list[IngestDomainResult], bool]:
    """Recalcule les 4 snapshots + émet les facts (Phase 1.B). Synchrone.

    Utilisé en mode inline (défaut) ET par le worker procrastinate (mode worker).
    """
    results: list[IngestDomainResult] = []

    # --- Carbon ---
    try:
        carbon_data = build_carbon_snapshot(company_id=company_id)
        write_snapshot("carbon", carbon_data, company_id=company_id)
        results.append(IngestDomainResult(domain="carbon", status="ok", cachedAt=carbon_data.get("generatedAt")))
    except Exception as exc:
        results.append(IngestDomainResult(domain="carbon", status="error", detail=str(exc)))

    # --- VSME ---
    try:
        vsme = build_vsme_snapshot()
        vsme_dict = vsme.model_dump()
        write_snapshot("vsme", vsme_dict, company_id=company_id)
        results.append(IngestDomainResult(domain="vsme", status="ok", cachedAt=vsme.generatedAt))
    except Exception as exc:
        results.append(IngestDomainResult(domain="vsme", status="error", detail=str(exc)))

    # --- ESG ---
    try:
        esg = build_esg_snapshot()
        esg_dict = esg.model_dump()
        write_snapshot("esg", esg_dict, company_id=company_id)
        emit_esg_facts(esg_dict, company_id)  # Phase 1.B — provenance KPIs ESG
        results.append(IngestDomainResult(domain="esg", status="ok", cachedAt=esg.generatedAt))
    except Exception as exc:
        results.append(IngestDomainResult(domain="esg", status="error", detail=str(exc)))

    # --- Finance ---
    try:
        fin = build_finance_snapshot()
        fin_dict = fin.model_dump()
        write_snapshot("finance", fin_dict, company_id=company_id)
        emit_finance_facts(fin_dict, company_id)  # Phase 1.B — provenance KPIs Finance
        results.append(IngestDomainResult(domain="finance", status="ok", cachedAt=fin.generatedAt))
    except Exception as exc:
        results.append(IngestDomainResult(domain="finance", status="error", detail=str(exc)))

    all_ok = all(r.status == "ok" for r in results)
    ok_domains = [r.domain for r in results if r.status == "ok"]
    err_domains = [r.domain for r in results if r.status == "error"]

    log_event(
        event_type="ingest",
        title=f"Recalcul snapshots — {len(ok_domains)}/{len(results)} domaines OK",
        detail=f"OK: {', '.join(ok_domains)}" + (f" | Erreurs: {', '.join(err_domains)}" if err_domains else ""),
        status="ok" if all_ok else "warning" if ok_domains else "error",
        meta={"domains": [r.model_dump() for r in results]},
        company_id=company_id,
    )
    return results, all_ok


@router.post("/ingest", response_model=IngestResponse, status_code=202)
async def ingest(company_id: int = Depends(get_company_id)) -> IngestResponse:
    """Lance une ingestion. Crée un job suivable via GET /ingests/{id}.

    WORKER_MODE=worker (+ procrastinate + DATABASE_URL_DIRECT) → job déféré,
    réponse immédiate (< 1 s, statut pending). Sinon (défaut « inline ») →
    exécution synchrone, le job est néanmoins journalisé (statut done|failed).
    """
    job_id = ingest_jobs.create_job(company_id)

    if os.environ.get("WORKER_MODE") == "worker":
        try:
            from jobs.ingest_job import ingest_task
            ingest_task.defer(company_id=company_id, job_id=job_id)
            return IngestResponse(status="pending", ingestId=job_id, domains=[])
        except Exception as exc:
            logger.warning("defer worker échoué, bascule inline : %s", exc)

    # Mode inline (défaut)
    ingest_jobs.set_status(job_id, "processing", company_id=company_id)
    try:
        results, all_ok = run_ingest_sync(company_id)
        ingest_jobs.set_status(job_id, "done", company_id=company_id)
        return IngestResponse(status="ok" if all_ok else "partial", ingestId=job_id, domains=results)
    except Exception as exc:
        ingest_jobs.set_status(job_id, "failed", company_id=company_id, error=str(exc))
        raise HTTPException(500, detail=f"Ingestion échouée : {exc}") from exc


@router.get("/ingests/{job_id}", response_model=IngestJobResponse)
async def ingest_job_status(
    job_id: str, company_id: int = Depends(get_company_id),
) -> IngestJobResponse:
    """Suivi d'un job d'ingestion (polling côté UI)."""
    job = ingest_jobs.get_job(job_id, company_id=company_id)
    if not job:
        raise HTTPException(404, detail="Job d'ingestion inconnu")
    return IngestJobResponse(id=str(job["id"]), status=job["status"], error=job.get("error"))


# ---------------------------------------------------------------------------
# GET /ingest/status
# ---------------------------------------------------------------------------

@router.get("/ingest/status", response_model=CacheStatusResponse)
async def ingest_status(company_id: int = Depends(get_company_id)) -> CacheStatusResponse:
    """Return cache age and staleness for all 4 domains."""
    return CacheStatusResponse(domains=cache_status(company_id=company_id))


# ---------------------------------------------------------------------------
# DELETE /ingest/cache
# ---------------------------------------------------------------------------

@router.delete("/ingest/cache", status_code=204)
async def invalidate_cache(
    domain: str | None = None,
    user: AuthUser = Depends(require_admin),
) -> None:
    """Invalidate cached snapshot(s) for the current tenant.

    Action destructrice — réservée admin (sinon n'importe quel anonyme
    pouvait invalider le cache d'un tenant, DoS trivial).
    """
    try:
        invalidate(domain, company_id=user.company_id)
        log_event(
            event_type="cache_clear",
            title=f"Cache invalidé - {domain or 'tous les domaines'}",
            status="ok",
            company_id=user.company_id,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
