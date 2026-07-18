"""
instruments_service.py — instruments contractuels & allocations (PR-06A).

Instruments market-based (REC/GO/PPA/tarif vert) et leur ALLOCATION CONTRÔLÉE à
des activités énergie. L'allocation refuse explicitement :
  - la double allocation d'un même instrument à une même activité (UNIQUE base) ;
  - le dépassement du volume de l'instrument (survente de garanties — trigger base
    `energy_allocation_guard` + pré-contrôle applicatif pour un message clair) ;
  - un vecteur (carrier) incompatible entre instrument et activité ;
  - une période d'activité hors de la validité de l'instrument ;
  - un instrument expiré / non actif.

L'anti-double-allocation est garanti EN BASE (migration 031) : le service ajoute
un pré-contrôle lisible, mais la contrainte UNIQUE et le trigger sont la barrière
infranchissable, même en contournant le service (prouvé par test SQL direct).

Défense en profondeur : `company_id = %s` explicite sur chaque requête (la RLS
FORCE reste la garantie primaire en prod sous carbonco_app).
"""

from __future__ import annotations

from datetime import date
from typing import Any

from db.database import get_db
from models.energy import (
    AllocationRequest,
    AllocationResponse,
    InstrumentCreate,
    InstrumentResponse,
)
from services.energy import EnergyError

_INSTRUMENT_FIELDS = (
    "id", "company_id", "instrument_type", "carrier", "reference", "volume_mwh",
    "valid_from", "valid_to", "geography_code", "certificate_artifact_id", "status",
    "created_at", "updated_at",
)
_INSTRUMENT_COLS = ", ".join(_INSTRUMENT_FIELDS)
_INSTRUMENT_COLS_CI = ", ".join(f"ci.{f}" for f in _INSTRUMENT_FIELDS)
_ALLOCATION_COLS = (
    "id, company_id, instrument_id, energy_activity_id, allocated_mwh, "
    "allocated_at, allocated_by, created_at"
)


def _instrument_response(row: dict[str, Any], allocated_mwh: float) -> InstrumentResponse:
    volume = float(row["volume_mwh"])
    valid_to = row["valid_to"]
    is_expired = row["status"] != "active" or valid_to < date.today()
    return InstrumentResponse(
        **{k: row[k] for k in row if k != "volume_mwh"},
        volume_mwh=volume,
        allocated_mwh=round(allocated_mwh, 6),
        remaining_mwh=round(volume - allocated_mwh, 6),
        is_expired=is_expired,
    )


def create_instrument(*, company_id: int, payload: InstrumentCreate) -> InstrumentResponse:
    if payload.valid_to < payload.valid_from:
        raise EnergyError("Période de validité invalide : valid_to antérieure à valid_from (requise).")
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            _assert_artifact_in_scope(cur, company_id, payload.certificate_artifact_id)
            cur.execute(
                f"""
                INSERT INTO contractual_instruments
                    (company_id, instrument_type, carrier, reference, volume_mwh,
                     valid_from, valid_to, geography_code, certificate_artifact_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING {_INSTRUMENT_COLS}
                """,
                (
                    company_id, payload.instrument_type, payload.carrier, payload.reference,
                    payload.volume_mwh, payload.valid_from, payload.valid_to,
                    payload.geography_code, payload.certificate_artifact_id,
                ),
            )
            row = cur.fetchone()
    return _instrument_response(row, 0.0)


def _assert_artifact_in_scope(cur, company_id: int, artifact_id: int | None) -> None:
    """Le certificat (preuve) doit être un evidence_artifact DU tenant (ou global)."""
    if artifact_id is None:
        return
    cur.execute(
        "SELECT 1 FROM evidence_artifacts WHERE id = %s AND (company_id = %s OR company_id IS NULL)",
        (artifact_id, company_id),
    )
    if cur.fetchone() is None:
        raise EnergyError(f"Certificat (artefact) '{artifact_id}' introuvable.")


def get_instrument(*, company_id: int, instrument_id: int) -> InstrumentResponse:
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {_INSTRUMENT_COLS} FROM contractual_instruments "
                "WHERE id = %s AND company_id = %s",
                (instrument_id, company_id),
            )
            row = cur.fetchone()
            if row is None:
                raise EnergyError(f"Instrument '{instrument_id}' introuvable.")
            allocated = _allocated_sum(cur, company_id, instrument_id)
    return _instrument_response(row, allocated)


def _allocated_sum(cur, company_id: int, instrument_id: int) -> float:
    cur.execute(
        "SELECT COALESCE(SUM(allocated_mwh), 0) AS s FROM instrument_allocations "
        "WHERE instrument_id = %s AND company_id = %s",
        (instrument_id, company_id),
    )
    return float(cur.fetchone()["s"])


