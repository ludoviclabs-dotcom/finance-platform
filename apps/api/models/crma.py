"""
models/crma.py — CRMA, aimants permanents et exposition matières critiques (PR-07).

Un modèle par table de la migration 034 + les modèles d'analyse (concentration
par étape, score d'exposition, rapport Article 24). Champs snake_case alignés
1:1 sur les colonnes SQL ; les `Literal` reflètent les CHECK de la migration —
un seul endroit de vérité pour chaque énumération.

Trois invariants du domaine sont portés par les TYPES eux-mêmes :

1. **Risque ≠ confiance.** `MaterialExposureScore` expose `risk_score` et
   `confidence` comme deux champs distincts, jamais combinés. Aucun modèle ne
   propose de « score net » ou de « risque pondéré par la confiance ».
2. **Concentration par étape.** `StageConcentration` porte `stage_code`
   obligatoire : il n'existe aucun modèle de concentration sans étape, donc
   aucune façon de renvoyer une concentration qui mélangerait extraction et
   raffinage.
3. **Licence avant affichage.** `MarketObservationResponse.numeric_value` est
   optionnel et accompagné de `display_allowed` / `derived_use_allowed` /
   `license_reasons` : une valeur masquée reste une réponse valide et explicite,
   jamais un zéro silencieux.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from models.intelligence import DataStatus

# ── Vocabulaires (miroir des CHECK de la migration 034) ──────────────────────
GroupKind = Literal["family", "regulatory", "application", "custom"]
Maturity = Literal["research", "pilot", "commercial", "mature"]
EventType = Literal[
    "export_control", "quota", "tariff", "sanction", "ban",
    "subsidy", "incident", "regulation", "other",
]
EventSeverity = Literal["low", "medium", "high", "critical"]
AssessmentStatus = Literal["draft", "under_review", "approved", "submitted"]
ActionType = Literal[
    "diversification", "substitution", "recycling", "stockpiling",
    "supplier_audit", "long_term_contract", "rd", "other",
]
ActionStatus = Literal["planned", "in_progress", "completed", "cancelled"]

# Codes de groupe réglementaire. Le statut est une APPARTENANCE, pas un booléen :
# une matière stratégique appartient aux DEUX groupes (non exclusif, plan §12.1).
GROUP_CODE_CRITICAL = "eu_critical"
GROUP_CODE_STRATEGIC = "eu_strategic"


# ---------------------------------------------------------------------------
# material_groups / material_group_members
# ---------------------------------------------------------------------------

class MaterialGroupCreate(BaseModel):
    code: str = Field(min_length=1, max_length=100)
    label: str = Field(min_length=1, max_length=255)
    group_kind: GroupKind = "family"
    regulation_version: str | None = None
    description: str | None = None


class MaterialGroupResponse(BaseModel):
    id: int
    company_id: int | None
    code: str
    label: str
    group_kind: GroupKind
    regulation_version: str | None
    description: str | None
    created_at: datetime


class MaterialGroupListResponse(BaseModel):
    items: list[MaterialGroupResponse]
    total: int
    limit: int
    offset: int


class MaterialGroupMemberResponse(BaseModel):
    id: int
    company_id: int | None
    group_id: int
    group_code: str
    material_id: str
    created_at: datetime


class MaterialStatus(BaseModel):
    """Statut réglementaire d'une matière — NON EXCLUSIF.

    `is_critical_eu` et `is_strategic_eu` sont deux booléens indépendants
    calculés à partir des appartenances de groupe, et non deux valeurs d'une
    même énumération. `strategic_not_critical` matérialise l'incohérence
    (stratégique sans être critique) au lieu de la corriger en silence :
    toute matière stratégique DOIT aussi être critique.
    """
    material_id: str
    is_critical_eu: bool
    is_strategic_eu: bool
    regulation_version: str | None = None
    group_codes: list[str] = Field(default_factory=list)
    strategic_not_critical: bool = False


# ---------------------------------------------------------------------------
# processing_stages
# ---------------------------------------------------------------------------

class ProcessingStageResponse(BaseModel):
    id: int
    company_id: int | None
    code: str
    label: str
    stage_order: int
    is_upstream: bool
    description: str | None


class ProcessingStageListResponse(BaseModel):
    items: list[ProcessingStageResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# material_stage_observations
# ---------------------------------------------------------------------------

class StageObservationCreate(BaseModel):
    material_id: str = Field(min_length=1, max_length=100)
    stage_code: str = Field(min_length=1, max_length=50)
    country_code: str = Field(min_length=2, max_length=10)
    reference_year: int = Field(ge=1900, le=2200)
    share_pct: float | None = Field(default=None, ge=0, le=100)
    volume_value: float | None = None
    volume_unit: str | None = None
    data_status: DataStatus = "estimated"
    confidence: float | None = Field(default=None, ge=0, le=1)
    methodology_version: str | None = None
    source_release_id: int | None = None
    evidence_artifact_id: int | None = None
    observed_at: datetime | None = None


class StageObservationResponse(BaseModel):
    id: int
    company_id: int | None
    material_id: str
    stage_code: str
    country_code: str
    share_pct: float | None
    volume_value: float | None
    volume_unit: str | None
    reference_year: int
    data_status: DataStatus
    confidence: float | None
    methodology_version: str | None
    source_release_id: int | None
    evidence_artifact_id: int | None
    observed_at: datetime | None
    created_at: datetime


class StageObservationListResponse(BaseModel):
    items: list[StageObservationResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# Concentration PAR ÉTAPE — jamais agrégée entre étapes
# ---------------------------------------------------------------------------

class CountryShare(BaseModel):
    country_code: str
    share_pct: float
    data_status: DataStatus
    source_release_id: int | None = None


class StageConcentration(BaseModel):
    """Concentration géographique d'UNE étape.

    `stage_code` est obligatoire : aucune instance de ce modèle ne peut décrire
    une concentration « toutes étapes confondues ». `hhi_pct` est calculé sur
    les parts renormalisées à `observed_total_pct` (les données peuvent être
    incomplètes) — l'incomplétude est reportée dans `observed_total_pct` et
    dégrade la CONFIANCE, jamais le risque.
    """
    stage_code: str
    stage_label: str | None = None
    stage_order: int | None = None
    is_upstream: bool = False
    reference_year: int | None = None
    country_shares: list[CountryShare] = Field(default_factory=list)
    observed_total_pct: float = 0.0
    top_country_code: str | None = None
    top_country_share_pct: float | None = None
    hhi_pct: float | None = None
    country_count: int = 0
    data_status_mix: dict[str, int] = Field(default_factory=dict)


class ValueChainResponse(BaseModel):
    """Chaîne de valeur d'une matière : une concentration PAR étape, ordonnée
    de l'amont vers l'aval. Il n'y a délibérément AUCUN champ de concentration
    agrégée toutes étapes confondues."""
    material_id: str
    reference_year: int | None
    stages: list[StageConcentration]
    stages_with_data: int
    stages_total: int


# ---------------------------------------------------------------------------
# material_market_observations — licence obligatoire
# ---------------------------------------------------------------------------

class MarketObservationCreate(BaseModel):
    material_id: str = Field(min_length=1, max_length=100)
    metric_code: str = Field(min_length=1, max_length=100)
    source_release_id: int
    observed_at: datetime
    stage_code: str | None = None
    numeric_value: float | None = None
    unit: str | None = None
    currency: str | None = None
    data_status: DataStatus = "estimated"
    confidence: float | None = Field(default=None, ge=0, le=1)
    evidence_artifact_id: int | None = None


class MarketObservationResponse(BaseModel):
    """Observation de marché SOUS LICENCE.

    `numeric_value` est `None` quand `display_allowed` est faux : la valeur
    n'est pas transmise au client, pas seulement masquée à l'affichage. C'est
    la différence entre « ne pas afficher » et « ne pas divulguer » — seule la
    seconde est une vraie garantie (contrats §8).
    """
    id: int
    company_id: int | None
    material_id: str
    stage_code: str | None
    metric_code: str
    numeric_value: float | None
    unit: str | None
    currency: str | None
    observed_at: datetime
    data_status: DataStatus
    confidence: float | None
    source_release_id: int
    source_code: str | None = None
    evidence_artifact_id: int | None
    display_allowed: bool
    derived_use_allowed: bool
    value_withheld: bool = False
    license_reasons: list[str] = Field(default_factory=list)
    attribution_text: str | None = None


class MarketObservationListResponse(BaseModel):
    items: list[MarketObservationResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# substitutes / recycling_routes / trade_or_regulatory_events
# ---------------------------------------------------------------------------

class SubstituteCreate(BaseModel):
    material_id: str = Field(min_length=1, max_length=100)
    substitute_material_id: str = Field(min_length=1, max_length=100)
    stage_code: str | None = None
    application: str | None = None
    maturity: Maturity = "research"
    performance_penalty_pct: float | None = None
    data_status: DataStatus = "estimated"
    notes: str | None = None
    source_release_id: int | None = None
    evidence_artifact_id: int | None = None


class SubstituteResponse(BaseModel):
    id: int
    company_id: int | None
    material_id: str
    substitute_material_id: str
    stage_code: str | None
    application: str | None
    maturity: Maturity
    performance_penalty_pct: float | None
    data_status: DataStatus
    notes: str | None
    source_release_id: int | None
    evidence_artifact_id: int | None
    created_at: datetime


class SubstituteListResponse(BaseModel):
    items: list[SubstituteResponse]
    total: int
    limit: int
    offset: int


class RecyclingRouteCreate(BaseModel):
    material_id: str = Field(min_length=1, max_length=100)
    route_code: str = Field(min_length=1, max_length=100)
    label: str = Field(min_length=1, max_length=255)
    input_stage_code: str | None = None
    output_stage_code: str | None = None
    maturity: Maturity = "research"
    recycled_content_pct: float | None = Field(default=None, ge=0, le=100)
    recovery_rate_pct: float | None = Field(default=None, ge=0, le=100)
    data_status: DataStatus = "estimated"
    source_release_id: int | None = None
    evidence_artifact_id: int | None = None


class RecyclingRouteResponse(BaseModel):
    id: int
    company_id: int | None
    material_id: str
    route_code: str
    label: str
    input_stage_code: str | None
    output_stage_code: str | None
    maturity: Maturity
    recycled_content_pct: float | None
    recovery_rate_pct: float | None
    data_status: DataStatus
    source_release_id: int | None
    evidence_artifact_id: int | None
    created_at: datetime


class RecyclingRouteListResponse(BaseModel):
    items: list[RecyclingRouteResponse]
    total: int
    limit: int
    offset: int


class TradeEventCreate(BaseModel):
    event_type: EventType
    title: str = Field(min_length=1, max_length=255)
    material_id: str | None = None
    stage_code: str | None = None
    country_code: str | None = None
    severity: EventSeverity = "medium"
    description: str | None = None
    effective_from: date | None = None
    effective_to: date | None = None
    data_status: DataStatus = "estimated"
    source_release_id: int | None = None
    evidence_artifact_id: int | None = None


class TradeEventResponse(BaseModel):
    id: int
    company_id: int | None
    material_id: str | None
    stage_code: str | None
    country_code: str | None
    event_type: EventType
    severity: EventSeverity
    title: str
    description: str | None
    effective_from: date | None
    effective_to: date | None
    data_status: DataStatus
    source_release_id: int | None
    evidence_artifact_id: int | None
    created_at: datetime


class TradeEventListResponse(BaseModel):
    items: list[TradeEventResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# company_material_exposures
# ---------------------------------------------------------------------------

class ExposureCreate(BaseModel):
    material_id: str = Field(min_length=1, max_length=100)
    stage_code: str | None = None
    bom_item_id: int | None = None
    material_mapping_id: int | None = None
    product_id: int | None = None
    supplier_id: int | None = None
    supplier_site_id: int | None = None
    annual_mass_kg: float | None = None
    annual_spend_eur: float | None = None
    share_of_supply_pct: float | None = Field(default=None, ge=0, le=100)
    stock_coverage_days: float | None = Field(default=None, ge=0)
    stock_as_of: date | None = None
    reference_year: int | None = None
    data_status: DataStatus = "manual"
    confidence: float | None = Field(default=None, ge=0, le=1)
    notes: str | None = None


class ExposureResponse(BaseModel):
    id: int
    company_id: int
    material_id: str
    stage_code: str | None
    bom_item_id: int | None
    material_mapping_id: int | None
    product_id: int | None
    supplier_id: int | None
    supplier_site_id: int | None
    annual_mass_kg: float | None
    annual_spend_eur: float | None
    share_of_supply_pct: float | None
    stock_coverage_days: float | None
    stock_as_of: date | None
    reference_year: int | None
    data_status: DataStatus
    confidence: float | None
    notes: str | None
    created_at: datetime


class ExposureListResponse(BaseModel):
    items: list[ExposureResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# CarbonCo Material Exposure Score
# ---------------------------------------------------------------------------

class ScoreComponent(BaseModel):
    """Une composante du score, INSPECTABLE isolément.

    Chaque composante garde sa valeur brute (`raw_value` + `raw_unit`, ce qui a
    réellement été mesuré), sa traduction en risque 0-100, son poids et sa
    contribution. `rationale` dit en français pourquoi. `available=False`
    signifie « pas de donnée » — la composante est alors EXCLUE du calcul
    (poids renormalisé) au lieu d'être comptée à zéro, ce qui reviendrait à
    affirmer l'absence de risque là où on ne sait rien.
    """
    code: str
    label: str
    available: bool
    risk_value: float | None = None
    weight: float = 0.0
    contribution: float = 0.0
    raw_value: float | None = None
    raw_unit: str | None = None
    rationale: str = ""
    stage_code: str | None = None


class ConfidenceComponent(BaseModel):
    """Une composante de la CONFIANCE — dimension séparée du risque.

    Ces composantes ne participent JAMAIS au `risk_score` : elles disent
    seulement à quel point les données permettent d'y croire.
    """
    code: str
    label: str
    value: float
    weight: float
    rationale: str = ""


class MaterialExposureScore(BaseModel):
    """**CarbonCo Material Exposure Score** — méthode CarbonCo versionnée.

    Ce n'est PAS un score officiel de l'Union européenne, ni une notation
    réglementaire : `disclaimer` le porte explicitement dans chaque réponse, et
    `methodology_code`/`methodology_version` identifient la méthode.

    `risk_score` et `confidence` sont deux grandeurs SÉPARÉES (0-100 chacune).
    Il n'existe volontairement aucun champ qui les combine.
    """
    material_id: str
    methodology_code: str
    methodology_version: str
    risk_score: float | None
    confidence: float
    coverage_pct: float
    components: list[ScoreComponent]
    confidence_components: list[ConfidenceComponent]
    drivers: list[ScoreComponent]
    warnings: list[str] = Field(default_factory=list)
    stage_concentrations: list[StageConcentration] = Field(default_factory=list)
    disclaimer: str
    calculated_at: datetime | None = None


class ExposureAnalysisMeta(BaseModel):
    as_of: date | None = None
    status: DataStatus = "estimated"
    method: dict[str, str] = Field(default_factory=dict)
    quality: dict[str, Any] = Field(default_factory=dict)


class ExposureAnalysisResponse(BaseModel):
    """Enveloppe analytique {data, meta, evidence} des contrats §4."""
    data: MaterialExposureScore
    meta: ExposureAnalysisMeta
    evidence: list[dict[str, Any]] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# crma_article24_assessments / mitigation_actions
# ---------------------------------------------------------------------------

class Article24AssessmentCreate(BaseModel):
    material_id: str = Field(min_length=1, max_length=100)
    assessment_year: int = Field(ge=1900, le=2200)
    regulation_version: str | None = None
    vulnerability_summary: str | None = None


class Article24AssessmentResponse(BaseModel):
    id: int
    company_id: int
    material_id: str
    assessment_year: int
    status: AssessmentStatus
    risk_score: float | None
    confidence: float | None
    coverage_pct: float | None
    methodology_code: str
    methodology_version: str
    regulation_version: str | None
    components: list[dict[str, Any]]
    drivers: list[dict[str, Any]]
    warnings: list[str]
    input_snapshot: dict[str, Any]
    vulnerability_summary: str | None
    calculated_at: datetime | None
    prepared_by: int | None
    approved_by: int | None
    approved_at: datetime | None
    created_at: datetime


class Article24AssessmentListResponse(BaseModel):
    items: list[Article24AssessmentResponse]
    total: int
    limit: int
    offset: int


class Article24ReviewRequest(BaseModel):
    """Gate de revue humaine. `approve=True` exige un utilisateur identifié —
    aucun calcul n'approuve un rapport Article 24."""
    approve: bool
    note: str | None = None


