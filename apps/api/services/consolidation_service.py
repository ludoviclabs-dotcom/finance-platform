"""
consolidation_service.py — T4.4 : périmètre & consolidation multi-entités.

Approche de consolidation par organisation (contrôle opérationnel / financier /
parts de capital). La vue groupe agrège les facts de l'entité mère + ses filiales
(lecture seule, pondérée selon l'approche) — JAMAIS ré-émise comme facts. Aucune
RLS récursive : les company_id enfants sont lus via une whitelist explicite côté
service. Tout changement d'approche est journalisé (perimeter_events).
"""

from __future__ import annotations

import logging
from typing import Any

from db.database import db_available, get_db

logger = logging.getLogger(__name__)

APPROACHES = {
    "operational": {
        "label": "Contrôle opérationnel",
        "definition": "100 % des émissions des entités sous contrôle opérationnel.",
    },
    "financial": {
        "label": "Contrôle financier",
        "definition": "100 % des émissions des entités sous contrôle financier.",
    },
    "equity": {
        "label": "Parts de capital",
        "definition": "Émissions au prorata du pourcentage de détention.",
    },
}


class ConsolidationError(Exception):
    """Erreur de consolidation (approche invalide…)."""


def weight_for(approach: str, ownership_pct: float) -> float:
    """Poids d'une entité selon l'approche (pur). Contrôle = 100 %, parts = % détention."""
    if approach == "equity":
        return max(0.0, min(100.0, float(ownership_pct))) / 100.0
    return 1.0


def consolidate(entities: list[dict[str, Any]], approach: str) -> dict[str, Any]:
    """Agrège les facts d'entités selon l'approche. Fonction PURE.

    entities = [{company_id, ownership_pct, facts: {code: value}}].
    Retourne {kpis: {code: somme_pondérée}, entities: [...], approach}.
    """
    if approach not in APPROACHES:
        raise ConsolidationError(f"Approche inconnue : {approach}.")
    kpis: dict[str, float] = {}
    for ent in entities:
        w = weight_for(approach, ent.get("ownership_pct", 100))
        for code, value in (ent.get("facts") or {}).items():
            if value is None:
                continue
            kpis[code] = round(kpis.get(code, 0.0) + float(value) * w, 6)
    return {
        "approach": approach,
        "approach_label": APPROACHES[approach]["label"],
        "entity_count": len(entities),
        "kpis": kpis,
    }


# ── DB ───────────────────────────────────────────────────────────────────────

def _entity_facts(company_id: int) -> dict[str, float]:
    facts: dict[str, float] = {}
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT code, value FROM facts_current WHERE company_id = %s AND code LIKE 'CC.GES.%%'",
                (company_id,),
            )
            for r in cur.fetchall():
                if r["value"] is not None:
                    facts[r["code"]] = float(r["value"])
    return facts


def get_perimeter(company_id: int) -> dict[str, Any]:
    """Approche + entités du périmètre (la company + ses filiales directes)."""
    if not db_available():
        return {"approach": "operational", "entities": []}
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, ownership_pct, consolidation_approach FROM companies WHERE id = %s",
                (company_id,),
            )
            me = cur.fetchone()
            approach = (me["consolidation_approach"] if me else None) or "operational"
            # Filiales directes (whitelist explicite, pas de RLS récursive).
            cur.execute(
                "SELECT id, name, ownership_pct FROM companies WHERE parent_id = %s ORDER BY id",
                (company_id,),
            )
            children = cur.fetchall()
    entities = [{"company_id": company_id, "name": me["name"] if me else None, "ownership_pct": 100, "is_parent": True}]
    entities += [{"company_id": c["id"], "name": c["name"], "ownership_pct": float(c["ownership_pct"]), "is_parent": False}
                 for c in children]
    return {"approach": approach, "approach_label": APPROACHES.get(approach, {}).get("label"), "entities": entities}


def group_view(company_id: int) -> dict[str, Any]:
    """Vue groupe consolidée (lecture seule, calculée)."""
    perimeter = get_perimeter(company_id)
    if not db_available():
        return consolidate([], perimeter["approach"])
    entities = [
        {"company_id": e["company_id"], "ownership_pct": e["ownership_pct"], "facts": _entity_facts(e["company_id"])}
        for e in perimeter["entities"]
    ]
    result = consolidate(entities, perimeter["approach"])
    result["entities"] = perimeter["entities"]
    return result


def set_approach(*, company_id: int, approach: str, actor: str | None = None) -> dict[str, Any]:
    """Change l'approche de consolidation et journalise un event de périmètre."""
    if approach not in APPROACHES:
        raise ConsolidationError(f"Approche inconnue : {approach}.")
    if not db_available():
        raise ConsolidationError("Base de données indisponible.")
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT consolidation_approach FROM companies WHERE id = %s", (company_id,))
            row = cur.fetchone()
            previous = row["consolidation_approach"] if row else None
            cur.execute(
                "UPDATE companies SET consolidation_approach = %s WHERE id = %s",
                (approach, company_id),
            )
            cur.execute(
                "INSERT INTO perimeter_events (company_id, approach_from, approach_to, actor) "
                "VALUES (%s, %s, %s, %s)",
                (company_id, previous, approach, actor),
            )
    return {"approach": approach, "previous": previous}
