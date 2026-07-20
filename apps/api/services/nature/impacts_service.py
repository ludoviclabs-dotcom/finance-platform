"""
impacts_service.py — `nature_impacts` (PR-09 tranche A, Evaluate).

CRUD gaté par revue humaine (`pending -> accepted/flagged`). Un impact dit que
l'entreprise AFFECTE un écosystème (`pressure_type` porte la pression TNFD
comme ATTRIBUT, pas une table séparée — plan §2) — JAMAIS fusionné avec
`nature_dependencies` (table séparée, colonnes disjointes dès le schéma).

Défense en profondeur applicative (contrats §7) : prédicat `company_id = %s`
sur chaque requête (le superuser de CI bypasse la RLS).
"""

from __future__ import annotations

from typing import Any

from db.database import get_db
from models.nature import (
    NatureImpactCreate,
    NatureImpactListResponse,
    NatureImpactResponse,
)

_SCOPE = "company_id = %s"


class NatureImpactError(Exception):
    """Erreur métier des impacts nature."""


def _assert_in_scope(cur, company_id: int, table: str, row_id: int | None, label: str) -> None:
    if row_id is None:
        return
    cur.execute(f"SELECT 1 FROM {table} WHERE id = %s AND {_SCOPE}", (row_id, company_id))
    if cur.fetchone() is None:
        raise NatureImpactError(f"{label} '{row_id}' introuvable.")


def create_impact(
    *, company_id: int, payload: NatureImpactCreate, created_by: int | None = None,
) -> NatureImpactResponse:
    if payload.site_id is None and payload.bom_item_id is None and not payload.material_id:
        raise NatureImpactError(
            "Un impact nature exige un ancrage : site, composant BOM ou matière — "
            "jamais une ligne orpheline."
        )
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            _assert_in_scope(cur, company_id, "sites", payload.site_id, "Site")
            _assert_in_scope(cur, company_id, "bom_items", payload.bom_item_id, "Composant BOM")
            cur.execute(
                """
                INSERT INTO nature_impacts
                    (company_id, site_id, bom_item_id, material_id, pressure_type,
                     impact_kind, magnitude_qualitative, rationale, data_status,
                     review_status, source_release_id, evidence_artifact_id, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', %s, %s, %s)
                RETURNING *
                """,
                (
                    company_id, payload.site_id, payload.bom_item_id, payload.material_id,
                    payload.pressure_type, payload.impact_kind, payload.magnitude_qualitative,
                    payload.rationale, payload.data_status, payload.source_release_id,
                    payload.evidence_artifact_id, created_by,
                ),
            )
            return NatureImpactResponse(**dict(cur.fetchone()))


def list_impacts(
    *, company_id: int, site_id: int | None = None, impact_kind: str | None = None,
    review_status: str | None = None, limit: int = 50, offset: int = 0,
) -> NatureImpactListResponse:
    clauses = [_SCOPE]
    params: list[Any] = [company_id]
    if site_id is not None:
        clauses.append("site_id = %s")
        params.append(site_id)
    if impact_kind is not None:
        clauses.append("impact_kind = %s")
        params.append(impact_kind)
    if review_status is not None:
        clauses.append("review_status = %s")
        params.append(review_status)
    where = f"WHERE {' AND '.join(clauses)}"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS c FROM nature_impacts {where}", params)
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT * FROM nature_impacts {where} ORDER BY id DESC LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            rows = cur.fetchall()
    return NatureImpactListResponse(
        items=[NatureImpactResponse(**dict(r)) for r in rows],
        total=total, limit=limit, offset=offset,
    )


def get_impact(*, company_id: int, impact_id: int) -> NatureImpactResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM nature_impacts WHERE id = %s AND {_SCOPE}",
                (impact_id, company_id),
            )
            row = cur.fetchone()
    if row is None:
        raise NatureImpactError(f"Impact nature '{impact_id}' introuvable.")
    return NatureImpactResponse(**dict(row))


def review_impact(
    *, company_id: int, impact_id: int, accept: bool, reviewed_by: int | None = None,
) -> NatureImpactResponse:
    target = "accepted" if accept else "flagged"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT review_status FROM nature_impacts WHERE id = %s AND {_SCOPE}",
                (impact_id, company_id),
            )
            row = cur.fetchone()
            if row is None:
                raise NatureImpactError(f"Impact nature '{impact_id}' introuvable.")
            if row["review_status"] != "pending":
                raise NatureImpactError(
                    f"Impact '{impact_id}' déjà revu ({row['review_status']}) — "
                    "seule une ligne 'pending' est revue."
                )
            cur.execute(
                f"UPDATE nature_impacts SET review_status = %s, updated_at = now() "
                f"WHERE id = %s AND {_SCOPE} RETURNING *",
                (target, impact_id, company_id),
            )
            return NatureImpactResponse(**dict(cur.fetchone()))
