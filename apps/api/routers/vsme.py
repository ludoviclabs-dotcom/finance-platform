from __future__ import annotations

from fastapi import APIRouter, HTTPException

from models.vsme import VsmeSnapshotResponse
from services.esg_service import build_vsme_snapshot
from services.snapshot_cache import read_snapshot, write_snapshot

router = APIRouter()


@router.get("/snapshot", response_model=VsmeSnapshotResponse)
async def vsme_snapshot() -> VsmeSnapshotResponse:
    """Return VSME snapshot — served from cache if fresh, recalculated otherwise."""
    cached = read_snapshot("vsme")
    if cached:
        return VsmeSnapshotResponse(**cached)
    try:
        result = build_vsme_snapshot()
        write_snapshot("vsme", result.model_dump())
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
