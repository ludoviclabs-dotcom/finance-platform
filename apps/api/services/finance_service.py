from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from openpyxl import load_workbook

from models.finance import (
    BenchmarkIndicateur,
    BenchmarkSnapshot,
    FinanceClimatSnapshot,
    FinanceQcControl,
    FinanceSnapshotResponse,
    SfdrPaiSnapshot,
)

DEFAULT_WORKBOOK_ROOT = Path(__file__).parent.parent / "data"


def _get_root() -> Path:
    root = os.environ.get("CARBONCO_WORKBOOK_ROOT")
    return Path(root) if root else DEFAULT_WORKBOOK_ROOT


# ---------------------------------------------------------------------------
# Named range → fallback cell (Finance workbook)
# ---------------------------------------------------------------------------
FINANCE_FALLBACKS: dict[str, tuple[str, str]] = {
    "CC_FIN_Raison_Sociale":      ("Liaison_Donnees", "C7"),
    "CC_FIN_Annee_Reporting":     ("Liaison_Donnees", "C8"),
    "CC_FIN_CA_Net":              ("Liaison_Donnees", "C9"),
    "CC_FIN_ETP":                 ("Liaison_Donnees", "C10"),
    "CC_FIN_Code_NAF":            ("Liaison_Donnees", "C11"),
    "CC_FIN_CapEx_Total":         ("Liaison_Donnees", "C12"),
    "CC_FIN_OpEx_Eligible_Taxo":  ("Liaison_Donnees", "C13"),
    "CC_FIN_Scope1":              ("Liaison_Donnees", "C15"),
    "CC_FIN_Scope2_LB":           ("Liaison_Donnees", "C16"),
    "CC_FIN_Scope2_MB":           ("Liaison_Donnees", "C17"),
    "CC_FIN_Scope3":              ("Liaison_Donnees", "C18"),
    "CC_FIN_Total_GES":           ("Liaison_Donnees", "C19"),
    "CC_FIN_Intensite_CA":        ("Liaison_Donnees", "C20"),
    "CC_FIN_Part_Scope3":         ("Liaison_Donnees", "C21"),
    "CC_FIN_Part_ENR":            ("Liaison_Donnees", "C23"),
    "CC_FIN_Taxo_CA_Aligne":      ("Liaison_Donnees", "C24"),
    "CC_FIN_Taxo_CapEx_Aligne":   ("Liaison_Donnees", "C25"),
    "CC_FIN_CBAM_Cout":           ("Liaison_Donnees", "C26"),
    "CC_FIN_SBTI_Taux_S12":       ("Liaison_Donnees", "C28"),
    "CC_FIN_SBTI_Baseline_S12":   ("Liaison_Donnees", "C29"),
    "CC_FIN_SBTI_Annee_Baseline": ("Liaison_Donnees", "C30"),
    "CC_FIN_Prix_ETS":            ("Finance_Climat", "D7"),
    "CC_FIN_Quota_ETS":           ("Finance_Climat", "D9"),
    "CC_FIN_CAGR_Prix_Carbone":   ("Finance_Climat", "D15"),
    "CC_FIN_Exposition_Totale":   ("Finance_Climat", "D12"),
    "CC_FIN_CapEx_Decarb_S12":    ("Finance_Climat", "D46"),
    "CC_FIN_CapEx_Decarb_S3":     ("Finance_Climat", "D47"),
    "CC_FIN_Green_CapEx_Pct":     ("Finance_Climat", "D50"),
}

QC_CONTROLS = [
    ("F-01", "Liaison CA renseigné", "Bloquant"),
    ("F-02", "Liaison GES renseigné", "Bloquant"),
    ("F-03", "Prix EU ETS défini", "Avert."),
    ("F-04", "Au moins 1 action climat", "Avert."),
    ("F-05", "Green CapEx ratio > 10%", "Avert."),
    ("F-06", "CapEx total renseigné", "Bloquant"),
    ("F-07", "Au moins 1 produit DPP", "Avert."),
    ("F-08", "PCF calculé > 0", "Avert."),
    ("F-09", "Secteur benchmark défini", "Avert."),
    ("F-10", "PAI 1-3 SFDR renseignés", "Bloquant"),
    ("F-11", "PAI 10 UNGC renseigné", "Avert."),
    ("F-12", "Score ESG > 40/100", "Avert."),
]

