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

Endpoints (plan §7, tranche B — moteur Scope 3, hotspots, campagnes) :
  POST /procurement/calculate                       — run de calcul (idempotent par entrées)
  GET  /procurement/runs · /runs/{id}               — runs
  POST /procurement/runs/{id}/approve               — approbation humaine + scellement fact
  GET  /procurement/runs/{id}/lines                 — résultats par ligne (drill-down)
  GET  /procurement/runs/{id}/coverage              — couverture & méthodes (enveloppe §4)
  GET  /procurement/runs/{id}/trace/{line_id}       — trace de calcul (enveloppe §4)
  GET  /procurement/runs/{id}/evidence-pack         — Evidence Pack ZIP vérifiable
  GET  /procurement/hotspots                        — hotspots détectés (enveloppe §4)
  POST /procurement/hotspots/select                 — SÉLECTION HUMAINE
  GET  /procurement/hotspots/selections             — sélections enregistrées
  POST /procurement/hotspots/selections/{id}/campaign — campagne depuis un hotspot retenu
  GET  /procurement/exposures/{materials|countries} — expositions (enveloppe §4)

Ordonnancement des routes : les littérales (`/hotspots/select`,
`/hotspots/selections`) sont déclarées AVANT toute route paramétrée du même
préfixe, comme `routers/suppliers.py` le fait déjà pour `/scope3`, `/campaigns`
(piège documenté au §7 du plan).

Pagination §5, erreurs §6 (helper partagé `routers/_errors.py`), isolation §7,
licence §8. Aucun LLM : aucun de ces endpoints n'appelle un modèle de langage.
"""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Response

from models.analytics import AnalyticalEnvelope
from models.procurement import (
    CalculationMethod,
    CalculationRequest,
    CalculationTraceData,
    CampaignFromHotspotRequest,
    CampaignFromHotspotResponse,
    CoverageData,
    DeclarationCreate,
    DeclarationListResponse,
    DeclarationResponse,
    ExposureData,
    HotspotsData,
    HotspotSelectionCreate,
    HotspotSelectionListResponse,
    HotspotSelectionResponse,
    HotspotType,
    ImportReviewRequest,
    LineResultListResponse,
    MappingStatus,
    PcfCreate,
    PcfListResponse,
    PcfResponse,
    PurchaseImportCreate,
    PurchaseImportListResponse,
    PurchaseImportResponse,
    PurchaseLineListResponse,
    ResolveMappingsRequest,
    RunListResponse,
    RunResponse,
)
from routers._errors import http_error, require_db
from routers.auth import get_current_user, require_analyst
from services.auth_service import AuthUser
from services.procurement import (
    calculation_run_service,
    declarations_service,
    evidence_pack,
    hotspots_service,
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


# ===========================================================================
# PR-05B — Moteur de calcul Scope 3 catégorie 1
# ===========================================================================

@router.post("/calculate", response_model=RunResponse, status_code=201)
async def calculate_endpoint(
    body: CalculationRequest,
    user: AuthUser = Depends(require_analyst),
) -> RunResponse:
    """Lance un run sur un périmètre EXPLICITE (import validé et/ou période).

    Idempotent : sans `force_recalculate`, des entrées identiques rendent le run
    existant (`already_calculated=true`) au lieu d'en créer un second."""
    require_db()
    try:
        return calculation_run_service.calculate(
            company_id=user.company_id, payload=body, created_by=user.user_id,
        )
    except calculation_run_service.ProcurementCalculationError as exc:
        raise http_error(exc) from exc


@router.get("/runs", response_model=RunListResponse)
async def list_runs_endpoint(
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    user: AuthUser = Depends(get_current_user),
) -> RunListResponse:
    require_db()
    items, total = calculation_run_service.list_runs(
        company_id=user.company_id, limit=limit, offset=offset,
    )
    return RunListResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/runs/{run_id}", response_model=RunResponse)
async def get_run_endpoint(
    run_id: int,
    user: AuthUser = Depends(get_current_user),
) -> RunResponse:
    require_db()
    try:
        return calculation_run_service.get_run(company_id=user.company_id, run_id=run_id)
    except calculation_run_service.ProcurementCalculationError as exc:
        raise http_error(exc) from exc


