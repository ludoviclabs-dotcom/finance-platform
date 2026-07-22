"""
regulatory_service.py — Module 2, statuts réglementaires des ressources (PR-M2A).

Une LIGNE par régime (crma, eudr, reach…), jamais un booléen : le statut est
NON EXCLUSIF (une ressource peut être critique CRMA ET dans le périmètre EUDR).
`certainty='confirmed'` exige une release source (Evidence Kernel) — garde
service DOUBLÉE par le CHECK SQL `resource_regulatory_statuses_sourced_check` :
aucune classification confirmée sans source primaire.

Portée mixte (lecture globale+tenant, écriture tenant), même contrat que
catalog_service — la résolution de slug est déléguée à `catalog_service`
(une seule vérité de résolution).
"""

from __future__ import annotations

from typing import Any

from db.database import get_db
from models.resources import (
    ResourceRegulatoryStatusCreate,
    ResourceRegulatoryStatusListResponse,
    ResourceRegulatoryStatusResponse,
)
from services.resources import catalog_service

_SCOPE_READ = "(company_id = %s OR company_id IS NULL)"


class ResourceRegulatoryError(Exception):
    """Erreur métier des statuts réglementaires (introuvable, source requise…)."""


def _status_response(row: dict[str, Any]) -> ResourceRegulatoryStatusResponse:
    return ResourceRegulatoryStatusResponse(
        **{k: row[k] for k in ResourceRegulatoryStatusResponse.model_fields}
    )


def list_statuses(
    *, company_id: int, slug: str, regime: str | None = None, limit: int = 50, offset: int = 0
) -> ResourceRegulatoryStatusListResponse:
    clauses = ["resource_id = %s", _SCOPE_READ]
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            resource = catalog_service.resolve_resource(cur, company_id=company_id, slug=slug)
            params: list[Any] = [resource["id"], company_id]
            if regime:
                clauses.append("regime = %s")
                params.append(regime)
            where = " AND ".join(clauses)
            cur.execute(
                f"SELECT COUNT(*) AS n FROM resource_regulatory_statuses WHERE {where}", params
            )
            total = cur.fetchone()["n"]
            cur.execute(
                f"""
                SELECT * FROM resource_regulatory_statuses WHERE {where}
                ORDER BY regime, regulation_ref NULLS LAST LIMIT %s OFFSET %s
                """,
                (*params, limit, offset),
            )
            items = [_status_response(r) for r in cur.fetchall()]
    return ResourceRegulatoryStatusListResponse(items=items, total=total, limit=limit, offset=offset)


def create_status(
    *, company_id: int, slug: str, payload: ResourceRegulatoryStatusCreate,
    created_by: int | None = None,
) -> ResourceRegulatoryStatusResponse:
    """Enregistre un statut réglementaire TENANT pour une ressource. Une
    classification « confirmed » exige une release source enregistrée."""
    if payload.certainty == "confirmed" and payload.source_release_id is None:
        raise ResourceRegulatoryError(
            "Un statut réglementaire « confirmed » requiert une release source (source_release_id)."
        )
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            resource = catalog_service.resolve_resource(cur, company_id=company_id, slug=slug)
            cur.execute(
                """
                INSERT INTO resource_regulatory_statuses
                    (company_id, resource_id, regime, regulation_ref, list_or_annex,
                     listing_status, validity_note, certainty, source_release_id,
                     verified_on, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (company_id, resource_id, regime, regulation_ref) DO NOTHING
                RETURNING *
                """,
                (
                    company_id, resource["id"], payload.regime, payload.regulation_ref,
                    payload.list_or_annex, payload.listing_status, payload.validity_note,
                    payload.certainty, payload.source_release_id, payload.verified_on, created_by,
                ),
            )
            row = cur.fetchone()
            if row is None:
                raise ResourceRegulatoryError(
                    f"Statut réglementaire {payload.regime}"
                    f"/{payload.regulation_ref or '—'} déjà enregistré pour '{slug}'."
                )
    return _status_response(row)
