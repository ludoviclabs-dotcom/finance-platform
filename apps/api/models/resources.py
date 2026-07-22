"""
models/resources.py — Module 2 (Ressources stratégiques), fondation catalogue
(PR-M2A). Un modèle par table de la migration 042 + les modèles d'agrégat de
lecture (fiche catalogue avec compteurs).

Champs snake_case alignés 1:1 sur les colonnes SQL ; les `Literal` reflètent les
CHECK de la migration — un seul endroit de vérité pour chaque énumération.

Invariants portés par les TYPES :
1. **Statut réglementaire NON EXCLUSIF, sans booléen.** Le statut d'une ressource
   est une LISTE de `ResourceRegulatoryStatusResponse` (une par régime), jamais
   deux booléens `is_critical`/`is_strategic` sur le catalogue. Une ressource
   peut être critique CRMA ET dans le périmètre EUDR.
2. **Sourcé-ou-avoué.** `ResourceRegulatoryStatusCreate.certainty='confirmed'`
   exige `source_release_id` (garde service + CHECK SQL) ; idem `data_status`.
3. **Legacy préservé (D-2).** `ResourceAlias*` porte les anciens `material_id`
   comme `alias_kind='legacy_material_id'` — aucun identifiant historique
   supprimé, aucun booléen réglementaire permanent.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from models.intelligence import DataStatus

# ── Vocabulaires (miroir des CHECK de la migration 042) ──────────────────────
ResourceFamily = Literal[
    "industrial_gas", "biomass_fibre", "energy_fuel", "critical_raw_material", "other"
]
AliasKind = Literal["legacy_material_id", "cas", "ec", "hs_cn", "reach", "internal", "other"]
RegulatoryRegime = Literal[
    "crma", "eudr", "reach", "clp", "red_iii", "cbam",
    "euratom", "dual_use", "gas_sos", "esrs", "other",
]
ListingStatus = Literal[
    "listed", "not_listed", "in_scope", "out_of_scope",
    "in_force", "adopted_not_applicable", "proposed", "delayed",
]
Certainty = Literal["confirmed", "probable", "unresolved"]


# ---------------------------------------------------------------------------
# resource_catalog
# ---------------------------------------------------------------------------

class ResourceCatalogCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=120)
    name: str = Field(min_length=1, max_length=255)
    name_fr: str | None = None
    primary_family: ResourceFamily = "other"
    description: str | None = None
    data_status: DataStatus = "manual"
    source_release_id: int | None = None


class ResourceCatalogResponse(BaseModel):
    id: int
    company_id: int | None
    slug: str
    name: str
    name_fr: str | None
    primary_family: ResourceFamily
    description: str | None
    data_status: DataStatus
    source_release_id: int | None
    created_at: datetime


class ResourceCatalogItem(BaseModel):
    """Ligne de liste allégée (sans description)."""
    id: int
    company_id: int | None
    slug: str
    name: str
    name_fr: str | None
    primary_family: ResourceFamily
    data_status: DataStatus
    has_source: bool


class ResourceCatalogListResponse(BaseModel):
    items: list[ResourceCatalogItem]
    total: int
    limit: int
    offset: int


class ResourceCatalogDetail(BaseModel):
    """Fiche complète : la ressource + compteurs de ses enfants (alias,
    statuts réglementaires, usages) pour une lecture d'un coup d'œil."""
    id: int
    company_id: int | None
    slug: str
    name: str
    name_fr: str | None
    primary_family: ResourceFamily
    description: str | None
    data_status: DataStatus
    source_release_id: int | None
    aliases_count: int
    regulations_count: int
    uses_count: int
    created_at: datetime


# ---------------------------------------------------------------------------
# resource_aliases
# ---------------------------------------------------------------------------

class ResourceAliasCreate(BaseModel):
    alias_kind: AliasKind
    alias_value: str = Field(min_length=1, max_length=255)


class ResourceAliasResponse(BaseModel):
    id: int
    company_id: int | None
    resource_id: int
    alias_kind: AliasKind
    alias_value: str
    created_at: datetime


class ResourceAliasListResponse(BaseModel):
    items: list[ResourceAliasResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# resource_regulatory_statuses
# ---------------------------------------------------------------------------

class ResourceRegulatoryStatusCreate(BaseModel):
    regime: RegulatoryRegime
    regulation_ref: str | None = None
    list_or_annex: str | None = None
    listing_status: ListingStatus
    validity_note: str | None = None
    certainty: Certainty = "probable"
    source_release_id: int | None = None
    verified_on: date | None = None


class ResourceRegulatoryStatusResponse(BaseModel):
    id: int
    company_id: int | None
    resource_id: int
    regime: RegulatoryRegime
    regulation_ref: str | None
    list_or_annex: str | None
    listing_status: ListingStatus
    validity_note: str | None
    certainty: Certainty
    source_release_id: int | None
    verified_on: date | None
    created_at: datetime


class ResourceRegulatoryStatusListResponse(BaseModel):
    items: list[ResourceRegulatoryStatusResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# resource_sector_uses
# ---------------------------------------------------------------------------

class ResourceSectorUseCreate(BaseModel):
    sector_code: str | None = None
    use_label: str = Field(min_length=1, max_length=255)
    criticality_note: str | None = None
    data_status: DataStatus = "manual"
    source_release_id: int | None = None


class ResourceSectorUseResponse(BaseModel):
    id: int
    company_id: int | None
    resource_id: int
    sector_code: str | None
    use_label: str
    criticality_note: str | None
    data_status: DataStatus
    source_release_id: int | None
    created_at: datetime


class ResourceSectorUseListResponse(BaseModel):
    items: list[ResourceSectorUseResponse]
    total: int
    limit: int
    offset: int


# ===========================================================================
# PR-M2B — Expositions & assessments (migration 043)
# ===========================================================================

Role = Literal[
    "material", "feedstock", "energy_carrier", "process_input",
    "industrial_gas", "nuclear_fuel", "biomass", "water",
]
LinkKind = Literal[
    "bom_item", "purchase_line", "energy_activity",
    "water_activity", "supplier_declaration", "manual",
]
SupplyMetric = Literal[
    "production", "reserves", "refining_capacity", "trade_export", "trade_import"
]
DimensionKind = Literal["risk", "confidence"]
RunStatus = Literal["computed", "approved", "superseded"]


# ── resource_supply_observations ─────────────────────────────────────────────

class ResourceSupplyObservationCreate(BaseModel):
    stage_code: str = Field(min_length=1, max_length=100)
    country_code: str = Field(min_length=1, max_length=8)
    metric_code: SupplyMetric = "production"
    share_pct: float | None = Field(default=None, ge=0, le=100)
    volume_value: float | None = None
    volume_unit: str | None = None
    reference_year: int = Field(ge=1900, le=2100)
    data_status: DataStatus = "estimated"
    confidence: float | None = Field(default=None, ge=0, le=1)
    methodology_version: str | None = None
    source_release_id: int | None = None
    evidence_artifact_id: int | None = None
    observed_at: datetime | None = None


class ResourceSupplyObservationResponse(BaseModel):
    id: int
    company_id: int | None
    resource_id: int
    stage_code: str
    country_code: str
    metric_code: SupplyMetric
    share_pct: float | None
    volume_value: float | None
    volume_unit: str | None
    reference_year: int
    data_status: DataStatus
    confidence: float | None
    source_release_id: int | None
    evidence_artifact_id: int | None
    created_at: datetime


class ResourceSupplyObservationListResponse(BaseModel):
    items: list[ResourceSupplyObservationResponse]
    total: int
    limit: int
    offset: int


# ── company_resource_exposure_links ──────────────────────────────────────────

class ResourceExposureLinkCreate(BaseModel):
    resource_slug: str = Field(min_length=1, max_length=120)
    role: Role
    link_kind: LinkKind
    bom_item_id: int | None = None
    purchase_line_id: int | None = None
    energy_activity_id: int | None = None
    water_activity_id: int | None = None
    supplier_declaration_id: int | None = None
    manual_note: str | None = None
    annual_mass_kg: float | None = Field(default=None, ge=0)
    annual_spend_eur: float | None = Field(default=None, ge=0)
    share_of_supply_pct: float | None = Field(default=None, ge=0, le=100)
    stock_coverage_days: float | None = Field(default=None, ge=0)
    data_status: DataStatus = "manual"
    confidence: float | None = Field(default=None, ge=0, le=1)
    notes: str | None = None


class ResourceExposureLinkResponse(BaseModel):
    id: int
    company_id: int
    resource_id: int
    resource_slug: str | None = None
    role: Role
    link_kind: LinkKind
    linked_ref: str | None = None  # pointeur lisible, ex. "purchase_line:842"
    annual_mass_kg: float | None
    annual_spend_eur: float | None
    share_of_supply_pct: float | None
    stock_coverage_days: float | None
    data_status: DataStatus
    created_at: datetime


class ResourceExposureLinkListResponse(BaseModel):
    items: list[ResourceExposureLinkResponse]
    total: int
    limit: int
    offset: int


# ── resource_assessment_runs / dimensions ────────────────────────────────────

class ResourceAssessmentRunCreate(BaseModel):
    resource_slug: str = Field(min_length=1, max_length=120)
    assessment_year: int = Field(ge=1900, le=2100)
    as_of: date | None = None


class ResourceDimension(BaseModel):
    """Composante inspectable — risque OU confiance, jamais additionnées.
    `detail` porte les sous-valeurs SÉPARÉES (ex. substituabilité :
    {maturity, penalty_pct}). `source_release_ids` = provenance."""
    kind: DimensionKind
    dimension_code: str
    available: bool
    risk_value: float | None = None
    weight: float | None = None
    contribution: float | None = None
    raw_value: float | None = None
    raw_unit: str | None = None
    stage_code: str | None = None
    rationale: str | None = None
    detail: dict[str, Any] = Field(default_factory=dict)
    source_release_ids: list[int] = Field(default_factory=list)


class ResourceAssessmentResult(BaseModel):
    """Sortie PURE du moteur (`services/resources/scoring.py`). `risk_score`
    est `None` si des données obligatoires manquent — jamais un indice inventé.
    `confidence` reste calculée. `input_hash` rend le run reproductible."""
    risk_score: float | None
    confidence: float
    coverage_pct: float | None
    observed_hhi: float | None
    missing_share_pct: float | None
    methodology_code: str
    methodology_version: str
    input_hash: str
    dimensions: list[ResourceDimension] = Field(default_factory=list)
    drivers: list[dict[str, Any]] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    sensitivity: dict[str, Any] | None = None
    disclaimer: str = ""


class ResourceAssessmentSummary(BaseModel):
    run_id: int
    resource_slug: str
    resource_id: int
    assessment_year: int
    status: RunStatus
    risk_score: float | None
    confidence: float | None
    coverage_pct: float | None
    observed_hhi: float | None
    missing_share_pct: float | None
    methodology_code: str
    methodology_version: str
    calculated_at: datetime


class ResourceAssessmentDetail(BaseModel):
    run_id: int
    resource_slug: str
    resource_id: int
    assessment_year: int
    status: RunStatus
    risk_score: float | None
    confidence: float | None
    coverage_pct: float | None
    observed_hhi: float | None
    missing_share_pct: float | None
    methodology_code: str
    methodology_version: str
    input_hash: str
    drivers: list[dict[str, Any]]
    warnings: list[str]
    sensitivity: dict[str, Any] | None
    iro_signal_id: int | None
    calculated_at: datetime
    dimensions: list[ResourceDimension]
    disclaimer: str


class ResourceAssessmentListResponse(BaseModel):
    items: list[ResourceAssessmentSummary]
    total: int
    limit: int
    offset: int


class ResourceDimensionListResponse(BaseModel):
    items: list[ResourceDimension]
    total: int
    limit: int
    offset: int


# ── Alertes dérivées (lecture seule) ─────────────────────────────────────────

AlertKind = Literal["high_dependency", "stale_supply_data", "license_blocked", "regulatory_flag"]


class ResourceAlert(BaseModel):
    kind: AlertKind
    severity: Literal["low", "medium", "high", "critical"]
    resource_slug: str
    message: str
    as_of: date | None = None


class ResourceAlertListResponse(BaseModel):
    items: list[ResourceAlert]
    total: int
    limit: int
    offset: int
