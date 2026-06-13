"""
seed_emission_factors.py — Import du CSV officiel ADEME Base Empreinte® dans
emission_factors (T1.2 du PLAN_ACTION_CARBONCO).

Différence avec seed_factors.py : ce script importe l'EXPORT CSV OFFICIEL de la
Base Empreinte (téléchargé manuellement avec un compte ADEME gratuit), incluant
les **ratios monétaires** (kgCO2e/€) indispensables au screening FEC (T4.3).
seed_factors.py reste la fixture dev/test (valeurs recopiées à la main).

Procédure et licence : voir scripts/README_ADEME.md. Le CSV brut ne doit PAS
être committé (apps/api/data/ademe/ est dans .gitignore).

Usage :
    python apps/api/scripts/seed_emission_factors.py --csv apps/api/data/ademe/base_empreinte.csv [--version v2025] [--dry-run]
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent.parent))

from db.database import db_available, get_db

SOURCE = "ADEME Base Empreinte"
DEFAULT_VERSION = "v2025"

# Noms de colonnes de l'export Base Empreinte (FR). Tolérant aux variations
# mineures : on cherche par sous-chaîne insensible à la casse.
COLUMN_HINTS = {
    "id": ["identifiant de l'élément", "identifiant", "id de l'élément"],
    "label": ["nom base français", "nom base", "nom français"],
    "attribute": ["nom attribut français", "nom attribut"],
    "category": ["code de la catégorie", "catégorie", "code categorie"],
    "unit": ["unité français", "unite francais", "unité"],
    "factor": ["total poste non décomposé", "total poste", "valeur", "facteur"],
}


def _resolve_columns(header: list[str]) -> dict[str, str | None]:
    """Associe nos clés logiques aux noms de colonnes réels du CSV."""
    resolved: dict[str, str | None] = {}
    lowered = {h.lower().strip(): h for h in header}
    for key, hints in COLUMN_HINTS.items():
        found = None
        for hint in hints:
            for low, original in lowered.items():
                if hint in low:
                    found = original
                    break
            if found:
                break
        resolved[key] = found
    return resolved


def _slug(text: str) -> str:
    s = re.sub(r"[^A-Za-z0-9]+", "_", (text or "").strip().upper()).strip("_")
    return s[:60] or "NA"


def _to_float(raw: Any) -> float | None:
    if raw is None:
        return None
    s = str(raw).strip().replace(" ", "").replace(" ", "")
    if not s:
        return None
    s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def _unit_denominator(unit_raw: str) -> str:
    """`kgCO2e/kWh` -> `kWh` ; `kgCO2e/€` -> `€` ; sinon la chaîne telle quelle."""
    u = (unit_raw or "").strip()
    if "/" in u:
        return u.split("/")[-1].strip()
    return u


def normalize_rows(rows: list[dict[str, str]], header: list[str], version: str) -> list[dict[str, Any]]:
    """Transforme les lignes brutes du CSV ADEME en lignes emission_factors.

    Fonction pure (testable sans DB). Ignore les lignes sans facteur numérique.
    """
    cols = _resolve_columns(header)
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in rows:
        factor = _to_float(row.get(cols["factor"] or "", ""))
        if factor is None:
            continue
        ident = (row.get(cols["id"] or "", "") or "").strip()
        label = (row.get(cols["label"] or "", "") or "").strip()
        attribute = (row.get(cols["attribute"] or "", "") or "").strip() if cols["attribute"] else ""
        full_label = f"{label} — {attribute}" if attribute else label
        unit = _unit_denominator(row.get(cols["unit"] or "", ""))
        category_raw = (row.get(cols["category"] or "", "") or "").strip()
        category = category_raw.split(">")[0].strip().lower() or None

        slug = _slug(ident or label)
        ef_code = f"ADEME.{version}.{slug}"
        # Dé-doublonnage sur (ef_code) : la contrainte DB est (ef_code, version).
        if ef_code in seen:
            ef_code = f"{ef_code}.{len(seen)}"
        seen.add(ef_code)

        out.append({
            "ef_code": ef_code,
            "label": full_label or ef_code,
            "scope": None,  # ADEME transverse — scope déterminé à l'usage
            "category": category,
            "factor_kgco2e": factor,
            "unit": unit or "unité",
            "is_monetary": unit in ("€", "EUR", "euro", "Euro"),
            "raw": row,
        })
    return out


def parse_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    """Lit le CSV (détection séparateur + encodage). Retourne (header, rows)."""
    data: str | None = None
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            data = path.read_text(encoding=encoding)
            break
        except UnicodeDecodeError:
            continue
    if data is None:
        raise RuntimeError(f"Impossible de décoder {path}")

    first_line = data.split("\n", 1)[0]
    sep = ";" if first_line.count(";") >= first_line.count(",") else ","
    reader = csv.DictReader(io.StringIO(data), delimiter=sep)
    header = reader.fieldnames or []
    rows = [dict(r) for r in reader]
    return header, rows


def seed(csv_path: Path, version: str = DEFAULT_VERSION, dry_run: bool = False) -> int:
    header, rows = parse_csv(csv_path)
    normalized = normalize_rows(rows, header, version)
    monetary = sum(1 for r in normalized if r["is_monetary"])
    print(f"[INFO] {len(normalized)} facteurs normalisés ({monetary} ratios monétaires kgCO2e/€).")

    if dry_run:
        print(f"[DRY-RUN] {len(normalized)} facteurs seraient insérés (version {version}).")
        return len(normalized)
    if not db_available():
        print("[WARN] DATABASE_URL absent — skip insertion.")
        return 0

    inserted = 0
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT to_regclass('public.emission_factors')::text")
            if cur.fetchone()[0] is None:
                migration = Path(__file__).parent.parent / "db" / "migrations" / "001_emission_factors.sql"
                cur.execute(migration.read_text(encoding="utf-8"))
                print("[INFO] Table emission_factors créée.")
            for r in normalized:
                try:
                    cur.execute(
                        """
                        INSERT INTO emission_factors
                            (ef_code, label, scope, category, factor_kgco2e, unit, source, version, raw)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (ef_code, version) DO UPDATE
                            SET label=EXCLUDED.label,
                                factor_kgco2e=EXCLUDED.factor_kgco2e,
                                unit=EXCLUDED.unit,
                                category=EXCLUDED.category,
                                raw=EXCLUDED.raw
                        """,
                        (
                            r["ef_code"], r["label"], r["scope"], r["category"],
                            r["factor_kgco2e"], r["unit"], SOURCE, version,
                            json.dumps(r["raw"], ensure_ascii=False),
                        ),
                    )
                    inserted += 1
                except Exception as exc:
                    print(f"[WARN] Skip {r['ef_code']}: {exc}")
    print(f"[OK] {inserted} facteurs insérés/mis à jour (version {version}).")
    return inserted


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed emission_factors depuis le CSV ADEME Base Empreinte")
    parser.add_argument("--csv", required=True, help="Chemin du CSV d'export Base Empreinte")
    parser.add_argument("--version", default=DEFAULT_VERSION, help=f"Version (défaut: {DEFAULT_VERSION})")
    parser.add_argument("--dry-run", action="store_true", help="Simuler sans écrire en DB")
    args = parser.parse_args()
    count = seed(Path(args.csv), version=args.version, dry_run=args.dry_run)
    sys.exit(0 if count >= 0 else 1)
