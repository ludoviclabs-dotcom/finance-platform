"""
ingestion_service.py — exécutions de détection/import pour une source (PR-03).

Un run est idempotent sur `idempotency_key` (créé une fois, relancer avec la
même clé renvoie le run existant) et transite `pending -> running -> ... ->
{published|failed|blocked_license}` (terminal). Aucun état terminal n'est
jamais rouvert silencieusement — pas de trigger DB ici (contrairement à
observations/source_releases) : la garde est appliquée en Python parce que
ingestion_runs n'a pas de contrat d'immutabilité au niveau schéma (mission,
§Immutabilité — seuls source_releases/observations/evidence_artifacts en ont un).
"""

from __future__ import annotations

from typing import Any

from db.database import get_db
from models.intelligence import IngestionRunResponse, IngestionStatus

_TERMINAL_STATUSES = {"published", "failed", "blocked_license"}


class IngestionError(Exception):
    """Erreur métier d'un run d'ingestion (introuvable, statut terminal…)."""


def _row_to_response(row: dict[str, Any]) -> IngestionRunResponse:
    return IngestionRunResponse(**row)


def start_run(
    *,
    company_id: int,
    source_id: int,
    idempotency_key: str,
    adapter_kind: str | None = None,
    source_release_id: int | None = None,
    created_by: int | None = None,
) -> IngestionRunResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM source_registry WHERE id = %s", (source_id,))
            if cur.fetchone() is None:
                raise IngestionError(f"Source '{source_id}' introuvable.")
            cur.execute(
                """
                INSERT INTO ingestion_runs
                    (company_id, source_id, source_release_id, adapter_kind, idempotency_key,
                     status, created_by)
                VALUES (%s, %s, %s, %s, %s, 'pending', %s)
                ON CONFLICT (idempotency_key) DO NOTHING
                RETURNING *
                """,
                (company_id, source_id, source_release_id, adapter_kind, idempotency_key, created_by),
            )
            row = cur.fetchone()
            if row is None:
                cur.execute("SELECT * FROM ingestion_runs WHERE idempotency_key = %s", (idempotency_key,))
                row = cur.fetchone()
    if row is None:
        raise IngestionError("Création de run incohérente (conflit détecté puis lecture vide).")
    return _row_to_response(row)


def get_run(*, company_id: int, run_id: int) -> IngestionRunResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM ingestion_runs WHERE id = %s", (run_id,))
            row = cur.fetchone()
    if row is None:
        raise IngestionError(f"Run '{run_id}' introuvable.")
    return _row_to_response(row)


def list_runs(
    *, company_id: int, source_id: int | None = None, limit: int = 50, offset: int = 0,
) -> tuple[list[IngestionRunResponse], int]:
    where = "WHERE source_id = %s" if source_id is not None else ""
    params: tuple[Any, ...] = (source_id,) if source_id is not None else ()
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS c FROM ingestion_runs {where}", params)
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT * FROM ingestion_runs {where} ORDER BY started_at DESC LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            rows = cur.fetchall()
    return [_row_to_response(r) for r in rows], total


def update_run(
    *,
    company_id: int,
    run_id: int,
    status: IngestionStatus | None = None,
    detected_count: int | None = None,
    accepted_count: int | None = None,
    rejected_count: int | None = None,
    warning_count: int | None = None,
    error_summary: str | None = None,
) -> IngestionRunResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM ingestion_runs WHERE id = %s", (run_id,))
            run = cur.fetchone()
            if run is None:
                raise IngestionError(f"Run '{run_id}' introuvable.")
            if run["status"] in _TERMINAL_STATUSES:
                raise IngestionError(
                    f"Run '{run_id}' déjà au statut terminal '{run['status']}' — plus modifiable."
                )

            set_parts: list[str] = []
            values: list[Any] = []
            for column, value in (
                ("status", status),
                ("detected_count", detected_count),
                ("accepted_count", accepted_count),
                ("rejected_count", rejected_count),
                ("warning_count", warning_count),
                ("error_summary", error_summary),
            ):
                if value is not None:
                    set_parts.append(f"{column} = %s")
                    values.append(value)
            if status is not None and status in _TERMINAL_STATUSES:
                set_parts.append("completed_at = now()")

            if not set_parts:
                return _row_to_response(run)

            cur.execute(
                f"UPDATE ingestion_runs SET {', '.join(set_parts)} WHERE id = %s RETURNING *",
                (*values, run_id),
            )
            row = cur.fetchone()
    return _row_to_response(row)


def fail_run(*, company_id: int, run_id: int, error_summary: str) -> IngestionRunResponse:
    return update_run(company_id=company_id, run_id=run_id, status="failed", error_summary=error_summary)
