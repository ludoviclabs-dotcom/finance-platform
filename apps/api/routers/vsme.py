from __future__ import annotations

from fastapi import APIRouter, Depends

from db.tenant import get_company_id
from models.vsme import VsmeSnapshotResponse
from routers._snapshots import serve_snapshot
from services.esg_service import build_vsme_snapshot

router = APIRouter()


@router.get("/snapshot", response_model=VsmeSnapshotResponse)
async def vsme_snapshot(company_id: int = Depends(get_company_id)) -> VsmeSnapshotResponse:
    """Dernier snapshot VSME importé par l'organisation (404 `no_snapshot` sinon)."""
    data = serve_snapshot("vsme", company_id, lambda: build_vsme_snapshot().model_dump())
    return VsmeSnapshotResponse(**data)
