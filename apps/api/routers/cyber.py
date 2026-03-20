"""Router for the Gouvernance Cyber module."""

from __future__ import annotations

from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, UploadFile, File

from services.cyber_service import analyze_cyber
from utils.excel_reader import CorruptFileError

router = APIRouter()


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class RadarPoint(BaseModel):
    chapter: str
    score: float
    max: float = 4


class CyberAnalysisResponse(BaseModel):
    """JSON payload returned to the frontend after cyber analysis."""

    filename: str
    sheets: list[str]
    sheet_count: int

    # Maturity
    maturity_index: float = Field(description="DORA maturity index 0-100")

    # Financial risk
    ale: float = Field(description="Annualized Loss Expectancy (K\u20AC)")
    var95: float = Field(description="Value at Risk 95% (K\u20AC)")
    ratio_cyber_it: float = Field(description="Cyber budget / IT budget (%)")

    # DORA per-chapter scores (0-4)
    dora_scores: dict[str, float] = Field(
        description="Per-chapter DORA scores: Gouvernance, Incidents, Tests, Tiers, TIC, Reporting",
    )

    # Radar chart data
    radar_data: list[RadarPoint] = Field(description="Data points for the radar chart")


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.post("/analyze", response_model=CyberAnalysisResponse)
async def analyze(
    file: UploadFile = File(..., description="Excel file (.xlsx) with cyber governance data"),
) -> CyberAnalysisResponse:
    """Upload an Excel file and receive DORA maturity, ALE, VaR 95 and radar data.

    Expected sheets: PARAM\u00C8TRES, FAIR PERT, DORA.
    """
    if not (file.filename or "").lower().endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Please upload an Excel file (.xlsx).",
        )

    try:
        result = await analyze_cyber(file)
    except CorruptFileError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {exc}",
        ) from exc

    return CyberAnalysisResponse(**result)