# Benchmark reference data (ADEME/EFRAG sector medians, code NAF 2 digits)
# Structure: {naf_code: {indicator_key: (median, top25)}}
BENCHMARK_REF: dict[str, dict[str, tuple[float, float]]] = {
    "62": {  # Services IT
        "intensite_ca":   (42.0, 20.0),
        "intensite_etp":  (3.2, 1.8),
        "part_scope3":    (78.0, 65.0),
        "part_enr":       (35.0, 60.0),
        "taxo_ca":        (5.0, 15.0),
        "green_capex":    (8.0, 18.0),
    },
    "46": {  # Commerce de gros
        "intensite_ca":   (85.0, 40.0),
        "intensite_etp":  (6.5, 3.0),
        "part_scope3":    (85.0, 72.0),
        "part_enr":       (22.0, 45.0),
        "taxo_ca":        (3.0, 10.0),
        "green_capex":    (5.0, 12.0),
    },
    "default": {
        "intensite_ca":   (65.0, 30.0),
        "intensite_etp":  (5.0, 2.5),
        "part_scope3":    (80.0, 68.0),
        "part_enr":       (28.0, 50.0),
        "taxo_ca":        (4.0, 12.0),
        "green_capex":    (6.0, 15.0),
    },
}

BENCHMARK_LABELS = {
    "intensite_ca":  "Intensité carbone / CA (tCO2e/M€)",
    "intensite_etp": "Intensité carbone / ETP (tCO2e/ETP)",
    "part_scope3":   "Part Scope 3 / total (%)",
    "part_enr":      "Part énergie renouvelable (%)",
    "taxo_ca":       "% CA aligné Taxonomie",
    "green_capex":   "Green CapEx ratio (%)",
}


def _read_cell(wb: Any, sheet: str, cell: str) -> Any:
    try:
        return wb[sheet][cell].value
    except Exception:
        return None


def _read_named(wb: Any, name: str) -> Any:
    try:
        defn = wb.defined_names.get(name)
        if defn:
            dests = list(defn.destinations)
            if dests:
                sheet_name, coord = dests[0]
                coord = coord.replace("$", "")
                return wb[sheet_name][coord].value
    except Exception:
        pass
    fb = FINANCE_FALLBACKS.get(name)
    if fb:
        return _read_cell(wb, fb[0], fb[1])
    return None


