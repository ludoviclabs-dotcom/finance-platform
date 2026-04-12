"""Business logic for the M&A Simulator 2026 module.

Reads deal modelling data from an uploaded Excel file, computes
Enterprise Value, Equity Value, EV/EBITDA multiple, accretion/dilution
on EPS, synergies NPV and IRR.
"""

from __future__ import annotations

from typing import Any

from fastapi import UploadFile

from utils.excel_reader import ExcelReader

# ---------------------------------------------------------------------------
# Sheet name resolution
# ---------------------------------------------------------------------------
_DEAL_CANDIDATES = [
    "1-Deal",
    "Deal",
    "Transaction",
    "Cible",
    "Target",
]
_FINANCING_CANDIDATES = [
    "2-Financement",
    "Financement",
    "Financing",
    "Structure",
]
_SYNERGIES_CANDIDATES = [
    "3-Synergies",
    "Synergies",
    "Synergies & Retour",
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
# 1-Deal:
#   B2 = Chiffre d'affaires cible (K\u20ac)
#   B3 = EBITDA cible (K\u20ac)
#   B4 = R\u00e9sultat net cible (K\u20ac)
#   B5 = Dette nette cible (K\u20ac)
#   B6 = VE propos\u00e9e \u2014 Enterprise Value (K\u20ac)
#   B7 = Secteur (texte)
#
# 2-Financement:
#   B2 = % financement dette
#   B3 = % financement actions
#   B4 = Taux d'int\u00e9r\u00eat dette (%)
#   B5 = Nombre d'actions acqu\u00e9reur (M)
#   B6 = R\u00e9sultat net acqu\u00e9reur (K\u20ac)
#
# 3-Synergies:
#   B2 = Synergies revenus (K\u20ac/an)
#   B3 = Synergies co\u00fbts (K\u20ac/an)
#   B4 = D\u00e9lai de r\u00e9alisation (ans)
#   B5 = Co\u00fbts d'int\u00e9gration (K\u20ac)

# Sectoral benchmarks (median EV/EBITDA, implied P/E)
BENCHMARKS: dict[str, dict[str, float]] = {
    "Technologie":  {"evEbitda": 18, "pe": 25},
    "Industrie":    {"evEbitda": 10, "pe": 15},
    "Sant\u00e9":        {"evEbitda": 14, "pe": 20},
    "Finance":      {"evEbitda": 11, "pe": 12},
    "Consommation": {"evEbitda": 11, "pe": 18},
    "\u00c9nergie":      {"evEbitda":  8, "pe": 10},
}

IS_RATE = 0.25
WACC = 0.08
HORIZON = 10   # years for NPV synergies
SORTIE_AN = 5  # IRR exit horizon


def _extract_deal(reader: ExcelReader, sheet: str) -> dict[str, Any]:
    secteur_raw = ""
    try:
        secteur_raw = str(reader.get_cell(sheet, "B7") or "")
    except Exception:
        pass
    return {
        "ca_cible": _num(reader, sheet, "B2"),
        "ebitda_cible": _num(reader, sheet, "B3"),
        "rn_cible": _num(reader, sheet, "B4"),
        "dette_nette_cible": _num(reader, sheet, "B5"),
        "ve_proposee": _num(reader, sheet, "B6"),
        "secteur": secteur_raw.strip() if secteur_raw.strip() else "Industrie",
    }


def _extract_financing(reader: ExcelReader, sheet: str) -> dict[str, float]:
    return {
        "pct_dette": _num(reader, sheet, "B2"),
        "pct_actions": _num(reader, sheet, "B3"),
        "taux_dette": _num(reader, sheet, "B4"),
        "nb_actions_acquereur": _num(reader, sheet, "B5"),
        "rn_acquereur": _num(reader, sheet, "B6"),
    }


def _extract_synergies(reader: ExcelReader, sheet: str) -> dict[str, float]:
    return {
        "synergies_revenu": _num(reader, sheet, "B2"),
        "synergies_couts": _num(reader, sheet, "B3"),
        "delai_realisation": max(1, _num(reader, sheet, "B4", 3)),
        "cout_integration": _num(reader, sheet, "B5"),
    }


# ---------------------------------------------------------------------------
# Computation engine
# ---------------------------------------------------------------------------

def _compute(
    deal: dict[str, Any],
    fin: dict[str, float],
    syn: dict[str, float],
) -> dict[str, Any]:
    secteur = deal["secteur"]
    bench = BENCHMARKS.get(secteur, BENCHMARKS["Industrie"])

    ca = deal["ca_cible"]
    ebitda = deal["ebitda_cible"]
    rn_cible = deal["rn_cible"]
    dette_nette = deal["dette_nette_cible"]
    ve = deal["ve_proposee"]

    # --- Valuation ---
    multiple_ev_ebitda = round(ve / ebitda, 2) if ebitda > 0 else 0
    multiple_ev_ca = round(ve / ca, 2) if ca > 0 else 0
    equity_value = round(ve - dette_nette, 2)
    prime = round(
        ((multiple_ev_ebitda - bench["evEbitda"]) / bench["evEbitda"]) * 100, 1
    ) if bench["evEbitda"] > 0 else 0

    # --- Financing ---
    pct_dette = fin["pct_dette"]
    pct_actions = fin["pct_actions"]
    pct_cash = max(0, 100 - pct_dette - pct_actions)

    montant_dette = round(ve * pct_dette / 100, 2)
    montant_actions = round(ve * pct_actions / 100, 2)
    montant_cash = round(ve * pct_cash / 100, 2)

    charges_interets = round(
        montant_dette * (fin["taux_dette"] / 100) * (1 - IS_RATE), 2
    )

    nb_actions = fin["nb_actions_acquereur"]
    rn_acq = fin["rn_acquereur"]

    bpa_actuel = (
        round((rn_acq * 1_000) / (nb_actions * 1_000_000), 4)
        if nb_actions > 0
        else 0
    )
    prix_action = bpa_actuel * bench["pe"]
    nouvelles_actions = (
        round((montant_actions * 1_000) / (prix_action * 1_000_000), 2)
        if prix_action > 0
        else 0
    )

    benefice_additionnel = rn_cible - charges_interets
    total_benefice = rn_acq + benefice_additionnel
    total_actions = nb_actions + nouvelles_actions
    bpa_pro_forma = (
        round((total_benefice * 1_000) / (total_actions * 1_000_000), 4)
        if total_actions > 0
        else 0
    )

    accretion_pct = (
        round(((bpa_pro_forma - bpa_actuel) / bpa_actuel) * 100, 2)
        if bpa_actuel > 0
        else 0
    )

    # --- Synergies & IRR ---
    synergies_annuelles = syn["synergies_revenu"] + syn["synergies_couts"]
    delai = syn["delai_realisation"]
    cout_integ = syn["cout_integration"]

    van_synergies = -cout_integ
    for t in range(1, HORIZON + 1):
        ramp = min(t / delai, 1) if delai > 0 else 1
        flux = ramp * synergies_annuelles * (1 - IS_RATE)
        van_synergies += flux / ((1 + WACC) ** t)
    van_synergies = round(van_synergies, 2)

    ebitda_terminal = ebitda + synergies_annuelles
    ve_sortie = ebitda_terminal * bench["evEbitda"]
    dette_initiale = dette_nette + montant_dette
    dette_residuelle = dette_initiale * 0.60
    equity_sortie = max(0, ve_sortie - dette_residuelle)
    equity_investie = montant_actions + montant_cash

    tri = 0.0
    if equity_investie > 0 and equity_sortie > 0:
        tri = round(
            ((equity_sortie / equity_investie) ** (1 / SORTIE_AN) - 1) * 100, 2
        )

    return {
        "secteur": secteur,
        "benchmark_ev_ebitda": bench["evEbitda"],
        "pe_sectoriel": bench["pe"],
        # Valuation
        "ca_cible": ca,
        "ebitda_cible": ebitda,
        "rn_cible": rn_cible,
        "dette_nette_cible": dette_nette,
        "ve_proposee": ve,
        "equity_value": equity_value,
        "multiple_ev_ebitda": multiple_ev_ebitda,
        "multiple_ev_ca": multiple_ev_ca,
        "prime": prime,
        # Financing
        "pct_dette": pct_dette,
        "pct_actions": pct_actions,
        "pct_cash": pct_cash,
        "montant_dette": montant_dette,
        "montant_actions": montant_actions,
        "montant_cash": montant_cash,
        "charges_interets": charges_interets,
        "nouvelles_actions": nouvelles_actions,
        "bpa_actuel": bpa_actuel,
        "bpa_pro_forma": bpa_pro_forma,
        "accretion_pct": accretion_pct,
        # Synergies
        "synergies_revenu": syn["synergies_revenu"],
        "synergies_couts": syn["synergies_couts"],
        "synergies_annuelles": synergies_annuelles,
        "cout_integration": cout_integ,
        "delai_realisation": delai,
        "van_synergies": van_synergies,
        "tri": tri,
    }


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def analyze_ma(file: UploadFile) -> dict[str, Any]:
    """Full M&A analysis: read Excel, compute valuation + financing + synergies.

    Raises:
        utils.excel_reader.CorruptFileError: If the file cannot be parsed.
    """
    reader = await ExcelReader.from_upload(file)

    try:
        sheets = reader.sheet_names

        # --- Deal ---
        deal_sheet = _find_sheet(reader, _DEAL_CANDIDATES)
        if deal_sheet:
            deal = _extract_deal(reader, deal_sheet)
        else:
            deal = {
                "ca_cible": 0, "ebitda_cible": 0, "rn_cible": 0,
                "dette_nette_cible": 0, "ve_proposee": 0, "secteur": "Industrie",
            }

        # --- Financing ---
        fin_sheet = _find_sheet(reader, _FINANCING_CANDIDATES)
        if fin_sheet:
            fin = _extract_financing(reader, fin_sheet)
        else:
            fin = {
                "pct_dette": 0, "pct_actions": 0, "taux_dette": 0,
                "nb_actions_acquereur": 0, "rn_acquereur": 0,
            }

        # --- Synergies ---
        syn_sheet = _find_sheet(reader, _SYNERGIES_CANDIDATES)
        if syn_sheet:
            syn = _extract_synergies(reader, syn_sheet)
        else:
            syn = {
                "synergies_revenu": 0, "synergies_couts": 0,
                "delai_realisation": 3, "cout_integration": 0,
            }

    finally:
        reader.close()

    result = _compute(deal, fin, syn)

    return {
        "filename": file.filename or "unknown.xlsx",
        "sheets": sheets,
        "sheet_count": len(sheets),
        **result,
    }
