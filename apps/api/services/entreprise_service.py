"""Business logic for the Analyse d'Entreprise module.

Reads financial data from an uploaded Excel file, computes the Altman
Z-Score (Z'' variant for private companies) and core KPIs, then returns
a structured result dict ready for serialisation.
"""

from __future__ import annotations

from typing import Any

from fastapi import UploadFile

from utils.excel_reader import ExcelReader

# ---------------------------------------------------------------------------
# Sheet name resolution — try common French labels, then fall back to first
# ---------------------------------------------------------------------------
_CANDIDATE_SHEETS = [
    "Données Brutes",
    "Donnees Brutes",
    "Ratios",
    "Balance Générale",
    "Balance Generale",
    "Bilan",
    "Data",
]


def _resolve_sheet(reader: ExcelReader) -> str:
    """Return the first matching sheet name or the first available sheet."""
    available = reader.sheet_names
    for candidate in _CANDIDATE_SHEETS:
        if candidate in available:
            return candidate
    # Fallback: use the very first sheet
    return available[0]


# ---------------------------------------------------------------------------
# Safe cell reader
# ---------------------------------------------------------------------------

def _num(reader: ExcelReader, sheet: str, cell: str, default: float = 0.0) -> float:
    """Read a numeric cell value, returning *default* on any failure."""
    try:
        val = reader.get_cell(sheet, cell)
        if val is None:
            return default
        return float(val)
    except Exception:
        return default


# ---------------------------------------------------------------------------
# Expected cell mapping (can be overridden later via config / mapping sheet)
# ---------------------------------------------------------------------------
# Row layout assumption for the "Données Brutes" sheet:
#   B2  = Chiffre d'affaires N
#   B3  = Chiffre d'affaires N-1
#   B4  = EBE (EBITDA)
#   B5  = EBIT
#   B6  = Résultat net
#   B7  = Total Actif
#   B8  = Capitaux propres
#   B9  = Dettes financières
#   B10 = BFR
#   B11 = Trésorerie nette


def _extract_financials(reader: ExcelReader, sheet: str) -> dict[str, float]:
    """Extract the raw financial figures from the resolved sheet."""
    return {
        "ca_n": _num(reader, sheet, "B2"),
        "ca_n1": _num(reader, sheet, "B3"),
        "ebe": _num(reader, sheet, "B4"),
        "ebit": _num(reader, sheet, "B5"),
        "resultat_net": _num(reader, sheet, "B6"),
        "total_actif": _num(reader, sheet, "B7"),
        "capitaux_propres": _num(reader, sheet, "B8"),
        "dettes_financieres": _num(reader, sheet, "B9"),
        "bfr": _num(reader, sheet, "B10"),
        "tresorerie": _num(reader, sheet, "B11"),
    }


# ---------------------------------------------------------------------------
# Altman Z-Score Z'' (private firms, 1995 revision)
# ---------------------------------------------------------------------------
# Z'' = 6.56·X1 + 3.26·X2 + 6.72·X3 + 1.05·X4
#   X1 = BFR / Total Actif
#   X2 = Capitaux propres / Total Actif
#   X3 = EBIT / Total Actif
#   X4 = Capitaux propres / Dettes financières

def _compute_z_score(f: dict[str, float]) -> float:
    ta = f["total_actif"]
    if ta == 0:
        return 0.0
    x1 = f["bfr"] / ta
    x2 = f["capitaux_propres"] / ta
    x3 = f["ebit"] / ta
    x4 = f["capitaux_propres"] / f["dettes_financieres"] if f["dettes_financieres"] != 0 else 9.99
    return round(6.56 * x1 + 3.26 * x2 + 6.72 * x3 + 1.05 * x4, 2)


# ---------------------------------------------------------------------------
# KPIs
# ---------------------------------------------------------------------------

def _compute_kpis(f: dict[str, float]) -> dict[str, float]:
    ca = f["ca_n"]
    ca_prev = f["ca_n1"]

    croissance_ca = round(((ca - ca_prev) / ca_prev) * 100, 2) if ca_prev != 0 else 0.0
    marge_ebe = round((f["ebe"] / ca) * 100, 2) if ca != 0 else 0.0
    ratio_endettement = (
        round((f["dettes_financieres"] / f["capitaux_propres"]) * 100, 2)
        if f["capitaux_propres"] != 0
        else 0.0
    )
    roe = (
        round((f["resultat_net"] / f["capitaux_propres"]) * 100, 2)
        if f["capitaux_propres"] != 0
        else 0.0
    )
    bfr_jours = round((f["bfr"] / ca) * 365, 0) if ca != 0 else 0.0
    tresorerie_nette = f["tresorerie"]

    return {
        "croissance_ca": croissance_ca,
        "marge_ebe": marge_ebe,
        "ratio_endettement": ratio_endettement,
        "roe": roe,
        "bfr_jours": bfr_jours,
        "tresorerie_nette": tresorerie_nette,
    }


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def analyze_entreprise(file: UploadFile) -> dict[str, Any]:
    """Full analysis pipeline: read Excel → compute Z-Score + KPIs.

    Returns a dict matching the ``AnalyseEntrepriseResponse`` schema.

    Raises:
        utils.excel_reader.CorruptFileError: If the file cannot be parsed.
    """
    reader = await ExcelReader.from_upload(file)

    try:
        sheets = reader.sheet_names
        sheet = _resolve_sheet(reader)
        financials = _extract_financials(reader, sheet)
        z_score = _compute_z_score(financials)
        kpis = _compute_kpis(financials)
    finally:
        reader.close()

    return {
        "filename": file.filename or "unknown.xlsx",
        "sheets": sheets,
        "sheet_count": len(sheets),
        "source_sheet": sheet,
        "z_score": z_score,
        **kpis,
    }