@router.post("/runs/{run_id}/approve", response_model=RunResponse)
async def approve_run_endpoint(
    run_id: int,
    user: AuthUser = Depends(require_analyst),
) -> RunResponse:
    """Approbation HUMAINE d'un run, puis scellement d'un fait récapitulatif
    dans la chaîne `facts_events`. Rien n'est approuvé automatiquement."""
    require_db()
    try:
        return calculation_run_service.approve_run(
            company_id=user.company_id, run_id=run_id, approved_by=user.user_id,
        )
    except calculation_run_service.ProcurementCalculationError as exc:
        raise http_error(exc) from exc


@router.get("/runs/{run_id}/lines", response_model=LineResultListResponse)
async def list_run_lines_endpoint(
    run_id: int,
    calculation_method: CalculationMethod | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    user: AuthUser = Depends(get_current_user),
) -> LineResultListResponse:
    """Résultats par ligne. Les lignes non résolues sont dans la MÊME liste —
    jamais filtrées par défaut, jamais reléguées à un écran secondaire."""
    require_db()
    try:
        items, total = calculation_run_service.list_line_results(
            company_id=user.company_id, run_id=run_id,
            calculation_method=calculation_method, limit=limit, offset=offset,
        )
    except calculation_run_service.ProcurementCalculationError as exc:
        raise http_error(exc) from exc
    return LineResultListResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/runs/{run_id}/coverage", response_model=AnalyticalEnvelope[CoverageData])
async def run_coverage_endpoint(
    run_id: int,
    user: AuthUser = Depends(get_current_user),
) -> AnalyticalEnvelope[CoverageData]:
    """Couverture et répartition par méthode, en enveloppe analytique (§4)."""
    require_db()
    try:
        run = calculation_run_service.get_run(company_id=user.company_id, run_id=run_id)
        data = calculation_run_service.get_coverage(company_id=user.company_id, run_id=run_id)
        evidence = calculation_run_service.list_run_evidence(
            company_id=user.company_id, run_id=run_id,
        )
    except calculation_run_service.ProcurementCalculationError as exc:
        raise http_error(exc) from exc
    return AnalyticalEnvelope[CoverageData](
        data=data, meta=calculation_run_service.build_meta(run), evidence=evidence,
    )


@router.get(
    "/runs/{run_id}/trace/{line_id}",
    response_model=AnalyticalEnvelope[CalculationTraceData],
)
async def run_trace_endpoint(
    run_id: int,
    line_id: int,
    user: AuthUser = Depends(get_current_user),
) -> AnalyticalEnvelope[CalculationTraceData]:
    """Trace complète d'une ligne : achat → fournisseur → produit → BOM →
    matière → facteur → preuve, avec la hiérarchie réellement parcourue."""
    require_db()
    try:
        run = calculation_run_service.get_run(company_id=user.company_id, run_id=run_id)
        data = calculation_run_service.get_trace(
            company_id=user.company_id, run_id=run_id, line_id=line_id,
        )
        evidence = calculation_run_service.list_run_evidence(
            company_id=user.company_id, run_id=run_id,
        )
    except calculation_run_service.ProcurementCalculationError as exc:
        raise http_error(exc) from exc
    return AnalyticalEnvelope[CalculationTraceData](
        data=data,
        meta=calculation_run_service.build_meta(run, extra_warnings=data.warnings),
        evidence=evidence,
    )


@router.get("/runs/{run_id}/evidence-pack")
async def run_evidence_pack_endpoint(
    run_id: int,
    user: AuthUser = Depends(get_current_user),
) -> Response:
    """Evidence Pack ZIP du run — auto-suffisant et vérifiable hors plateforme
    (`sha256sum -c CHECKSUMS.sha256`, puis page publique `/verify/{hash}`)."""
    require_db()
    try:
        pack = evidence_pack.build_run_evidence_pack(
            company_id=user.company_id, run_id=run_id, generated_by=user.user_id,
        )
    except calculation_run_service.ProcurementCalculationError as exc:
        raise http_error(exc) from exc
    except evidence_pack.EvidencePackError as exc:
        raise http_error(exc) from exc
    return Response(
        content=pack["zip_bytes"],
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{pack["filename"]}"',
            "X-Package-Hash": pack["package_hash"],
            "X-Manifest-Hash": pack["manifest_hash"],
        },
    )


# ===========================================================================
# PR-05B — Hotspots (routes littérales AVANT toute route paramétrée)
# ===========================================================================

