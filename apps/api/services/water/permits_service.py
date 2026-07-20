"""
permits_service.py — permis eau d'un site (PR-08A) : CRUD + preuve Evidence
Kernel + gate de revue.

Un permis est une autorisation administrative (prélèvement, rejet,
exploitation) : sa preuve naturelle est la pièce jointe (l'arrêté) enregistrée
comme `evidence_artifact` (028) — jamais une URL externe.

Défense en profondeur applicative (contrats §7) : prédicat `company_id = %s`
sur chaque requête (le superuser de CI bypasse la RLS).
"""

from __future__ import annotations

from typing import Any

from db.database import get_db
from models.water import (
    WaterPermitCreate,
    WaterPermitListResponse,
    WaterPermitResponse,
)

_SCOPE = "company_id = %s"


class WaterPermitError(Exception):
    """Erreur métier des permis eau."""


def _response(row: dict[str, Any]) -> WaterPermitResponse:
    return WaterPermitResponse(**row)


def create_permit(
    *, company_id: int, payload: WaterPermitCreate, created_by: int | None = None,
) -> WaterPermitResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT 1 FROM sites WHERE id = %s AND {_SCOPE}", (payload.site_id, company_id))
            if cur.fetchone() is None:
                raise WaterPermitError(f"Site '{payload.site_id}' introuvable.")
            if payload.evidence_artifact_id is not None:
                cur.execute(
                    "SELECT 1 FROM evidence_artifacts WHERE id = %s "
                    "AND (company_id = %s OR company_id IS NULL)",
                    (payload.evidence_artifact_id, company_id),
                )
                if cur.fetchone() is None:
                    raise WaterPermitError(
                        f"Pièce de preuve '{payload.evidence_artifact_id}' introuvable."
                    )
            cur.execute(
                """
                INSERT INTO water_permits
                    (company_id, site_id, permit_type, permit_reference,
                     authorized_volume_m3, valid_from, valid_to, issuing_authority,
                     evidence_artifact_id, status, review_status, notes, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', %s, %s)
                RETURNING *
                """,
                (
                    company_id, payload.site_id, payload.permit_type,
                    payload.permit_reference, payload.authorized_volume_m3,
                    payload.valid_from, payload.valid_to, payload.issuing_authority,
                    payload.evidence_artifact_id, payload.status, payload.notes, created_by,
                ),
            )
            return _response(dict(cur.fetchone()))


def get_permit(*, company_id: int, permit_id: int) -> WaterPermitResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM water_permits WHERE id = %s AND {_SCOPE}",
                (permit_id, company_id),
            )
            row = cur.fetchone()
    if row is None:
        raise WaterPermitError(f"Permis eau '{permit_id}' introuvable.")
    return _response(dict(row))


def list_permits(
    *, company_id: int, site_id: int | None = None, status: str | None = None,
    limit: int = 50, offset: int = 0,
) -> WaterPermitListResponse:
    clauses = [_SCOPE]
    params: list[Any] = [company_id]
    if site_id is not None:
        clauses.append("site_id = %s")
        params.append(site_id)
    if status is not None:
        clauses.append("status = %s")
        params.append(status)
    where = f"WHERE {' AND '.join(clauses)}"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS c FROM water_permits {where}", params)
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT * FROM water_permits {where} ORDER BY id DESC LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            rows = cur.fetchall()
    return WaterPermitListResponse(
        items=[_response(dict(r)) for r in rows], total=total, limit=limit, offset=offset,
    )


def review_permit(
    *, company_id: int, permit_id: int, accept: bool, reviewed_by: int | None = None,
) -> WaterPermitResponse:
    """Gate de revue : `pending` → `accepted`/`flagged`."""
    target = "accepted" if accept else "flagged"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT review_status FROM water_permits WHERE id = %s AND {_SCOPE}",
                (permit_id, company_id),
            )
            row = cur.fetchone()
            if row is None:
                raise WaterPermitError(f"Permis eau '{permit_id}' introuvable.")
            if row["review_status"] != "pending":
                raise WaterPermitError(
                    f"Permis '{permit_id}' déjà revu ({row['review_status']}) — "
                    "seul un permis 'pending' est revu."
                )
            cur.execute(
                f"UPDATE water_permits SET review_status = %s, updated_at = now() "
                f"WHERE id = %s AND {_SCOPE} RETURNING *",
                (target, permit_id, company_id),
            )
            return _response(dict(cur.fetchone()))
