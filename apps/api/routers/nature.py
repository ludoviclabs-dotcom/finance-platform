"""
routers/nature.py — biodiversité, TNFD LEAP (PR-09), préfixe `/nature`.

Lecture (GET) : utilisateur authentifié du tenant (`get_current_user`), sauf
la géométrie précise d'un élément sensible (`require_admin`, §6 du plan).
Écriture (POST) : `require_analyst`.

Endpoints tranche A (038) :
  GET  /nature/features                     — référentiel, masquage systématique
  GET  /nature/features/{id}/geometry       — géométrie précise (require_admin)
  POST /nature/sites/{site_id}/locate       — calcule/rafraîchit les intersections
  GET  /nature/sites/{site_id}/intersections
  POST /nature/intersections/{id}/review    — gate humaine sur le fait géométrique
  POST /nature/dependencies · GET           — Evaluate : dépendances
  POST /nature/dependencies/{id}/review
  POST /nature/impacts · GET                — Evaluate : impacts (séparés des dépendances)
  POST /nature/impacts/{id}/review
  POST /nature/leap-assessments · GET · GET /{id}
  POST /nature/leap-assessments/{id}/sites
  POST /nature/leap-assessments/{id}/advance-phase
  POST /nature/leap-assessments/{id}/review — approbation humaine (motif article24)

Endpoints tranche B (039) :
  POST /nature/risks/calculate · GET · GET /{id}      — AnalyticalEnvelope
  POST /nature/risks/{id}/review
  POST /nature/opportunities/calculate · GET · GET /{id} — AnalyticalEnvelope
  POST /nature/opportunities/{id}/review
  POST /nature/actions · GET
  POST /nature/actions/{id}/review
  POST /nature/disclosure-drafts · GET · GET /{id}    — TOUJOURS un brouillon
  POST /nature/disclosure-drafts/{id}/review — require_admin (motif article24)

TOUTES les routes de ce fichier sont NEUVES (migrations 038/039 pas encore
appliquées au moment où la production déploie ce code) : chacune est sous
`schema_ready_guard` et répond 503 `schema_not_ready` tant que le schéma
n'est pas migré — jamais une erreur SQL brute.

Aucun LLM, aucune source externe, aucun appel réseau, aucune écriture de
production par ce code. Aucune conclusion automatique : proximité ≠ impact,
dépendance ≠ risque financier (PR-10).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from models.analytics import AnalyticalEnvelope
from models.nature import (
    IntersectionReviewRequest,
    LeapAddSiteRequest,
    LeapAdvancePhaseRequest,
    LeapAssessmentCreate,
    LeapAssessmentListResponse,
    LeapAssessmentResponse,
    LocateRequest,
    NatureActionCreate,
    NatureActionListResponse,
    NatureActionResponse,
    NatureDependencyCreate,
    NatureDependencyListResponse,
    NatureDependencyResponse,
    NatureFeatureListResponse,
    NatureFeatureResponse,
    NatureImpactCreate,
    NatureImpactListResponse,
    NatureImpactResponse,
    NatureOpportunityData,
    NatureOpportunityListResponse,
    NatureOpportunitySummary,
    NatureRiskData,
    NatureRiskListResponse,
    NatureRiskSummary,
    OpportunityCalculateRequest,
    ReviewRequest,
    RiskCalculateRequest,
    SiteNatureIntersectionListResponse,
    SiteNatureIntersectionResponse,
    TnfdDisclosureDraftCreate,
    TnfdDisclosureDraftListResponse,
    TnfdDisclosureDraftResponse,
)
from routers._errors import http_error, require_db, schema_ready_guard
from routers.auth import get_current_user, require_admin, require_analyst
from services.auth_service import AuthUser
from services.nature import (
    actions_service,
    dependencies_service,
    disclosure_service,
    features_service,
    impacts_service,
    leap_service,
    locate_service,
    opportunity_service,
    risk_service,
)

router = APIRouter()

_NATURE_ERRORS = (
    features_service.NatureFeatureError,
    locate_service.NatureLocateError,
    dependencies_service.NatureDependencyError,
    impacts_service.NatureImpactError,
    leap_service.NatureLeapError,
    risk_service.NatureRiskError,
    opportunity_service.NatureOpportunityError,
    actions_service.NatureActionError,
    disclosure_service.NatureDisclosureError,
)


# ---------------------------------------------------------------------------
# Référentiel nature_features — lecture masquée, géométrie précise réservée
# ---------------------------------------------------------------------------

@router.get("/features", response_model=NatureFeatureListResponse)
async def list_features_endpoint(
    feature_kind: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> NatureFeatureListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return features_service.list_features(
                company_id=user.company_id, feature_kind=feature_kind,
                limit=limit, offset=offset,
            )
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/features/{feature_id}/geometry", response_model=NatureFeatureResponse)
async def get_feature_geometry_endpoint(
    feature_id: int,
    user: AuthUser = Depends(require_admin),
) -> NatureFeatureResponse:
    """Géométrie PRÉCISE — rôle élevé requis (§6 du plan), jamais une URL
    signée permanente."""
    require_db()
    try:
        with schema_ready_guard():
            return features_service.get_feature_geometry(
                company_id=user.company_id, feature_id=feature_id,
            )
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc


# ---------------------------------------------------------------------------
# Locate — intersections géométriques (fait, jamais un score)
# ---------------------------------------------------------------------------

@router.post("/sites/{site_id}/locate", response_model=list[SiteNatureIntersectionResponse])
async def locate_site_endpoint(
    site_id: int,
    body: LocateRequest,
    user: AuthUser = Depends(require_analyst),
) -> list[SiteNatureIntersectionResponse]:
    require_db()
    try:
        with schema_ready_guard():
            return locate_service.locate_site(
                company_id=user.company_id, site_id=site_id, computed_by=user.user_id,
            )
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/sites/{site_id}/intersections", response_model=SiteNatureIntersectionListResponse)
async def list_site_intersections_endpoint(
    site_id: int,
    matched: bool | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> SiteNatureIntersectionListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return locate_service.list_intersections(
                company_id=user.company_id, site_id=site_id, matched=matched,
                limit=limit, offset=offset,
            )
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/intersections/{intersection_id}/review", response_model=SiteNatureIntersectionResponse)
async def review_intersection_endpoint(
    intersection_id: int,
    body: IntersectionReviewRequest,
    user: AuthUser = Depends(require_analyst),
) -> SiteNatureIntersectionResponse:
    require_db()
    try:
        with schema_ready_guard():
            return locate_service.review_intersection(
                company_id=user.company_id, intersection_id=intersection_id,
                accept=body.accept, reviewed_by=user.user_id,
            )
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc


# ---------------------------------------------------------------------------
# Evaluate — dépendances (jamais fusionnées avec les impacts)
# ---------------------------------------------------------------------------

@router.post("/dependencies", response_model=NatureDependencyResponse, status_code=201)
async def create_dependency_endpoint(
    body: NatureDependencyCreate,
    user: AuthUser = Depends(require_analyst),
) -> NatureDependencyResponse:
    require_db()
    try:
        with schema_ready_guard():
            return dependencies_service.create_dependency(
                company_id=user.company_id, payload=body, created_by=user.user_id,
            )
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/dependencies", response_model=NatureDependencyListResponse)
async def list_dependencies_endpoint(
    site_id: int | None = Query(None),
    review_status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> NatureDependencyListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return dependencies_service.list_dependencies(
                company_id=user.company_id, site_id=site_id, review_status=review_status,
                limit=limit, offset=offset,
            )
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/dependencies/{dependency_id}/review", response_model=NatureDependencyResponse)
async def review_dependency_endpoint(
    dependency_id: int,
    body: ReviewRequest,
    user: AuthUser = Depends(require_analyst),
) -> NatureDependencyResponse:
    require_db()
    try:
        with schema_ready_guard():
            return dependencies_service.review_dependency(
                company_id=user.company_id, dependency_id=dependency_id,
                accept=body.accept, reviewed_by=user.user_id,
            )
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc


# ---------------------------------------------------------------------------
# Evaluate — impacts (jamais fusionnés avec les dépendances)
# ---------------------------------------------------------------------------

@router.post("/impacts", response_model=NatureImpactResponse, status_code=201)
async def create_impact_endpoint(
    body: NatureImpactCreate,
    user: AuthUser = Depends(require_analyst),
) -> NatureImpactResponse:
    require_db()
    try:
        with schema_ready_guard():
            return impacts_service.create_impact(
                company_id=user.company_id, payload=body, created_by=user.user_id,
            )
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/impacts", response_model=NatureImpactListResponse)
async def list_impacts_endpoint(
    site_id: int | None = Query(None),
    impact_kind: str | None = Query(None),
    review_status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> NatureImpactListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return impacts_service.list_impacts(
                company_id=user.company_id, site_id=site_id, impact_kind=impact_kind,
                review_status=review_status, limit=limit, offset=offset,
            )
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/impacts/{impact_id}/review", response_model=NatureImpactResponse)
async def review_impact_endpoint(
    impact_id: int,
    body: ReviewRequest,
    user: AuthUser = Depends(require_analyst),
) -> NatureImpactResponse:
    require_db()
    try:
        with schema_ready_guard():
            return impacts_service.review_impact(
                company_id=user.company_id, impact_id=impact_id,
                accept=body.accept, reviewed_by=user.user_id,
            )
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc


# ---------------------------------------------------------------------------
# Dossiers LEAP
# ---------------------------------------------------------------------------

@router.post("/leap-assessments", response_model=LeapAssessmentResponse, status_code=201)
async def create_leap_assessment_endpoint(
    body: LeapAssessmentCreate,
    user: AuthUser = Depends(require_analyst),
) -> LeapAssessmentResponse:
    require_db()
    try:
        with schema_ready_guard():
            return leap_service.create_assessment(
                company_id=user.company_id, payload=body, created_by=user.user_id,
            )
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/leap-assessments", response_model=LeapAssessmentListResponse)
async def list_leap_assessments_endpoint(
    phase: str | None = Query(None),
    status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> LeapAssessmentListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return leap_service.list_assessments(
                company_id=user.company_id, phase=phase, status=status,
                limit=limit, offset=offset,
            )
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/leap-assessments/{assessment_id}", response_model=LeapAssessmentResponse)
async def get_leap_assessment_endpoint(
    assessment_id: int,
    user: AuthUser = Depends(get_current_user),
) -> LeapAssessmentResponse:
    require_db()
    try:
        with schema_ready_guard():
            return leap_service.get_assessment(
                company_id=user.company_id, assessment_id=assessment_id,
            )
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/leap-assessments/{assessment_id}/sites", response_model=LeapAssessmentResponse)
async def add_leap_assessment_site_endpoint(
    assessment_id: int,
    body: LeapAddSiteRequest,
    user: AuthUser = Depends(require_analyst),
) -> LeapAssessmentResponse:
    require_db()
    try:
        with schema_ready_guard():
            return leap_service.add_site(
                company_id=user.company_id, assessment_id=assessment_id, site_id=body.site_id,
            )
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/leap-assessments/{assessment_id}/advance-phase", response_model=LeapAssessmentResponse)
async def advance_leap_phase_endpoint(
    assessment_id: int,
    body: LeapAdvancePhaseRequest,
    user: AuthUser = Depends(require_analyst),
) -> LeapAssessmentResponse:
    require_db()
    try:
        with schema_ready_guard():
            return leap_service.advance_phase(
                company_id=user.company_id, assessment_id=assessment_id,
                target_phase=body.target_phase, actor_id=user.user_id,
            )
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/leap-assessments/{assessment_id}/review", response_model=LeapAssessmentResponse)
async def review_leap_assessment_endpoint(
    assessment_id: int,
    body: ReviewRequest,
    user: AuthUser = Depends(require_analyst),
) -> LeapAssessmentResponse:
    """Approbation humaine du dossier (motif `article24_service.review()`) —
    `require_analyst` ici (comme le reste de la revue PR-09 tranche A) ; les
    approbations à plus forte portée (brouillon TNFD, 039) exigent
    `require_admin`."""
    require_db()
    try:
        with schema_ready_guard():
            return leap_service.review(
                company_id=user.company_id, assessment_id=assessment_id,
                approve=body.accept, reviewed_by=user.user_id,
            )
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc


# ---------------------------------------------------------------------------
# Assess (tranche B) — risques, enveloppe analytique partagée
# ---------------------------------------------------------------------------

@router.post("/risks/calculate", response_model=AnalyticalEnvelope[NatureRiskData])
async def calculate_risk_endpoint(
    body: RiskCalculateRequest,
    user: AuthUser = Depends(require_analyst),
) -> AnalyticalEnvelope[NatureRiskData]:
    """Score PUR à partir des dépendances/impacts/intersections ACCEPTÉS du
    dossier. `data.risk_score` est `None` si aucune composante n'est
    calculable — jamais un nombre inventé. `likelihood` est un jugement
    humain transmis tel quel, jamais dérivé du score."""
    require_db()
    try:
        with schema_ready_guard():
            return risk_service.calculate(
                company_id=user.company_id, payload=body, calculated_by=user.user_id,
            )
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/risks", response_model=NatureRiskListResponse)
async def list_risks_endpoint(
    assessment_id: int | None = Query(None),
    review_status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> NatureRiskListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return risk_service.list_risks(
                company_id=user.company_id, assessment_id=assessment_id,
                review_status=review_status, limit=limit, offset=offset,
            )
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/risks/{risk_id}", response_model=NatureRiskSummary)
async def get_risk_endpoint(
    risk_id: int,
    user: AuthUser = Depends(get_current_user),
) -> NatureRiskSummary:
    require_db()
    try:
        with schema_ready_guard():
            return risk_service.get_risk(company_id=user.company_id, risk_id=risk_id)
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/risks/{risk_id}/review", response_model=NatureRiskSummary)
async def review_risk_endpoint(
    risk_id: int,
    body: ReviewRequest,
    user: AuthUser = Depends(require_analyst),
) -> NatureRiskSummary:
    require_db()
    try:
        with schema_ready_guard():
            return risk_service.review_risk(
                company_id=user.company_id, risk_id=risk_id,
                accept=body.accept, reviewed_by=user.user_id,
            )
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc


# ---------------------------------------------------------------------------
# Assess (tranche B) — opportunités, même discipline que les risques
# ---------------------------------------------------------------------------

@router.post("/opportunities/calculate", response_model=AnalyticalEnvelope[NatureOpportunityData])
async def calculate_opportunity_endpoint(
    body: OpportunityCalculateRequest,
    user: AuthUser = Depends(require_analyst),
) -> AnalyticalEnvelope[NatureOpportunityData]:
    require_db()
    try:
        with schema_ready_guard():
            return opportunity_service.calculate(
                company_id=user.company_id, payload=body, calculated_by=user.user_id,
            )
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/opportunities", response_model=NatureOpportunityListResponse)
async def list_opportunities_endpoint(
    assessment_id: int | None = Query(None),
    review_status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> NatureOpportunityListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return opportunity_service.list_opportunities(
                company_id=user.company_id, assessment_id=assessment_id,
                review_status=review_status, limit=limit, offset=offset,
            )
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/opportunities/{opportunity_id}", response_model=NatureOpportunitySummary)
async def get_opportunity_endpoint(
    opportunity_id: int,
    user: AuthUser = Depends(get_current_user),
) -> NatureOpportunitySummary:
    require_db()
    try:
        with schema_ready_guard():
            return opportunity_service.get_opportunity(
                company_id=user.company_id, opportunity_id=opportunity_id,
            )
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/opportunities/{opportunity_id}/review", response_model=NatureOpportunitySummary)
async def review_opportunity_endpoint(
    opportunity_id: int,
    body: ReviewRequest,
    user: AuthUser = Depends(require_analyst),
) -> NatureOpportunitySummary:
    require_db()
    try:
        with schema_ready_guard():
            return opportunity_service.review_opportunity(
                company_id=user.company_id, opportunity_id=opportunity_id,
                accept=body.accept, reviewed_by=user.user_id,
            )
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc


# ---------------------------------------------------------------------------
# Prepare (tranche B) — actions
# ---------------------------------------------------------------------------

@router.post("/actions", response_model=NatureActionResponse, status_code=201)
async def create_nature_action_endpoint(
    body: NatureActionCreate,
    user: AuthUser = Depends(require_analyst),
) -> NatureActionResponse:
    require_db()
    try:
        with schema_ready_guard():
            return actions_service.create_action(
                company_id=user.company_id, payload=body, created_by=user.user_id,
            )
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/actions", response_model=NatureActionListResponse)
async def list_nature_actions_endpoint(
    risk_id: int | None = Query(None),
    opportunity_id: int | None = Query(None),
    assessment_id: int | None = Query(None),
    status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> NatureActionListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return actions_service.list_actions(
                company_id=user.company_id, risk_id=risk_id, opportunity_id=opportunity_id,
                assessment_id=assessment_id, status=status, limit=limit, offset=offset,
            )
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/actions/{action_id}/review", response_model=NatureActionResponse)
async def review_nature_action_endpoint(
    action_id: int,
    body: ReviewRequest,
    user: AuthUser = Depends(require_analyst),
) -> NatureActionResponse:
    require_db()
    try:
        with schema_ready_guard():
            return actions_service.review_action(
                company_id=user.company_id, action_id=action_id,
                accept=body.accept, reviewed_by=user.user_id,
            )
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc


# ---------------------------------------------------------------------------
# Prepare (tranche B) — brouillons de disclosure TNFD, TOUJOURS un brouillon
# ---------------------------------------------------------------------------

@router.post("/disclosure-drafts", response_model=TnfdDisclosureDraftResponse, status_code=201)
async def create_disclosure_draft_endpoint(
    body: TnfdDisclosureDraftCreate,
    user: AuthUser = Depends(require_analyst),
) -> TnfdDisclosureDraftResponse:
    """Assemble un brouillon à partir de l'état RÉEL du dossier (dépendances/
    impacts/risques/opportunités/actions) — `is_official_tnfd_disclosure`
    toujours `False`, verrouillé en base."""
    require_db()
    try:
        with schema_ready_guard():
            return disclosure_service.assemble_draft(
                company_id=user.company_id, payload=body, prepared_by=user.user_id,
            )
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/disclosure-drafts", response_model=TnfdDisclosureDraftListResponse)
async def list_disclosure_drafts_endpoint(
    assessment_id: int | None = Query(None),
    status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> TnfdDisclosureDraftListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return disclosure_service.list_drafts(
                company_id=user.company_id, assessment_id=assessment_id, status=status,
                limit=limit, offset=offset,
            )
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc


@router.get("/disclosure-drafts/{draft_id}", response_model=TnfdDisclosureDraftResponse)
async def get_disclosure_draft_endpoint(
    draft_id: int,
    user: AuthUser = Depends(get_current_user),
) -> TnfdDisclosureDraftResponse:
    require_db()
    try:
        with schema_ready_guard():
            return disclosure_service.get_draft(company_id=user.company_id, draft_id=draft_id)
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc


@router.post("/disclosure-drafts/{draft_id}/review", response_model=TnfdDisclosureDraftResponse)
async def review_disclosure_draft_endpoint(
    draft_id: int,
    body: ReviewRequest,
    user: AuthUser = Depends(require_admin),
) -> TnfdDisclosureDraftResponse:
    """Approbation à PLUS FORTE PORTÉE que les revues courantes du domaine
    (`require_admin`, pas `require_analyst`) — un brouillon approuvé reste un
    brouillon (`is_official_tnfd_disclosure=False` non contournable), mais
    l'acte d'approbation interne mérite le rôle le plus élevé."""
    require_db()
    try:
        with schema_ready_guard():
            return disclosure_service.review(
                company_id=user.company_id, draft_id=draft_id,
                approve=body.accept, reviewed_by=user.user_id,
            )
    except _NATURE_ERRORS as exc:
        raise http_error(exc) from exc
