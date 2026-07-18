"""
source_service.py — registre des sources externes (PR-03).

Un tenant crée/lit/désactive ses propres sources et peut LIRE les sources
globales (`company_id IS NULL`, policy de lecture de la migration 028) mais
ne peut jamais en créer ou en modifier une — appliqué par la policy RLS
d'écriture (`company_id = tenant courant`, jamais NULL), pas par ce module :
toute tentative de contourner `company_id` échouerait de toute façon côté
base. `get_source`/`update_source` filtrées par id seul (RLS fait le tri) :
une ligne hors périmètre ou inexistante lève la MÊME erreur, jamais de fuite
(même principe que evidence_service.get_evidence_file).
"""

from __future__ import annotations

from typing import Any

from db.database import get_db
from models.intelligence import SourceCreate, SourceResponse, SourceUpdate


class SourceError(Exception):
    """Erreur métier du registre de sources (introuvable, code déjà utilisé…)."""


def _row_to_response(row: dict[str, Any]) -> SourceResponse:
    return SourceResponse(**row)


def create_source(*, company_id: int, payload: SourceCreate, created_by: int | None) -> SourceResponse:
    """Crée une source tenant. `ON CONFLICT ... DO NOTHING` cible précisément
    l'index partiel tenant (idx_source_registry_code_tenant_uniq) — atomique,
    pas de fenêtre de course entre un SELECT de vérification et l'INSERT."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO source_registry
                    (company_id, code, publisher, title, source_type, adapter_kind, base_uri,
                     license_code, automated_access_allowed, storage_allowed, commercial_use_allowed,
                     redistribution_allowed, derived_use_allowed, display_allowed, attribution_text,
                     terms_uri, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (company_id, code) WHERE company_id IS NOT NULL DO NOTHING
                RETURNING *
                """,
                (
                    company_id, payload.code, payload.publisher, payload.title, payload.source_type,
                    payload.adapter_kind, payload.base_uri, payload.license_code,
                    payload.automated_access_allowed, payload.storage_allowed,
                    payload.commercial_use_allowed, payload.redistribution_allowed,
                    payload.derived_use_allowed, payload.display_allowed, payload.attribution_text,
                    payload.terms_uri, created_by,
                ),
            )
            row = cur.fetchone()
    if row is None:
        raise SourceError(f"Code de source déjà utilisé pour ce tenant : '{payload.code}'")
    return _row_to_response(row)


def get_source(*, company_id: int, source_id: int) -> SourceResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM source_registry WHERE id = %s", (source_id,))
            row = cur.fetchone()
    if row is None:
        raise SourceError(f"Source '{source_id}' introuvable.")
    return _row_to_response(row)


def list_sources(
    *, company_id: int, limit: int = 50, offset: int = 0, active_only: bool = False,
) -> tuple[list[SourceResponse], int]:
    where = "WHERE active = TRUE" if active_only else ""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS c FROM source_registry {where}")
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT * FROM source_registry {where} ORDER BY created_at DESC LIMIT %s OFFSET %s",
                (limit, offset),
            )
            rows = cur.fetchall()
    return [_row_to_response(r) for r in rows], total


def update_source(*, company_id: int, source_id: int, payload: SourceUpdate) -> SourceResponse:
    """PATCH partiel — seuls les champs explicitement fournis sont modifiés.

    `fields` vient exclusivement des noms de champs de `SourceUpdate` (jamais
    d'une chaîne utilisateur) : le `SET` dynamique n'est donc pas exposé à
    une injection SQL.
    """
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        return get_source(company_id=company_id, source_id=source_id)

    set_clause = ", ".join(f"{k} = %s" for k in fields)
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE source_registry SET {set_clause}, updated_at = now() WHERE id = %s RETURNING *",
                (*fields.values(), source_id),
            )
            row = cur.fetchone()
    if row is None:
        raise SourceError(f"Source '{source_id}' introuvable ou hors périmètre.")
    return _row_to_response(row)


def deactivate_source(*, company_id: int, source_id: int) -> SourceResponse:
    return update_source(company_id=company_id, source_id=source_id, payload=SourceUpdate(active=False))
