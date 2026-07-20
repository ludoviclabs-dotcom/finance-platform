"""
disclosure_mapping_service.py — `disclosure_mappings` (PR-10, migration 040).

Table de correspondance PURE — CRUD uniquement, n'écrit JAMAIS dans
`vsme_datapoints`/`vsme_field_values` (référentiel VSME, migrations 014/015,
lecture seule si un jour consommé) et ne déclenche AUCUNE publication
automatique : `status` (`draft`/`mapped`/`disclosed`) est toujours posé par
un appel humain explicite, jamais par une règle de calcul.

`esrs_reference` reste TEXT libre (voir commentaire détaillé dans la
migration 040) : le catalogue `vsme_datapoints` (47 points, modules B1-C9)
est un sous-ensemble volontairement simplifié du standard VSME, pas le
référentiel ESRS complet — une FK stricte bloquerait toute correspondance à
un point de donnée ESRS hors couverture VSME.
"""

from __future__ import annotations

from typing import Any

from db.database import get_db
from models.iro import (
    DisclosureMappingCreate,
    DisclosureMappingListResponse,
    DisclosureMappingResponse,
)

from . import iro_service

_SCOPE = "company_id = %s"


class DisclosureMappingError(Exception):
    """Erreur métier des correspondances de disclosure."""


def _mapping_row(row: dict[str, Any]) -> DisclosureMappingResponse:
    return DisclosureMappingResponse(**{k: row[k] for k in DisclosureMappingResponse.model_fields})


def create_mapping(
    *, company_id: int, iro_id: int, payload: DisclosureMappingCreate, created_by: int | None = None,
) -> DisclosureMappingResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            iro_service.assert_iro_in_scope(cur, company_id, iro_id)
            cur.execute(
                """
                INSERT INTO disclosure_mappings
                    (company_id, iro_id, esrs_reference, status, notes, created_by)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (company_id, iro_id, payload.esrs_reference, payload.status, payload.notes, created_by),
            )
            return _mapping_row(dict(cur.fetchone()))


def list_mappings(
    *, company_id: int, iro_id: int, limit: int = 50, offset: int = 0,
) -> DisclosureMappingListResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            iro_service.assert_iro_in_scope(cur, company_id, iro_id)
            cur.execute(
                f"SELECT COUNT(*) AS n FROM disclosure_mappings WHERE iro_id = %s AND {_SCOPE}",
                (iro_id, company_id),
            )
            total = cur.fetchone()["n"]
            cur.execute(
                f"SELECT * FROM disclosure_mappings WHERE iro_id = %s AND {_SCOPE} "
                "ORDER BY id DESC LIMIT %s OFFSET %s",
                (iro_id, company_id, limit, offset),
            )
            items = [_mapping_row(dict(r)) for r in cur.fetchall()]
    return DisclosureMappingListResponse(items=items, total=total, limit=limit, offset=offset)
