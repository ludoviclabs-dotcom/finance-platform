from __future__ import annotations

from fastapi import APIRouter, Depends

from db.tenant import get_company_id
from models.esg import EsgSnapshotResponse
from routers._snapshots import serve_snapshot
from services.esg_service import build_esg_snapshot

router = APIRouter()


@router.get("/snapshot", response_model=EsgSnapshotResponse)
async def esg_snapshot(company_id: int = Depends(get_company_id)) -> EsgSnapshotResponse:
    """Dernier snapshot ESG importé par l'organisation (404 `no_snapshot` sinon)."""
    data = serve_snapshot("esg", company_id, lambda: build_esg_snapshot().model_dump())
    return EsgSnapshotResponse(**data)
