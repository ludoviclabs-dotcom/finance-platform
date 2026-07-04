"""
csv_import_parsers.py — T5.4 : parseurs de fichiers exportés manuellement.

AWS Customer Carbon Footprint (CSV), GCP Carbon Footprint (CSV), Qonto (CSV
transactions). Tout est PUR (prend des bytes → dict) → testable sans DB. Aucune
dépendance externe : `csv` (stdlib) + détection d'encodage maison (utf-8 → cp1252
→ iso-8859-1, comme fec_parser). AWS/GCP donnent des émissions directes, Qonto un
flux monétaire (pré-screening, cf. T4.3).
"""

from __future__ import annotations

import csv
import io
from typing import Any

MAX_IMPORT_ROWS = 100_000


class ImportParseError(Exception):
    """Fichier d'import illisible ou non conforme."""


def _decode(data: bytes) -> tuple[str, str]:
    # cp1252 AVANT iso-8859-1 (cf. fec_parser) : iso-8859-1 ne lève jamais.
    for enc in ("utf-8-sig", "utf-8", "cp1252", "iso-8859-1"):
        try:
            return data.decode(enc), enc
        except UnicodeDecodeError:
            continue
    raise ImportParseError("Encodage non reconnu (UTF-8, CP1252, ISO-8859-1 essayés).")


def _read_rows(data: bytes) -> tuple[list[dict[str, str]], str]:
    text, encoding = _decode(data)
    sample = text[:4096]
    delimiter = ";" if sample.count(";") > sample.count(",") else ","
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    if not reader.fieldnames:
        raise ImportParseError("En-tête CSV introuvable.")
    rows: list[dict[str, str]] = []
    for i, row in enumerate(reader):
        if i >= MAX_IMPORT_ROWS:
            raise ImportParseError(f"Fichier trop volumineux (> {MAX_IMPORT_ROWS} lignes).")
        rows.append({(k or "").strip(): (v or "").strip() for k, v in row.items()})
    if not rows:
        raise ImportParseError("Aucune ligne de données.")
    return rows, encoding


def _find_col(fieldnames: list[str], *needles: str) -> str | None:
    """Première colonne dont le nom (minuscule) contient l'un des needles."""
    low = {f.lower(): f for f in fieldnames}
    for needle in needles:
        for lname, original in low.items():
            if needle in lname:
                return original
    return None


def _to_float(value: str) -> float:
    v = (value or "").strip().replace(" ", "").replace(" ", "").replace(",", ".")
    if not v:
        return 0.0
    try:
        return float(v)
    except ValueError:
        return 0.0


def aws_ccft_parse(data: bytes) -> dict[str, Any]:
    """AWS Customer Carbon Footprint Tool : émissions en MTCO2e (tonnes)."""
    rows, encoding = _read_rows(data)
    fields = list(rows[0].keys())
    svc_col = _find_col(fields, "service", "product", "category")
    em_col = _find_col(fields, "emission", "mtco2e", "tco2e", "carbon", "co2")
    if em_col is None:
        raise ImportParseError("Colonne d'émissions introuvable (attendu 'emissions'/'MTCO2e').")
    kg = "kg" in em_col.lower()
    out_rows, total = [], 0.0
    for r in rows:
        val = _to_float(r[em_col])
        tco2e = val / 1000.0 if kg else val
        out_rows.append({"service": r.get(svc_col, "") if svc_col else "", "tco2e": round(tco2e, 6)})
        total += tco2e
    return {"encoding": encoding, "row_count": len(out_rows),
            "total_tco2e": round(total, 6), "rows": out_rows}


def gcp_carbon_parse(data: bytes) -> dict[str, Any]:
    """GCP Carbon Footprint : émissions en kgCO2e par défaut."""
    rows, encoding = _read_rows(data)
    fields = list(rows[0].keys())
    svc_col = _find_col(fields, "service", "product", "sku")
    em_col = _find_col(fields, "carbon_footprint", "emission", "kgco2e", "tco2e", "co2")
    if em_col is None:
        raise ImportParseError("Colonne d'émissions introuvable (attendu 'carbon_footprint_kgCO2e').")
    tonnes = "tco2e" in em_col.lower() or "mtco2e" in em_col.lower()
    out_rows, total = [], 0.0
    for r in rows:
        val = _to_float(r[em_col])
        tco2e = val if tonnes else val / 1000.0
        out_rows.append({"service": r.get(svc_col, "") if svc_col else "", "tco2e": round(tco2e, 6)})
        total += tco2e
    return {"encoding": encoding, "row_count": len(out_rows),
            "total_tco2e": round(total, 6), "rows": out_rows}


def qonto_parse(data: bytes) -> dict[str, Any]:
    """Qonto : export CSV des transactions (flux monétaire). On ne retient que
    les DÉBITS (dépenses) pour le pré-screening Scope 3 monétaire."""
    rows, encoding = _read_rows(data)
    fields = list(rows[0].keys())
    amt_col = _find_col(fields, "amount", "montant", "debit", "débit")
    lbl_col = _find_col(fields, "label", "libellé", "libelle", "reference", "counterparty", "description")
    cat_col = _find_col(fields, "category", "catégorie", "categorie")
    if amt_col is None:
        raise ImportParseError("Colonne de montant introuvable (attendu 'amount').")
    side_col = _find_col(fields, "side", "sens", "type")
    out_rows, total_spend = [], 0.0
    for r in rows:
        amount = _to_float(r[amt_col])
        side = (r.get(side_col, "") if side_col else "").lower()
        # Dépense = montant négatif, ou side=debit. On normalise en valeur absolue.
        is_expense = amount < 0 or side in ("debit", "débit", "debet")
        spend = abs(amount)
        if not is_expense or spend == 0:
            continue
        label = r.get(lbl_col, "") if lbl_col else ""
        category = r.get(cat_col, "") if cat_col else ""
        out_rows.append({"label": label, "qonto_category": category, "spend": round(spend, 2)})
        total_spend += spend
    return {"encoding": encoding, "row_count": len(out_rows),
            "total_spend": round(total_spend, 2), "rows": out_rows}
