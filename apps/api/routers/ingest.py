from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.carbon_service import CarbonServiceError, build_carbon_snapshot
from services.esg_service import build_esg_snapshot, build_vsme_snapshot
from services.finance_service import build_finance_snapshot
from services.audit_service import log_event
from services.snapshot_cache import (
    cache_status,
    invalidate,
    write_snapshot,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class IngestDomainResult(BaseModel):
    domain: str
    status: str          # "ok" | "error"
    detail: str | None = None
    cachedAt: str | None = None


class IngestResponse(BaseModel):
    status: str          # "ok" | "partial"
    domains: list[IngestDomainResult]


class CacheStatusResponse(BaseModel):
    domains: dict[str, Any]


# ---------------------------------------------------------------------------
# POST /ingest — recalculate all snapshots and persist to cache
# ---------------------------------------------------------------------------

@router.post("/ingest", response_model=IngestResponse, status_code=202)
async def ingest() -> IngestResponse:
    """
    Recalculate all 4 domain snapshots from the Excel masters and persist them
    to the JSON cache. Designed to be called after an Excel upload or on demand.

    Returns 202 Accepted with per-domain results (errors don't fail the whole request).
    """
    results: list[IngestDomainResult] = []

    # --- Carbon ---
    try:
        carbon_data = build_carbon_snapshot()
        write_snapshot("carbon", carbon_data)
        results.append(IngestDomainResult(
            domain="carbon", status="ok",
            cachedAt=carbon_data.get("generatedAt"),
        ))
    except CarbonServiceError as exc:
        results.append(IngestDomainResult(domain="carbon", status="error", detail=str(exc)))
    except Exception as exc:
        results.append(IngestDomainResult(domain="carbon", status="error", detail=str(exc)))

    # --- VSME ---
    try:
        vsme = build_vsme_snapshot()
        vsme_dict = vsme.model_dump()
        write_snapshot("vsme", vsme_dict)
        results.append(IngestDomainResult(
            domain="vsme", status="ok",
            cachedAt=vsme.generatedAt,
        ))
    except Exception as exc:
        results.append(IngestDomainResult(domain="vsme", status="error", detail=str(exc)))

    # --- ESG ---
    try:
        esg = build_esg_snapshot()
        esg_dict = esg.model_dump()
        write_snapshot("esg", esg_dict)
        results.append(IngestDomainResult(
            domain="esg", status="ok",
            cachedAt=esg.generatedAt,
        ))
    except Exception as exc:
        results.append(IngestDomainResult(domain="esg", status="error", detail=str(exc)))

    # --- Finance ---
    try:
        fin = build_finance_snapshot()
        fin_dict = fin.model_dump()
        write_snapshot("finance", fin_dict)
        results.append(IngestDomainResult(
            domain="finance", status="ok",
            cachedAt=fin.generatedAt,
        ))
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
    )

    return IngestResponse(
        status="ok" if all_ok else "partial",
        domains=results,
    )


# ---------------------------------------------------------------------------
# GET /ingest/status — cache freshness info
# ---------------------------------------------------------------------------

@router.get("/ingest/status", response_model=CacheStatusResponse)
async def ingest_status() -> CacheStatusResponse:
    """Return cache age and staleness for all 4 domains."""
    return CacheStatusResponse(domains=cache_status())


# ---------------------------------------------------------------------------
# DELETE /ingest/cache — invalidate all caches (force re-ingest)
# ---------------------------------------------------------------------------

@router.delete("/ingest/cache", status_code=204)
async def invalidate_cache(domain: str | None = None) -> None:
    """
    Invalidate cached snapshot(s). Pass ?domain=carbon|vsme|esg|finance to
    invalidate a single domain, or omit to wipe all.
    """
    try:
        invalidate(domain)
        log_event(
            event_type="cache_clear",
            title=f"Cache invalidé — {domain or 'tous les domaines'}",
            status="ok",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
