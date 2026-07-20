"""
actions_service.py — `nature_actions` (PR-09 tranche B).

Calquée sur `targets_actions_service.py` (eau, PR-08) / `article24_service`
(actions CRMA, 034) : `expected_risk_reduction_pct` est une INTENTION
déclarée — AUCUNE fonction de ce module (ni d'aucun autre) ne l'applique
automatiquement à `nature_risks.risk_score`. Une action rattachée à un risque,
une opportunité et/ou un dossier LEAP (au moins un ancrage, CHECK 039).

Défense en profondeur applicative (contrats §7) : prédicat `company_id = %s`
sur chaque requête (le superuser de CI bypasse la RLS).
"""

from __future__ import annotations

from typing import Any

from db.database import get_db
from models.nature import (
    NatureActionCreate,
    NatureActionListResponse,
    NatureActionResponse,
)

_SCOPE = "company_id = %s"


class NatureActionError(Exception):
    """Erreur métier des actions nature."""


def _assert_in_scope(cur, company_id: int, table: str, row_id: int | None, label: str) -> None:
    if row_id is None:
        return
    cur.execute(f"SELECT 1 FROM {table} WHERE id = %s AND {_SCOPE}", (row_id, company_id))
    if cur.fetchone() is None:
        raise NatureActionError(f"{label} '{row_id}' introuvable.")


def create_action(
    *, company_id: int, payload: NatureActionCreate, created_by: int | None = None,
) -> NatureActionResponse:
    if payload.risk_id is None and payload.opportunity_id is None and payload.assessment_id is None:
        raise NatureActionError(
            "Une action nature exige un ancrage : risque, opportunité ou dossier LEAP — "
            "jamais une ligne orpheline."
        )
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            _assert_in_scope(cur, company_id, "nature_risks", payload.risk_id, "Risque nature")
            _assert_in_scope(cur, company_id, "nature_opportunities", payload.opportunity_id, "Opportunité nature")
            _assert_in_scope(cur, company_id, "leap_assessments", payload.assessment_id, "Dossier LEAP")
            cur.execute(
                """
                INSERT INTO nature_actions
                    (company_id, risk_id, opportunity_id, assessment_id, action_type, title,
                     description, status, owner, due_date, expected_effect,
                     expected_risk_reduction_pct, review_status, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', %s)
                RETURNING *
                """,
                (
                    company_id, payload.risk_id, payload.opportunity_id, payload.assessment_id,
                    payload.action_type, payload.title, payload.description, payload.status,
                    payload.owner, payload.due_date, payload.expected_effect,
                    payload.expected_risk_reduction_pct, created_by,
                ),
            )
            return NatureActionResponse(**dict(cur.fetchone()))


def list_actions(
    *, company_id: int, risk_id: int | None = None, opportunity_id: int | None = None,
    assessment_id: int | None = None, status: str | None = None,
    limit: int = 50, offset: int = 0,
) -> NatureActionListResponse:
    clauses = [_SCOPE]
    params: list[Any] = [company_id]
    if risk_id is not None:
        clauses.append("risk_id = %s")
        params.append(risk_id)
    if opportunity_id is not None:
        clauses.append("opportunity_id = %s")
        params.append(opportunity_id)
    if assessment_id is not None:
        clauses.append("assessment_id = %s")
        params.append(assessment_id)
    if status is not None:
        clauses.append("status = %s")
        params.append(status)
    where = f"WHERE {' AND '.join(clauses)}"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS c FROM nature_actions {where}", params)
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT * FROM nature_actions {where} ORDER BY id DESC LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            rows = cur.fetchall()
    return NatureActionListResponse(
        items=[NatureActionResponse(**dict(r)) for r in rows], total=total, limit=limit, offset=offset,
    )


def review_action(
    *, company_id: int, action_id: int, accept: bool, reviewed_by: int | None = None,
) -> NatureActionResponse:
    target = "accepted" if accept else "flagged"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT review_status FROM nature_actions WHERE id = %s AND {_SCOPE}",
                (action_id, company_id),
            )
            row = cur.fetchone()
            if row is None:
                raise NatureActionError(f"Action nature '{action_id}' introuvable.")
            if row["review_status"] != "pending":
                raise NatureActionError(
                    f"Action '{action_id}' déjà revue ({row['review_status']}) — "
                    "seule une ligne 'pending' est revue."
                )
            cur.execute(
                f"UPDATE nature_actions SET review_status = %s, updated_at = now() "
                f"WHERE id = %s AND {_SCOPE} RETURNING *",
                (target, action_id, company_id),
            )
            return NatureActionResponse(**dict(cur.fetchone()))
