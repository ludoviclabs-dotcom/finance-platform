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
from typing import Literal

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