def list_instruments(
    *,
    company_id: int,
    limit: int = 50,
    offset: int = 0,
    carrier: str | None = None,
    status: str | None = None,
) -> tuple[list[InstrumentResponse], int]:
    where = ["ci.company_id = %s"]
    params: list[Any] = [company_id]
    if carrier:
        where.append("ci.carrier = %s")
        params.append(carrier)
    if status:
        where.append("ci.status = %s")
        params.append(status)
    clause = " AND ".join(where)
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT COUNT(*) AS c FROM contractual_instruments ci WHERE {clause}",
                tuple(params),
            )
            total = cur.fetchone()["c"]
            # Couverture (somme allouée) calculée en une passe, scopée tenant.
            cur.execute(
                f"""
                SELECT {_INSTRUMENT_COLS_CI}, COALESCE(alloc.s, 0) AS allocated_mwh
                FROM contractual_instruments ci
                LEFT JOIN (
                    SELECT instrument_id, SUM(allocated_mwh) AS s
                    FROM instrument_allocations WHERE company_id = %s GROUP BY instrument_id
                ) alloc ON alloc.instrument_id = ci.id
                WHERE {clause}
                ORDER BY ci.valid_to DESC, ci.id DESC
                LIMIT %s OFFSET %s
                """,
                (company_id, *params, limit, offset),
            )
            rows = cur.fetchall()
    out: list[InstrumentResponse] = []
    for r in rows:
        allocated = float(r.pop("allocated_mwh"))
        out.append(_instrument_response(r, allocated))
    return out, total


def allocate_instrument(
    *, company_id: int, instrument_id: int, payload: AllocationRequest, allocated_by: int | None,
) -> AllocationResponse:
    """Alloue une part du volume d'un instrument à une activité — contrôlé.

    Toutes les vérifications et l'insertion se font dans la MÊME transaction
    tenant : la somme allouée lue reflète l'état validé, et le trigger base
    reste le dernier rempart (survente impossible même en cas de course)."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, carrier, volume_mwh, valid_from, valid_to, status "
                "FROM contractual_instruments WHERE id = %s AND company_id = %s",
                (instrument_id, company_id),
            )
            inst = cur.fetchone()
            if inst is None:
                raise EnergyError(f"Instrument '{instrument_id}' introuvable.")

            cur.execute(
                "SELECT id, carrier, period_start, period_end "
                "FROM energy_activities WHERE id = %s AND company_id = %s",
                (payload.energy_activity_id, company_id),
            )
            act = cur.fetchone()
            if act is None:
                raise EnergyError(f"Activité '{payload.energy_activity_id}' introuvable.")

            # Instrument expiré / non actif → refus (le flag d'expiration est aussi
            # remonté en lecture pour l'UI, cf. list_instruments.is_expired).
            if inst["status"] != "active":
                raise EnergyError(f"Instrument '{instrument_id}' non actif (statut {inst['status']}).")
            if inst["valid_to"] < date.today():
                raise EnergyError(f"Instrument '{instrument_id}' expiré le {inst['valid_to']}.")

            # Vecteur (carrier) compatible.
            if inst["carrier"] != act["carrier"]:
                raise EnergyError(
                    f"Vecteur incompatible : instrument {inst['carrier']} vs activité {act['carrier']}."
                )

            # Période : la consommation doit tomber dans la validité de l'instrument.
            if act["period_start"] < inst["valid_from"] or act["period_end"] > inst["valid_to"]:
                raise EnergyError(
                    "Période incompatible : l'activité déborde de la fenêtre de validité de l'instrument."
                )

            # Double allocation de la même paire (message clair ; UNIQUE en base garde le fond).
            cur.execute(
                "SELECT 1 FROM instrument_allocations "
                "WHERE instrument_id = %s AND energy_activity_id = %s",
                (instrument_id, payload.energy_activity_id),
            )
            if cur.fetchone() is not None:
                raise EnergyError("Double allocation refusée : cette activité est déjà allouée à cet instrument.")

            # Dépassement de volume (survente) — pré-contrôle ; le trigger base
            # reste la garantie infranchissable.
            already = _allocated_sum(cur, company_id, instrument_id)
            if already + payload.allocated_mwh > float(inst["volume_mwh"]) + 1e-9:
                raise EnergyError(
                    "Dépassement refusé : l'allocation excède le volume disponible de l'instrument (survente)."
                )

            cur.execute(
                f"""
                INSERT INTO instrument_allocations
                    (company_id, instrument_id, energy_activity_id, allocated_mwh, allocated_by)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING {_ALLOCATION_COLS}
                """,
                (company_id, instrument_id, payload.energy_activity_id,
                 payload.allocated_mwh, allocated_by),
            )
            row = cur.fetchone()
    return AllocationResponse(**row)
