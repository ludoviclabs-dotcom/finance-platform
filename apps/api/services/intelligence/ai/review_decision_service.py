"""
review_decision_service.py — décision humaine sur une revue IA (PR-11).

Human-in-the-loop (AI_GOVERNANCE §12) : accept / reject / modify, reviewer +
justification obligatoires, APPEND-ONLY (ai_review_decisions, supersedes_id),
auditée (audit_service). Le modèle n'écrit JAMAIS de donnée métier ; seul le
geste HUMAIN d'acceptation peut en déclencher une, et uniquement via l'API réelle.

Geste métier d'un accept qui promeut une suggestion en IRO candidate :
`iro_service.create_iro(company_id=…, payload=IroCreate(…), created_by=reviewer)`
— qui force déjà `status='candidate'`. AUCUN chemin `create_candidate` parallèle.
"""

from __future__ import annotations

from typing import Any

from db.database import get_db
from models.ai_review import ReviewDecisionCreate, ReviewDecisionResponse
from services import audit_service
from services.intelligence.ai import review_service

_SCOPE = "company_id = %s"

# accept -> approved, reject -> rejected, modify -> needs_review (à finaliser).
_REVIEW_STATUS = {"accept": "approved", "reject": "rejected", "modify": "needs_review"}


class AiReviewDecisionError(Exception):
    """Erreur métier d'une décision de revue IA."""


def _create_iro_if_requested(
    *, company_id: int, payload: ReviewDecisionCreate, reviewer_id: int
) -> dict[str, Any] | None:
    """Si l'accept demande explicitement la promotion en IRO candidate
    (`modified_output.create_iro`), crée l'IRO via l'API réelle. Geste HUMAIN."""
    if payload.decision != "accept" or not payload.modified_output:
        return None
    iro_data = payload.modified_output.get("create_iro")
    if not iro_data:
        return None

    from models.iro import IroCreate
    from services.iro import iro_service

    try:
        created = iro_service.create_iro(
            company_id=company_id, payload=IroCreate(**iro_data), created_by=reviewer_id
        )
    except iro_service.IroError as exc:
        raise AiReviewDecisionError(f"Création IRO refusée: {exc}") from exc
    return {"iro_id": created.id, "status": created.status}


def record(
    *, company_id: int, run_id: int, payload: ReviewDecisionCreate, reviewer_id: int
) -> ReviewDecisionResponse:
    # 1. Le run doit exister pour ce tenant (sinon AiReviewError → 404).
    review_service.get_run_row(company_id=company_id, run_id=run_id)

    # 2. Geste métier humain éventuel (jamais une écriture du modèle).
    business_effect = _create_iro_if_requested(
        company_id=company_id, payload=payload, reviewer_id=reviewer_id
    )

    import json

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            # Chaîne append-only : la nouvelle décision supersède la dernière.
            cur.execute(
                f"SELECT id FROM ai_review_decisions WHERE run_id=%s AND {_SCOPE} "
                "ORDER BY created_at DESC, id DESC LIMIT 1",
                (run_id, company_id),
            )
            prev = cur.fetchone()
            supersedes_id = prev["id"] if prev else None

            cur.execute(
                """
                INSERT INTO ai_review_decisions
                    (run_id, company_id, decision, reviewer_id, justification,
                     modified_output, feedback, supersedes_id)
                VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s, %s)
                RETURNING *
                """,
                (
                    run_id, company_id, payload.decision, reviewer_id, payload.justification,
                    json.dumps(payload.modified_output) if payload.modified_output is not None else None,
                    payload.feedback, supersedes_id,
                ),
            )
            row = dict(cur.fetchone())

            cur.execute(
                f"UPDATE ai_runs SET review_status=%s WHERE id=%s AND {_SCOPE}",
                (_REVIEW_STATUS[payload.decision], run_id, company_id),
            )

    audit_service.log_event(
        "ai_review_decision",
        f"Revue IA {payload.decision} (run #{run_id})",
        detail=payload.justification[:500],
        user=str(reviewer_id),
        company_id=company_id,
        meta={"run_id": run_id, "decision": payload.decision, "business_effect": business_effect},
    )

    return ReviewDecisionResponse(
        id=row["id"], run_id=row["run_id"], company_id=row["company_id"],
        decision=row["decision"], reviewer_id=row["reviewer_id"], justification=row["justification"],
        feedback=row.get("feedback"), supersedes_id=row.get("supersedes_id"),
        created_at=row.get("created_at"), business_effect=business_effect,
    )
