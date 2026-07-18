"""
routers/products.py — nomenclatures (BOM) & correspondances matières (PR-05A),
préfixe /products.

Les BOM sont rattachées aux produits internes (`products`, DPP). Router dédié
(prefix `/products`) pour honorer le contrat d'URL du plan §7
(`/products/{id}/boms`). Aucune route racine `/products/{id}` ici (le CRUD
produit DPP vit sous `/dpp/products`) → aucun risque de capture de chemin.

Endpoints (plan §7, tranche A) :
  POST /products/{id}/boms                                  — créer une version BOM + items
  GET  /products/{id}/boms                                  — lister les versions
  GET  /products/{id}/boms/{version}                        — version + arbre d'items (drill-down)
  POST /products/{id}/boms/{version}/map-materials          — rattacher des matières
  POST /products/{id}/boms/{version}/mappings/{mid}/review  — gate de revue d'un mapping

Lecture : `get_current_user` (JWT réel). Écriture : `require_analyst`.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from models.procurement import (
    BomVersionCreate,
    BomVersionDetail,
    BomVersionListResponse,
    BomVersionResponse,
    MapMaterialsRequest,
    MaterialMappingResponse,
    MaterialMappingReviewRequest,
)
from routers._errors import http_error, require_db
from routers.auth import get_current_user, require_analyst
from services.auth_service import AuthUser
from services.procurement import bom_service

router = APIRouter()


@router.post("/{product_id}/boms", response_model=BomVersionResponse, status_code=201)
async def create_bom_endpoint(
    product_id: int,
    body: BomVersionCreate,
    user: AuthUser = Depends(require_analyst),
) -> BomVersionResponse:
    require_db()
    try:
        return bom_service.create_bom(
            company_id=user.company_id, product_id=product_id, payload=body, created_by=user.user_id,
        )
    except bom_service.BomError as exc:
        raise http_error(exc) from exc


@router.get("/{product_id}/boms", response_model=BomVersionListResponse)
async def list_boms_endpoint(
    product_id: int,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    user: AuthUser = Depends(get_current_user),
) -> BomVersionListResponse:
    require_db()
    items, total = bom_service.list_boms(
        company_id=user.company_id, product_id=product_id, limit=limit, offset=offset,
    )
    return BomVersionListResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/{product_id}/boms/{version}", response_model=BomVersionDetail)
async def get_bom_endpoint(
    product_id: int,
    version: str,
    user: AuthUser = Depends(get_current_user),
) -> BomVersionDetail:
    require_db()
    try:
        return bom_service.get_bom(company_id=user.company_id, product_id=product_id, version=version)
    except bom_service.BomError as exc:
        raise http_error(exc) from exc


@router.post("/{product_id}/boms/{version}/map-materials", response_model=list[MaterialMappingResponse])
async def map_materials_endpoint(
    product_id: int,
    version: str,
    body: MapMaterialsRequest,
    user: AuthUser = Depends(require_analyst),
) -> list[MaterialMappingResponse]:
    require_db()
    try:
        return bom_service.map_materials(
            company_id=user.company_id, product_id=product_id, version=version,
            mappings=body.mappings, reviewed_by=user.user_id,
        )
    except bom_service.BomError as exc:
        raise http_error(exc) from exc


@router.post(
    "/{product_id}/boms/{version}/mappings/{mapping_id}/review",
    response_model=MaterialMappingResponse,
)
async def review_mapping_endpoint(
    product_id: int,
    version: str,
    mapping_id: int,
    body: MaterialMappingReviewRequest,
    user: AuthUser = Depends(require_analyst),
) -> MaterialMappingResponse:
    require_db()
    try:
        return bom_service.review_mapping(
            company_id=user.company_id, mapping_id=mapping_id, accept=body.accept, reviewed_by=user.user_id,
        )
    except bom_service.BomError as exc:
        raise http_error(exc) from exc
