"""
scope3_service.py — T4.1 : 15 catégories Scope 3 (GHG Protocol).

Convention de code : chaque catégorie est un code de fact distinct
`CC.GES.SCOPE3.<n>` (n = 1..15) — Modèle B retenu (cf. revue d'architecture) :
chaque catégorie a son propre code, donc `facts_current` (PK company_id, code)
fonctionne SANS modification de schéma ni de compute_hash. Le breakdown agrège
facts_current par ces codes ; `CC.GES.SCOPE3` (sans suffixe) reste l'agrégat
historique « non catégorisé ». Les 15 catégories sont toujours affichées (0 si
non évaluée) — honnêteté sur la couverture partielle.
"""

from __future__ import annotations

import json
import os
import re
from functools import lru_cache
from typing import Any

from db.database import db_available, get_db

_DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "scope3_categories.json")

SCOPE3_PREFIX = "CC.GES.SCOPE3"
SCOPE3_AGGREGATE_CODE = "CC.GES.SCOPE3"
_CAT_CODE_RE = re.compile(r"^CC\.GES\.SCOPE3\.(\d{1,2})$")


@lru_cache(maxsize=1)
def _catalog() -> dict[str, Any]:
    with open(_DATA_PATH, encoding="utf-8") as f:
        return json.load(f)


def categories() -> list[dict[str, Any]]:
    return list(_catalog()["categories"])


def category_label(n: int) -> str | None:
    return next((c["label"] for c in categories() if c["code"] == n), None)


def code_for(n: int) -> str:
    """Code de fact pour la catégorie n (1..15)."""
    if not 1 <= n <= 15:
        raise ValueError(f"Catégorie Scope 3 invalide : {n} (attendu 1..15).")
    return f"{SCOPE3_PREFIX}.{n}"


def category_of(code: str) -> int | None:
    m = _CAT_CODE_RE.match(code or "")
    return int(m.group(1)) if m else None


def aggregate_breakdown(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Agrège des lignes {code, value} par catégorie Scope 3. Fonction PURE.

    Retourne les 15 catégories (0 si non évaluée), la couverture, l'agrégat non
    catégorisé (CC.GES.SCOPE3) et le total.
    """
    per_cat: dict[int, float] = {n: 0.0 for n in range(1, 16)}
    uncategorized = 0.0
    for r in rows:
        code = r.get("code")
        val = r.get("value")
        if val is None:
            continue
        n = category_of(code)
        if n is not None:
            per_cat[n] += float(val)
        elif code == SCOPE3_AGGREGATE_CODE:
            uncategorized += float(val)

    categorized_total = sum(per_cat.values())
    coverage = sorted(n for n, v in per_cat.items() if v > 0)
    return {
        "categories": [
            {"code": n, "label": category_label(n), "value": round(per_cat[n], 6), "evaluated": per_cat[n] > 0}
            for n in range(1, 16)
        ],
        "coverage": coverage,
        "coverage_count": len(coverage),
        "categorized_total": round(categorized_total, 6),
        "uncategorized_total": round(uncategorized, 6),
        "total_scope3": round(categorized_total + uncategorized, 6),
    }


def breakdown(company_id: int) -> dict[str, Any]:
    """Breakdown Scope 3 par catégorie pour une company (lit facts_current)."""
    rows: list[dict[str, Any]] = []
    if db_available():
        with get_db(company_id=company_id) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT code, value FROM facts_current "
                    "WHERE company_id = %s AND code LIKE %s",
                    (company_id, SCOPE3_PREFIX + "%"),
                )
                rows = [{"code": r["code"], "value": r["value"]} for r in cur.fetchall()]
    return aggregate_breakdown(rows)
