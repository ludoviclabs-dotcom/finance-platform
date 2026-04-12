"""Router for the M&A Simulator 2026 module."""

from __future__ import annotations

from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, UploadFile, File

from services.ma_service import analyze_ma
from utils.excel_reader import CorruptFileError

router = APIRouter()


# ---------------------------------------------------------------------------
# Response model
# ---------------------------------------------------------------------------

class MAAnalysisResponse(BaseModel):
    """JSON payload returned to the frontend."""

    filename: str
    sheets: list[str]
    sheet_count: int

    # Context
    secteur: str
    benchmark_ev_ebitda: float
    pe_sectoriel: float

    # Target financials
    ca_cible: float = Field(description="Chiffre d'affaires cible (K€)")
    ebitda_cible: float = Field(description="EBITDA cible (K€)")
    rn_cible: float = Field(description="Résultat net cible (K€)")
    dette_nette_cible: float = Field(description="Dette nette cible (K€)")
    ve_proposee: float = Field(description="Enterprise Value proposée (K€)")
    equity_value: float = Field(description="Equity Value (K€)")

    # Multiples
    multiple_ev_ebitda: float
    multiple_ev_ca: float
    prime: float = Field(description="Prime vs benchmark sectoriel (%)")

    # Financing
    pct_dette: float
    pct_actions: float
    pct_cash: float
    montant_dette: float = Field(description="K€")
    montant_actions: float = Field(description="K€")
    montant_cash: float = Field(description="K€")
    charges_interets: float = Field(description="Charge d'intérêts after-tax (K€/an)")
    nouvelles_actions: float = Field(description="Nouvelles actions émises (M)")

    # EPS accretion/dilution
    bpa_actuel: float = Field(description="BPA actuel acquéreur (€)")
    bpa_pro_forma: float = Field(description="BPA pro forma (€)")
    accretion_pct: float = Field(description="Accrétion (+) / Dilution (-) (%)")

    # Synergies
    synergies_revenu: float = Field(description="K€/an")
    synergies_couts: float = Field(description="K€/an")
    synergies_annuelles: float = Field(description="Total synergies brutes (K€/an)")
    cout_integration: float = Field(description="Coûts one-time (K€)")
    delai_realisation: float = Field(description="Années")
    van_synergies: float = Field(description="VAN synergies 10 ans (K€)")
    tri: float = Field(description="TRI estimé 5 ans (%)")


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.post("/analyze", response_model=MAAnalysisResponse)
async def analyze(
    file: UploadFile = File(..., description="Excel file (.xlsx) with M&A deal data"),
) -> MAAnalysisResponse:
    """Upload an Excel file and receive full M&A deal analysis.

    Expected sheets: 1-Deal, 2-Financement, 3-Synergies.
    """
    if not (file.filename or "").lower().endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Please upload an Excel file (.xlsx).",
        )

    try:
        result = await analyze_ma(file)
    except CorruptFileError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {exc}",
        ) from exc

    return MAAnalysisResponse(**result)
