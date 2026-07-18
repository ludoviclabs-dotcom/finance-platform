"""
models/procurement.py — Exposition achats / fournisseurs (PR-05A).

Un modèle par table + des modèles de requête par opération d'écriture exposée.
Champs snake_case alignés sur les colonnes SQL de la migration 030. Les
`Literal` reflètent 1:1 les contraintes CHECK SQL (statuts, méthodes) — un seul
endroit de vérité pour l'énumération. `data_status` réutilise le vocabulaire du
noyau (`models.intelligence.DataStatus`) pour rester cohérent avec les
observations sourcées.

Aucun modèle de calcul/score ici (PR-05B) : cette tranche n'expose que le socle
d'exposition et de données sourcées.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from models.intelligence import DataStatus

# ── Vocabulaires (miroir des CHECK de la migration 030) ──────────────────────
GeocodeReviewStatus = Literal["pending", "accepted", "flagged"]
PurchaseImportStatus = Literal["pending", "validated", "emitted", "rejected"]
MappingStatus = Literal["unmapped", "mapped", "needs_review", "resolved"]
BomStatus = Literal["draft", "active", "superseded", "archived"]
MappingMethod = Literal["manual", "ai_draft", "rule_based", "imported"]
ReviewStatus = Literal["pending", "accepted", "flagged"]
VerificationStatus = Literal["unverified", "self_declared", "third_party_verified"]


# ---------------------------------------------------------------------------
# supplier_sites
# ---------------------------------------------------------------------------

class SupplierSiteCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    address: str | None = None
    country_code: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class SupplierSiteResponse(BaseModel):
    id: int
    company_id: int
    supplier_id: int
    name: str
    address: str | None
    country_code: str | None
    latitude: float | None
    longitude: float | None
    geocode_review_status: GeocodeReviewStatus
    created_by: int | None
    created_at: datetime
    updated_at: datetime


class SupplierSiteListResponse(BaseModel):
    items: list[SupplierSiteResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# supplier_products
# ---------------------------------------------------------------------------

class SupplierProductCreate(BaseModel):
    product_code: str = Field(min_length=1, max_length=255)
    product_name: str | None = None
    category_code: str | None = None
    origin_country: str | None = None
    manufacturing_site_id: int | None = None


class SupplierProductResponse(BaseModel):
    id: int
    company_id: int
    supplier_id: int
    product_code: str
    product_name: str | None
    category_code: str | None
    origin_country: str | None
    manufacturing_site_id: int | None
    created_by: int | None
    created_at: datetime
    updated_at: datetime


class SupplierProductListResponse(BaseModel):
    items: list[SupplierProductResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# purchase_imports / purchase_lines
# ---------------------------------------------------------------------------

class PurchaseImportCreate(BaseModel):
    filename: str = Field(min_length=1, max_length=512)
    csv_text: str = Field(min_length=1)
    period_start: date | None = None
    period_end: date | None = None


class PurchaseImportResponse(BaseModel):
    id: int
    company_id: int
    filename: str
    sha256: str
    period_start: date | None
    period_end: date | None
    status: PurchaseImportStatus
    row_count: int
    accepted_count: int
    rejected_count: int
    error_summary: str | None
    imported_by: int | None
    imported_at: datetime
    updated_at: datetime
    # Vrai quand le même contenu (sha256) avait déjà été importé — l'appel est
    # un no-op idempotent, aucune ligne dupliquée.
    already_imported: bool = False


class PurchaseImportListResponse(BaseModel):
    items: list[PurchaseImportResponse]
    total: int
    limit: int
    offset: int


class PurchaseLineResponse(BaseModel):
    id: int
    company_id: int
    import_id: int
    supplier_id: int | None
    supplier_external_code: str | None
    product_id: int | None
    product_external_code: str | None
    purchase_date: date | None
    quantity: float | None
    unit: str | None
    spend_amount: float | None
    currency: str | None
    category_code: str | None
    origin_country: str | None
    raw_row_json: dict[str, Any]
    mapping_status: MappingStatus
    created_at: datetime
    updated_at: datetime


class PurchaseLineListResponse(BaseModel):
    items: list[PurchaseLineResponse]
    total: int
    limit: int
    offset: int


class LineResolution(BaseModel):
    """Résolution manuelle d'une ligne d'achat non mappée (file de résolution)."""
    line_id: int
    supplier_id: int | None = None
    product_id: int | None = None
    mapping_status: MappingStatus = "resolved"


class ResolveMappingsRequest(BaseModel):
    resolutions: list[LineResolution] = Field(min_length=1)


class ImportReviewRequest(BaseModel):
    """Gate de revue de l'import : accepter (→ validated) ou rejeter (→ rejected)."""
    accept: bool
    note: str | None = None


# ---------------------------------------------------------------------------
# bom_versions / bom_items / material_mappings
# ---------------------------------------------------------------------------

