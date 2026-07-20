"""
models/procurement.py — Exposition achats / fournisseurs (PR-05A) puis moteur
Scope 3 catégorie 1, hotspots et score fournisseur (PR-05B).

Un modèle par table + des modèles de requête par opération d'écriture exposée.
Champs snake_case alignés sur les colonnes SQL des migrations 030 (exposition)
et 032 (calcul). Les `Literal` reflètent 1:1 les contraintes CHECK SQL (statuts,
méthodes) — un seul endroit de vérité pour l'énumération. `data_status`
réutilise le vocabulaire du noyau (`models.intelligence.DataStatus`) pour rester
cohérent avec les observations sourcées.

Découpage du fichier :
  1. PR-05A — exposition (sites, produits, imports, lignes, BOM, déclarations, PCF)
  2. PR-05B — calcul (runs, résultats par ligne, couverture, trace)
  3. PR-05B — hotspots (détection, sélection humaine, campagne)
  4. PR-05B — score fournisseur en 5 dimensions SÉPARÉES (jamais un score unique)
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from models.intelligence import DataStatus

# ── Vocabulaires (miroir des CHECK de la migration 030) ──────────────────────
GeocodeReviewStatus = Literal["pending", "accepted", "flagged"]
PurchaseImportStatus = Literal["pending", "validated", "emitted", "rejected"]
# 'ambiguous' (Wave 3, migration 035) : plusieurs supplier_products candidats
# pour le même product_code dans le périmètre pertinent — jamais résolu par
# ordre/premier résultat (cf. purchase_import_service._auto_map). Distinct
# d'`unmapped` (aucun candidat) : la raison vit dans PurchaseLineResponse.mapping_note.
MappingStatus = Literal["unmapped", "mapped", "needs_review", "resolved", "ambiguous"]
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
    # Raison lisible + candidats quand mapping_status='ambiguous' (Wave 3) —
    # même principe que LineResultResponse.fallback_reason : jamais d'ambiguïté
    # silencieuse. NULL pour les autres statuts.
    mapping_note: str | None = None
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


# ===========================================================================
# PR-05B — Moteur de calcul Scope 3 catégorie 1 (migration 032)
# ===========================================================================

# Hiérarchie de méthode, ORDRE NON NÉGOCIABLE (plan §6). Le rang est l'ordre
# canonique, pas une donnée libre : la cohérence méthode ↔ rang est aussi
# contrainte en base (procurement_line_results_method_rank_coherent_check).
CalculationMethod = Literal[
    "supplier_pcf_verified",      # 1 — PCF fournisseur vérifiée ET comparable
    "supplier_specific_hybrid",   # 2 — méthode fournisseur spécifique / hybride
    "average_physical",           # 3 — facteur physique moyen (produit/matière)
    "spend_based_economic",       # 4 — facteur économique par catégorie de dépense
    "unresolved",                 # 5 — aucun chiffre inventé, ligne conservée
]

METHOD_RANKS: dict[str, int] = {
    "supplier_pcf_verified": 1,
    "supplier_specific_hybrid": 2,
    "average_physical": 3,
    "spend_based_economic": 4,
    "unresolved": 5,
}

# Libellés d'affichage (français), source unique pour l'API et l'UI.
METHOD_LABELS: dict[str, str] = {
    "supplier_pcf_verified": "PCF fournisseur vérifiée",
    "supplier_specific_hybrid": "Méthode fournisseur spécifique",
    "average_physical": "Facteur physique moyen",
    "spend_based_economic": "Facteur monétaire (dépense)",
    "unresolved": "Non résolu",
}

RunStatus = Literal["calculated", "approved", "superseded"]
HotspotType = Literal["supplier", "supplier_product", "category", "country"]
SelectionStatus = Literal["selected", "dismissed", "campaign_created"]


class CalculationRequest(BaseModel):
    """Lancement d'un calcul. Le périmètre est EXPLICITE : soit un import validé,
    soit une période. Rien n'est calculé « par défaut sur tout » en silence."""

    import_id: int | None = None
    period_start: date | None = None
    period_end: date | None = None
    # Recalcul forcé : sans lui, un run dont les entrées sont identiques
    # (input_fingerprint) est RENDU tel quel plutôt que dupliqué.
    force_recalculate: bool = False


