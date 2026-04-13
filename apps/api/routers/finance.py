from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from db.tenant import get_company_id
from models.finance import FinanceSnapshotResponse
from services.finance_service import build_finance_snapshot
from services.snapshot_cache import read_snapshot, write_snapshot

router = APIRouter()


@router.get("/snapshot", response_model=FinanceSnapshotResponse)
async def finance_snapshot(company_id: int = Depends(get_company_id)) -> FinanceSnapshotResponse:
    """Return Finance snapshot — served from cache if fresh, recalculated otherwise."""
    cached = read_snapshot("finance", company_id=company_id)
    if cached:
        return FinanceSnapshotResponse(**cached)
    try:
        result = build_finance_snapshot()
        write_snapshot("finance", result.model_dump(), company_id=company_id)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
