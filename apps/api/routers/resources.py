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
    ResourceAliasListResponse,
    ResourceCatalogDetail,
    ResourceCatalogListResponse,
    ResourceRegulatoryStatusListResponse,
    ResourceSectorUseListResponse,
)
from routers._errors import http_error, require_db, schema_ready_guard
from routers.auth import get_current_user
from services.auth_service import AuthUser
from services.resources import catalog_service, regulatory_service

router = APIRouter()

# Erreurs métier du domaine : convention lexicale partagée (contrats §6) —
# « introuvable » → 404, « requis/requise » → 400, sinon 409.
_RESOURCE_ERRORS = (
    catalog_service.ResourceCatalogError,
    regulatory_service.ResourceRegulatoryError,
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
