from __future__ import annotations

from fastapi import APIRouter, HTTPException

from models.finance import FinanceSnapshotResponse
from services.finance_service import build_finance_snapshot
from services.snapshot_cache import read_snapshot, write_snapshot

router = APIRouter()


@router.get("/snapshot", response_model=FinanceSnapshotResponse)
async def finance_snapshot() -> FinanceSnapshotResponse:
    """Return Finance snapshot — served from cache if fresh, recalculated otherwise."""
    cached = read_snapshot("finance")
    if cached:
        return FinanceSnapshotResponse(**cached)
    try:
        result = build_finance_snapshot()
        write_snapshot("finance", result.model_dump())
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
