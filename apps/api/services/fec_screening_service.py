"""
fec_screening_service.py — T4.3 : screening Scope 3 monétaire depuis un FEC.

Agrège les comptes de charges (classe 6) du FEC, applique la table de passage
PCG → catégorie Scope 3, puis un ratio monétaire (kgCO2e/€) pour estimer les
émissions (qualité = 4, proxy monétaire). RIEN n'entre dans la chaîne sans
validation humaine : l'upload produit un screening en statut `pending` ; seul un
POST /fec/{id}/emit (analyste) émet les facts. Le screening est une fonction
PURE (testable sans DB).
"""

from __future__ import annotations

import json
import logging
import os
from collections import defaultdict
from typing import Any

from db.database import db_available, get_db
from services import facts_service, scope3_service

logger = logging.getLogger(__name__)

_PCG_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "pcg_scope3.json")

# Ratio monétaire par défaut (kgCO2e/€) — proxy générique. En prod, ratios ADEME
# par catégorie depuis emission_factors (T1.2, action Ludo).
DEFAULT_RATIO = 0.25
QUALITY_MONETARY = 4


class ScreeningError(Exception):
    """Erreur de screening FEC."""


def _pcg_rules() -> list[dict[str, Any]]:
    with open(_PCG_PATH, encoding="utf-8") as f:
        # Tri par longueur de préfixe décroissante → match le plus long d'abord.
        return sorted(json.load(f)["rules"], key=lambda r: -len(r["prefix"]))


def map_compte(compte_num: str) -> int | None:
    """Catégorie Scope 3 d'un compte PCG (préfixe le plus long). None si non mappé."""
    compte = (compte_num or "").strip()
    for rule in _pcg_rules():
        if compte.startswith(rule["prefix"]):
            return rule["scope3"]
    return None


def screen(rows: list[dict[str, Any]], ratio: float = DEFAULT_RATIO) -> dict[str, Any]:
    """Screening Scope 3 monétaire. Fonction PURE.

    Agrège les charges (classe 6, débit net positif), mappe PCG → catégorie,
    applique le ratio. Retourne couverture, total, top comptes, non mappés.
    """
    by_cat: dict[int, dict[str, float]] = defaultdict(lambda: {"spend": 0.0, "tco2e": 0.0})
    accounts: dict[str, dict[str, Any]] = {}
    total_spend = mapped_spend = 0.0
    unmapped: set[str] = set()

    for r in rows:
        compte = (r.get("CompteNum") or "").strip()
        if not compte.startswith("6"):
            continue  # uniquement les charges (classe 6)
        net = float(r.get("Debit") or 0) - float(r.get("Credit") or 0)
        if net <= 0:
            continue
        total_spend += net
        cat = map_compte(compte)
        acc = accounts.setdefault(compte, {"spend": 0.0, "lib": r.get("CompteLib", ""), "category": cat})
        acc["spend"] += net
        if cat is None:
            unmapped.add(compte)
            continue
        mapped_spend += net
        by_cat[cat]["spend"] += net
        by_cat[cat]["tco2e"] += net * ratio / 1000.0

    top_accounts = sorted(
        (
            {
                "compte": k, "lib": v["lib"], "category": v["category"],
                "spend": round(v["spend"], 2),
                "tco2e": round(v["spend"] * ratio / 1000.0, 3) if v["category"] else 0.0,
            }
            for k, v in accounts.items()
        ),
        key=lambda a: -a["spend"],
    )[:20]

    return {
        "ratio_kgco2e_per_eur": ratio,
        "quality": QUALITY_MONETARY,
        "total_spend": round(total_spend, 2),
        "mapped_spend": round(mapped_spend, 2),
        "mappable_pct": round(100 * mapped_spend / total_spend, 1) if total_spend else 0.0,
        "total_tco2e": round(sum(c["tco2e"] for c in by_cat.values()), 3),
        "by_category": [
            {
                "category": cat, "label": scope3_service.category_label(cat),
                "spend": round(v["spend"], 2), "tco2e": round(v["tco2e"], 3),
            }
            for cat, v in sorted(by_cat.items())
        ],
        "top_accounts": top_accounts,
        "unmapped_accounts": sorted(unmapped),
    }


# ── Persistance + gate d'émission ────────────────────────────────────────────

def create_screening(*, company_id: int, filename: str, parsed: dict[str, Any], result: dict[str, Any]) -> dict[str, Any]:
    """Enregistre un screening en statut `pending` (aucun fact émis)."""
    if not db_available():
        raise ScreeningError("Base de données indisponible.")
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO fec_screenings
                    (company_id, filename, exercise_year, status, total_debit, total_credit,
                     mappable_pct, estimated_tco2e, result, created_at, updated_at)
                VALUES (%s, %s, %s, 'pending', %s, %s, %s, %s, %s, now(), now())
                RETURNING id, created_at
                """,
                (company_id, filename, parsed.get("exercise_year"),
                 parsed.get("total_debit"), parsed.get("total_credit"),
                 result.get("mappable_pct"), result.get("total_tco2e"), json.dumps(result)),
            )
            row = cur.fetchone()
    return {"id": row["id"], "status": "pending"}


def get_screening(*, company_id: int, screening_id: int) -> dict[str, Any] | None:
    if not db_available():
        return None
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, filename, exercise_year, status, total_debit, total_credit, "
                "mappable_pct, estimated_tco2e, result FROM fec_screenings "
                "WHERE company_id = %s AND id = %s",
                (company_id, screening_id),
            )
            row = cur.fetchone()
    if not row:
        return None
    result = row["result"]
    if isinstance(result, str):
        result = json.loads(result)
    return {**{k: row[k] for k in row if k != "result"}, "result": result}


def emit_facts(*, company_id: int, screening_id: int, user_email: str | None) -> dict[str, Any]:
    """Émet les facts Scope 3 du screening (gate analyste). Idempotent par statut."""
    screening = get_screening(company_id=company_id, screening_id=screening_id)
    if screening is None:
        raise ScreeningError("Screening introuvable.")
    if screening["status"] == "emitted":
        raise ScreeningError("Screening déjà émis.")

    emitted = 0
    for cat in screening["result"].get("by_category", []):
        ev = facts_service.emit_fact(
            company_id=company_id, code=scope3_service.code_for(cat["category"]),
            value=float(cat["tco2e"]), unit="tCO2e", ef_id=None,
            source_path=f"fec:{screening['filename']}",
            meta={"quality": QUALITY_MONETARY, "scope3_category": cat["category"], "screening_id": screening_id},
        )
        if ev is not None:
            emitted += 1
    if emitted > 0:
        try:
            facts_service.refresh_facts_current()
        except Exception as exc:  # pragma: no cover
            logger.warning("refresh_facts_current (fec) échoué: %s", exc)

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE fec_screenings SET status = 'emitted', updated_at = now() "
                "WHERE company_id = %s AND id = %s",
                (company_id, screening_id),
            )
    return {"emitted_facts": emitted, "status": "emitted"}
