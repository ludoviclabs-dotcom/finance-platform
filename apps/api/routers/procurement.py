"""
routers/procurement.py — Exposition achats / fournisseurs (PR-05A), préfixe /procurement.

Lecture (GET) : utilisateur authentifié du tenant (`get_current_user`, JWT réel
— PAS `get_company_id` qui retomberait sur le tenant 1 par défaut, cf. risque
§11 du plan : ne jamais exposer un achat via un endpoint en `get_company_id`
seul). Écriture (POST) : `require_analyst`.

Endpoints (plan §7, tranche A) :
  POST /procurement/imports                         — import CSV achats (idempotent sha256)
  GET  /procurement/imports                         — liste paginée
  GET  /procurement/imports/{id}                    — détail
  GET  /procurement/imports/{id}/lines              — lignes (drill-down, filtre mapping_status)
  GET  /procurement/imports/{id}/errors             — lignes en anomalie de parse
  GET  /procurement/imports/{id}/resolution-queue   — lignes non mappées à corriger
  POST /procurement/imports/{id}/resolve-mappings   — résolution manuelle
  POST /procurement/imports/{id}/review             — gate de revue (pending→validated/rejected)
  POST /procurement/declarations · GET …            — déclarations fournisseurs sourcées
  POST /procurement/pcfs · GET …                    — PCF produit sourcées

Aucun calcul Scope 3, aucun hotspot, aucun score (PR-05B).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from models.procurement import (
    DeclarationCreate,
    DeclarationListResponse,
    DeclarationResponse,
    ImportReviewRequest,
    MappingStatus,
    PcfCreate,
    PcfListResponse,
    PcfResponse,
    PurchaseImportCreate,
    PurchaseImportListResponse,
    PurchaseImportResponse,
    PurchaseLineListResponse,
    ResolveMappingsRequest,
)
from routers._errors import http_error, require_db
from routers.auth import get_current_user, require_analyst
from services.auth_service import AuthUser
from services.procurement import (
    declarations_service,
    purchase_import_service,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Imports d'achats
# ---------------------------------------------------------------------------

@router.post("/imports", response_model=PurchaseImportResponse, status_code=201)
async def create_import_endpoint(
    body: PurchaseImportCreate,
    user: AuthUser = Depends(require_analyst),
) -> PurchaseImportResponse:
    require_db()
    try:
        return purchase_import_service.create_import(
            company_id=user.company_id,
            filename=body.filename,
            content=body.csv_text.encode("utf-8"),
            period_start=body.period_start,
            period_end=body.period_end,
            imported_by=user.user_id,
        )
    except purchase_import_service.PurchaseImportError as exc:
        raise http_error(exc) from exc


@router.get("/imports", response_model=PurchaseImportListResponse)
async def list_imports_endpoint(
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    user: AuthUser = Depends(get_current_user),
) -> PurchaseImportListResponse:
    require_db()
    items, total = purchase_import_service.list_imports(
        company_id=user.company_id, limit=limit, offset=offset,
    )
    return PurchaseImportListResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/imports/{import_id}", response_model=PurchaseImportResponse)
async def get_import_endpoint(
    import_id: int,
    user: AuthUser = Depends(get_current_user),
) -> PurchaseImportResponse:
    require_db()
    try:
        return purchase_import_service.get_import(company_id=user.company_id, import_id=import_id)
    except purchase_import_service.PurchaseImportError as exc:
        raise http_error(exc) from exc


@router.get("/imports/{import_id}/lines", response_model=PurchaseLineListResponse)
async def list_import_lines_endpoint(
    import_id: int,
    mapping_status: MappingStatus | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    user: AuthUser = Depends(get_current_user),
) -> PurchaseLineListResponse:
    require_db()
    try:
        purchase_import_service.get_import(company_id=user.company_id, import_id=import_id)
    except purchase_import_service.PurchaseImportError as exc:
        raise http_error(exc) from exc
    items, total = purchase_import_service.list_lines(
        company_id=user.company_id, import_id=import_id, mapping_status=mapping_status,
        limit=limit, offset=offset,
    )
    return PurchaseLineListResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/imports/{import_id}/errors", response_model=PurchaseLineListResponse)
async def list_import_errors_endpoint(
    import_id: int,
    user: AuthUser = Depends(get_current_user),
) -> PurchaseLineListResponse:
    require_db()
    try:
        purchase_import_service.get_import(company_id=user.company_id, import_id=import_id)
    except purchase_import_service.PurchaseImportError as exc:
        raise http_error(exc) from exc
    lines = purchase_import_service.list_errors(company_id=user.company_id, import_id=import_id)
    return PurchaseLineListResponse(items=lines, total=len(lines), limit=len(lines), offset=0)


@router.get("/imports/{import_id}/resolution-queue", response_model=PurchaseLineListResponse)
async def resolution_queue_endpoint(
    import_id: int,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    user: AuthUser = Depends(get_current_user),
) -> PurchaseLineListResponse:
    require_db()
    try:
        purchase_import_service.get_import(company_id=user.company_id, import_id=import_id)
    except purchase_import_service.PurchaseImportError as exc:
        raise http_error(exc) from exc
    items, total = purchase_import_service.list_resolution_queue(
        company_id=user.company_id, import_id=import_id, limit=limit, offset=offset,
    )
    return PurchaseLineListResponse(items=items, total=total, limit=limit, offset=offset)


@router.post("/imports/{import_id}/resolve-mappings")
async def resolve_mappings_endpoint(
    import_id: int,
    body: ResolveMappingsRequest,
    user: AuthUser = Depends(require_analyst),
) -> dict:
    require_db()
    try:
        return purchase_import_service.resolve_mappings(
            company_id=user.company_id, import_id=import_id,
            resolutions=body.resolutions, reviewed_by=user.user_id,
        )
    except purchase_import_service.PurchaseImportError as exc:
        raise http_error(exc) from exc


@router.post("/imports/{import_id}/review", response_model=PurchaseImportResponse)
async def review_import_endpoint(
    import_id: int,
    body: ImportReviewRequest,
    user: AuthUser = Depends(require_analyst),
) -> PurchaseImportResponse:
    require_db()
    try:
        return purchase_import_service.review_import(
            company_id=user.company_id, import_id=import_id, accept=body.accept, reviewed_by=user.user_id,
        )
    except purchase_import_service.PurchaseImportError as exc:
        raise http_error(exc) from exc


# ---------------------------------------------------------------------------
# Déclarations fournisseurs (sourcées)
# ---------------------------------------------------------------------------

@router.post("/declarations", response_model=DeclarationResponse, status_code=201)
async def create_declaration_endpoint(
    body: DeclarationCreate,
    user: AuthUser = Depends(require_analyst),
) -> DeclarationResponse:
    require_db()
    try:
        return declarations_service.create_declaration(
            company_id=user.company_id, payload=body, created_by=user.user_id,
        )
    except declarations_service.DeclarationError as exc:
        raise http_error(exc) from exc


@router.get("/declarations", response_model=DeclarationListResponse)
async def list_declarations_endpoint(
    supplier_id: int | None = None,
    supplier_product_id: int | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    user: AuthUser = Depends(get_current_user),
) -> DeclarationListResponse:
    require_db()
    items, total = declarations_service.list_declarations(
        company_id=user.company_id, supplier_id=supplier_id,
        supplier_product_id=supplier_product_id, limit=limit, offset=offset,
    )
    return DeclarationListResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/declarations/{declaration_id}", response_model=DeclarationResponse)
async def get_declaration_endpoint(
    declaration_id: int,
    user: AuthUser = Depends(get_current_user),
) -> DeclarationResponse:
    require_db()
    try:
        return declarations_service.get_declaration(
            company_id=user.company_id, declaration_id=declaration_id,
        )
    except declarations_service.DeclarationError as exc:
        raise http_error(exc) from exc


# ---------------------------------------------------------------------------
# PCF produit (sourcées)
# ---------------------------------------------------------------------------

@router.post("/pcfs", response_model=PcfResponse, status_code=201)
async def create_pcf_endpoint(
    body: PcfCreate,
    user: AuthUser = Depends(require_analyst),
) -> PcfResponse:
    require_db()
    try:
        return declarations_service.create_pcf(
            company_id=user.company_id, payload=body, created_by=user.user_id,
        )
    except declarations_service.DeclarationError as exc:
        raise http_error(exc) from exc


@router.get("/pcfs", response_model=PcfListResponse)
async def list_pcfs_endpoint(
    supplier_product_id: int | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    user: AuthUser = Depends(get_current_user),
) -> PcfListResponse:
    require_db()
    items, total = declarations_service.list_pcfs(
        company_id=user.company_id, supplier_product_id=supplier_product_id, limit=limit, offset=offset,
    )
    return PcfListResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/pcfs/{pcf_id}", response_model=PcfResponse)
async def get_pcf_endpoint(
    pcf_id: int,
    user: AuthUser = Depends(get_current_user),
) -> PcfResponse:
    require_db()
    try:
        return declarations_service.get_pcf(company_id=user.company_id, pcf_id=pcf_id)
    except declarations_service.DeclarationError as exc:
        raise http_error(exc) from exc
