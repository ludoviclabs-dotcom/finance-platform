from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from db.tenant import get_company_id
from models.esg import EsgSnapshotResponse
from services.esg_service import build_esg_snapshot
from services.snapshot_cache import read_snapshot, write_snapshot

router = APIRouter()


@router.get("/snapshot", response_model=EsgSnapshotResponse)
async def esg_snapshot(company_id: int = Depends(get_company_id)) -> EsgSnapshotResponse:
    """Return ESG snapshot — served from cache if fresh, recalculated otherwise."""
    cached = read_snapshot("esg", company_id=company_id)
    if cached:
        return EsgSnapshotResponse(**cached)
    try:
        result = build_esg_snapshot()
        write_snapshot("esg", result.model_dump(), company_id=company_id)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
