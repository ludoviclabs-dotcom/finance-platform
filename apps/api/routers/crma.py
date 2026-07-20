"""
routers/crma.py — CRMA, aimants permanents et exposition matières (PR-07),
préfixe `/crma`.

Lecture (GET) : utilisateur authentifié du tenant (`get_current_user`, JWT réel
— jamais `get_company_id`, qui retomberait sur le tenant 1 par défaut).
Écriture (POST) : `require_analyst`.

Endpoints :
  GET  /crma/stages                          — étapes ordonnées de la chaîne de valeur
  GET  /crma/groups · POST                   — groupes de matières
  POST /crma/groups/{code}/materials         — rattachement d'une matière à un groupe
  GET  /crma/materials/{id}/status           — statut critique/stratégique (NON exclusif)
  GET  /crma/materials/{id}/value-chain      — concentration PAR ÉTAPE
  GET  /crma/materials/{id}/exposure         — CarbonCo Material Exposure Score
  POST /crma/stage-observations · GET        — parts pays par étape
  POST /crma/market-observations · GET       — données de marché (licence évaluée)
  POST /crma/substitutes · GET               — alternatives
  POST /crma/recycling-routes · GET          — filières de recyclage
  POST /crma/events · GET                    — événements commerciaux/réglementaires
  POST /crma/exposures · GET · GET /{id}     — expositions du tenant
  POST /crma/assessments · GET               — évaluations Article 24
  POST /crma/assessments/{id}/recalculate    — calcul (n'approuve jamais)
  POST /crma/assessments/{id}/review         — gate de revue humaine
  GET  /crma/assessments/{id}/report         — rapport Article 24 exportable
  POST /crma/actions · GET                   — actions d'atténuation

Aucun LLM, aucune source externe, aucune écriture de production.
"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query

from models.crma import (
    Article24AssessmentCreate,
    Article24AssessmentListResponse,
    Article24AssessmentResponse,
    Article24Report,
    Article24ReviewRequest,
    ExposureAnalysisResponse,
    ExposureCreate,
    ExposureListResponse,
    ExposureResponse,
    MarketObservationCreate,
    MarketObservationListResponse,
    MarketObservationResponse,
    MaterialGroupCreate,
    MaterialGroupListResponse,
    MaterialGroupResponse,
    MaterialStatus,
    MitigationActionCreate,
    MitigationActionListResponse,
    MitigationActionResponse,
    ProcessingStageListResponse,
    RecyclingRouteCreate,
    RecyclingRouteListResponse,
    RecyclingRouteResponse,
    StageObservationCreate,
    StageObservationListResponse,
    StageObservationResponse,
    SubstituteCreate,
    SubstituteListResponse,
    SubstituteResponse,
    TradeEventCreate,
    TradeEventListResponse,
    TradeEventResponse,
    ValueChainResponse,
)
from routers._errors import http_error, require_db
from routers.auth import get_current_user, require_analyst
from services.auth_service import AuthUser
from services.crma import (
    article24_service,
    exposure_service,
    reference_service,
    stage_service,
)

router = APIRouter()

# Toutes les erreurs métier du domaine passent par le helper lexical partagé
# (contrats §6) : « introuvable » -> 404, « requis/requise » -> 400, sinon 409.
_CRMA_ERRORS = (
    reference_service.CrmaReferenceError,
    stage_service.StageObservationError,
    exposure_service.ExposureError,
    article24_service.Article24Error,
)


# ---------------------------------------------------------------------------
# Référentiels
# ---------------------------------------------------------------------------

@router.get("/stages", response_model=ProcessingStageListResponse)
async def list_stages_endpoint(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> ProcessingStageListResponse:
    require_db()
    try:
        return reference_service.list_stages(
            company_id=user.company_id, limit=limit, offset=offset
        )
    except _CRMA_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/groups", response_model=MaterialGroupResponse, status_code=201)
async def create_group_endpoint(
    body: MaterialGroupCreate,
    user: AuthUser = Depends(require_analyst),
) -> MaterialGroupResponse:
    require_db()
    try:
        return reference_service.create_group(
            company_id=user.company_id, payload=body, created_by=user.user_id
        )
    except _CRMA_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/groups", response_model=MaterialGroupListResponse)
async def list_groups_endpoint(
    group_kind: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> MaterialGroupListResponse:
    require_db()
    try:
        return reference_service.list_groups(
            company_id=user.company_id, group_kind=group_kind, limit=limit, offset=offset
        )
    except _CRMA_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/groups/{group_code}/materials", response_model=MaterialGroupResponse)
async def add_material_to_group_endpoint(
    group_code: str,
    material_id: str = Query(min_length=1),
    user: AuthUser = Depends(require_analyst),
) -> MaterialGroupResponse:
    require_db()
    try:
        return reference_service.add_material_to_group(
            company_id=user.company_id, group_code=group_code, material_id=material_id
        )
    except _CRMA_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/materials/{material_id}/status", response_model=MaterialStatus)
async def material_status_endpoint(
    material_id: str,
    user: AuthUser = Depends(get_current_user),
) -> MaterialStatus:
    require_db()
    try:
        return reference_service.get_material_status(
            company_id=user.company_id, material_id=material_id
        )
    except _CRMA_ERRORS as exc:
        raise http_error(exc) from exc


# ---------------------------------------------------------------------------
# Chaîne de valeur et score
# ---------------------------------------------------------------------------

@router.get("/materials/{material_id}/value-chain", response_model=ValueChainResponse)
async def value_chain_endpoint(
    material_id: str,
    reference_year: int | None = Query(None),
    user: AuthUser = Depends(get_current_user),
) -> ValueChainResponse:
    """Concentration PAR ÉTAPE. Il n'existe volontairement aucun endpoint
    renvoyant une concentration « toutes étapes confondues »."""
    require_db()
    try:
        return stage_service.get_value_chain(
            company_id=user.company_id, material_id=material_id, reference_year=reference_year
        )
    except _CRMA_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/materials/{material_id}/exposure", response_model=ExposureAnalysisResponse)
async def exposure_score_endpoint(
    material_id: str,
    reference_year: int | None = Query(None),
    as_of: date | None = Query(None),
    user: AuthUser = Depends(get_current_user),
) -> ExposureAnalysisResponse:
    """**CarbonCo Material Exposure Score** — méthode CarbonCo versionnée, pas un
    score officiel de l'UE. `risk_score` et `confidence` sont deux champs
    distincts de la réponse ; le `disclaimer` accompagne chaque résultat."""
    require_db()
    try:
        return exposure_service.analyse_material(
            company_id=user.company_id, material_id=material_id,
            reference_year=reference_year, as_of=as_of,
        )
    except _CRMA_ERRORS as exc:
        raise http_error(exc) from exc


# ---------------------------------------------------------------------------
# Observations
# ---------------------------------------------------------------------------

@router.post("/stage-observations", response_model=StageObservationResponse, status_code=201)
async def create_stage_observation_endpoint(
    body: StageObservationCreate,
    user: AuthUser = Depends(require_analyst),
) -> StageObservationResponse:
    require_db()
    try:
        return stage_service.record_stage_observation(
            company_id=user.company_id, payload=body, created_by=user.user_id
        )
    except _CRMA_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/stage-observations", response_model=StageObservationListResponse)
async def list_stage_observations_endpoint(
    material_id: str | None = Query(None),
    stage_code: str | None = Query(None),
    reference_year: int | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> StageObservationListResponse:
    require_db()
    try:
        return stage_service.list_stage_observations(
            company_id=user.company_id, material_id=material_id, stage_code=stage_code,
            reference_year=reference_year, limit=limit, offset=offset,
        )
    except _CRMA_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/market-observations", response_model=MarketObservationResponse, status_code=201)
async def create_market_observation_endpoint(
    body: MarketObservationCreate,
    user: AuthUser = Depends(require_analyst),
) -> MarketObservationResponse:
    """Une donnée de marché exige une release source. Si la licence interdit
    l'affichage, la valeur est retirée de la réponse côté serveur."""
    require_db()
    try:
        return stage_service.record_market_observation(company_id=user.company_id, payload=body)
    except _CRMA_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/market-observations", response_model=MarketObservationListResponse)
