"""Business logic for the Credit Risk IFRS 9 / Bâle IV module.

Reads credit portfolio data from an uploaded Excel file, computes ECL
per stage, RWA, CET1 pro-forma and stage distribution.
"""

from __future__ import annotations

from typing import Any

from fastapi import UploadFile

from utils.excel_reader import ExcelReader

# ---------------------------------------------------------------------------
# Sheet name resolution
# ---------------------------------------------------------------------------
_PORTFOLIO_CANDIDATES = [
    "1-Portefeuille",
    "Portefeuille",
    "Portfolio",
]
_ECL_CANDIDATES = [
    "2-ECL IFRS 9",
    "ECL IFRS 9",
    "ECL",
    "IFRS9",
]
_CET1_CANDIDATES = [
    "4-CET1 Bâle IV",
    "4-CET1 Bale IV",
    "CET1 Bâle IV",
    "CET1",
    "Bâle IV",
    "Bale IV",
]


def _find_sheet(reader: ExcelReader, candidates: list[str]) -> str | None:
    available = reader.sheet_names
    for c in candidates:
        if c in available:
            return c
    return None


def _num(reader: ExcelReader, sheet: str, cell: str, default: float = 0.0) -> float:
    try:
        val = reader.get_cell(sheet, cell)
        if val is None:
            return default
        return float(val)
    except Exception:
        return default


# ---------------------------------------------------------------------------
# Expected cell mappings
# ---------------------------------------------------------------------------
# 1-Portefeuille:
#   B2 = Encours total (K€)
#   B3 = EAD Stage 1 (K€)
#   B4 = EAD Stage 2 (K€)
#   B5 = EAD Stage 3 (K€)
#
# 2-ECL IFRS 9:
#   B2 = ECL Stage 1 (K€)
#   B3 = ECL Stage 2 (K€)
#   B4 = ECL Stage 3 (K€)
#
# 4-CET1 Bâle IV:
#   B2 = RWA totaux (K€)
#   B3 = CET1 capital (K€)
#   B4 = CET1 ratio (%)


def _extract_portfolio(reader: ExcelReader, sheet: str) -> dict[str, float]:
    return {
        "encours_total": _num(reader, sheet, "B2"),
        "ead_s1": _num(reader, sheet, "B3"),
        "ead_s2": _num(reader, sheet, "B4"),
        "ead_s3": _num(reader, sheet, "B5"),
    }


def _extract_ecl(reader: ExcelReader, sheet: str) -> dict[str, float]:
    return {
        "ecl_s1": _num(reader, sheet, "B2"),
        "ecl_s2": _num(reader, sheet, "B3"),
        "ecl_s3": _num(reader, sheet, "B4"),
    }


def _extract_cet1(reader: ExcelReader, sheet: str) -> dict[str, float]:
    return {
        "rwa": _num(reader, sheet, "B2"),
        "cet1_capital": _num(reader, sheet, "B3"),
        "cet1_ratio": _num(reader, sheet, "B4"),
    }


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def analyze_creditrisk(file: UploadFile) -> dict[str, Any]:
    """Full analysis: read Excel → ECL per stage + RWA + CET1.

    Raises:
        utils.excel_reader.CorruptFileError: If the file cannot be parsed.
    """
    reader = await ExcelReader.from_upload(file)

    try:
        sheets = reader.sheet_names

        # --- Portfolio ---
        pf_sheet = _find_sheet(reader, _PORTFOLIO_CANDIDATES)
        if pf_sheet:
            pf = _extract_portfolio(reader, pf_sheet)
        else:
            pf = {"encours_total": 0, "ead_s1": 0, "ead_s2": 0, "ead_s3": 0}

        # --- ECL ---
        ecl_sheet = _find_sheet(reader, _ECL_CANDIDATES)
        if ecl_sheet:
            ecl = _extract_ecl(reader, ecl_sheet)
        else:
            ecl = {"ecl_s1": 0, "ecl_s2": 0, "ecl_s3": 0}

        # --- CET1 ---
        cet1_sheet = _find_sheet(reader, _CET1_CANDIDATES)
        if cet1_sheet:
            cet1 = _extract_cet1(reader, cet1_sheet)
        else:
            cet1 = {"rwa": 0, "cet1_capital": 0, "cet1_ratio": 0}

    finally:
        reader.close()

    # Derived values
    ecl_total = round(ecl["ecl_s1"] + ecl["ecl_s2"] + ecl["ecl_s3"], 2)
    encours = pf["encours_total"]

    # If no explicit encours, sum EADs
    if encours == 0:
        encours = pf["ead_s1"] + pf["ead_s2"] + pf["ead_s3"]

    # Stage distribution (percentages)
    stages = []
    for label, ead_key, ecl_key, color in [
        ("Stage 1", "ead_s1", "ecl_s1", "#22c55e"),  # success green
        ("Stage 2", "ead_s2", "ecl_s2", "#f59e0b"),  # warning amber
        ("Stage 3", "ead_s3", "ecl_s3", "#ef4444"),  # danger red
    ]:
        ead_val = pf[ead_key]
        ecl_val = ecl[ecl_key]
        pct = round((ead_val / encours) * 100, 1) if encours > 0 else 0
        coverage = round((ecl_val / ead_val) * 100, 2) if ead_val > 0 else 0
        stages.append({
            "name": label,
            "ead": ead_val,
            "ecl": ecl_val,
            "pct": pct,
            "coverage": coverage,
            "color": color,
        })

    # CET1 pro-forma: after full ECL deduction
    rwa = cet1["rwa"]
    cet1_capital = cet1["cet1_capital"]
    cet1_ratio_reported = cet1["cet1_ratio"]
    cet1_pro_forma = (
        round(((cet1_capital - ecl_total) / rwa) * 100, 2) if rwa > 0 else 0.0
    )

    # Output floor 72.5 % reference
    output_floor = 72.5

    return {
        "filename": file.filename or "unknown.xlsx",
        "sheets": sheets,
        "sheet_count": len(sheets),
        "encours_total": encours,
        "ecl_total": ecl_total,
        "ecl_s1": ecl["ecl_s1"],
        "ecl_s2": ecl["ecl_s2"],
        "ecl_s3": ecl["ecl_s3"],
        "rwa": rwa,
        "cet1_capital": cet1_capital,
        "cet1_ratio": cet1_ratio_reported,
        "cet1_pro_forma": cet1_pro_forma,
        "output_floor": output_floor,
        "stages": stages,
    }
