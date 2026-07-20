"""
iro_actions_service.py — `iro_actions` (PR-10, migration 040).

Calquée sur `services/crma/article24_service.py` (`create_action`/
`list_actions`) et `services/nature/actions_service.py` (034/037/039) :
`expected_risk_reduction_pct` est une INTENTION déclarée — AUCUNE fonction de
ce module (ni d'aucun autre) ne l'applique automatiquement à un score ou une
composante d'évaluation.

Table PROPRE (ne modifie pas `mitigation_actions`) : pas d'ALTER sur une
table d'un autre domaine, pas de FK `mitigation_actions.assessment_id` vers
un IRO (plan §5) — ne couple pas PR-10 à CRMA.
"""

from __future__ import annotations

from typing import Any

from db.database import get_db
from models.iro import IroActionCreate, IroActionListResponse, IroActionResponse

from . import iro_service

_SCOPE = "company_id = %s"


class IroActionError(Exception):
    """Erreur métier des actions IRO."""


def _action_row(row: dict[str, Any]) -> IroActionResponse:
    return IroActionResponse(**{k: row[k] for k in IroActionResponse.model_fields})


def create_action(
    *, company_id: int, iro_id: int, payload: IroActionCreate, created_by: int | None = None,
) -> IroActionResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            iro_service.assert_iro_in_scope(cur, company_id, iro_id)
            cur.execute(
                """
                INSERT INTO iro_actions
                    (company_id, iro_id, action_type, title, description, status, owner,
                     due_date, expected_effect, expected_risk_reduction_pct, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    company_id, iro_id, payload.action_type, payload.title, payload.description,
                    payload.status, payload.owner, payload.due_date, payload.expected_effect,
                    payload.expected_risk_reduction_pct, created_by,
                ),
            )
            return _action_row(dict(cur.fetchone()))


def list_actions(
    *, company_id: int, iro_id: int, status: str | None = None, limit: int = 50, offset: int = 0,
) -> IroActionListResponse:
    clauses = ["iro_id = %s", _SCOPE]
    params: list[Any] = [iro_id, company_id]
    if status is not None:
        clauses.append("status = %s")
        params.append(status)
    where = " AND ".join(clauses)
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            iro_service.assert_iro_in_scope(cur, company_id, iro_id)
            cur.execute(f"SELECT COUNT(*) AS n FROM iro_actions WHERE {where}", params)
            total = cur.fetchone()["n"]
            cur.execute(
                f"SELECT * FROM iro_actions WHERE {where} ORDER BY id DESC LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            items = [_action_row(dict(r)) for r in cur.fetchall()]
    return IroActionListResponse(items=items, total=total, limit=limit, offset=offset)