class BomItemCreate(BaseModel):
    component_code: str | None = None
    component_name: str | None = None
    quantity: float | None = None
    unit: str | None = None
    supplier_id: int | None = None
    supplier_product_id: int | None = None
    # Index (0-based) de l'item parent DANS cette même liste — construit l'arbre
    # sans exiger d'id serveur préalable. None = racine. Doit être < index courant.
    parent_index: int | None = None


class BomVersionCreate(BaseModel):
    version: str = Field(min_length=1, max_length=100)
    valid_from: date | None = None
    valid_to: date | None = None
    status: BomStatus = "draft"
    source_artifact_id: int | None = None
    items: list[BomItemCreate] = Field(default_factory=list)


class BomItemResponse(BaseModel):
    id: int
    company_id: int
    bom_version_id: int
    parent_item_id: int | None
    component_code: str | None
    component_name: str | None
    quantity: float | None
    unit: str | None
    supplier_id: int | None
    supplier_product_id: int | None
    created_at: datetime
    updated_at: datetime


class BomVersionResponse(BaseModel):
    id: int
    company_id: int
    product_id: int
    version: str
    valid_from: date | None
    valid_to: date | None
    status: BomStatus
    source_artifact_id: int | None
    created_by: int | None
    created_at: datetime
    updated_at: datetime


class BomVersionListResponse(BaseModel):
    items: list[BomVersionResponse]
    total: int
    limit: int
    offset: int


class BomVersionDetail(BaseModel):
    """Version BOM + son arbre d'items (drill-down)."""
    version: BomVersionResponse
    items: list[BomItemResponse]


class MaterialMappingCreate(BaseModel):
    bom_item_id: int
    material_id: str | None = None
    mass_value: float | None = None
    mass_unit: str | None = None
    mass_fraction: float | None = None
    mapping_method: MappingMethod = "manual"
    confidence: float | None = Field(default=None, ge=0, le=1)


class MapMaterialsRequest(BaseModel):
    mappings: list[MaterialMappingCreate] = Field(min_length=1)


class MaterialMappingResponse(BaseModel):
    id: int
    company_id: int
    bom_item_id: int
    material_id: str | None
    mass_value: float | None
    mass_unit: str | None
    mass_fraction: float | None
    mapping_method: MappingMethod
    confidence: float | None
    review_status: ReviewStatus
    reviewed_by: int | None
    created_at: datetime
    updated_at: datetime


class MaterialMappingReviewRequest(BaseModel):
    accept: bool


# ---------------------------------------------------------------------------
# supplier_metric_declarations (sourcée)
# ---------------------------------------------------------------------------

class DeclarationCreate(BaseModel):
    supplier_id: int
    supplier_product_id: int | None = None
    metric_code: str = Field(min_length=1, max_length=100)
    value: float | None = None
    unit: str | None = None
    reporting_year: int | None = None
    boundary: str | None = None
    methodology: str | None = None
    primary_data_pct: float | None = Field(default=None, ge=0, le=100)
    assurance_status: str | None = None
    data_status: DataStatus = "manual"
    # Sourcing (contrats §3) : si fourni, une observation immuable est créée et
    # citée. `evidence_artifact_id` doit appartenir à la même release / au tenant.
    source_release_id: int | None = None
    evidence_artifact_id: int | None = None


class DeclarationResponse(BaseModel):
    id: int
    company_id: int
    supplier_id: int
    supplier_product_id: int | None
    metric_code: str
    value: float | None
    unit: str | None
    reporting_year: int | None
    boundary: str | None
    methodology: str | None
    primary_data_pct: float | None
    assurance_status: str | None
    observation_id: int | None
    evidence_artifact_id: int | None
    source_release_id: int | None
    data_status: DataStatus
    review_status: ReviewStatus
    created_by: int | None
    created_at: datetime
    updated_at: datetime


class DeclarationListResponse(BaseModel):
    items: list[DeclarationResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# product_carbon_footprints (sourcée)
# ---------------------------------------------------------------------------

class PcfCreate(BaseModel):
    supplier_product_id: int
    cradle_boundary: str | None = None
    value_kgco2e: float | None = None
    declared_unit: str | None = None
    reference_flow: str | None = None
    reporting_period: str | None = None
    methodology: str | None = None
    verification_status: VerificationStatus | None = None
    data_status: DataStatus = "manual"
    source_release_id: int | None = None
    evidence_artifact_id: int | None = None


class PcfResponse(BaseModel):
    id: int
    company_id: int
    supplier_product_id: int
    cradle_boundary: str | None
    value_kgco2e: float | None
    declared_unit: str | None
    reference_flow: str | None
    reporting_period: str | None
    methodology: str | None
    verification_status: VerificationStatus | None
    observation_id: int | None
    evidence_artifact_id: int | None
    source_release_id: int | None
    data_status: DataStatus
    created_by: int | None
    created_at: datetime
    updated_at: datetime


class PcfListResponse(BaseModel):
    items: list[PcfResponse]
    total: int
    limit: int
    offset: int
