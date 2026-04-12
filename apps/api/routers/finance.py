from __future__ import annotations

from fastapi import APIRouter, HTTPException

from models.finance import FinanceSnapshotResponse
from services.finance_service import build_finance_snapshot

router = APIRouter()


@router.get("/snapshot", response_model=FinanceSnapshotResponse)
async def finance_snapshot() -> FinanceSnapshotResponse:
    """Return the Finance/DPP snapshot from CarbonCo_Finance_DPP_v1_3.xlsx."""
    try:
        return build_finance_snapshot()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