class MitigationActionCreate(BaseModel):
    action_type: ActionType
    title: str = Field(min_length=1, max_length=255)
    assessment_id: int | None = None
    material_id: str | None = None
    target_stage_code: str | None = None
    description: str | None = None
    status: ActionStatus = "planned"
    owner: str | None = None
    due_date: date | None = None
    expected_effect: str | None = None
    expected_risk_reduction_pct: float | None = Field(default=None, ge=0, le=100)


class MitigationActionResponse(BaseModel):
    id: int
    company_id: int
    assessment_id: int | None
    material_id: str | None
    target_stage_code: str | None
    action_type: ActionType
    title: str
    description: str | None
    status: ActionStatus
    owner: str | None
    due_date: date | None
    completed_at: datetime | None
    expected_effect: str | None
    expected_risk_reduction_pct: float | None
    created_at: datetime


class MitigationActionListResponse(BaseModel):
    items: list[MitigationActionResponse]
    total: int
    limit: int
    offset: int


class Article24Report(BaseModel):
    """Rapport Article 24 exportable — assemblage de l'évaluation, de la chaîne
    de valeur par étape, des alternatives et des actions.

    `is_official_eu_score` est explicitement `False` et sérialisé dans l'export :
    un lecteur du JSON exporté, hors contexte applicatif, doit pouvoir constater
    que le score n'est pas réglementaire."""
    company_id: int
    material_id: str
    assessment_year: int
    generated_at: datetime
    assessment: Article24AssessmentResponse
    material_status: MaterialStatus
    value_chain: ValueChainResponse
    substitutes: list[SubstituteResponse]
    recycling_routes: list[RecyclingRouteResponse]
    events: list[TradeEventResponse]
    exposures: list[ExposureResponse]
    mitigation_actions: list[MitigationActionResponse]
    methodology_code: str
    methodology_version: str
    is_official_eu_score: bool = False
    disclaimer: str = ""
    warnings: list[str] = Field(default_factory=list)
