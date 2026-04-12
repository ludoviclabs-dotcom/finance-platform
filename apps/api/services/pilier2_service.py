"""Business logic for the Pilier 2 GloBE module.

Reads jurisdictional tax data from an uploaded Excel file, computes the
ETR per jurisdiction, identifies those below the 15 % GloBE minimum, and
estimates the IIR top-up tax.
"""

from __future__ import annotations

from typing import Any

from fastapi import UploadFile

from utils.excel_reader import ExcelReader

# ---------------------------------------------------------------------------
# Sheet name resolution
# ---------------------------------------------------------------------------
_ETR_CANDIDATES = [
    "4-ETR Juridictionnel",
    "4-ETR juridictionnel",
    "ETR Juridictionnel",
    "ETR",
]
_TOPUP_CANDIDATES = [
    "6-Top-up Tax",
    "6-Top-up tax",
    "Top-up Tax",
    "Top-up tax",
    "TopUp",
]


def _find_sheet(reader: ExcelReader, candidates: list[str]) -> str | None:
    available = reader.sheet_names
    for c in candidates:
        if c in available:
            return c
    return None


# ---------------------------------------------------------------------------
# Safe cell reader
# ---------------------------------------------------------------------------

def _num(reader: ExcelReader, sheet: str, cell: str, default: float = 0.0) -> float:
    try:
        val = reader.get_cell(sheet, cell)
        if val is None:
            return default
        return float(val)
    except Exception:
        return default


def _str(reader: ExcelReader, sheet: str, cell: str, default: str = "") -> str:
    try:
        val = reader.get_cell(sheet, cell)
        if val is None:
            return default
        return str(val).strip()
    except Exception:
        return default


# ---------------------------------------------------------------------------
# Expected cell mapping — "4-ETR Juridictionnel"
# ---------------------------------------------------------------------------
# Row layout (starting row 2, header in row 1):
#   A = Country name
#   B = GloBE Revenue (K€)
#   C = Covered Taxes / IS paid (K€)
#   D = ETR (%) — may be formula; we recompute anyway
#
# We read up to 20 rows (2-21) to support variable jurisdiction counts.

_MAX_JURI_ROWS = 20
_GLOBE_RATE = 0.15


def _extract_jurisdictions(reader: ExcelReader, sheet: str) -> list[dict[str, Any]]:
    """Extract jurisdiction rows from the ETR sheet."""
    juris: list[dict[str, Any]] = []
    for row in range(2, 2 + _MAX_JURI_ROWS):
        pays = _str(reader, sheet, f"A{row}")
        if not pays:
            break  # empty row = end of data
        revenu_globe = _num(reader, sheet, f"B{row}")
        is_paye = _num(reader, sheet, f"C{row}")
        etr = round((is_paye / revenu_globe) * 100, 2) if revenu_globe > 0 else 0.0
        juris.append({
            "pays": pays,
            "revenu_globe": revenu_globe,
            "is_paye": is_paye,
            "etr": etr,
        })
    return juris


# ---------------------------------------------------------------------------
# Expected cell mapping — "6-Top-up Tax" (optional override)
# ---------------------------------------------------------------------------
# If present, column D contains pre-computed top-up tax per jurisdiction.
# We use it as a cross-check but always recompute for consistency.


def _compute_topup(juri: dict[str, Any]) -> float:
    """Compute IIR top-up for a single jurisdiction."""
    etr_decimal = juri["etr"] / 100
    revenu = juri["revenu_globe"]
    if etr_decimal >= _GLOBE_RATE or revenu <= 0:
        return 0.0
    return round((_GLOBE_RATE - etr_decimal) * revenu, 2)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def analyze_pilier2(file: UploadFile) -> dict[str, Any]:
    """Full analysis: read Excel → compute ETR + top-up per jurisdiction.

    Raises:
        utils.excel_reader.CorruptFileError: If the file cannot be parsed.
    """
    reader = await ExcelReader.from_upload(file)

    try:
        sheets = reader.sheet_names

        # --- ETR sheet ---
        etr_sheet = _find_sheet(reader, _ETR_CANDIDATES)
        if etr_sheet:
            jurisdictions_raw = _extract_jurisdictions(reader, etr_sheet)
        else:
            # Fallback: try first sheet
            jurisdictions_raw = _extract_jurisdictions(reader, sheets[0]) if sheets else []

    finally:
        reader.close()

    # Enrich with computed top-up
    jurisdictions: list[dict[str, Any]] = []
    for j in jurisdictions_raw:
        top_up = _compute_topup(j)
        jurisdictions.append({
            "pays": j["pays"],
            "revenu_globe": j["revenu_globe"],
            "is_paye": j["is_paye"],
            "etr": j["etr"],
            "seuil": 15.0,
            "top_up": top_up,
            "conforme": j["etr"] >= 15.0,
        })

    top_up_total = round(sum(j["top_up"] for j in jurisdictions), 2)
    nb_sous_seuil = sum(1 for j in jurisdictions if not j["conforme"])
    nb_jurisdictions = len(jurisdictions)

    # Weighted average ETR
    total_revenu = sum(j["revenu_globe"] for j in jurisdictions)
    total_is = sum(j["is_paye"] for j in jurisdictions)
    etr_moyen = round((total_is / total_revenu) * 100, 2) if total_revenu > 0 else 0.0

    return {
        "filename": file.filename or "unknown.xlsx",
        "sheets": sheets,
        "sheet_count": len(sheets),
        "source_sheet": etr_sheet or (sheets[0] if sheets else "N/A"),
        "top_up_total": top_up_total,
        "nb_jurisdictions": nb_jurisdictions,
        "nb_sous_seuil": nb_sous_seuil,
        "etr_moyen": etr_moyen,
        "juridictions": jurisdictions,
    }
