"""
routers/energy.py — Énergie & Scope 2 (PR-06A), préfixe `/energy`.

Lecture (GET) : tout utilisateur authentifié du tenant (`get_current_user`, RLS
filtre le tenant automatiquement). Écriture (POST) : `require_analyst`. Aucun
calcul Scope 2 exposé (PR-06B) — ces endpoints ne servent QUE la fondation de
données (compteurs, activités, instruments, allocations).

Erreurs : un helper lexical local traduit `EnergyError` en HTTP (même convention
que routers/intelligence.py — `introuvable` → 404, `requis/requise` → 400, sinon
409). Le helper est volontairement dupliqué ici plutôt que factorisé dans un
module partagé tant qu'aucune PR Wave 2 n'est mergée (le module commun
`routers/_errors.py` est « à confirmer » en PR-05, contrats §6).
"""

from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from db.database import db_available
from models.energy import (
    ActivityImportRequest,
    ActivityImportResult,
    ActivityListResponse,
    ActivityResponse,
    AllocationRequest,
    AllocationResponse,
    InstrumentCreate,
    InstrumentListResponse,
    InstrumentResponse,
    MeterCreate,
    MeterListResponse,
    MeterResponse,
)
from routers.auth import get_current_user, require_analyst
from services.auth_service import AuthUser
from services.energy import (
    EnergyError,
    activities_service,
    instruments_service,
    meters_service,
)

router = APIRouter()


def _http_error(exc: Exception) -> HTTPException:
    message = str(exc)
    if "introuvable" in message:
        return HTTPException(404, detail=message)
    if "requise" in message or "requis" in message:
        return HTTPException(400, detail=message)
    return HTTPException(409, detail=message)


def _require_db() -> None:
    if not db_available():
        raise HTTPException(503, detail="Base de données indisponible")


# ---------------------------------------------------------------------------
# Compteurs
# ---------------------------------------------------------------------------

@router.get("/meters", response_model=MeterListResponse)
async def list_meters_endpoint(
    carrier: str | None = None,
    active_only: bool = False,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    user: AuthUser = Depends(get_current_user),
) -> MeterListResponse:
    _require_db()
    items, total = meters_service.list_meters(
        company_id=user.company_id, limit=limit, offset=offset,
        carrier=carrier, active_only=active_only,
    )
    return MeterListResponse(items=items, total=total, limit=limit, offset=offset)


@router.post("/meters", response_model=MeterResponse, status_code=201)
async def create_meter_endpoint(
    body: MeterCreate,
    user: AuthUser = Depends(require_analyst),
) -> MeterResponse:
    _require_db()
    try:
        return meters_service.create_meter(company_id=user.company_id, payload=body)
    except EnergyError as exc:
        raise _http_error(exc) from exc


@router.get("/meters/{meter_id}", response_model=MeterResponse)
async def get_meter_endpoint(
    meter_id: int,
    user: AuthUser = Depends(get_current_user),
) -> MeterResponse:
    _require_db()
    try:
        return meters_service.get_meter(company_id=user.company_id, meter_id=meter_id)
    except EnergyError as exc:
        raise _http_error(exc) from exc


# ---------------------------------------------------------------------------
# Activités (import CSV idempotent + gate de revue)
# ---------------------------------------------------------------------------

@router.post("/activities/import", response_model=ActivityImportResult)
async def import_activities_endpoint(
    body: ActivityImportRequest,
    user: AuthUser = Depends(require_analyst),
) -> ActivityImportResult:
    _require_db()
    try:
        return activities_service.import_activities(
            company_id=user.company_id, filename=body.filename, csv_text=body.csv_text,
        )
    except EnergyError as exc:
        raise _http_error(exc) from exc


@router.get("/activities", response_model=ActivityListResponse)
async def list_activities_endpoint(
    site_id: int | None = None,
    carrier: str | None = None,
    review_status: str | None = None,
    period_from: date | None = None,
    period_to: date | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    user: AuthUser = Depends(get_current_user),
) -> ActivityListResponse:
    _require_db()
    items, total = activities_service.list_activities(
        company_id=user.company_id, limit=limit, offset=offset,
        site_id=site_id, carrier=carrier, review_status=review_status,
        period_from=period_from, period_to=period_to,
    )
    return ActivityListResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/activities/{activity_id}", response_model=ActivityResponse)
async def get_activity_endpoint(
    activity_id: int,
    user: AuthUser = Depends(get_current_user),
) -> ActivityResponse:
    _require_db()
    try:
        return activities_service.get_activity(company_id=user.company_id, activity_id=activity_id)
    except EnergyError as exc:
        raise _http_error(exc) from exc


# ---------------------------------------------------------------------------
# Instruments contractuels & allocations
# ---------------------------------------------------------------------------

@router.get("/instruments", response_model=InstrumentListResponse)
async def list_instruments_endpoint(
    carrier: str | None = None,
    status: str | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    user: AuthUser = Depends(get_current_user),
) -> InstrumentListResponse:
    _require_db()
    items, total = instruments_service.list_instruments(
        company_id=user.company_id, limit=limit, offset=offset, carrier=carrier, status=status,
    )
    return InstrumentListResponse(items=items, total=total, limit=limit, offset=offset)


@router.post("/instruments", response_model=InstrumentResponse, status_code=201)
async def create_instrument_endpoint(
    body: InstrumentCreate,
    user: AuthUser = Depends(require_analyst),
) -> InstrumentResponse:
    _require_db()
    try:
        return instruments_service.create_instrument(company_id=user.company_id, payload=body)
    except EnergyError as exc:
        raise _http_error(exc) from exc


@router.get("/instruments/{instrument_id}", response_model=InstrumentResponse)
async def get_instrument_endpoint(
    instrument_id: int,
    user: AuthUser = Depends(get_current_user),
) -> InstrumentResponse:
    _require_db()
    try:
        return instruments_service.get_instrument(company_id=user.company_id, instrument_id=instrument_id)
    except EnergyError as exc:
        raise _http_error(exc) from exc


@router.post("/instruments/{instrument_id}/allocate", response_model=AllocationResponse, status_code=201)
async def allocate_instrument_endpoint(
    instrument_id: int,
    body: AllocationRequest,
    user: AuthUser = Depends(require_analyst),
) -> AllocationResponse:
    _require_db()
    try:
        return instruments_service.allocate_instrument(
            company_id=user.company_id, instrument_id=instrument_id,
            payload=body, allocated_by=user.user_id,
        )
    except EnergyError as exc:
        raise _http_error(exc) from exc
