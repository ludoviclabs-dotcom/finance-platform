"""
questionnaire_service.py — T5.5 : export « réponses prêtes » vers questionnaires.

Mappe les facts (facts_current) vers les questions types de questionnaires clients
(CDP climat allégé, EcoVadis environnement) via un catalogue versionné
(data/questionnaire_map.json). Export CSV — AUCUNE intégration API. Chaque ligne
référence le fact source (fact_code). Cellules sanitizées (anti-injection formule).
"""

from __future__ import annotations

import csv
import io
import json
import os
from functools import lru_cache
from typing import Any

from db.database import db_available, get_db
from utils.excel_sanitize import sanitize_cell

_MAP_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "questionnaire_map.json")


@lru_cache(maxsize=1)
def _catalog() -> dict[str, Any]:
    with open(_MAP_PATH, encoding="utf-8") as f:
        return json.load(f)


def catalogs() -> dict[str, Any]:
    """Liste des questionnaires + nombre de questions (sans valeurs)."""
    qs = _catalog()["questionnaires"]
    return {
        "version": _catalog()["version"],
        "questionnaires": [
            {"key": k, "label": v["label"], "question_count": len(v["questions"])}
            for k, v in qs.items()
        ],
    }


def _fact_values(company_id: int) -> dict[str, float]:
    if not db_available():
        return {}
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT code, value FROM facts_current WHERE company_id = %s", (company_id,))
            return {r["code"]: (float(r["value"]) if r["value"] is not None else None)
                    for r in cur.fetchall()}


def build_answers(company_id: int, questionnaire: str | None = None) -> list[dict[str, Any]]:
    """Construit les lignes de réponses (valeur depuis facts_current, vide sinon).

    `questionnaire` filtre sur une clé (cdp|ecovadis) ; None = tous. PURE hormis
    la lecture facts_current (vide en l'absence de DB → questions + références
    de fact tout de même listées).
    """
    cat = _catalog()["questionnaires"]
    values = _fact_values(company_id)
    rows: list[dict[str, Any]] = []
    for key, conf in cat.items():
        if questionnaire and key != questionnaire:
            continue
        for q in conf["questions"]:
            code = q["fact_code"]
            rows.append({
                "questionnaire": conf["label"],
                "question_id": q["id"],
                "question": q["question"],
                "fact_code": code,
                "value": values.get(code),
                "unit": q.get("unit", ""),
                "source": f"facts_current:{code}",
            })
    return rows


_HEADER = ["questionnaire", "question_id", "question", "fact_code", "value", "unit", "source"]


def build_csv(rows: list[dict[str, Any]]) -> bytes:
    """CSV des réponses, cellules sanitizées (anti-injection de formule)."""
    buf = io.StringIO()
    writer = csv.writer(buf, delimiter=";")
    writer.writerow(_HEADER)
    for r in rows:
        writer.writerow([sanitize_cell(r.get(c) if r.get(c) is not None else "") for c in _HEADER])
    return buf.getvalue().encode("utf-8-sig")
