from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from db.tenant import get_company_id
from models.vsme import VsmeSnapshotResponse
from services.esg_service import build_vsme_snapshot
from services.snapshot_cache import read_snapshot, write_snapshot

router = APIRouter()


@router.get("/snapshot", response_model=VsmeSnapshotResponse)
async def vsme_snapshot(company_id: int = Depends(get_company_id)) -> VsmeSnapshotResponse:
    """Return VSME snapshot — served from cache if fresh, recalculated otherwise."""
    cached = read_snapshot("vsme", company_id=company_id)
    if cached:
        return VsmeSnapshotResponse(**cached)
    try:
        result = build_vsme_snapshot()
        write_snapshot("vsme", result.model_dump(), company_id=company_id)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
