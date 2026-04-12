from __future__ import annotations

from fastapi import APIRouter, HTTPException

from models.esg import EsgSnapshotResponse
from services.esg_service import build_esg_snapshot

router = APIRouter()


@router.get("/snapshot", response_model=EsgSnapshotResponse)
async def esg_snapshot() -> EsgSnapshotResponse:
    """Return the ESG snapshot (materiality + scores + QC) from CarbonCo_ESG_Social.xlsx."""
    try:
        return build_esg_snapshot()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
