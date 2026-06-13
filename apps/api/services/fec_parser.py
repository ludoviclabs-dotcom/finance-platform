"""
fec_parser.py — T4.3 : parseur FEC (Fichier des Écritures Comptables).

Format art. A.47 A-1 du LPF : 18 champs, séparateur `|` ou tabulation, encodage
détecté (UTF-8 → ISO-8859-1 → CP1252, sans dépendance externe). Valide
l'équilibre débit/crédit, extrait l'exercice, détecte les doublons. Fonction
PURE (prend des bytes) → testable sans DB.
"""

from __future__ import annotations

from typing import Any

FEC_FIELDS = [
    "JournalCode", "JournalLib", "EcritureNum", "EcritureDate", "CompteNum",
    "CompteLib", "CompAuxNum", "CompAuxLib", "PieceRef", "PieceDate",
    "EcritureLib", "Debit", "Credit", "EcritureLet", "DateLet", "ValidDate",
    "Montantdevise", "Idevise",
]

MAX_FEC_ROWS = 100_000


class FecError(Exception):
    """FEC illisible ou non conforme."""


def _decode(data: bytes) -> tuple[str, str]:
    for enc in ("utf-8-sig", "utf-8", "iso-8859-1", "cp1252"):
        try:
            return data.decode(enc), enc
        except UnicodeDecodeError:
            continue
    raise FecError("Encodage non reconnu (UTF-8, ISO-8859-1, CP1252 essayés).")


def _to_decimal(value: str) -> float:
    v = (value or "").strip().replace(" ", "").replace(" ", "").replace(",", ".")
    if not v:
        return 0.0
    try:
        return float(v)
    except ValueError:
        return 0.0


def parse_fec(data: bytes) -> dict[str, Any]:
    """Parse un FEC brut. Retourne rows + métadonnées + équilibre + anomalies."""
    text, encoding = _decode(data)
    lines = [ln for ln in text.splitlines() if ln.strip()]
    if not lines:
        raise FecError("Fichier vide.")

    header = lines[0]
    sep = "\t" if header.count("\t") >= header.count("|") and "\t" in header else "|"
    if sep not in header:
        raise FecError("Séparateur introuvable (attendu `|` ou tabulation).")

    cols = [c.strip().lstrip("﻿") for c in header.split(sep)]
    # Index des colonnes attendues (insensible à la casse).
    lower = {c.lower(): i for i, c in enumerate(cols)}
    idx = {f: lower.get(f.lower()) for f in FEC_FIELDS}
    missing = [f for f in ("CompteNum", "Debit", "Credit", "EcritureDate") if idx[f] is None]
    if missing:
        raise FecError(f"Colonnes FEC obligatoires manquantes : {', '.join(missing)}.")

    data_lines = lines[1:]
    if len(data_lines) > MAX_FEC_ROWS:
        raise FecError(f"FEC trop volumineux ({len(data_lines)} lignes > {MAX_FEC_ROWS}).")

    rows: list[dict[str, Any]] = []
    total_debit = total_credit = 0.0
    years: set[str] = set()
    seen: set[tuple] = set()
    duplicates = 0

    for n, line in enumerate(data_lines, start=2):
        parts = line.split(sep)
        if len(parts) < len(cols):
            parts += [""] * (len(cols) - len(parts))
        row: dict[str, Any] = {f: (parts[idx[f]] if idx[f] is not None else "") for f in FEC_FIELDS}
        debit = _to_decimal(row["Debit"])
        credit = _to_decimal(row["Credit"])
        row["Debit"], row["Credit"], row["line"] = debit, credit, n
        total_debit += debit
        total_credit += credit
        ecr_date = (row["EcritureDate"] or "").strip()
        if len(ecr_date) >= 4 and ecr_date[:4].isdigit():
            years.add(ecr_date[:4])
        key = (row["JournalCode"], row["EcritureNum"], row["CompteNum"], debit, credit)
        if key in seen:
            duplicates += 1
        seen.add(key)
        rows.append(row)

    balanced = abs(total_debit - total_credit) < 0.01
    issues: list[str] = []
    if not balanced:
        issues.append(f"Déséquilibre débit/crédit ({total_debit:.2f} ≠ {total_credit:.2f}).")
    if duplicates:
        issues.append(f"{duplicates} ligne(s) en doublon détectée(s).")

    return {
        "encoding": encoding,
        "separator": "tab" if sep == "\t" else "|",
        "row_count": len(rows),
        "total_debit": round(total_debit, 2),
        "total_credit": round(total_credit, 2),
        "balanced": balanced,
        "exercise_year": max(years) if years else None,
        "duplicates": duplicates,
        "issues": issues,
        "rows": rows,
    }
