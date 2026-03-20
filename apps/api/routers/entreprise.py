"""Router for the Analyse d'Entreprise module."""

from __future__ import annotations

from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, UploadFile, File

from services.entreprise_service import analyze_entreprise
from utils.excel_reader import CorruptFileError

router = APIRouter()


# ---------------------------------------------------------------------------
# Response model
# ---------------------------------------------------------------------------

class AnalyseEntrepriseResponse(BaseModel):
    """JSON payload returned to the frontend after analysis."""

    filename: str
    sheets: list[str]
    sheet_count: int
    source_sheet: str = Field(description="Sheet used for data extraction")

    # Altman Z-Score
    z_score: float = Field(description="Altman Z'' score (private firms)")

    # KPIs
    croissance_ca: float = Field(description="Revenue growth N/N-1 (%)")
    marge_ebe: float = Field(description="EBITDA margin (%)")
    ratio_endettement: float = Field(description="Debt / Equity (%)")
    roe: float = Field(description="Return on Equity (%)")
    bfr_jours: float = Field(description="Working capital in days")
    tresorerie_nette: float = Field(description="Net cash position (K€)")


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.post("/analyze", response_model=AnalyseEntrepriseResponse)
async def analyze(
    file: UploadFile = File(..., description="Excel file (.xlsx) containing financial data"),
) -> AnalyseEntrepriseResponse:
    """Upload an Excel file and receive the Altman Z-Score + KPIs.

    The service looks for a sheet named *Données Brutes*, *Ratios* or
    *Balance Générale*.  If none match, the first sheet is used.
    """
    # Validate extension
    if not (file.filename or "").lower().endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Please upload an Excel file (.xlsx).",
        )

    try:
        result = await analyze_entreprise(file)
    except CorruptFileError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {exc}",
        ) from exc

    return AnalyseEntrepriseResponse(**result)