@router.post("/hotspots/select", response_model=HotspotSelectionResponse, status_code=201)
async def select_hotspot_endpoint(
    body: HotspotSelectionCreate,
    user: AuthUser = Depends(require_analyst),
) -> HotspotSelectionResponse:
    """SÉLECTION HUMAINE d'un hotspot détecté. La détection classe ; seul cet
    appel retient ou écarte. Les chiffres de contribution sont relus depuis le
    run, jamais recopiés depuis le client."""
    require_db()
    try:
        return hotspots_service.select_hotspot(
            company_id=user.company_id, payload=body, selected_by=user.user_id,
        )
    except hotspots_service.HotspotError as exc:
        raise http_error(exc) from exc


@router.get("/hotspots/selections", response_model=HotspotSelectionListResponse)
async def list_hotspot_selections_endpoint(
    run_id: int | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    user: AuthUser = Depends(get_current_user),
) -> HotspotSelectionListResponse:
    require_db()
    items, total = hotspots_service.list_selections(
        company_id=user.company_id, run_id=run_id, limit=limit, offset=offset,
    )
    return HotspotSelectionListResponse(items=items, total=total, limit=limit, offset=offset)


@router.post(
    "/hotspots/selections/{selection_id}/campaign",
    response_model=CampaignFromHotspotResponse,
    status_code=201,
)
async def campaign_from_hotspot_endpoint(
    selection_id: int,
    body: CampaignFromHotspotRequest,
    user: AuthUser = Depends(require_analyst),
) -> CampaignFromHotspotResponse:
    """Crée une campagne de collecte CIBLÉE depuis un hotspot retenu.

    Refusé bruyamment si la sélection n'est pas `selected`, n'est pas de type
    `supplier`, ou ne porte pas de fournisseur du tenant."""
    require_db()
    try:
        return hotspots_service.create_campaign_from_selection(
            company_id=user.company_id, selection_id=selection_id, payload=body,
            created_by=user.email,
        )
    except hotspots_service.HotspotError as exc:
        raise http_error(exc) from exc


@router.get("/hotspots", response_model=AnalyticalEnvelope[HotspotsData])
async def hotspots_endpoint(
    run_id: int,
    hotspot_type: HotspotType = "supplier",
    limit: Annotated[int, Query(ge=1, le=200)] = 20,
    user: AuthUser = Depends(get_current_user),
) -> AnalyticalEnvelope[HotspotsData]:
    """Hotspots détectés d'un run (agrégation déterministe, lecture seule).

    Chaque hotspot porte sa part NON RÉSOLUE : un poste largement non calculé
    ne doit pas se lire comme un petit contributeur."""
    require_db()
    try:
        run = calculation_run_service.get_run(company_id=user.company_id, run_id=run_id)
        data = hotspots_service.detect_hotspots(
            company_id=user.company_id, run_id=run_id,
            hotspot_type=hotspot_type, limit=limit,
        )
        evidence = calculation_run_service.list_run_evidence(
            company_id=user.company_id, run_id=run_id,
        )
    except calculation_run_service.ProcurementCalculationError as exc:
        raise http_error(exc) from exc
    except hotspots_service.HotspotError as exc:
        raise http_error(exc) from exc
    return AnalyticalEnvelope[HotspotsData](
        data=data, meta=calculation_run_service.build_meta(run), evidence=evidence,
    )


@router.get("/exposures/{dimension}", response_model=AnalyticalEnvelope[ExposureData])
async def exposures_endpoint(
    dimension: Literal["materials", "countries"],
    run_id: int,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    user: AuthUser = Depends(get_current_user),
) -> AnalyticalEnvelope[ExposureData]:
    """Exposition par matière (mappings ACCEPTÉS uniquement) ou par pays d'origine."""
    require_db()
    try:
        run = calculation_run_service.get_run(company_id=user.company_id, run_id=run_id)
        data = hotspots_service.get_exposure(
            company_id=user.company_id, run_id=run_id, dimension=dimension, limit=limit,
        )
        evidence = calculation_run_service.list_run_evidence(
            company_id=user.company_id, run_id=run_id,
        )
    except calculation_run_service.ProcurementCalculationError as exc:
        raise http_error(exc) from exc
    except hotspots_service.HotspotError as exc:
        raise http_error(exc) from exc
    return AnalyticalEnvelope[ExposureData](
        data=data, meta=calculation_run_service.build_meta(run), evidence=evidence,
    )