def _normalize(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return None
        try:
            n = float(s.replace(",", "."))
            return int(n) if n.is_integer() else round(n, 4)
        except Exception:
            return s
    return v


def _is_filled(v: Any) -> bool:
    return v is not None and str(v).strip() not in ("", "0", "0.0")


def _position(client: float | None, median: float, top25: float, lower_is_better: bool = True) -> str:
    if client is None:
        return "N/A"
    if lower_is_better:
        if client <= top25:
            return "Leader"
        elif client <= median:
            return "Bon"
        elif client <= median * 1.5:
            return "Moyen"
        else:
            return "À améliorer"
    else:
        if client >= top25:
            return "Leader"
        elif client >= median:
            return "Bon"
        elif client >= median * 0.7:
            return "Moyen"
        else:
            return "À améliorer"


def build_finance_snapshot() -> FinanceSnapshotResponse:
    path = _get_root() / "CarbonCo_Finance_DPP_v1_3.xlsx"
    warnings: list[str] = []

    if not path.exists():
        warnings.append(f"Workbook Finance introuvable : {path}")
        wb = None
    else:
        wb = load_workbook(path, read_only=True, data_only=True)

    def r(name: str) -> Any:
        if wb is None:
            return None
        return _normalize(_read_named(wb, name))

    # Finance Climat
    finance_climat = FinanceClimatSnapshot(
        prixEts=r("CC_FIN_Prix_ETS"),
        expositionTotaleEur=r("CC_FIN_Exposition_Totale"),
        cagrPrixCarbone=r("CC_FIN_CAGR_Prix_Carbone"),
        capexDecarbS12Eur=r("CC_FIN_CapEx_Decarb_S12"),
        capexDecarbS3Eur=r("CC_FIN_CapEx_Decarb_S3"),
        greenCapexPct=r("CC_FIN_Green_CapEx_Pct"),
        statutAlignementParis=None,  # computed cell, may need COM fallback
    )

    # SFDR PAI — source: Liaison_Donnees for GES values
    total_ges = r("CC_FIN_Total_GES")
    intensite_ca = r("CC_FIN_Intensite_CA")
    part_enr = r("CC_FIN_Part_ENR")

    sfdr = SfdrPaiSnapshot(
        pai1_totalGes=total_ges,
        pai2_empreinteCarbone=intensite_ca,
        pai3_intensiteGes=intensite_ca,
        pai5_partEnrNonRenouvelablePct=(
            round(100 - float(part_enr), 2)
            if part_enr is not None and str(part_enr) not in ("", "0")
            else None
        ),
        pai6_intensiteEnergie=None,  # requires energy / CA ratio
    )

    # Benchmark
    naf_raw = r("CC_FIN_Code_NAF")
    naf = str(naf_raw)[:2] if naf_raw else "default"
    ref = BENCHMARK_REF.get(naf, BENCHMARK_REF["default"])

    client_values = {
        "intensite_ca":  r("CC_FIN_Intensite_CA"),
        "intensite_etp": None,  # not in Finance workbook
        "part_scope3":   r("CC_FIN_Part_Scope3"),
        "part_enr":      r("CC_FIN_Part_ENR"),
        "taxo_ca":       r("CC_FIN_Taxo_CA_Aligne"),
        "green_capex":   r("CC_FIN_Green_CapEx_Pct"),
    }
    lower_better = {
        "intensite_ca": True, "intensite_etp": True,
        "part_scope3": False, "part_enr": False,
        "taxo_ca": False, "green_capex": False,
    }

    bench_items: list[BenchmarkIndicateur] = []
    for key, (median, top25) in ref.items():
        client_val = client_values.get(key)
        ecart = None
        if client_val is not None:
            try:
                ecart = round((float(client_val) - median) / median * 100, 1)
            except Exception:
                pass
        bench_items.append(BenchmarkIndicateur(
            label=BENCHMARK_LABELS[key],
            valeurClient=client_val,
            medianneSecteur=median,
            top25Pct=top25,
            ecartPct=ecart,
            position=_position(
                float(client_val) if client_val is not None else None,
                median, top25, lower_better[key],
            ),
        ))

    benchmark = BenchmarkSnapshot(
        secteurNaf=naf if naf != "default" else None,
        indicateurs=bench_items,
        nbLeader=sum(1 for i in bench_items if i.position == "Leader"),
        nbAAmeliorer=sum(1 for i in bench_items if i.position == "À améliorer"),
    )

    # QC controls
    qc_results: list[FinanceQcControl] = []
    for ctrl_id, ctrl_label, criticite in QC_CONTROLS:
        statut = _evaluate_finance_qc(ctrl_id, r, wb)
        qc_results.append(FinanceQcControl(
            id=ctrl_id, label=ctrl_label, statut=statut, criticite=criticite,
        ))

    if wb:
        wb.close()

    return FinanceSnapshotResponse(
        generatedAt=datetime.now(timezone.utc).isoformat(),
        financeClimat=finance_climat,
        sfdrPai=sfdr,
        benchmark=benchmark,
        qcControls=qc_results,
        warnings=warnings,
    )


def _evaluate_finance_qc(ctrl_id: str, r: Any, wb: Any) -> str:
    try:
        if ctrl_id == "F-01":
            return "OK" if _is_filled(r("CC_FIN_CA_Net")) else "ERROR"
        elif ctrl_id == "F-02":
            return "OK" if _is_filled(r("CC_FIN_Total_GES")) else "ERROR"
        elif ctrl_id == "F-03":
            prix = r("CC_FIN_Prix_ETS")
            return "OK" if (prix is not None and float(prix) > 0) else "WARNING"
        elif ctrl_id == "F-05":
            gcpx = r("CC_FIN_Green_CapEx_Pct")
            return "OK" if (gcpx is not None and float(gcpx) >= 10) else "WARNING"
        elif ctrl_id == "F-06":
            return "OK" if _is_filled(r("CC_FIN_CapEx_Total")) else "ERROR"
        elif ctrl_id == "F-10":
            return "OK" if _is_filled(r("CC_FIN_Total_GES")) else "ERROR"
        else:
            return "INFO"
    except Exception:
        return "UNKNOWN"
