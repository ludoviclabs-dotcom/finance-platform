from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from db.tenant import get_company_id
from models.carbon import CarbonSnapshotResponse, CarbonValidationResponse
from routers._snapshots import serve_snapshot
from services.carbon_service import (
    build_carbon_snapshot,
    validate_master_workbooks,
)

router = APIRouter()


@router.get("/validate", response_model=CarbonValidationResponse)
async def validate() -> CarbonValidationResponse:
    """Validate the three CarbonCo master workbooks used for Phase 0."""
    try:
        result = validate_master_workbooks()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Carbon validation failed: {exc}") from exc
    return CarbonValidationResponse(**result)


@router.get("/snapshot", response_model=CarbonSnapshotResponse)
async def snapshot(company_id: int = Depends(get_company_id)) -> CarbonSnapshotResponse:
    """Dernier snapshot carbone importé par l'organisation (404 `no_snapshot` sinon)."""
    data = serve_snapshot("carbon", company_id, lambda: build_carbon_snapshot(company_id=company_id))
    return CarbonSnapshotResponse(**data)
