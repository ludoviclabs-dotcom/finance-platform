from __future__ import annotations

from fastapi import APIRouter, Depends

from db.tenant import get_company_id
from models.finance import FinanceSnapshotResponse
from routers._snapshots import serve_snapshot
from services.finance_service import build_finance_snapshot

router = APIRouter()


@router.get("/snapshot", response_model=FinanceSnapshotResponse)
async def finance_snapshot(company_id: int = Depends(get_company_id)) -> FinanceSnapshotResponse:
    """Dernier snapshot Finance importé par l'organisation (404 `no_snapshot` sinon)."""
    data = serve_snapshot("finance", company_id, lambda: build_finance_snapshot().model_dump())
    return FinanceSnapshotResponse(**data)
