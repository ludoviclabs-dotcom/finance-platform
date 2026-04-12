from __future__ import annotations

from fastapi import APIRouter, HTTPException

from models.vsme import VsmeSnapshotResponse
from services.esg_service import build_vsme_snapshot

router = APIRouter()


@router.get("/snapshot", response_model=VsmeSnapshotResponse)
async def vsme_snapshot() -> VsmeSnapshotResponse:
    """Return the VSME snapshot built from CarbonCo_ESG_Social.xlsx."""
    try:
        return build_vsme_snapshot()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
