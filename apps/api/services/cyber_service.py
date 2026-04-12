"""Business logic for the Gouvernance Cyber module.

Reads cyber-governance data from an uploaded Excel file, computes the
DORA maturity index, ALE, VaR 95 and per-chapter DORA scores for the
radar chart.
"""

from __future__ import annotations

import math
from typing import Any

from fastapi import UploadFile

from utils.excel_reader import ExcelReader

# ---------------------------------------------------------------------------
# Sheet name resolution
# ---------------------------------------------------------------------------
_PARAMS_CANDIDATES = ["PARAMÈTRES", "PARAMETRES", "Paramètres", "Parametres", "Params"]
_FAIR_CANDIDATES = ["FAIR PERT", "Fair PERT", "FAIR", "Scénarios", "Scenarios"]
_DORA_CANDIDATES = ["DORA", "Dora", "Conformité DORA", "Conformite DORA"]


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


# ---------------------------------------------------------------------------
# Expected cell mappings
# ---------------------------------------------------------------------------
# PARAMÈTRES sheet:
#   B2  = Budget IT (K€)
#   B3  = Budget Cyber (K€)
#
# FAIR PERT sheet (3 scenarios in rows 2-4):
#   A2:A4  = Scenario names
#   B2:B4  = Min loss (K€)
#   C2:C4  = Most likely loss (K€)
#   D2:D4  = Max loss (K€)
#   E2:E4  = Probability (% annuel)
#
# DORA sheet (6 chapters in rows 2-7):
#   A2:A7  = Chapter names
#   B2:B7  = Score (0-4)


def _extract_params(reader: ExcelReader, sheet: str) -> dict[str, float]:
    return {
        "budget_it": _num(reader, sheet, "B2"),
        "budget_cyber": _num(reader, sheet, "B3"),
    }


def _extract_fair_scenarios(reader: ExcelReader, sheet: str) -> list[dict[str, float]]:
    """Extract FAIR PERT scenarios (rows 2-4)."""
    scenarios: list[dict[str, float]] = []
    for row in range(2, 5):
        low = _num(reader, sheet, f"B{row}")
        mode = _num(reader, sheet, f"C{row}")
        high = _num(reader, sheet, f"D{row}")
        proba = _num(reader, sheet, f"E{row}")
        scenarios.append({"low": low, "mode": mode, "high": high, "proba": proba})
    return scenarios


# DORA chapters — order matters for the radar chart
_DORA_CHAPTERS = [
    "Gouvernance",
    "Incidents",
    "Tests",
    "Tiers",
    "TIC",
    "Reporting",
]


def _extract_dora_scores(reader: ExcelReader, sheet: str) -> dict[str, float]:
    """Extract per-chapter DORA scores (B2:B7, scale 0-4)."""
    scores: dict[str, float] = {}
    for i, chapter in enumerate(_DORA_CHAPTERS):
        row = i + 2
        scores[chapter] = _num(reader, sheet, f"B{row}")
    return scores


# ---------------------------------------------------------------------------
# Computations
# ---------------------------------------------------------------------------

def _pert_mean(low: float, mode: float, high: float) -> float:
    """PERT weighted mean: (low + 4*mode + high) / 6."""
    return (low + 4 * mode + high) / 6


def _pert_std(low: float, high: float) -> float:
    """PERT standard deviation: (high - low) / 6."""
    return (high - low) / 6


def _compute_ale(scenarios: list[dict[str, float]]) -> float:
    """Annualized Loss Expectancy = sum(mean_loss * proba)."""
    total = 0.0
    for s in scenarios:
        mean_loss = _pert_mean(s["low"], s["mode"], s["high"])
        total += mean_loss * (s["proba"] / 100)
    return round(total, 2)


def _compute_var95(scenarios: list[dict[str, float]]) -> float:
    """Approximate VaR 95% using PERT distributions (normal approx).

    VaR95 ≈ sum(mean_i * proba_i) + 1.645 * sqrt(sum((std_i * proba_i)^2))
    """
    ale = 0.0
    variance_sum = 0.0
    for s in scenarios:
        mean = _pert_mean(s["low"], s["mode"], s["high"])
        std = _pert_std(s["low"], s["high"])
        p = s["proba"] / 100
        ale += mean * p
        variance_sum += (std * p) ** 2
    return round(ale + 1.645 * math.sqrt(variance_sum), 2)


def _compute_maturity_index(dora_scores: dict[str, float]) -> float:
    """Maturity index on 0-100 scale (average of chapter scores / 4 * 100)."""
    if not dora_scores:
        return 0.0
    avg = sum(dora_scores.values()) / len(dora_scores)
    return round((avg / 4) * 100, 1)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def analyze_cyber(file: UploadFile) -> dict[str, Any]:
    """Full analysis pipeline: read Excel → compute maturity + ALE + VaR + DORA radar.

    Raises:
        utils.excel_reader.CorruptFileError: If the file cannot be parsed.
    """
    reader = await ExcelReader.from_upload(file)

    try:
        sheets = reader.sheet_names

        # --- PARAMÈTRES ---
        params_sheet = _find_sheet(reader, _PARAMS_CANDIDATES)
        if params_sheet:
            params = _extract_params(reader, params_sheet)
        else:
            params = {"budget_it": 0.0, "budget_cyber": 0.0}

        # --- FAIR PERT ---
        fair_sheet = _find_sheet(reader, _FAIR_CANDIDATES)
        if fair_sheet:
            scenarios = _extract_fair_scenarios(reader, fair_sheet)
        else:
            scenarios = []

        # --- DORA ---
        dora_sheet = _find_sheet(reader, _DORA_CANDIDATES)
        if dora_sheet:
            dora_scores = _extract_dora_scores(reader, dora_sheet)
        else:
            # Fallback: zeros
            dora_scores = {ch: 0.0 for ch in _DORA_CHAPTERS}

    finally:
        reader.close()

    # Computations
    ale = _compute_ale(scenarios) if scenarios else 0.0
    var95 = _compute_var95(scenarios) if scenarios else 0.0
    maturity_index = _compute_maturity_index(dora_scores)
    ratio_cyber_it = (
        round((params["budget_cyber"] / params["budget_it"]) * 100, 1)
        if params["budget_it"] > 0
        else 0.0
    )

    # Radar data: list of {chapter, score, max}
    radar_data = [
        {"chapter": ch, "score": dora_scores.get(ch, 0), "max": 4}
        for ch in _DORA_CHAPTERS
    ]

    return {
        "filename": file.filename or "unknown.xlsx",
        "sheets": sheets,
        "sheet_count": len(sheets),
        "maturity_index": maturity_index,
        "ale": ale,
        "var95": var95,
        "ratio_cyber_it": ratio_cyber_it,
        "dora_scores": dora_scores,
        "radar_data": radar_data,
    }
