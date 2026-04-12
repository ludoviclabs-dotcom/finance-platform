"""Router for the Credit Risk IFRS 9 / Bâle IV module."""

from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from services.creditrisk_service import analyze_creditrisk
from utils.excel_reader import CorruptFileError

router = APIRouter()


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class StageBreakdown(BaseModel):
    name: str
    ead: float = Field(description="Exposure at Default (K\u20AC)")
    ecl: float = Field(description="Expected Credit Loss (K\u20AC)")
    pct: float = Field(description="% of total portfolio")
    coverage: float = Field(description="ECL / EAD coverage ratio (%)")
    color: str = Field(description="Hex color for charts")


class CreditRiskResponse(BaseModel):
    """JSON payload returned to the frontend."""

    filename: str
    sheets: list[str]
    sheet_count: int

    encours_total: float = Field(description="Total portfolio exposure (K\u20AC)")

    # ECL
    ecl_total: float
    ecl_s1: float
    ecl_s2: float
    ecl_s3: float

    # Bâle IV
    rwa: float = Field(description="Risk-Weighted Assets (K\u20AC)")
    cet1_capital: float = Field(description="CET1 capital (K\u20AC)")
    cet1_ratio: float = Field(description="Reported CET1 ratio (%)")
    cet1_pro_forma: float = Field(description="CET1 pro-forma after ECL (%)")
    output_floor: float = Field(default=72.5, description="B\u00E2le IV output floor (%)")

    # Stage distribution for charts
    stages: list[StageBreakdown]


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.post("/analyze", response_model=CreditRiskResponse)
async def analyze(
    file: UploadFile = File(..., description="Excel file (.xlsx) with credit risk data"),
) -> CreditRiskResponse:
    """Upload an Excel file and receive ECL, RWA, CET1 and stage breakdown.

    Expected sheets: 1-Portefeuille, 2-ECL IFRS 9, 4-CET1 B\u00E2le IV.
    """
    if not (file.filename or "").lower().endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Please upload an Excel file (.xlsx).",
        )

    try:
        result = await analyze_creditrisk(file)
    except CorruptFileError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {exc}",
        ) from exc

    return CreditRiskResponse(**result)
