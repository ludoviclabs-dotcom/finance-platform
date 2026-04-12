"""Router for the Pilier 2 GloBE module."""

from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from services.pilier2_service import analyze_pilier2
from utils.excel_reader import CorruptFileError

router = APIRouter()


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class JurisdictionResult(BaseModel):
    pays: str
    revenu_globe: float = Field(description="GloBE revenue (K\u20AC)")
    is_paye: float = Field(description="Covered taxes paid (K\u20AC)")
    etr: float = Field(description="Effective Tax Rate (%)")
    seuil: float = Field(default=15.0, description="GloBE minimum rate (%)")
    top_up: float = Field(description="IIR top-up tax (K\u20AC)")
    conforme: bool = Field(description="True if ETR >= 15 %")


class Pilier2AnalysisResponse(BaseModel):
    """JSON payload returned to the frontend."""

    filename: str
    sheets: list[str]
    sheet_count: int
    source_sheet: str

    top_up_total: float = Field(description="Total IIR top-up tax (K\u20AC)")
    nb_jurisdictions: int
    nb_sous_seuil: int = Field(description="Jurisdictions with ETR < 15 %")
    etr_moyen: float = Field(description="Weighted average ETR (%)")
    juridictions: list[JurisdictionResult]


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.post("/analyze", response_model=Pilier2AnalysisResponse)
async def analyze(
    file: UploadFile = File(..., description="Excel file (.xlsx) with Pilier 2 data"),
) -> Pilier2AnalysisResponse:
    """Upload an Excel file and receive ETR + top-up tax per jurisdiction.

    Expected sheets: 4-ETR Juridictionnel, 6-Top-up Tax.
    """
    if not (file.filename or "").lower().endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Please upload an Excel file (.xlsx).",
        )

    try:
        result = await analyze_pilier2(file)
    except CorruptFileError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {exc}",
        ) from exc

    return Pilier2AnalysisResponse(**result)
