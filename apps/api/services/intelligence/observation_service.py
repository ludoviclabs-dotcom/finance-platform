"""
observation_service.py — faits normalisés issus d'une release (PR-03).

Une observation n'est jamais modifiée après création — `evidence_kernel_
guard('frozen')` (migration 028) le garantit au niveau base ; ce module
valide en amont (message clair, pas une erreur PostgreSQL brute) et ne
propose qu'une correction par supersession (nouvelle ligne + supersedes_id).
"""

from __future__ import annotations

from typing import Any

from db.database import get_db
from models.intelligence import ObservationCreate, ObservationResponse


class ObservationError(Exception):
    """Erreur métier d'une observation (valeur absente, référence hors périmètre…)."""


def _row_to_response(row: dict[str, Any]) -> ObservationResponse:
    return ObservationResponse(**row)


def _validate_value(payload: ObservationCreate) -> None:
    """Même contrat que la contrainte CHECK observations_value_presence_check
    (migration 028) — validé ici d'abord pour un message clair plutôt qu'une
    erreur PostgreSQL brute remontée telle quelle à l'appelant."""
    if payload.numeric_value is None and payload.text_value is None and payload.boolean_value is None:
        raise ObservationError(
            "Au moins une valeur (numeric_value, text_value ou boolean_value) est requise."
        )


def create_observation(*, company_id: int, payload: ObservationCreate) -> ObservationResponse:
    _validate_value(payload)

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM source_releases WHERE id = %s", (payload.source_release_id,))
            if cur.fetchone() is None:
                raise ObservationError(
                    f"Release '{payload.source_release_id}' introuvable ou hors périmètre."
                )

            if payload.evidence_artifact_id is not None:
                cur.execute(
                    "SELECT id FROM evidence_artifacts WHERE id = %s", (payload.evidence_artifact_id,)
                )
                if cur.fetchone() is None:
                    raise ObservationError(
                        f"Artefact '{payload.evidence_artifact_id}' introuvable ou hors périmètre."
                    )

            if payload.supersedes_id is not None:
                cur.execute("SELECT id FROM observations WHERE id = %s", (payload.supersedes_id,))
                if cur.fetchone() is None:
                    raise ObservationError(
                        f"Observation supersédée '{payload.supersedes_id}' introuvable ou hors périmètre."
                    )

            cur.execute(
                """
                INSERT INTO observations
                    (company_id, subject_type, subject_key, metric_code, numeric_value, text_value,
                     boolean_value, unit, geography_code, stage_code, observed_at, valid_from, valid_to,
                     source_release_id, evidence_artifact_id, data_status, confidence,
                     methodology_version, supersedes_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    company_id, payload.subject_type, payload.subject_key, payload.metric_code,
                    payload.numeric_value, payload.text_value, payload.boolean_value, payload.unit,
                    payload.geography_code, payload.stage_code, payload.observed_at, payload.valid_from,
                    payload.valid_to, payload.source_release_id, payload.evidence_artifact_id,
                    payload.data_status, payload.confidence, payload.methodology_version,
                    payload.supersedes_id,
                ),
            )
            row = cur.fetchone()
    return _row_to_response(row)


def get_observation(*, company_id: int, observation_id: int) -> ObservationResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM observations WHERE id = %s", (observation_id,))
            row = cur.fetchone()
    if row is None:
        raise ObservationError(f"Observation '{observation_id}' introuvable.")
    return _row_to_response(row)


def list_observations(
    *,
    company_id: int,
    subject_type: str | None = None,
    subject_key: str | None = None,
    metric_code: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[ObservationResponse], int]:
    clauses: list[str] = []
    params: list[Any] = []
    for column, value in (
        ("subject_type", subject_type),
        ("subject_key", subject_key),
        ("metric_code", metric_code),
    ):
        if value is not None:
            clauses.append(f"{column} = %s")
            params.append(value)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS c FROM observations {where}", params)
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT * FROM observations {where} "
                "ORDER BY observed_at DESC NULLS LAST, created_at DESC LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            rows = cur.fetchall()
    return [_row_to_response(r) for r in rows], total


def correct_observation(
    *, company_id: int, original_id: int, payload: ObservationCreate,
) -> ObservationResponse:
    """Corrige `original_id` en créant une NOUVELLE observation avec
    `supersedes_id=original_id` — l'originale n'est jamais touchée (le
    trigger `frozen` l'interdirait). `create_observation` valide déjà que
    `supersedes_id` existe et est accessible à ce tenant."""
    corrected = payload.model_copy(update={"supersedes_id": original_id})
    return create_observation(company_id=company_id, payload=corrected)
