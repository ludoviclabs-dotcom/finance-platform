"""
import_screening_service.py — T5.4 : screening des imports fichiers + gate.

Mappe les lignes parsées (AWS/GCP émissions directes, Qonto monétaire) vers les
catégories Scope 3 via un catalogue versionné (data/import_category_map.json), et
émet les facts UNIQUEMENT après validation analyste (statut pending → emitted),
comme le FEC (T4.3). Le screening (screen_*) est PUR ; l'émission passe par
facts_service.emit_fact (chaîne de preuve inchangée). Par-organisation → RLS.
"""

from __future__ import annotations

import json
import logging
import os
from collections import defaultdict
from functools import lru_cache
from typing import Any

from db.database import db_available, get_db
from services import facts_service, scope3_service
from services.fec_screening_service import DEFAULT_RATIO, QUALITY_MONETARY

logger = logging.getLogger(__name__)

_MAP_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "import_category_map.json")
IMPORT_TYPES = ("aws", "gcp", "qonto")


class ImportScreeningError(Exception):
    """Erreur de screening d'import."""


@lru_cache(maxsize=1)
def _catalog() -> dict[str, Any]:
    with open(_MAP_PATH, encoding="utf-8") as f:
        return json.load(f)


def category_for(source: str, text: str) -> tuple[int, bool]:
    """Catégorie Scope 3 pour un libellé. Retourne (catégorie, matched_specific).

    matched_specific=False signale un repli sur la catégorie par défaut (libellé
    non reconnu) — utilisé pour le % de couverture honnête.
    """
    conf = _catalog().get(source, {})
    low = (text or "").lower()
    for keyword, cat in conf.get("keywords", {}).items():
        if keyword in low:
            return int(cat), True
    return int(conf.get("default", 1)), False


def _screen_emissions(source: str, rows: list[dict[str, Any]]) -> dict[str, Any]:
    per_cat: dict[int, float] = defaultdict(float)
    matched = total = 0.0
    for r in rows:
        cat, specific = category_for(source, r.get("service", ""))
        tco2e = float(r.get("tco2e") or 0.0)
        per_cat[cat] += tco2e
        total += tco2e
        if specific:
            matched += tco2e
    by_cat = [{"category": c, "label": scope3_service.category_label(c), "tco2e": round(v, 6)}
              for c, v in sorted(per_cat.items())]
    return {
        "by_category": by_cat,
        "total_tco2e": round(total, 6),
        "mappable_pct": round(matched / total * 100, 1) if total else 0.0,
        "quality": 4,
        "coverage": sorted(per_cat),
    }


def screen_aws_ccft(rows: list[dict[str, Any]]) -> dict[str, Any]:
    return _screen_emissions("aws", rows)


def screen_gcp_carbon(rows: list[dict[str, Any]]) -> dict[str, Any]:
    return _screen_emissions("gcp", rows)


def screen_qonto(rows: list[dict[str, Any]], ratio: float = DEFAULT_RATIO) -> dict[str, Any]:
    spend_cat: dict[int, float] = defaultdict(float)
    tco2e_cat: dict[int, float] = defaultdict(float)
    matched = total_spend = 0.0
    for r in rows:
        text = f"{r.get('label', '')} {r.get('qonto_category', '')}"
        cat, specific = category_for("qonto", text)
        spend = float(r.get("spend") or 0.0)
        spend_cat[cat] += spend
        tco2e_cat[cat] += spend * ratio / 1000.0
        total_spend += spend
        if specific:
            matched += spend
    by_cat = [{"category": c, "label": scope3_service.category_label(c),
               "spend": round(spend_cat[c], 2), "tco2e": round(tco2e_cat[c], 6)}
              for c in sorted(spend_cat)]
    return {
        "by_category": by_cat,
        "total_spend": round(total_spend, 2),
        "total_tco2e": round(sum(tco2e_cat.values()), 6),
        "mappable_pct": round(matched / total_spend * 100, 1) if total_spend else 0.0,
        "quality": QUALITY_MONETARY,
        "ratio_kgco2e_per_eur": ratio,
    }


# ---------------------------------------------------------------------------
# DB (RLS) + gate d'émission
# ---------------------------------------------------------------------------

def create_import_screening(*, company_id: int, import_type: str, filename: str,
                            parsed: dict[str, Any], result: dict[str, Any]) -> dict[str, Any]:
    if import_type not in IMPORT_TYPES:
        raise ImportScreeningError(f"Type d'import invalide : {import_type}.")
    if not db_available():
        raise ImportScreeningError("Base de données indisponible.")
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO import_screenings
                   (company_id, import_type, filename, status, total_tco2e, mappable_pct, parsed, result)
                   VALUES (%s,%s,%s,'pending',%s,%s,%s,%s) RETURNING id""",
                (company_id, import_type, filename, result.get("total_tco2e"),
                 result.get("mappable_pct"), json.dumps(parsed), json.dumps(result)),
            )
            row = cur.fetchone()
    return {"id": row["id"], "status": "pending"}


def get_import_screening(*, company_id: int, screening_id: int) -> dict[str, Any] | None:
    if not db_available():
        return None
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, import_type, filename, status, total_tco2e, mappable_pct, result "
                "FROM import_screenings WHERE company_id = %s AND id = %s",
                (company_id, screening_id),
            )
            row = cur.fetchone()
    if not row:
        return None
    result = row["result"]
    if isinstance(result, str):
        result = json.loads(result)
    return {**{k: row[k] for k in row if k != "result"}, "result": result}


def list_import_screenings(company_id: int, import_type: str | None = None) -> list[dict[str, Any]]:
    if not db_available():
        return []
    clause, params = "", [company_id]
    if import_type:
        clause = "AND import_type = %s"
        params.append(import_type)
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, import_type, filename, status, total_tco2e, mappable_pct, created_at "
                f"FROM import_screenings WHERE company_id = %s {clause} ORDER BY created_at DESC",
                tuple(params),
            )
            return [{**{k: r[k] for k in r if k != "created_at"}, "created_at": str(r["created_at"])}
                    for r in cur.fetchall()]


def emit_import_facts(*, company_id: int, screening_id: int, user_email: str | None) -> dict[str, Any]:
    """Émet les facts Scope 3 du screening (gate analyste). Idempotent par statut."""
    screening = get_import_screening(company_id=company_id, screening_id=screening_id)
    if screening is None:
        raise ImportScreeningError("Screening introuvable.")
    if screening["status"] == "emitted":
        raise ImportScreeningError("Screening déjà émis.")

    source = screening["import_type"]
    emitted = 0
    for cat in screening["result"].get("by_category", []):
        ev = facts_service.emit_fact(
            company_id=company_id, code=scope3_service.code_for(cat["category"]),
            value=float(cat["tco2e"]), unit="tCO2e", ef_id=None,
            source_path=f"{source}:{screening['filename']}",
            meta={"quality": cat_quality(source), "scope3_category": cat["category"],
                  "import_screening_id": screening_id},
        )
        if ev is not None:
            emitted += 1
    if emitted > 0:
        try:
            facts_service.refresh_facts_current()
        except Exception as exc:  # pragma: no cover
            logger.warning("refresh_facts_current (import) échoué: %s", exc)

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE import_screenings SET status = 'emitted', updated_at = now() "
                "WHERE company_id = %s AND id = %s",
                (company_id, screening_id),
            )
    return {"emitted_facts": emitted, "status": "emitted"}


def cat_quality(source: str) -> int:
    # AWS/GCP : proxy carbone fournisseur (qualité 4) ; Qonto : ratio monétaire (4).
    return 4
