"""
targets_actions_service.py — cibles et actions eau (PR-08 tranche B).

CRUD gaté par revue humaine, rattachements vérifiés dans le périmètre du
tenant (site, screening, cible). `expected_reduction_m3` est une INTENTION
déclarée : AUCUNE fonction de ce module (ni d'aucun autre) ne l'applique à un
résultat de screening — précédent mitigation_actions (034).

Défense en profondeur applicative (contrats §7) : prédicat `company_id = %s`
sur chaque requête (le superuser de CI bypasse la RLS).
"""

from __future__ import annotations

from typing import Any

from db.database import get_db
from models.water import (
    WaterActionCreate,
    WaterActionListResponse,
    WaterActionResponse,
    WaterTargetCreate,
    WaterTargetListResponse,
    WaterTargetResponse,
)

_SCOPE = "company_id = %s"


class WaterPlanError(Exception):
    """Erreur métier des cibles/actions eau."""


def _assert_in_scope(cur, company_id: int, table: str, row_id: int | None, label: str) -> None:
    if row_id is None:
        return
    cur.execute(f"SELECT 1 FROM {table} WHERE id = %s AND {_SCOPE}", (row_id, company_id))
    if cur.fetchone() is None:
        raise WaterPlanError(f"{label} '{row_id}' introuvable.")


# ---------------------------------------------------------------------------
# Cibles
# ---------------------------------------------------------------------------

def create_target(
    *, company_id: int, payload: WaterTargetCreate, created_by: int | None = None,
) -> WaterTargetResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            _assert_in_scope(cur, company_id, "sites", payload.site_id, "Site")
            _assert_in_scope(
                cur, company_id, "site_water_screenings", payload.screening_id, "Screening"
            )
            cur.execute(
                """
                INSERT INTO water_targets
                    (company_id, site_id, screening_id, target_type, title, description,
                     baseline_year, target_year, baseline_value_m3, target_value_m3,
                     status, review_status, notes, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', %s, %s)
                RETURNING *
                """,
                (
                    company_id, payload.site_id, payload.screening_id,
                    payload.target_type, payload.title, payload.description,
                    payload.baseline_year, payload.target_year,
                    payload.baseline_value_m3, payload.target_value_m3,
                    payload.status, payload.notes, created_by,
                ),
            )
            return WaterTargetResponse(**dict(cur.fetchone()))


def list_targets(
    *, company_id: int, site_id: int | None = None, screening_id: int | None = None,
    limit: int = 50, offset: int = 0,
) -> WaterTargetListResponse:
    clauses = [_SCOPE]
    params: list[Any] = [company_id]
    if site_id is not None:
        clauses.append("site_id = %s")
        params.append(site_id)
    if screening_id is not None:
        clauses.append("screening_id = %s")
        params.append(screening_id)
    where = f"WHERE {' AND '.join(clauses)}"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS c FROM water_targets {where}", params)
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT * FROM water_targets {where} ORDER BY id DESC LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            rows = cur.fetchall()
    return WaterTargetListResponse(
        items=[WaterTargetResponse(**dict(r)) for r in rows],
        total=total, limit=limit, offset=offset,
    )


def review_target(
    *, company_id: int, target_id: int, accept: bool, reviewed_by: int | None = None,
) -> WaterTargetResponse:
    target = "accepted" if accept else "flagged"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT review_status FROM water_targets WHERE id = %s AND {_SCOPE}",
                (target_id, company_id),
            )
            row = cur.fetchone()
            if row is None:
                raise WaterPlanError(f"Cible eau '{target_id}' introuvable.")
            if row["review_status"] != "pending":
                raise WaterPlanError(
                    f"Cible '{target_id}' déjà revue ({row['review_status']}) — "
                    "seule une cible 'pending' est revue."
                )
            cur.execute(
                f"UPDATE water_targets SET review_status = %s, updated_at = now() "
                f"WHERE id = %s AND {_SCOPE} RETURNING *",
                (target, target_id, company_id),
            )
            return WaterTargetResponse(**dict(cur.fetchone()))


# ---------------------------------------------------------------------------
# Actions
# ---------------------------------------------------------------------------

def create_action(
    *, company_id: int, payload: WaterActionCreate, created_by: int | None = None,
) -> WaterActionResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            _assert_in_scope(cur, company_id, "sites", payload.site_id, "Site")
            _assert_in_scope(
                cur, company_id, "site_water_screenings", payload.screening_id, "Screening"
            )
            _assert_in_scope(cur, company_id, "water_targets", payload.target_id, "Cible eau")
            cur.execute(
                """
                INSERT INTO water_actions
                    (company_id, site_id, screening_id, target_id, action_type, title,
                     description, status, owner, due_date, expected_effect,
                     expected_reduction_m3, review_status, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', %s)
                RETURNING *
                """,
                (
                    company_id, payload.site_id, payload.screening_id, payload.target_id,
                    payload.action_type, payload.title, payload.description,
                    payload.status, payload.owner, payload.due_date,
                    payload.expected_effect, payload.expected_reduction_m3, created_by,
                ),
            )
            return WaterActionResponse(**dict(cur.fetchone()))


def list_actions(
    *, company_id: int, site_id: int | None = None, screening_id: int | None = None,
    status: str | None = None, limit: int = 50, offset: int = 0,
) -> WaterActionListResponse:
    clauses = [_SCOPE]
    params: list[Any] = [company_id]
    if site_id is not None:
        clauses.append("site_id = %s")
        params.append(site_id)
    if screening_id is not None:
        clauses.append("screening_id = %s")
        params.append(screening_id)
    if status is not None:
        clauses.append("status = %s")
        params.append(status)
    where = f"WHERE {' AND '.join(clauses)}"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS c FROM water_actions {where}", params)
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT * FROM water_actions {where} ORDER BY id DESC LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            rows = cur.fetchall()
    return WaterActionListResponse(
        items=[WaterActionResponse(**dict(r)) for r in rows],
        total=total, limit=limit, offset=offset,
    )


def review_action(
    *, company_id: int, action_id: int, accept: bool, reviewed_by: int | None = None,
) -> WaterActionResponse:
    target = "accepted" if accept else "flagged"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT review_status FROM water_actions WHERE id = %s AND {_SCOPE}",
                (action_id, company_id),
            )
            row = cur.fetchone()
            if row is None:
                raise WaterPlanError(f"Action eau '{action_id}' introuvable.")
            if row["review_status"] != "pending":
                raise WaterPlanError(
                    f"Action '{action_id}' déjà revue ({row['review_status']}) — "
                    "seule une action 'pending' est revue."
                )
            cur.execute(
                f"UPDATE water_actions SET review_status = %s, updated_at = now() "
                f"WHERE id = %s AND {_SCOPE} RETURNING *",
                (target, action_id, company_id),
            )
            return WaterActionResponse(**dict(cur.fetchone()))
