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

TOUTES les routes de ce fichier sont NEUVES (migration 038 pas encore
appliquée au moment où la production déploie ce code) : chacune est sous
`schema_ready_guard` et répond 503 `schema_not_ready` tant que le schéma
n'est pas migré — jamais une erreur SQL brute.

Aucun LLM, aucune source externe, aucun appel réseau, aucune écriture de
production par ce code. Aucune conclusion automatique : proximité ≠ impact,
dépendance ≠ risque financier (PR-10).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from models.nature import (
    IntersectionReviewRequest,
    LeapAddSiteRequest,
    LeapAdvancePhaseRequest,
    LeapAssessmentCreate,
    LeapAssessmentListResponse,
    LeapAssessmentResponse,
    LocateRequest,
    NatureDependencyCreate,
    NatureDependencyListResponse,
    NatureDependencyResponse,
    NatureFeatureListResponse,
    NatureFeatureResponse,
    NatureImpactCreate,
    NatureImpactListResponse,
    NatureImpactResponse,
    ReviewRequest,
    SiteNatureIntersectionListResponse,
    SiteNatureIntersectionResponse,
)
from routers._errors import http_error, require_db, schema_ready_guard
from routers.auth import get_current_user, require_admin, require_analyst
from services.auth_service import AuthUser
from services.nature import (
    dependencies_service,
    features_service,
    impacts_service,
    leap_service,
    locate_service,
)

router = APIRouter()

_NATURE_ERRORS = (
    features_service.NatureFeatureError,
    locate_service.NatureLocateError,
    dependencies_service.NatureDependencyError,
    impacts_service.NatureImpactError,
    leap_service.NatureLeapError,
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
