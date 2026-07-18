"""
routers/intelligence.py — Evidence Kernel (PR-03) : API protégée minimale.

Lecture (GET) : tout utilisateur authentifié du tenant (`get_current_user`,
RLS filtre global+tenant automatiquement). Création/modification tenant
(POST/PATCH) : `require_analyst`. Aucune opération globale exposée dans
PR-03 (publier une source globale reste un geste admin hors périmètre de
cette PR, cf. mission — "Ne crée pas encore : endpoint de publication
automatique").
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from db.database import db_available
from models.intelligence import (
    IngestionRunListResponse,
    IngestionRunResponse,
    ObservationCreate,
    ObservationListResponse,
    ObservationResponse,
    ReleaseCreate,
    ReleaseListResponse,
    ReleaseResponse,
    ReleaseValidateRequest,
    SourceCreate,
    SourceFreshness,
    SourceListResponse,
    SourceResponse,
    SourceUpdate,
)
from routers.auth import get_current_user, require_admin, require_analyst
from services.auth_service import AuthUser
from services.intelligence import (
    freshness_service,
    ingestion_service,
    observation_service,
    release_service,
    source_service,
)

router = APIRouter()


def _http_error(exc: Exception) -> HTTPException:
    """Traduit une erreur métier du noyau en HTTPException.

    Convention partagée par les 4 modules de service (source/release/
    ingestion/observation) : messages en français, cohérents ("introuvable",
    "requis/requise") — pas une hiérarchie d'exceptions par code HTTP, à
    l'image de evidence_service.EvidenceError qui laisse déjà le routeur
    décider par contexte.
    """
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
# Sources
# ---------------------------------------------------------------------------

@router.get("/sources", response_model=SourceListResponse)
async def list_sources_endpoint(
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    active_only: bool = False,
    user: AuthUser = Depends(get_current_user),
) -> SourceListResponse:
    _require_db()
    items, total = source_service.list_sources(
        company_id=user.company_id, limit=limit, offset=offset, active_only=active_only,
    )
    return SourceListResponse(items=items, total=total, limit=limit, offset=offset)


@router.post("/sources", response_model=SourceResponse, status_code=201)
async def create_source_endpoint(
    body: SourceCreate,
    user: AuthUser = Depends(require_analyst),
) -> SourceResponse:
    _require_db()
    try:
        return source_service.create_source(
            company_id=user.company_id, payload=body, created_by=user.user_id,
        )
    except source_service.SourceError as exc:
        raise _http_error(exc) from exc


@router.get("/sources/{source_id}", response_model=SourceResponse)
async def get_source_endpoint(
    source_id: int,
    user: AuthUser = Depends(get_current_user),
) -> SourceResponse:
    _require_db()
    try:
        return source_service.get_source(company_id=user.company_id, source_id=source_id)
    except source_service.SourceError as exc:
        raise _http_error(exc) from exc


@router.patch("/sources/{source_id}", response_model=SourceResponse)
async def update_source_endpoint(
    source_id: int,
    body: SourceUpdate,
    user: AuthUser = Depends(require_analyst),
) -> SourceResponse:
    _require_db()
    try:
        return source_service.update_source(company_id=user.company_id, source_id=source_id, payload=body)
    except source_service.SourceError as exc:
        raise _http_error(exc) from exc


@router.get("/sources/{source_id}/freshness", response_model=SourceFreshness)
async def get_source_freshness_endpoint(
    source_id: int,
    user: AuthUser = Depends(get_current_user),
) -> SourceFreshness:
    """Fraîcheur d'une source (âge de la dernière release, péremption, licence).
    404 (jamais 403) si hors périmètre tenant — pas de fuite d'existence."""
    _require_db()
    result = freshness_service.get_source_freshness(company_id=user.company_id, source_id=source_id)
    if result is None:
        raise HTTPException(404, detail=f"Source '{source_id}' introuvable.")
    return result


# ---------------------------------------------------------------------------
# Releases
# ---------------------------------------------------------------------------

@router.get("/sources/{source_id}/releases", response_model=ReleaseListResponse)
async def list_releases_endpoint(
    source_id: int,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    user: AuthUser = Depends(get_current_user),
) -> ReleaseListResponse:
    _require_db()
    items, total = release_service.list_releases_for_source(
        company_id=user.company_id, source_id=source_id, limit=limit, offset=offset,
    )
    return ReleaseListResponse(items=items, total=total, limit=limit, offset=offset)


@router.post("/sources/{source_id}/releases", response_model=ReleaseResponse, status_code=201)
async def create_release_endpoint(
    source_id: int,
    body: ReleaseCreate,
    user: AuthUser = Depends(require_analyst),
) -> ReleaseResponse:
    _require_db()
    try:
        return release_service.detect_release(
            company_id=user.company_id, source_id=source_id, payload=body, created_by=user.user_id,
        )
    except release_service.ReleaseError as exc:
        raise _http_error(exc) from exc


