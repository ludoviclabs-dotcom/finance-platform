"""
workbook_totals.py — recalcul serveur des agrégats d'un classeur carbone (M-02).

Le modèle distribué jusqu'au 16/09/2026 renvoyait des totaux FIGÉS (Scope 1/2/3
= 1 336 / 934 / 3 685, total 5 955 tCO2e, énergie, taxonomie, coût CBAM) quelles
que soient les saisies. Les classeurs déjà téléchargés circulent encore : le
serveur ne fait donc plus confiance aux cellules de total. Il recompose chaque
agrégat à partir des lignes de détail (elles-mêmes calculées depuis les
données d'activité) et des saisies brutes, selon les règles suivantes :

  * GHG Protocol / méthode BEGES v5 : total réglementaire = Scope 1
    + Scope 2 location-based + Scope 3 ; le market-based est publié à part.
    Scope 2 = électricité + chaleur/vapeur/froid achetés.
  * ESRS E1-5 : part renouvelable = consommation renouvelable / totale.
  * Règlement délégué (UE) 2021/2178 : KPI taxonomie = montant aligné /
    dénominateur ; une activité est alignée si elle est éligible, contribue
    substantiellement à un objectif (renseigné), respecte le DNSH et les
    garanties minimales.
  * Règlement (UE) 2023/956 (CBAM), art. 31 : pendant la sortie progressive
    des quotas gratuits, seule une part des émissions intrinsèques donne lieu
    à certificats — 2,5 % (2026) … 86 % (2033), 100 % dès 2034.

Toutes les fonctions sont pures : `read(sheet, ref)` fournit la valeur
résolue d'une cellule (valeur en cache ou formule évaluée).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Callable

SYNTHESE = "Synthese_GES"
SCOPE1_CELLS = ("C6", "C7", "C8", "C9")
SCOPE2_ELEC_LB = "C13"
SCOPE2_HEAT = "C14"
SCOPE2_ELEC_MB = "C16"
SCOPE3_CELLS = tuple(f"C{r}" for r in range(20, 35))

ENERGIE = "Energie"
ENERGY_NON_RENEWABLE = "E10"
ENERGY_RENEWABLE = "E16"

TAXONOMIE = "Taxonomie"
TAXO_ROWS = range(14, 24)
# Colonne des montants par KPI (CA, CapEx, OpEx) — en-têtes H13/I13/J13.
TAXO_AMOUNT_COLUMNS = {"turnover": "H", "capex": "I", "opex": "J"}

CBAM = "CBAM"
CBAM_ROWS = range(9, 24)

# Part des émissions intrinsèques couverte par des certificats (1 − facteur
# CBAM), directive 2003/87/CE art. 10 bis §1 bis, règl. (UE) 2023/956 art. 31.
CBAM_PAYABLE_SHARE = {
    2026: 0.025,
    2027: 0.05,
    2028: 0.10,
    2029: 0.225,
    2030: 0.485,
    2031: 0.61,
    2032: 0.735,
    2033: 0.86,
}
CBAM_FIRST_YEAR = 2026
CBAM_FULL_YEAR = 2034

# Écart toléré entre un total du classeur et son recalcul avant avertissement.
_TOLERANCE_ABS = 0.5
_TOLERANCE_REL = 0.001

CellReader = Callable[[str, str], Any]


class UnresolvedCell(Exception):
    """Valeur de cellule illisible (erreur Excel, texte au lieu d'un nombre…)."""


@dataclass
class TotalsResult:
    values: dict[str, float | None] = field(default_factory=dict)
    failures: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def cbam_payable_share(year: int | None) -> float | None:
    if year is None:
        return None
    if year < CBAM_FIRST_YEAR:
        return 0.0
    if year >= CBAM_FULL_YEAR:
        return 1.0
    return CBAM_PAYABLE_SHARE[year]


def _to_number(sheet: str, ref: str, value: Any) -> float:
    if value is None or (isinstance(value, str) and not value.strip()):
        return 0.0
    if isinstance(value, bool):
        raise UnresolvedCell(f"{sheet}!{ref} : valeur booléenne inattendue")
    if isinstance(value, (int, float)):
        if value != value:  # NaN
            raise UnresolvedCell(f"{sheet}!{ref} : valeur non numérique")
        return float(value)
    text = str(value).strip()
    if text.startswith("#"):
        raise UnresolvedCell(f"{sheet}!{ref} : erreur de calcul Excel {text}")
    try:
        return float(text.replace("\u202f", "").replace(" ", "").replace(",", "."))
    except ValueError as exc:
        raise UnresolvedCell(f"{sheet}!{ref} : « {text} » n'est pas un nombre") from exc


def _sum(read: CellReader, sheet: str, refs: tuple[str, ...]) -> float:
    return sum(_to_number(sheet, ref, read(sheet, ref)) for ref in refs)


def _text(value: Any) -> str:
    return "" if value is None else str(value).strip().upper()


def _year(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)) and float(value).is_integer():
        return int(value)
    m = re.search(r"(19|20)\d{2}", str(value or ""))
    return int(m.group(0)) if m else None


def _ratio_pct(numerator: float, denominator: float | None) -> float | None:
    if not denominator or denominator <= 0:
        return None
    return round(numerator / denominator * 100, 1)


def _round(value: float) -> float:
    return round(value, 4)


