"""routers/sites.py — Sites physiques.

v1 (027, INCHANGÉE — schéma déjà en production) :
  GET  /sites — sites de la company
  POST /sites — créer un site (analyste)

Extension géospatiale (PR-08A, migration 036 — routes NEUVES uniquement,
toutes sous `schema_ready_guard` : la production déploie ce code AVANT
l'application de 036, ces routes doivent répondre 503 `schema_not_ready`
proprement, jamais une erreur SQL brute) :
  GET  /sites/geo                                        — sites + position + gate
  GET  /sites/{id}/geocode-candidates                    — historique des candidats
  POST /sites/{id}/geocode-candidates                    — proposer (analyste ; la
                                                           saisie manuelle passe par
                                                           le MÊME gate)
  POST /sites/{id}/geocode-candidates/{cid}/review       — accepter/rejeter (analyste)
  POST /sites/{id}/geocode/flag                          — marquer la position douteuse

Un site rattache les leviers MACC (actions.site_id) à une implantation réelle.
Pas de DELETE en v1 : la FK actions.site_id est ON DELETE SET NULL, mais la
suppression attendra un vrai besoin (et son UI de confirmation).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from db.database import db_available
from models.geo import (
    GeocodeCandidateCreate,
    GeocodeCandidateListResponse,
    GeocodeCandidateResponse,
    GeocodeCandidateReviewRequest,
    SiteGeoListResponse,
    SiteGeoResponse,
)
from routers._errors import http_error, require_db, schema_ready_guard
from routers.auth import get_current_user, require_analyst
from services import sites_service
from services.auth_service import AuthUser
from services.geo import geocode_service

router = APIRouter()


class SiteCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    location: str | None = Field(None, max_length=300)
    naf_code: str | None = Field(None, max_length=20)
    activity_type: str | None = Field(None, max_length=100)


@router.get("")
def list_sites(user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    return {"sites": sites_service.list_sites(user.company_id)}


@router.post("", status_code=201)
def create_site(body: SiteCreate, user: AuthUser = Depends(require_analyst)) -> dict[str, Any]:
    if not db_available():
        raise HTTPException(503, "Base indisponible.")
    try:
        return sites_service.create_site(user.company_id, **body.model_dump())
    except sites_service.SiteError as exc:
        raise HTTPException(400, str(exc)) from exc


# ---------------------------------------------------------------------------
# Extension géospatiale (PR-08A) — routes NEUVES, gate de revue humaine.
# ---------------------------------------------------------------------------

@router.get("/geo", response_model=SiteGeoListResponse)
async def list_sites_geo_endpoint(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> SiteGeoListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return geocode_service.list_sites_geo(
                company_id=user.company_id, limit=limit, offset=offset
            )
    except geocode_service.GeocodeError as exc:
        raise http_error(exc) from exc


@router.get("/{site_id}/geocode-candidates", response_model=GeocodeCandidateListResponse)
async def list_geocode_candidates_endpoint(
    site_id: int,
    status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: AuthUser = Depends(get_current_user),
) -> GeocodeCandidateListResponse:
    require_db()
    try:
        with schema_ready_guard():
            return geocode_service.list_candidates(
                company_id=user.company_id, site_id=site_id, status=status,
                limit=limit, offset=offset,
            )
    except geocode_service.GeocodeError as exc:
        raise http_error(exc) from exc


@router.post(
    "/{site_id}/geocode-candidates",
    response_model=GeocodeCandidateResponse,
    status_code=201,
)
async def propose_geocode_candidate_endpoint(
    site_id: int,
    body: GeocodeCandidateCreate,
    user: AuthUser = Depends(require_analyst),
) -> GeocodeCandidateResponse:
    """Propose un candidat — saisie manuelle ou provenance fournisseur
    (métadonnée). MÊME gate pour tous : le candidat naît `proposed` et ne
    devient utilisable qu'après acceptation humaine."""
    require_db()
    try:
        with schema_ready_guard():
            return geocode_service.propose_candidate(
                company_id=user.company_id, site_id=site_id, payload=body,
                created_by=user.user_id,
            )
    except geocode_service.GeocodeError as exc:
        raise http_error(exc) from exc


@router.post(
    "/{site_id}/geocode-candidates/{candidate_id}/review",
    response_model=GeocodeCandidateResponse,
)
async def review_geocode_candidate_endpoint(
    site_id: int,
    candidate_id: int,
    body: GeocodeCandidateReviewRequest,
    user: AuthUser = Depends(require_analyst),
) -> GeocodeCandidateResponse:
    """Revue HUMAINE : accepter promeut la position vers `sites` ; rejeter la
    laisse intacte. Le réviseur est l'utilisateur du JWT."""
    require_db()
    try:
        with schema_ready_guard():
            return geocode_service.review_candidate(
                company_id=user.company_id, site_id=site_id,
                candidate_id=candidate_id, accept=body.accept,
                reviewed_by=user.user_id, note=body.note,
            )
    except geocode_service.GeocodeError as exc:
        raise http_error(exc) from exc


@router.post("/{site_id}/geocode/flag", response_model=SiteGeoResponse)
async def flag_site_position_endpoint(
    site_id: int,
    user: AuthUser = Depends(require_analyst),
) -> SiteGeoResponse:
    """Marque la position courante `flagged` : visible mais exclue de tout
    calcul tant qu'un nouveau candidat n'est pas accepté."""
    require_db()
    try:
        with schema_ready_guard():
            return geocode_service.flag_site_position(
                company_id=user.company_id, site_id=site_id, reviewed_by=user.user_id,
            )
    except geocode_service.GeocodeError as exc:
        raise http_error(exc) from exc