@router.get("/releases/{release_id}", response_model=ReleaseResponse)
async def get_release_endpoint(
    release_id: int,
    user: AuthUser = Depends(get_current_user),
) -> ReleaseResponse:
    _require_db()
    try:
        return release_service.get_release(company_id=user.company_id, release_id=release_id)
    except release_service.ReleaseError as exc:
        raise _http_error(exc) from exc


# ---------------------------------------------------------------------------
# Transitions de release (PR-04) — pilotent le cycle de vie depuis la page
# Source Admin. `require_admin` : gestes de gouvernance, pas de simple analyste.
# Les transitions elles-mêmes existent déjà en service (PR-03) ; PR-04 ne fait
# que les exposer. La licence bloquante n'est pas une erreur : publish renvoie
# 200 avec le statut `blocked_license` (état normal du cycle de vie).
# ---------------------------------------------------------------------------

@router.post("/releases/{release_id}/validate", response_model=ReleaseResponse)
async def validate_release_endpoint(
    release_id: int,
    body: ReleaseValidateRequest | None = None,
    user: AuthUser = Depends(require_admin),
) -> ReleaseResponse:
    _require_db()
    passed = body.passed if body is not None else True
    try:
        return release_service.validate_release(
            company_id=user.company_id, release_id=release_id, passed=passed,
        )
    except release_service.ReleaseError as exc:
        raise _http_error(exc) from exc


@router.post("/releases/{release_id}/publish", response_model=ReleaseResponse)
async def publish_release_endpoint(
    release_id: int,
    user: AuthUser = Depends(require_admin),
) -> ReleaseResponse:
    _require_db()
    try:
        return release_service.publish_release(company_id=user.company_id, release_id=release_id)
    except release_service.ReleaseError as exc:
        raise _http_error(exc) from exc


@router.post("/releases/{release_id}/supersede", response_model=ReleaseResponse)
async def supersede_release_endpoint(
    release_id: int,
    user: AuthUser = Depends(require_admin),
) -> ReleaseResponse:
    _require_db()
    try:
        return release_service.supersede_release(company_id=user.company_id, new_release_id=release_id)
    except release_service.ReleaseError as exc:
        raise _http_error(exc) from exc


# ---------------------------------------------------------------------------
# Ingestions (lecture seule dans PR-03 — création réservée aux futurs
# adaptateurs, pas exposée via API publique ici)
# ---------------------------------------------------------------------------

@router.get("/ingestions", response_model=IngestionRunListResponse)
async def list_ingestions_endpoint(
    source_id: int | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    user: AuthUser = Depends(get_current_user),
) -> IngestionRunListResponse:
    _require_db()
    items, total = ingestion_service.list_runs(
        company_id=user.company_id, source_id=source_id, limit=limit, offset=offset,
    )
    return IngestionRunListResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/ingestions/{ingestion_id}", response_model=IngestionRunResponse)
async def get_ingestion_endpoint(
    ingestion_id: int,
    user: AuthUser = Depends(get_current_user),
) -> IngestionRunResponse:
    _require_db()
    try:
        return ingestion_service.get_run(company_id=user.company_id, run_id=ingestion_id)
    except ingestion_service.IngestionError as exc:
        raise _http_error(exc) from exc


# ---------------------------------------------------------------------------
# Observations
# ---------------------------------------------------------------------------

@router.get("/observations", response_model=ObservationListResponse)
async def list_observations_endpoint(
    subject_type: str | None = None,
    subject_key: str | None = None,
    metric_code: str | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    user: AuthUser = Depends(get_current_user),
) -> ObservationListResponse:
    _require_db()
    items, total = observation_service.list_observations(
        company_id=user.company_id,
        subject_type=subject_type,
        subject_key=subject_key,
        metric_code=metric_code,
        limit=limit,
        offset=offset,
    )
    return ObservationListResponse(items=items, total=total, limit=limit, offset=offset)


@router.post("/observations", response_model=ObservationResponse, status_code=201)
async def create_observation_endpoint(
    body: ObservationCreate,
    user: AuthUser = Depends(require_analyst),
) -> ObservationResponse:
    _require_db()
    try:
        return observation_service.create_observation(company_id=user.company_id, payload=body)
    except observation_service.ObservationError as exc:
        raise _http_error(exc) from exc


@router.get("/observations/{observation_id}", response_model=ObservationResponse)
async def get_observation_endpoint(
    observation_id: int,
    user: AuthUser = Depends(get_current_user),
) -> ObservationResponse:
    _require_db()
    try:
        return observation_service.get_observation(company_id=user.company_id, observation_id=observation_id)
    except observation_service.ObservationError as exc:
        raise _http_error(exc) from exc
