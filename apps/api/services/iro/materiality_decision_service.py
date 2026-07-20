"""
materiality_decision_service.py — `materiality_decisions` (PR-10, migration
040) : gate de revue HUMAINE, append-only.

Motif direct de `services/crma/article24_service.py::review()` : `decided_by`
n'est jamais optionnel (une décision de matérialité n'est jamais prise par
« le système »), et ce service refuse de décider un IRO qui n'a encore reçu
AUCUNE évaluation calculée (même garde-fou que `review()` qui refuse
d'approuver une évaluation Article 24 jamais calculée).

**Append-only, structurellement.** Une redécision n'écrase jamais la
précédente : `decide()` n'exécute JAMAIS d'UPDATE sur une ligne existante,
seulement des INSERT — et la migration 040 pose en plus un trigger
(`trg_materiality_decisions_guard`) qui refuse toute UPDATE/DELETE en base,
même si un futur appel contournait ce service. La nouvelle ligne porte
`supersedes_id` vers l'ancienne décision (la plus récente au moment de
l'appel), formant une chaîne append-only complète et navigable.

**Décision auditée.** Chaque décision de matérialité — geste humain, sensible
et append-only — est journalisée via `audit_service.log_event`
(`event_type='materiality_decision'`, ajouté à `AuditEventType` par PR-10).
"""

from __future__ import annotations

from typing import Any

from db.database import get_db
from models.iro import (
    MaterialityDecisionCreate,
    MaterialityDecisionListResponse,
    MaterialityDecisionResponse,
)
from services import audit_service

from . import iro_service

_SCOPE = "company_id = %s"


class MaterialityDecisionError(Exception):
    """Erreur métier des décisions de matérialité."""


def _decision_row(row: dict[str, Any]) -> MaterialityDecisionResponse:
    return MaterialityDecisionResponse(**{k: row[k] for k in MaterialityDecisionResponse.model_fields})


def decide(
    *, company_id: int, iro_id: int, payload: MaterialityDecisionCreate, decided_by: int | None,
) -> MaterialityDecisionResponse:
    if not decided_by:
        raise MaterialityDecisionError(
            "Une décision de matérialité requiert un décideur identifié (decided_by requis)."
        )

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            iro_service.assert_iro_in_scope(cur, company_id, iro_id)

            cur.execute(
                f"SELECT EXISTS ("
                f"  SELECT 1 FROM impact_assessments WHERE iro_id = %s AND {_SCOPE}"
                f"  UNION ALL"
                f"  SELECT 1 FROM financial_assessments WHERE iro_id = %s AND {_SCOPE}"
                f") AS has_assessment",
                (iro_id, company_id, iro_id, company_id),
            )
            if not cur.fetchone()["has_assessment"]:
                raise MaterialityDecisionError(
                    "Une évaluation (impact ou financière) est requise avant toute décision "
                    "de matérialité — lancer une évaluation avant de décider."
                )

            cur.execute(
                f"SELECT id FROM materiality_decisions WHERE iro_id = %s AND {_SCOPE} "
                "ORDER BY decided_at DESC, id DESC LIMIT 1",
                (iro_id, company_id),
            )
            previous = cur.fetchone()
            supersedes_id = previous["id"] if previous else None

            # INSERT uniquement — jamais d'UPDATE sur une décision existante
            # (append-only, renforcé en base par trg_materiality_decisions_guard).
            cur.execute(
                """
                INSERT INTO materiality_decisions
                    (company_id, iro_id, decided_by, is_material, basis, justification, supersedes_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    company_id, iro_id, decided_by, payload.is_material, payload.basis,
                    payload.justification, supersedes_id,
                ),
            )
            row = _decision_row(dict(cur.fetchone()))

    iro_service.advance_status(company_id=company_id, iro_id=iro_id, target="decided")

    audit_service.log_event(
        "materiality_decision",
        f"Décision de matérialité — IRO #{iro_id}",
        detail=(
            f"is_material={payload.is_material} basis={payload.basis} "
            f"supersedes_id={supersedes_id}"
        ),
        meta={"iro_id": iro_id, "decision_id": row.id, "basis": payload.basis},
        user=str(decided_by),
        company_id=company_id,
    )

    return row


def list_decisions(
    *, company_id: int, iro_id: int, limit: int = 50, offset: int = 0,
) -> MaterialityDecisionListResponse:
    """Historique complet, append-only, le plus récent en tête — inclut les
    décisions superseded (jamais purgées)."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            iro_service.assert_iro_in_scope(cur, company_id, iro_id)
            cur.execute(
                f"SELECT COUNT(*) AS n FROM materiality_decisions WHERE iro_id = %s AND {_SCOPE}",
                (iro_id, company_id),
            )
            total = cur.fetchone()["n"]
            cur.execute(
                f"SELECT * FROM materiality_decisions WHERE iro_id = %s AND {_SCOPE} "
                "ORDER BY decided_at DESC, id DESC LIMIT %s OFFSET %s",
                (iro_id, company_id, limit, offset),
            )
            items = [_decision_row(dict(r)) for r in cur.fetchall()]
    return MaterialityDecisionListResponse(items=items, total=total, limit=limit, offset=offset)