class RunResponse(BaseModel):
    id: int
    company_id: int
    import_id: int | None
    period_start: date | None
    period_end: date | None
    methodology_code: str
    methodology_version: str
    input_snapshot: dict[str, Any]
    input_fingerprint: str
    factor_versions: dict[str, Any]
    result: dict[str, Any]
    warnings: list[str]
    confidence: float | None
    coverage_pct: float | None
    line_count: int
    unresolved_count: int
    total_tco2e: float | None
    status: RunStatus
    calculated_at: datetime
    approved_at: datetime | None
    approved_by: int | None
    created_by: int | None
    created_at: datetime
    updated_at: datetime
    # Vrai quand le run existait déjà pour ces entrées — appel idempotent.
    already_calculated: bool = False


class RunListResponse(BaseModel):
    items: list[RunResponse]
    total: int
    limit: int
    offset: int


class LineResultResponse(BaseModel):
    """Résultat d'UNE ligne d'achat. Porte toujours sa méthode, son facteur
    (id + version), sa conversion d'unité explicite, ses avertissements et — dès
    qu'un repli a eu lieu — sa raison. `result_tco2e` est NULL si non résolu :
    un trou de donnée n'est jamais un zéro."""

    id: int
    company_id: int
    run_id: int
    purchase_line_id: int
    supplier_id: int | None
    supplier_product_id: int | None
    calculation_method: CalculationMethod
    method_rank: int
    factor_id: str | None
    factor_version: str | None
    factor_source: str | None
    activity_value: float | None
    activity_unit: str | None
    converted_value: float | None
    converted_unit: str | None
    conversion_factor: float | None
    conversion_note: str | None
    result_tco2e: float | None
    uncertainty_pct: float | None
    uncertainty_low_tco2e: float | None
    uncertainty_high_tco2e: float | None
    data_quality: float | None
    data_quality_label: str | None
    confidence: float | None
    data_status: DataStatus
    fallback_reason: str | None
    warnings: list[str]
    method_trace: list[dict[str, Any]]
    evidence_artifact_id: int | None
    source_release_id: int | None
    observation_id: int | None
    created_at: datetime


class LineResultListResponse(BaseModel):
    items: list[LineResultResponse]
    total: int
    limit: int
    offset: int


class MethodBreakdownRow(BaseModel):
    """Répartition par méthode — rend VISIBLE ce qui a été calculé comment."""

    calculation_method: CalculationMethod
    method_rank: int
    label: str
    line_count: int
    result_tco2e: float | None
    spend_amount: float | None
    share_of_lines_pct: float
    share_of_emissions_pct: float | None


class CoverageData(BaseModel):
    """Couverture d'un run : ce qui est calculé, comment, et ce qui NE L'EST PAS.

    Les lignes non résolues sont une grandeur de premier plan (jamais masquées) :
    leur nombre et leur dépense sont exposés à côté du total d'émissions, pour
    qu'un total ne puisse pas être lu comme exhaustif s'il ne l'est pas."""

    run_id: int
    line_count: int
    resolved_count: int
    unresolved_count: int
    unresolved_spend_amount: float | None
    coverage_lines_pct: float
    coverage_spend_pct: float | None
    total_tco2e: float | None
    primary_data_share_pct: float
    methods: list[MethodBreakdownRow]


class TraceStep(BaseModel):
    """Un maillon de la trace de calcul (drill-down). Chaque niveau porte sa
    date, sa source, son statut et sa méthode quand ils existent — contrats §2."""

    level: str
    label: str
    reference: str | None = None
    detail: dict[str, Any] = Field(default_factory=dict)
    data_status: DataStatus | None = None
    observed_at: str | None = None
    source_release_id: int | None = None
    evidence_artifact_id: int | None = None


class CalculationTraceData(BaseModel):
    """Trace complète achat → fournisseur → produit → BOM → matière → facteur →
    preuve, plus la hiérarchie de méthode réellement parcourue (`method_trace` :
    pourquoi chaque niveau supérieur a été écarté)."""

    run_id: int
    purchase_line_id: int
    calculation_method: CalculationMethod
    method_rank: int
    fallback_reason: str | None
    result_tco2e: float | None
    steps: list[TraceStep]
    method_trace: list[dict[str, Any]]
    warnings: list[str]


# ===========================================================================
# PR-05B — Hotspots : détection déterministe + SÉLECTION HUMAINE
# ===========================================================================

class Hotspot(BaseModel):
    """Hotspot DÉTECTÉ (agrégation déterministe, lecture seule). Détecter n'est
    pas décider : rien n'est retenu tant qu'un humain ne l'a pas sélectionné.

    `unresolved_line_count` / `unresolved_spend_amount` accompagnent chaque
    hotspot pour qu'un poste massivement non résolu ne passe pas pour un petit
    contributeur."""

    hotspot_type: HotspotType
    hotspot_key: str
    hotspot_label: str
    supplier_id: int | None = None
    line_count: int
    contribution_tco2e: float | None
    contribution_pct: float | None
    spend_amount: float | None
    unresolved_line_count: int
    unresolved_spend_amount: float | None
    dominant_method: CalculationMethod | None
    rank_position: int
    selection_status: SelectionStatus | None = None
    selection_id: int | None = None


