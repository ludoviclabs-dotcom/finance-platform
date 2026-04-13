from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from db.tenant import get_company_id
from models.carbon import CarbonSnapshotResponse, CarbonValidationResponse
from services.carbon_service import (
    CarbonServiceError,
    build_carbon_snapshot,
    validate_master_workbooks,
)
from services.snapshot_cache import read_snapshot, write_snapshot

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
    """Return Carbon snapshot — served from cache if fresh, recalculated otherwise."""
    cached = read_snapshot("carbon", company_id=company_id)
    if cached:
        return CarbonSnapshotResponse(**cached)
    try:
        result = build_carbon_snapshot()
        write_snapshot("carbon", result, company_id=company_id)
    except CarbonServiceError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Carbon snapshot failed: {exc}") from exc
    return CarbonSnapshotResponse(**result)
