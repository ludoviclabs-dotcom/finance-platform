"""
supply_service.py — observations de part-pays PAR ÉTAPE (PR-M2B).

Portée mixte (lecture globale+tenant, écriture tenant). Entrée du HHI. La règle
« pas de fait vérifié sans source » est portée par le CHECK SQL
`resource_supply_sourced_check` ET par ce service.
"""

from __future__ import annotations

from typing import Any

from db.database import get_db
from models.resources import (
    ResourceSupplyObservationCreate,
    ResourceSupplyObservationListResponse,
    ResourceSupplyObservationResponse,
)
from services.resources import catalog_service

_SCOPE_READ = "(company_id = %s OR company_id IS NULL)"


class ResourceSupplyError(Exception):
    """Erreur métier des observations de supply (introuvable, doublon, source requise…)."""


def _response(row: dict[str, Any]) -> ResourceSupplyObservationResponse:
    data = {k: row[k] for k in ResourceSupplyObservationResponse.model_fields}
    for num in ("share_pct", "volume_value", "confidence"):
        if data.get(num) is not None:
            data[num] = float(data[num])
    return ResourceSupplyObservationResponse(**data)


def create_observation(
    *, company_id: int, slug: str, payload: ResourceSupplyObservationCreate,
    created_by: int | None = None,
) -> ResourceSupplyObservationResponse:
    if payload.data_status == "verified" and payload.source_release_id is None:
        raise ResourceSupplyError(
            "Une observation « verified » requiert une release source (source_release_id)."
        )
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            resource = catalog_service.resolve_resource(cur, company_id=company_id, slug=slug)
            cur.execute(
                """
                INSERT INTO resource_supply_observations
                    (company_id, resource_id, stage_code, country_code, metric_code, share_pct,
                     volume_value, volume_unit, reference_year, data_status, confidence,
                     methodology_version, source_release_id, evidence_artifact_id, observed_at,
                     created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (company_id, resource_id, stage_code, country_code, reference_year, metric_code)
                DO NOTHING
                RETURNING *
                """,
                (
                    company_id, resource["id"], payload.stage_code, payload.country_code,
                    payload.metric_code, payload.share_pct, payload.volume_value, payload.volume_unit,
                    payload.reference_year, payload.data_status, payload.confidence,
                    payload.methodology_version, payload.source_release_id,
                    payload.evidence_artifact_id, payload.observed_at, created_by,
                ),
            )
            row = cur.fetchone()
            if row is None:
                raise ResourceSupplyError(
                    f"Observation ({payload.stage_code}/{payload.country_code}/"
                    f"{payload.reference_year}/{payload.metric_code}) déjà enregistrée pour '{slug}'."
                )
    return _response(row)


def list_observations(
    *, company_id: int, slug: str, stage_code: str | None = None,
    reference_year: int | None = None, limit: int = 50, offset: int = 0,
) -> ResourceSupplyObservationListResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            resource = catalog_service.resolve_resource(cur, company_id=company_id, slug=slug)
            clauses = ["resource_id = %s", _SCOPE_READ]
            params: list[Any] = [resource["id"], company_id]
            if stage_code:
                clauses.append("stage_code = %s")
                params.append(stage_code)
            if reference_year is not None:
                clauses.append("reference_year = %s")
                params.append(reference_year)
            where = " AND ".join(clauses)
            cur.execute(f"SELECT COUNT(*) AS n FROM resource_supply_observations WHERE {where}", params)
            total = cur.fetchone()["n"]
            cur.execute(
                f"""
                SELECT * FROM resource_supply_observations WHERE {where}
                ORDER BY stage_code, share_pct DESC NULLS LAST, country_code LIMIT %s OFFSET %s
                """,
                (*params, limit, offset),
            )
            items = [_response(r) for r in cur.fetchall()]
    return ResourceSupplyObservationListResponse(items=items, total=total, limit=limit, offset=offset)