class HotspotsData(BaseModel):
    run_id: int
    hotspot_type: HotspotType
    total_tco2e: float | None
    items: list[Hotspot]


class ExposureRow(BaseModel):
    """Ligne d'exposition (matière ou pays) — dépense et masse couvertes, part
    non résolue conservée."""

    key: str
    label: str
    line_count: int
    spend_amount: float | None
    mass_kg: float | None
    contribution_tco2e: float | None
    contribution_pct: float | None
    unresolved_line_count: int


class ExposureData(BaseModel):
    run_id: int
    dimension: Literal["materials", "countries"]
    items: list[ExposureRow]


class HotspotSelectionCreate(BaseModel):
    """Sélection humaine explicite d'un hotspot détecté."""

    run_id: int
    hotspot_type: HotspotType
    hotspot_key: str = Field(min_length=1, max_length=255)
    hotspot_label: str | None = None
    selection_status: SelectionStatus = "selected"
    selection_reason: str | None = Field(default=None, max_length=2000)


class HotspotSelectionResponse(BaseModel):
    id: int
    company_id: int
    run_id: int
    hotspot_type: HotspotType
    hotspot_key: str
    hotspot_label: str | None
    supplier_id: int | None
    contribution_tco2e: float | None
    contribution_pct: float | None
    rank_position: int | None
    selection_status: SelectionStatus
    selection_reason: str | None
    campaign_id: int | None
    selected_by: int | None
    selected_at: datetime
    created_at: datetime
    updated_at: datetime


class HotspotSelectionListResponse(BaseModel):
    items: list[HotspotSelectionResponse]
    total: int
    limit: int
    offset: int


class CampaignFromHotspotRequest(BaseModel):
    """Création CONTRÔLÉE d'une campagne fournisseur depuis un hotspot retenu.

    Le moteur de campagnes (024) n'est pas réinventé : on l'appelle. Seule une
    sélection `selected` de type `supplier` rattachée à un fournisseur du tenant
    peut donner lieu à une campagne."""

    campaign_name: str = Field(min_length=1, max_length=255)
    exercise_year: int | None = Field(default=None, ge=2000, le=2100)
    deadline: date | None = None


class CampaignFromHotspotResponse(BaseModel):
    selection: HotspotSelectionResponse
    campaign_id: int
    campaign_name: str
    invited_supplier_ids: list[int]


# ===========================================================================
# PR-05B — Score fournisseur : 5 dimensions SÉPARÉES
# ===========================================================================

ScoreDimensionCode = Literal[
    "evidence_maturity",       # maturité des preuves
    "ghg_data_quality",        # qualité des données GES
    "supply_concentration",    # concentration d'approvisionnement
    "location_exposure",       # exposition géographique
    "compliance_response",     # statut de conformité / réponse
]


class ScoreDimension(BaseModel):
    """UNE dimension, autonome. `value` est l'état mesuré (0-100) ; `confidence`
    dit à quel point la donnée disponible soutient cette mesure. Les deux sont
    distincts, et aucune des cinq dimensions n'est agrégée avec une autre.

    `direction` est OBLIGATOIRE : sans elle, « 80 » se lit aussi bien comme
    « très bon » que comme « très exposé » selon la dimension. Une maturité de
    preuve élevée est bonne ; une concentration d'approvisionnement élevée est
    risquée. Le sens ne doit jamais être deviné par le lecteur."""

    code: ScoreDimensionCode
    label: str
    value: float | None
    scale: str = "0-100"
    direction: Literal["higher_is_better", "higher_is_riskier"]
    confidence: float | None = Field(default=None, ge=0, le=1)
    basis: str
    inputs: dict[str, Any] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)


class SupplierScoreCard(BaseModel):
    """Cinq dimensions, JAMAIS un score ESG unique.

    `aggregate_score` n'existe pas et ne doit pas être ajouté : fusionner ces
    dimensions produirait un chiffre opaque contraire au principe §1.10 du plan
    d'architecture. Le champ `no_aggregate_score` documente ce refus dans la
    réponse elle-même, pour que le contrat soit lisible côté client."""

    supplier_id: int
    supplier_name: str | None
    dimensions: list[ScoreDimension]
    no_aggregate_score: Literal[True] = True
    note: str = (
        "Cinq dimensions indépendantes, volontairement non agrégées : "
        "risque, confiance et statut de donnée sont des grandeurs distinctes."
    )