async def list_market_observations_endpoint(
    material_id: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> MarketObservationListResponse:
    require_db()
    try:
        return stage_service.list_market_observations(
            company_id=user.company_id, material_id=material_id, limit=limit, offset=offset
        )
    except _CRMA_ERRORS as exc:
        raise http_error(exc) from exc


# ---------------------------------------------------------------------------
# Alternatives, recyclage, événements
# ---------------------------------------------------------------------------

@router.post("/substitutes", response_model=SubstituteResponse, status_code=201)
async def create_substitute_endpoint(
    body: SubstituteCreate,
    user: AuthUser = Depends(require_analyst),
) -> SubstituteResponse:
    require_db()
    try:
        return reference_service.create_substitute(
            company_id=user.company_id, payload=body, created_by=user.user_id
        )
    except _CRMA_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/substitutes", response_model=SubstituteListResponse)
async def list_substitutes_endpoint(
    material_id: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> SubstituteListResponse:
    require_db()
    try:
        return reference_service.list_substitutes(
            company_id=user.company_id, material_id=material_id, limit=limit, offset=offset
        )
    except _CRMA_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/recycling-routes", response_model=RecyclingRouteResponse, status_code=201)
async def create_recycling_route_endpoint(
    body: RecyclingRouteCreate,
    user: AuthUser = Depends(require_analyst),
) -> RecyclingRouteResponse:
    require_db()
    try:
        return reference_service.create_recycling_route(
            company_id=user.company_id, payload=body, created_by=user.user_id
        )
    except _CRMA_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/recycling-routes", response_model=RecyclingRouteListResponse)
async def list_recycling_routes_endpoint(
    material_id: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> RecyclingRouteListResponse:
    require_db()
    try:
        return reference_service.list_recycling_routes(
            company_id=user.company_id, material_id=material_id, limit=limit, offset=offset
        )
    except _CRMA_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/events", response_model=TradeEventResponse, status_code=201)
async def create_event_endpoint(
    body: TradeEventCreate,
    user: AuthUser = Depends(require_analyst),
) -> TradeEventResponse:
    require_db()
    try:
        return reference_service.create_event(
            company_id=user.company_id, payload=body, created_by=user.user_id
        )
    except _CRMA_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/events", response_model=TradeEventListResponse)
async def list_events_endpoint(
    material_id: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> TradeEventListResponse:
    require_db()
    try:
        return reference_service.list_events(
            company_id=user.company_id, material_id=material_id, limit=limit, offset=offset
        )
    except _CRMA_ERRORS as exc:
        raise http_error(exc) from exc


# ---------------------------------------------------------------------------
# Expositions du tenant
# ---------------------------------------------------------------------------

@router.post("/exposures", response_model=ExposureResponse, status_code=201)
async def create_exposure_endpoint(
    body: ExposureCreate,
    user: AuthUser = Depends(require_analyst),
) -> ExposureResponse:
    require_db()
    try:
        return exposure_service.create_exposure(
            company_id=user.company_id, payload=body, created_by=user.user_id
        )
    except _CRMA_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/exposures", response_model=ExposureListResponse)
async def list_exposures_endpoint(
    material_id: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> ExposureListResponse:
    require_db()
    try:
        return exposure_service.list_exposures(
            company_id=user.company_id, material_id=material_id, limit=limit, offset=offset
        )
    except _CRMA_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/exposures/{exposure_id}", response_model=ExposureResponse)
async def get_exposure_endpoint(
    exposure_id: int,
    user: AuthUser = Depends(get_current_user),
) -> ExposureResponse:
    require_db()
    try:
        return exposure_service.get_exposure(
            company_id=user.company_id, exposure_id=exposure_id
        )
    except _CRMA_ERRORS as exc:
        raise http_error(exc) from exc


# ---------------------------------------------------------------------------
# Article 24
# ---------------------------------------------------------------------------

@router.post("/assessments", response_model=Article24AssessmentResponse, status_code=201)
async def create_assessment_endpoint(
    body: Article24AssessmentCreate,
    user: AuthUser = Depends(require_analyst),
) -> Article24AssessmentResponse:
    require_db()
    try:
        return article24_service.create_assessment(
            company_id=user.company_id, payload=body, prepared_by=user.user_id
        )
    except _CRMA_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/assessments", response_model=Article24AssessmentListResponse)
async def list_assessments_endpoint(
    material_id: str | None = Query(None),
    assessment_year: int | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> Article24AssessmentListResponse:
    require_db()
    try:
        return article24_service.list_assessments(
            company_id=user.company_id, material_id=material_id,
            assessment_year=assessment_year, limit=limit, offset=offset,
        )
    except _CRMA_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/assessments/{assessment_id}/recalculate", response_model=Article24AssessmentResponse)
async def recalculate_assessment_endpoint(
    assessment_id: int,
    as_of: date | None = Query(None),
    user: AuthUser = Depends(require_analyst),
) -> Article24AssessmentResponse:
    """Recalcule le score. N'approuve JAMAIS : le statut reste inchangé."""
    require_db()
    try:
        return article24_service.recalculate(
            company_id=user.company_id, assessment_id=assessment_id, as_of=as_of
        )
    except _CRMA_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/assessments/{assessment_id}/review", response_model=Article24AssessmentResponse)
async def review_assessment_endpoint(
    assessment_id: int,
    body: Article24ReviewRequest,
    user: AuthUser = Depends(require_analyst),
) -> Article24AssessmentResponse:
    """Gate de revue HUMAINE — l'approbation trace l'utilisateur du JWT."""
    require_db()
    try:
        return article24_service.review(
            company_id=user.company_id, assessment_id=assessment_id,
            approve=body.approve, reviewed_by=user.user_id,
        )
    except _CRMA_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/assessments/{assessment_id}/report", response_model=Article24Report)
async def assessment_report_endpoint(
    assessment_id: int,
    user: AuthUser = Depends(get_current_user),
) -> Article24Report:
    require_db()
    try:
        return article24_service.build_report(
            company_id=user.company_id, assessment_id=assessment_id
        )
    except _CRMA_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/actions", response_model=MitigationActionResponse, status_code=201)
async def create_action_endpoint(
    body: MitigationActionCreate,
    user: AuthUser = Depends(require_analyst),
) -> MitigationActionResponse:
    require_db()
    try:
        return article24_service.create_action(
            company_id=user.company_id, payload=body, created_by=user.user_id
        )
    except _CRMA_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/actions", response_model=MitigationActionListResponse)
async def list_actions_endpoint(
    assessment_id: int | None = Query(None),
    material_id: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> MitigationActionListResponse:
    require_db()
    try:
        return article24_service.list_actions(
            company_id=user.company_id, assessment_id=assessment_id,
            material_id=material_id, limit=limit, offset=offset,
        )
    except _CRMA_ERRORS as exc:
        raise http_error(exc) from exc
