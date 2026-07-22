"""
routers/resources.py — Module 2 (Ressources stratégiques), API de LECTURE
(PR-M2A), préfixe `/resources`.

Lecture (GET) : utilisateur authentifié du tenant (`get_current_user`, JWT réel
— jamais `get_company_id` qui retomberait sur le tenant 1 par défaut). Aucune
écriture exposée dans cette tranche (catalogue & réglementation en lecture) ;
l'ingestion des données passe par Source Admin / Evidence Kernel, hors requête
utilisateur.

Les tables arrivent avec la migration 042 : chaque handler enveloppe son corps
dans `schema_ready_guard()` et répond **503 `schema_not_ready`** tant que le
schéma n'est pas migré (motif routers/water.py, PR-08).

Endpoints :
  GET /resources/catalog                       — liste du catalogue (global + tenant)
  GET /resources/catalog/{slug}                — fiche détaillée + compteurs
  GET /resources/catalog/{slug}/aliases        — alias legacy / identifiants externes
  GET /resources/catalog/{slug}/regulations    — statuts réglementaires (non exclusifs)
  GET /resources/catalog/{slug}/uses           — usages sectoriels (classification supply-chain)

Aucun LLM, aucune source externe live, aucune écriture de production.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from models.resources import (
    ResourceAlertListResponse,
    ResourceAliasListResponse,
    ResourceAssessmentDetail,
    ResourceAssessmentListResponse,
    ResourceAssessmentRunCreate,
    ResourceCatalogDetail,
    ResourceCatalogListResponse,
    ResourceDimensionListResponse,
    ResourceExposureLinkCreate,
    ResourceExposureLinkListResponse,
    ResourceExposureLinkResponse,
    ResourceRegulatoryStatusListResponse,
    ResourceSectorUseListResponse,
    ResourceSupplyObservationCreate,
    ResourceSupplyObservationListResponse,
    ResourceSupplyObservationResponse,
)
from routers._errors import http_error, require_db, schema_ready_guard
from routers.auth import get_current_user, require_analyst
from services.auth_service import AuthUser
from services.resources import (
    assessment_service,
    catalog_service,
    exposure_link_service,
    regulatory_service,
    supply_service,
)

router = APIRouter()

# Erreurs métier du domaine : convention lexicale partagée (contrats §6) —
# « introuvable » → 404, « requis/requise » → 400, sinon 409.
_RESOURCE_ERRORS = (
    catalog_service.ResourceCatalogError,
    regulatory_service.ResourceRegulatoryError,
    supply_service.ResourceSupplyError,
    exposure_link_service.ResourceExposureError,
    assessment_service.ResourceAssessmentError,
)


@router.get("/catalog", response_model=ResourceCatalogListResponse)
async def list_catalog_endpoint(
    family: str | None = Query(None),
    q: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> ResourceCatalogListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return catalog_service.list_catalog(
                company_id=user.company_id, family=family, q=q, limit=limit, offset=offset
            )
    except _RESOURCE_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/catalog/{slug}", response_model=ResourceCatalogDetail)
async def get_catalog_detail_endpoint(
    slug: str,
    user: AuthUser = Depends(get_current_user),
) -> ResourceCatalogDetail:
    require_db()
    try:
        with schema_ready_guard():
            return catalog_service.get_detail(company_id=user.company_id, slug=slug)
    except _RESOURCE_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/catalog/{slug}/aliases", response_model=ResourceAliasListResponse)
async def list_aliases_endpoint(
    slug: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> ResourceAliasListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return catalog_service.list_aliases(
                company_id=user.company_id, slug=slug, limit=limit, offset=offset
            )
    except _RESOURCE_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/catalog/{slug}/regulations", response_model=ResourceRegulatoryStatusListResponse)
async def list_regulations_endpoint(
    slug: str,
    regime: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> ResourceRegulatoryStatusListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return regulatory_service.list_statuses(
                company_id=user.company_id, slug=slug, regime=regime, limit=limit, offset=offset
            )
    except _RESOURCE_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/catalog/{slug}/uses", response_model=ResourceSectorUseListResponse)
async def list_uses_endpoint(
    slug: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> ResourceSectorUseListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return catalog_service.list_sector_uses(
                company_id=user.company_id, slug=slug, limit=limit, offset=offset
            )
    except _RESOURCE_ERRORS as exc:
        raise http_error(exc) from exc


# ===========================================================================
# PR-M2B — supply / exposures / assessments / alerts
# ===========================================================================

@router.get("/catalog/{slug}/supply", response_model=ResourceSupplyObservationListResponse)
async def list_supply_endpoint(
    slug: str,
    stage_code: str | None = Query(None),
    reference_year: int | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> ResourceSupplyObservationListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return supply_service.list_observations(
                company_id=user.company_id, slug=slug, stage_code=stage_code,
                reference_year=reference_year, limit=limit, offset=offset,
            )
    except _RESOURCE_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/catalog/{slug}/supply", response_model=ResourceSupplyObservationResponse, status_code=201)
async def create_supply_endpoint(
    slug: str,
    body: ResourceSupplyObservationCreate,
    user: AuthUser = Depends(require_analyst),
) -> ResourceSupplyObservationResponse:
    require_db()
    try:
        with schema_ready_guard():
            return supply_service.create_observation(
                company_id=user.company_id, slug=slug, payload=body, created_by=user.user_id
            )
    except _RESOURCE_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/exposures", response_model=ResourceExposureLinkListResponse)
async def list_exposures_endpoint(
    resource_slug: str | None = Query(None),
    link_kind: str | None = Query(None),
    role: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> ResourceExposureLinkListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return exposure_link_service.list_links(
                company_id=user.company_id, slug=resource_slug, link_kind=link_kind,
                role=role, limit=limit, offset=offset,
            )
    except _RESOURCE_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/exposures/link", response_model=ResourceExposureLinkResponse, status_code=201)
async def create_exposure_link_endpoint(
    body: ResourceExposureLinkCreate,
    user: AuthUser = Depends(require_analyst),
) -> ResourceExposureLinkResponse:
    require_db()
    try:
        with schema_ready_guard():
            return exposure_link_service.create_link(
                company_id=user.company_id, payload=body, created_by=user.user_id
            )
    except _RESOURCE_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/assessments", response_model=ResourceAssessmentListResponse)
async def list_assessments_endpoint(
    resource_slug: str | None = Query(None),
    assessment_year: int | None = Query(None),
    status: str | None = Query(None),
    current_only: bool = Query(True),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> ResourceAssessmentListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return assessment_service.list_runs(
                company_id=user.company_id, slug=resource_slug, assessment_year=assessment_year,
                status=status, current_only=current_only, limit=limit, offset=offset,
            )
    except _RESOURCE_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/assessments", response_model=ResourceAssessmentDetail, status_code=201)
async def create_assessment_endpoint(
    body: ResourceAssessmentRunCreate,
    user: AuthUser = Depends(require_analyst),
) -> ResourceAssessmentDetail:
    require_db()
    try:
        with schema_ready_guard():
            return assessment_service.create_run(
                company_id=user.company_id, slug=body.resource_slug,
                assessment_year=body.assessment_year, as_of=body.as_of,
                calculated_by=user.user_id,
            )
    except _RESOURCE_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/assessments/{run_id}", response_model=ResourceAssessmentDetail)
async def get_assessment_endpoint(
    run_id: int,
    user: AuthUser = Depends(get_current_user),
) -> ResourceAssessmentDetail:
    require_db()
    try:
        with schema_ready_guard():
            return assessment_service.get_run(company_id=user.company_id, run_id=run_id)
    except _RESOURCE_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/assessments/{run_id}/dimensions", response_model=ResourceDimensionListResponse)
async def list_assessment_dimensions_endpoint(
    run_id: int,
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> ResourceDimensionListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return assessment_service.list_dimensions(
                company_id=user.company_id, run_id=run_id, limit=limit, offset=offset
            )
    except _RESOURCE_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/alerts", response_model=ResourceAlertListResponse)
async def list_alerts_endpoint(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> ResourceAlertListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return assessment_service.list_alerts(
                company_id=user.company_id, limit=limit, offset=offset
            )
    except _RESOURCE_ERRORS as exc:
        raise http_error(exc) from exc