def compute_totals(
    read: CellReader,
    *,
    revenue_eur: float | None,
    fte: float | None,
    capex_eur: float | None,
    opex_eur: float | None,
) -> TotalsResult:
    """Recompose les agrégats du snapshot carbone. Pure."""
    result = TotalsResult()
    values = result.values

    # ── GES ────────────────────────────────────────────────────────────────
    try:
        s1 = _sum(read, SYNTHESE, SCOPE1_CELLS)
        heat = _to_number(SYNTHESE, SCOPE2_HEAT, read(SYNTHESE, SCOPE2_HEAT))
        s2_lb = _to_number(SYNTHESE, SCOPE2_ELEC_LB, read(SYNTHESE, SCOPE2_ELEC_LB)) + heat
        s2_mb = _to_number(SYNTHESE, SCOPE2_ELEC_MB, read(SYNTHESE, SCOPE2_ELEC_MB)) + heat
        s3 = _sum(read, SYNTHESE, SCOPE3_CELLS)
    except UnresolvedCell as exc:
        result.failures.append(f"Émissions non calculables : {exc}.")
    else:
        total = s1 + s2_lb + s3
        values.update({
            "carbon.scope1Tco2e": _round(s1),
            "carbon.scope2LbTco2e": _round(s2_lb),
            "carbon.scope2MbTco2e": _round(s2_mb),
            "carbon.scope3Tco2e": _round(s3),
            "carbon.totalS123Tco2e": _round(total),
            "carbon.intensityRevenueTco2ePerMEur": (
                _round(total / (revenue_eur / 1_000_000)) if revenue_eur and revenue_eur > 0 else None
            ),
            "carbon.intensityFteTco2ePerFte": _round(total / fte) if fte and fte > 0 else None,
            "carbon.shareScope1Pct": _ratio_pct(s1, total),
            "carbon.shareScope2Pct": _ratio_pct(s2_lb, total),
            "carbon.shareScope3Pct": _ratio_pct(s3, total),
        })

    # ── Énergie (ESRS E1-5) ────────────────────────────────────────────────
    try:
        non_renewable = _to_number(ENERGIE, ENERGY_NON_RENEWABLE, read(ENERGIE, ENERGY_NON_RENEWABLE))
        renewable = _to_number(ENERGIE, ENERGY_RENEWABLE, read(ENERGIE, ENERGY_RENEWABLE))
    except UnresolvedCell as exc:
        result.failures.append(f"Consommation d'énergie non calculable : {exc}.")
    else:
        consumption = non_renewable + renewable
        values["energy.consumptionMWh"] = _round(consumption)
        values["energy.renewableSharePct"] = _ratio_pct(renewable, consumption)
        if consumption == 0:
            result.warnings.append(
                "Consommation d'énergie nulle : renseignez la feuille Energie (ESRS E1-5, VSME B3)."
            )

    # ── Taxonomie (art. 8) ─────────────────────────────────────────────────
    denominators = {"turnover": revenue_eur, "capex": capex_eur, "opex": opex_eur}
    try:
        aligned = {kpi: 0.0 for kpi in TAXO_AMOUNT_COLUMNS}
        for row in TAXO_ROWS:
            is_aligned = (
                _text(read(TAXONOMIE, f"C{row}")) == "O"
                and _text(read(TAXONOMIE, f"D{row}")) != ""
                and _text(read(TAXONOMIE, f"E{row}")) == "O"
                and _text(read(TAXONOMIE, f"F{row}")) == "O"
            )
            if not is_aligned:
                continue
            for kpi, col in TAXO_AMOUNT_COLUMNS.items():
                aligned[kpi] += _to_number(TAXONOMIE, f"{col}{row}", read(TAXONOMIE, f"{col}{row}"))
    except UnresolvedCell as exc:
        result.failures.append(f"Indicateurs taxonomie non calculables : {exc}.")
    else:
        values["taxonomy.turnoverAlignedPct"] = _ratio_pct(aligned["turnover"], denominators["turnover"])
        values["taxonomy.capexAlignedPct"] = _ratio_pct(aligned["capex"], denominators["capex"])
        values["taxonomy.opexAlignedPct"] = _ratio_pct(aligned["opex"], denominators["opex"])

    # ── CBAM (estimation) ──────────────────────────────────────────────────
    try:
        declared = [row for row in CBAM_ROWS if _text(read(CBAM, f"B{row}"))]
        if declared:
            year = _year(read(CBAM, "B5"))
            share = cbam_payable_share(year)
            price = _to_number(CBAM, "B4", read(CBAM, "B4"))
            if share is None:
                result.warnings.append(
                    "Coût CBAM non estimé : année des importations absente (CBAM!B5)."
                )
                values["cbam.estimatedCostEur"] = None
            else:
                cost = 0.0
                for row in declared:
                    emissions = _to_number(CBAM, f"I{row}", read(CBAM, f"I{row}"))
                    paid = _to_number(CBAM, f"J{row}", read(CBAM, f"J{row}"))
                    cost += max(0.0, emissions * price * share - emissions * paid)
                values["cbam.estimatedCostEur"] = round(cost, 2)
        else:
            values["cbam.estimatedCostEur"] = 0.0
    except UnresolvedCell as exc:
        result.warnings.append(f"Coût CBAM non estimé : {exc}.")
        values["cbam.estimatedCostEur"] = None

    return result


def differs(workbook_value: Any, computed: float | None) -> bool:
    """True si la valeur du classeur s'écarte du recalcul au-delà de la tolérance."""
    if computed is None or workbook_value is None:
        return False
    try:
        wv = float(workbook_value)
    except (TypeError, ValueError):
        return True
    gap = abs(wv - computed)
    return gap > _TOLERANCE_ABS and gap > _TOLERANCE_REL * max(abs(wv), abs(computed))
