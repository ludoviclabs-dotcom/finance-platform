"""
dependencies_service.py — `nature_dependencies` (PR-09 tranche A, Evaluate).

CRUD gaté par revue humaine (`pending -> accepted/flagged`). Une dépendance dit
que l'entreprise A BESOIN d'un service écosystémique — JAMAIS fusionnée avec
`nature_impacts` (table séparée, colonnes disjointes dès le schéma, motif
TNFD). `material_id` sans FK (motif 034, le référentiel `materials` n'existe
toujours pas) ; `bom_item_id` porte une vraie FK (la table existe, 030).

Défense en profondeur applicative (contrats §7) : prédicat `company_id = %s`
sur chaque requête (le superuser de CI bypasse la RLS).
"""

from __future__ import annotations

from typing import Any

from db.database import get_db
from models.nature import (
    NatureDependencyCreate,
    NatureDependencyListResponse,
    NatureDependencyResponse,
)

_SCOPE = "company_id = %s"


class NatureDependencyError(Exception):
    """Erreur métier des dépendances nature."""


def _assert_in_scope(cur, company_id: int, table: str, row_id: int | None, label: str) -> None:
    if row_id is None:
        return
    cur.execute(f"SELECT 1 FROM {table} WHERE id = %s AND {_SCOPE}", (row_id, company_id))
    if cur.fetchone() is None:
        raise NatureDependencyError(f"{label} '{row_id}' introuvable.")


def create_dependency(
    *, company_id: int, payload: NatureDependencyCreate, created_by: int | None = None,
) -> NatureDependencyResponse:
    if payload.site_id is None and payload.bom_item_id is None and not payload.material_id:
        raise NatureDependencyError(
            "Une dépendance nature exige un ancrage : site, composant BOM ou matière — "
            "jamais une ligne orpheline."
        )
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            _assert_in_scope(cur, company_id, "sites", payload.site_id, "Site")
            _assert_in_scope(cur, company_id, "bom_items", payload.bom_item_id, "Composant BOM")
            cur.execute(
                """
                INSERT INTO nature_dependencies
                    (company_id, site_id, bom_item_id, material_id, ecosystem_service,
                     dependency_level, rationale, data_status, review_status,
                     source_release_id, evidence_artifact_id, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'pending', %s, %s, %s)
                RETURNING *
                """,
                (
                    company_id, payload.site_id, payload.bom_item_id, payload.material_id,
                    payload.ecosystem_service, payload.dependency_level, payload.rationale,
                    payload.data_status, payload.source_release_id,
                    payload.evidence_artifact_id, created_by,
                ),
            )
            return NatureDependencyResponse(**dict(cur.fetchone()))


def list_dependencies(
    *, company_id: int, site_id: int | None = None, review_status: str | None = None,
    limit: int = 50, offset: int = 0,
) -> NatureDependencyListResponse:
    clauses = [_SCOPE]
    params: list[Any] = [company_id]
    if site_id is not None:
        clauses.append("site_id = %s")
        params.append(site_id)
    if review_status is not None:
        clauses.append("review_status = %s")
        params.append(review_status)
    where = f"WHERE {' AND '.join(clauses)}"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS c FROM nature_dependencies {where}", params)
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT * FROM nature_dependencies {where} ORDER BY id DESC LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            rows = cur.fetchall()
    return NatureDependencyListResponse(
        items=[NatureDependencyResponse(**dict(r)) for r in rows],
        total=total, limit=limit, offset=offset,
    )


def get_dependency(*, company_id: int, dependency_id: int) -> NatureDependencyResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM nature_dependencies WHERE id = %s AND {_SCOPE}",
                (dependency_id, company_id),
            )
            row = cur.fetchone()
    if row is None:
        raise NatureDependencyError(f"Dépendance nature '{dependency_id}' introuvable.")
    return NatureDependencyResponse(**dict(row))


def review_dependency(
    *, company_id: int, dependency_id: int, accept: bool, reviewed_by: int | None = None,
) -> NatureDependencyResponse:
    target = "accepted" if accept else "flagged"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT review_status FROM nature_dependencies WHERE id = %s AND {_SCOPE}",
                (dependency_id, company_id),
            )
            row = cur.fetchone()
            if row is None:
                raise NatureDependencyError(f"Dépendance nature '{dependency_id}' introuvable.")
            if row["review_status"] != "pending":
                raise NatureDependencyError(
                    f"Dépendance '{dependency_id}' déjà revue ({row['review_status']}) — "
                    "seule une ligne 'pending' est revue."
                )
            cur.execute(
                f"UPDATE nature_dependencies SET review_status = %s, updated_at = now() "
                f"WHERE id = %s AND {_SCOPE} RETURNING *",
                (target, dependency_id, company_id),
            )
            return NatureDependencyResponse(**dict(cur.fetchone()))
