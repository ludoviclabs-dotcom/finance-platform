from __future__ import annotations

from fastapi import APIRouter, HTTPException

from models.carbon import CarbonSnapshotResponse, CarbonValidationResponse
from services.carbon_service import CarbonServiceError, build_carbon_snapshot, validate_master_workbooks

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
async def snapshot() -> CarbonSnapshotResponse:
    """Return the Phase 0 Carbon snapshot v1 normalized from the Excel masters."""
    try:
        result = build_carbon_snapshot()
    except CarbonServiceError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Carbon snapshot failed: {exc}") from exc
    return CarbonSnapshotResponse(**result)
