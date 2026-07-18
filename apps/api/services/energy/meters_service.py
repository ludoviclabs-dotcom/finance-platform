"""
meters_service.py — compteurs d'énergie (PR-06A).

CRUD tenant des compteurs (électricité, gaz, chaleur, vapeur…). Isolation en
profondeur (défense à deux niveaux, comme source_service / evidence_service) :
la RLS de la migration 031 (FORCE) reste la garantie PRIMAIRE (l'app tourne en
prod sous carbonco_app) ; EN PLUS, chaque requête porte explicitement son
prédicat de périmètre `company_id = %s` — indispensable pour que les tests
d'isolation soient verts même sous le rôle superuser de la CI (qui bypasse la
RLS). Une ligne hors périmètre ou inexistante lève la MÊME erreur (jamais de
fuite d'existence).
"""

from __future__ import annotations

from typing import Any

from db.database import get_db
from models.energy import MeterCreate, MeterResponse
from services.energy import EnergyError

_COLS = (
    "id, company_id, site_id, carrier, meter_code, label, unit, active, "
    "created_at, updated_at"
)


def _row_to_response(row: dict[str, Any]) -> MeterResponse:
    return MeterResponse(**row)


def _assert_site_in_scope(cur, company_id: int, site_id: int | None) -> None:
    """Un compteur ne peut référencer qu'un site DU tenant (le FK sites(id) ne
    vérifie pas le tenant ; la RLS de sites empêche de le voir, mais l'INSERT
    du FK réussirait sur un id cross-tenant sans ce contrôle explicite)."""
    if site_id is None:
        return
    cur.execute(
        "SELECT 1 FROM sites WHERE id = %s AND company_id = %s",
        (site_id, company_id),
    )
    if cur.fetchone() is None:
        raise EnergyError(f"Site '{site_id}' introuvable.")


def create_meter(*, company_id: int, payload: MeterCreate) -> MeterResponse:
    """Crée un compteur tenant. `meter_code` unique par tenant (ON CONFLICT
    ciblant l'index d'unicité — atomique, pas de course SELECT→INSERT)."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            _assert_site_in_scope(cur, company_id, payload.site_id)
            cur.execute(
                f"""
                INSERT INTO energy_meters
                    (company_id, site_id, carrier, meter_code, label, unit, active)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (company_id, meter_code) DO NOTHING
                RETURNING {_COLS}
                """,
                (
                    company_id, payload.site_id, payload.carrier, payload.meter_code,
                    payload.label, payload.unit, payload.active,
                ),
            )
            row = cur.fetchone()
    if row is None:
        raise EnergyError(f"Code de compteur déjà utilisé pour ce tenant : '{payload.meter_code}'")
    return _row_to_response(row)


def get_meter(*, company_id: int, meter_id: int) -> MeterResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {_COLS} FROM energy_meters WHERE id = %s AND company_id = %s",
                (meter_id, company_id),
            )
            row = cur.fetchone()
    if row is None:
        raise EnergyError(f"Compteur '{meter_id}' introuvable.")
    return _row_to_response(row)


def list_meters(
    *,
    company_id: int,
    limit: int = 50,
    offset: int = 0,
    carrier: str | None = None,
    active_only: bool = False,
) -> tuple[list[MeterResponse], int]:
    where = ["company_id = %s"]
    params: list[Any] = [company_id]
    if carrier:
        where.append("carrier = %s")
        params.append(carrier)
    if active_only:
        where.append("active = TRUE")
    clause = " AND ".join(where)
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS c FROM energy_meters WHERE {clause}", tuple(params))
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT {_COLS} FROM energy_meters WHERE {clause} "
                "ORDER BY created_at DESC LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            rows = cur.fetchall()
    return [_row_to_response(r) for r in rows], total
