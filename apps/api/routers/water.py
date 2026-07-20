"""
routers/water.py — ledger eau (PR-08A), préfixe `/water`.

Lecture (GET) : utilisateur authentifié du tenant (`get_current_user`).
Écriture (POST) : `require_analyst`.

Endpoints tranche A :
  POST /water/activities/import           — import CSV idempotent (sha256)
  POST /water/imports/{id}/review         — gate de revue d'un import
  POST /water/activities · GET            — saisie directe + liste filtrable
  POST /water/activities/{id}/review      — gate de revue d'une activité
  POST /water/permits · GET · GET /{id}   — permis (preuve Evidence Kernel)
  POST /water/permits/{id}/review         — gate de revue d'un permis
  GET  /water/risk-areas                  — référentiel de zones (LECTURE SEULE :
                                            l'ingestion passe par le CLI
                                            d'administration, jamais par un
                                            endpoint utilisateur)

TOUTES ces routes sont NEUVES (migration 036 pas encore appliquée au moment où
la production déploie ce code) : chacune est sous `schema_ready_guard` et
répond 503 `schema_not_ready` tant que le schéma n'est pas migré — jamais une
erreur SQL brute.

Aucun LLM, aucune source externe, aucun appel réseau, aucune écriture de
production par ce code.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from models.water import (
    WaterActivityCreate,
    WaterActivityListResponse,
    WaterActivityResponse,
    WaterActivityReviewRequest,
    WaterImportRequest,
    WaterImportResponse,
    WaterImportReviewRequest,
    WaterPermitCreate,
    WaterPermitListResponse,
    WaterPermitResponse,
    WaterRiskAreaListResponse,
)
from routers._errors import http_error, require_db, schema_ready_guard
from routers.auth import get_current_user, require_analyst
from services.auth_service import AuthUser
from services.water import activities_service, permits_service, risk_areas_service

router = APIRouter()

_WATER_ERRORS = (
    activities_service.WaterActivityError,
    permits_service.WaterPermitError,
    risk_areas_service.WaterRiskAreaError,
)


# ---------------------------------------------------------------------------
# Activités — import idempotent + gate de revue
# ---------------------------------------------------------------------------

@router.post("/activities/import", response_model=WaterImportResponse, status_code=201)
async def import_activities_endpoint(
    body: WaterImportRequest,
    user: AuthUser = Depends(require_analyst),
) -> WaterImportResponse:
    require_db()
    try:
        with schema_ready_guard():
            return activities_service.create_import(
                company_id=user.company_id, filename=body.filename,
                content=body.csv_text.encode("utf-8"), imported_by=user.user_id,
            )
    except _WATER_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/imports/{import_id}/review", response_model=WaterImportResponse)
async def review_import_endpoint(
    import_id: int,
    body: WaterImportReviewRequest,
    user: AuthUser = Depends(require_analyst),
) -> WaterImportResponse:
    require_db()
    try:
        with schema_ready_guard():
            return activities_service.review_import(
                company_id=user.company_id, import_id=import_id,
                accept=body.accept, reviewed_by=user.user_id,
            )
    except _WATER_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/activities", response_model=WaterActivityResponse, status_code=201)
async def create_activity_endpoint(
    body: WaterActivityCreate,
    user: AuthUser = Depends(require_analyst),
) -> WaterActivityResponse:
    require_db()
    try:
        with schema_ready_guard():
            return activities_service.create_activity(
                company_id=user.company_id, created_by=user.user_id,
                **body.model_dump(),
            )
    except _WATER_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/activities", response_model=WaterActivityListResponse)
async def list_activities_endpoint(
    site_id: int | None = Query(None),
    activity_type: str | None = Query(None),
    review_status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> WaterActivityListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return activities_service.list_activities(
                company_id=user.company_id, site_id=site_id,
                activity_type=activity_type, review_status=review_status,
                limit=limit, offset=offset,
            )
    except _WATER_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/activities/{activity_id}/review", response_model=WaterActivityResponse)
async def review_activity_endpoint(
    activity_id: int,
    body: WaterActivityReviewRequest,
    user: AuthUser = Depends(require_analyst),
) -> WaterActivityResponse:
    require_db()
    try:
        with schema_ready_guard():
            return activities_service.review_activity(
                company_id=user.company_id, activity_id=activity_id,
                accept=body.accept, reviewed_by=user.user_id,
            )
    except _WATER_ERRORS as exc:
        raise http_error(exc) from exc


# ---------------------------------------------------------------------------
# Permis
# ---------------------------------------------------------------------------

@router.post("/permits", response_model=WaterPermitResponse, status_code=201)
async def create_permit_endpoint(
    body: WaterPermitCreate,
    user: AuthUser = Depends(require_analyst),
) -> WaterPermitResponse:
    require_db()
    try:
        with schema_ready_guard():
            return permits_service.create_permit(
                company_id=user.company_id, payload=body, created_by=user.user_id,
            )
    except _WATER_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/permits", response_model=WaterPermitListResponse)
async def list_permits_endpoint(
    site_id: int | None = Query(None),
    status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> WaterPermitListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return permits_service.list_permits(
                company_id=user.company_id, site_id=site_id, status=status,
                limit=limit, offset=offset,
            )
    except _WATER_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/permits/{permit_id}", response_model=WaterPermitResponse)
async def get_permit_endpoint(
    permit_id: int,
    user: AuthUser = Depends(get_current_user),
) -> WaterPermitResponse:
    require_db()
    try:
        with schema_ready_guard():
            return permits_service.get_permit(
                company_id=user.company_id, permit_id=permit_id
            )
    except _WATER_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/permits/{permit_id}/review", response_model=WaterPermitResponse)
async def review_permit_endpoint(
    permit_id: int,
    body: WaterActivityReviewRequest,
    user: AuthUser = Depends(require_analyst),
) -> WaterPermitResponse:
    require_db()
    try:
        with schema_ready_guard():
            return permits_service.review_permit(
                company_id=user.company_id, permit_id=permit_id,
                accept=body.accept, reviewed_by=user.user_id,
            )
    except _WATER_ERRORS as exc:
        raise http_error(exc) from exc


# ---------------------------------------------------------------------------
# Référentiel de zones — LECTURE SEULE (ingestion = CLI/admin uniquement)
# ---------------------------------------------------------------------------

@router.get("/risk-areas", response_model=WaterRiskAreaListResponse)
async def list_risk_areas_endpoint(
    scenario_code: str | None = Query(None),
    area_kind: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> WaterRiskAreaListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return risk_areas_service.list_areas(
                company_id=user.company_id, scenario_code=scenario_code,
                area_kind=area_kind, limit=limit, offset=offset,
            )
    except _WATER_ERRORS as exc:
        raise http_error(exc) from exc
