"""
models/nature.py — biodiversité, TNFD LEAP (PR-09).

Tranche A (migration 038) : référentiel `nature_features`, intersections
géométriques (`site_nature_intersections`, Locate), dépendances/impacts
(Evaluate), dossiers LEAP. Tranche B (039, deuxième moitié de ce fichier)
ajoute risques, opportunités, actions et brouillons de disclosure TNFD.

Tranche B — invariants supplémentaires portés par les types :

- `NatureRiskResponse.risk_score`, `.likelihood` et `.confidence` sont TROIS
  champs indépendants (motif Wave 4 §6) : aucun champ combiné, `likelihood`
  n'est JAMAIS dérivé de `risk_score` (c'est un jugement humain transmis tel
  quel par `services/calculations/nature_scoring.py`).
- `components`/`confidence_components` sont des LISTES de composantes
  inspectables (`ScoreComponent`/`ConfidenceComponent`) — jamais un total
  opaque (« no untyped JSON », CLAUDE.md).
- `TnfdDisclosureDraftResponse.is_official_tnfd_disclosure` est verrouillé à
  `False` par le type Python ET par un CHECK en base (038/039 §D) — un
  brouillon ne devient jamais « certifié » par accident de sérialisation.
- `TnfdDisclosureDraftResponse.sections` est une liste TYPÉE
  (`TnfdDisclosureSection`), jamais un `dict` libre — un export TNFD reste
  structuré de bout en bout.

Champs snake_case alignés sur les colonnes SQL. Invariants portés par les
types (pas seulement par la documentation) :

- `NatureDependencyResponse` et `NatureImpactResponse` ne partagent AUCUN
  champ métier (`ecosystem_service`/`dependency_level` d'un côté,
  `pressure_type`/`impact_kind`/`magnitude_qualitative` de l'autre) — le TNFD
  distingue strictement dépendance et impact, la séparation est structurelle
  ici, pas une convention de nommage.
- `SiteNatureIntersectionResponse.matched` est un FAIT booléen, jamais un
  score : ce modèle ne porte aucun champ de risque ni de confiance.
- `method_code` nomme TOUJOURS la méthode géométrique réellement utilisée
  (geojson_point_in_polygon_v1) — jamais présentée comme ST_Intersects.
- Le référentiel `nature_features` masque sa géométrie précise pour les lignes
  `confidential`/`restricted` : `NatureFeatureResponse.boundary_geojson` est
  `None` et `geometry_withheld=True` quand l'appelant n'a pas le rôle requis
  (précédent `value_withheld` de `WaterRiskAreaResponse`, PR-08).
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

ReviewStatus = Literal["pending", "accepted", "flagged"]
DataStatus = Literal["verified", "estimated", "manual", "inferred"]
Sensitivity = Literal["public", "internal", "confidential", "restricted"]
FeatureKind = Literal["protected_area", "kba", "ecosystem", "other"]
MethodCode = Literal[
    "geojson_point_in_polygon_v1", "geojson_bbox_prefilter_v1", "manual_coordinates_v1"
]
EcosystemService = Literal["freshwater", "pollination", "soil_stability", "other"]
QualitativeLevel = Literal["low", "medium", "high", "critical"]
PressureType = Literal[
    "land_use_change", "water_use", "resource_exploitation",
    "climate_change", "pollution", "invasive_species", "other",
]
ImpactKind = Literal["positive", "negative"]
LeapPhase = Literal["locate", "evaluate", "assess", "prepare", "completed"]
AssessmentStatus = Literal["draft", "under_review", "approved"]


# ---------------------------------------------------------------------------
# Référentiel nature_features — masquage par sensibilité
# ---------------------------------------------------------------------------

class NatureFeatureResponse(BaseModel):
    """Élément naturel sensible. `boundary_geojson`/bbox précis sont retirés
    CÔTÉ SERVEUR (`geometry_withheld=True`) pour une ligne confidential/
    restricted lue sans le rôle requis — jamais transmis puis masqué côté
    client (précédent `value_withheld`, `WaterRiskAreaResponse`, PR-08)."""

    id: int
    company_id: int | None
    code: str
    label: str
    feature_kind: FeatureKind
    sensitivity: Sensitivity
    bbox_min_lat: float | None
    bbox_max_lat: float | None
    bbox_min_lon: float | None
    bbox_max_lon: float | None
    boundary_geojson: dict[str, Any] | None
    source_release_id: int
    evidence_artifact_id: int | None
    data_status: DataStatus
    geometry_withheld: bool = False
    created_at: datetime
    updated_at: datetime


class NatureFeatureListResponse(BaseModel):
    items: list[NatureFeatureResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# Intersections géométriques (Locate) — fait, jamais un score
# ---------------------------------------------------------------------------

class LocateRequest(BaseModel):
    """Déclenche/rafraîchit le calcul des intersections d'un site contre le
    référentiel `nature_features` accessible au tenant. Recalculer crée de
    NOUVELLES lignes (immuabilité, précédent site_water_screenings) — jamais
    une réécriture."""

    scenario_note: str | None = Field(default=None, max_length=500)


class SiteNatureIntersectionResponse(BaseModel):
    id: int
    company_id: int
    site_id: int
    feature_id: int
    feature_code: str | None = None
    feature_kind: FeatureKind | None = None
    method_code: MethodCode
    bbox_candidate: bool
    matched: bool
    review_status: ReviewStatus
    reviewed_by: int | None
    reviewed_at: datetime | None
    input_fingerprint: str
    computed_at: datetime
    computed_by: int | None
    created_at: datetime
    updated_at: datetime


class SiteNatureIntersectionListResponse(BaseModel):
    items: list[SiteNatureIntersectionResponse]
    total: int
    limit: int
    offset: int


class IntersectionReviewRequest(BaseModel):
    accept: bool
    note: str | None = Field(default=None, max_length=2000)


# ---------------------------------------------------------------------------
# nature_dependencies (Evaluate) — l'entreprise DÉPEND d'un service
# ---------------------------------------------------------------------------

class NatureDependencyCreate(BaseModel):
    ecosystem_service: EcosystemService
    dependency_level: QualitativeLevel
    site_id: int | None = None
    bom_item_id: int | None = None
    material_id: str | None = Field(default=None, max_length=200)
    rationale: str | None = Field(default=None, max_length=2000)
    data_status: DataStatus = "manual"
    source_release_id: int | None = None
    evidence_artifact_id: int | None = None


class NatureDependencyResponse(BaseModel):
    id: int
    company_id: int
    site_id: int | None
    bom_item_id: int | None
    material_id: str | None
    ecosystem_service: EcosystemService
    dependency_level: QualitativeLevel
    rationale: str | None
    data_status: DataStatus
    review_status: ReviewStatus
    source_release_id: int | None
    evidence_artifact_id: int | None
    created_at: datetime
    updated_at: datetime


class NatureDependencyListResponse(BaseModel):
    items: list[NatureDependencyResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# nature_impacts (Evaluate) — l'entreprise IMPACTE un écosystème
# ---------------------------------------------------------------------------

class NatureImpactCreate(BaseModel):
    pressure_type: PressureType
    impact_kind: ImpactKind
    magnitude_qualitative: QualitativeLevel
    site_id: int | None = None
    bom_item_id: int | None = None
    material_id: str | None = Field(default=None, max_length=200)
    rationale: str | None = Field(default=None, max_length=2000)
    data_status: DataStatus = "manual"
    source_release_id: int | None = None
    evidence_artifact_id: int | None = None


class NatureImpactResponse(BaseModel):
    id: int
    company_id: int
    site_id: int | None
    bom_item_id: int | None
    material_id: str | None
    pressure_type: PressureType
    impact_kind: ImpactKind
    magnitude_qualitative: QualitativeLevel
    rationale: str | None
    data_status: DataStatus
    review_status: ReviewStatus
    source_release_id: int | None
    evidence_artifact_id: int | None
    created_at: datetime
    updated_at: datetime


class NatureImpactListResponse(BaseModel):
    items: list[NatureImpactResponse]
    total: int
    limit: int
    offset: int


class ReviewRequest(BaseModel):
    """Gate de revue générique `pending -> accepted/flagged` — réutilisée par
    dépendances, impacts, et (tranche B) risques/opportunités/actions."""

    accept: bool
    note: str | None = Field(default=None, max_length=2000)


# ---------------------------------------------------------------------------
# Dossiers LEAP
# ---------------------------------------------------------------------------

class LeapAssessmentCreate(BaseModel):
    label: str = Field(min_length=1, max_length=300)
    site_ids: list[int] = Field(default_factory=list)


class LeapAssessmentResponse(BaseModel):
    id: int
    company_id: int
    label: str
    phase: LeapPhase
    status: AssessmentStatus
    prepared_by: int | None
    approved_by: int | None
    approved_at: datetime | None
    site_ids: list[int] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class LeapAssessmentListResponse(BaseModel):
    items: list[LeapAssessmentResponse]
    total: int
    limit: int
    offset: int


class LeapAddSiteRequest(BaseModel):
    site_id: int


class LeapAdvancePhaseRequest(BaseModel):
    """Fait progresser `phase` d'un cran (locate -> evaluate -> assess ->
    prepare -> completed). Le service valide les préconditions propres à
    chaque transition (ex. 'evaluate' exige au moins une dépendance ou un
    impact ACCEPTÉ) — jamais une avance automatique sans contenu revu."""

    target_phase: LeapPhase


# ===========================================================================
# TRANCHE B (migration 039) — Assess + Prepare
# ===========================================================================

ActionType = Literal[
    "restoration", "habitat_protection", "species_monitoring",
    "pollution_reduction", "water_management", "sourcing_change", "other",
]
ActionStatus = Literal["planned", "in_progress", "completed", "cancelled"]
DisclosureStatus = Literal["draft", "under_review", "approved"]


class ScoreComponent(BaseModel):
    """Une composante de risque/opportunité, INSPECTABLE isolément (motif
    `models/crma.py::ScoreComponent`, PR-07). `available=False` signifie
    « pas de donnée ACCEPTÉE » — la composante est EXCLUE du calcul (poids
    renormalisé), jamais comptée à zéro."""

    code: str
    label: str
    available: bool
    value: float | None = None
    weight: float = 0.0
    contribution: float = 0.0
    rationale: str = ""


class ConfidenceComponent(BaseModel):
    """Composante de CONFIANCE — ne participe JAMAIS au score."""

    code: str
    label: str
    value: float
    weight: float
    rationale: str = ""


# ---------------------------------------------------------------------------
# nature_risks (Assess)
# ---------------------------------------------------------------------------

class RiskCalculateRequest(BaseModel):
    assessment_id: int
    title: str = Field(min_length=1, max_length=300)
    site_id: int | None = None
    likelihood: QualitativeLevel | None = None


class NatureRiskData(BaseModel):
    """`data` de l'enveloppe analytique — résultat du calcul, jamais une
    conclusion de matérialité (dépendance ≠ risque financier, PR-10)."""

    risk_id: int
    assessment_id: int
    site_id: int | None
    title: str
    methodology_code: str
    methodology_version: str
    risk_score: float | None
    likelihood: QualitativeLevel | None
    components: list[ScoreComponent]
    input_fingerprint: str
    calculated_at: datetime


class NatureRiskSummary(BaseModel):
    id: int
    company_id: int
    assessment_id: int
    site_id: int | None
    dependency_id: int | None
    impact_id: int | None
    title: str
    methodology_code: str
    methodology_version: str
    risk_score: float | None
    likelihood: QualitativeLevel | None
    confidence: float | None
    components: list[ScoreComponent] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    rationale: str | None
    review_status: ReviewStatus
    reviewed_by: int | None
    reviewed_at: datetime | None
    input_fingerprint: str | None
    calculated_at: datetime | None
    calculated_by: int | None
    created_at: datetime
    updated_at: datetime


class NatureRiskListResponse(BaseModel):
    items: list[NatureRiskSummary]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# nature_opportunities (Assess) — même discipline, direction opposée
# ---------------------------------------------------------------------------

class OpportunityCalculateRequest(BaseModel):
    assessment_id: int
    title: str = Field(min_length=1, max_length=300)
    site_id: int | None = None
    likelihood: QualitativeLevel | None = None


class NatureOpportunityData(BaseModel):
    opportunity_id: int
    assessment_id: int
    site_id: int | None
    title: str
    methodology_code: str
    methodology_version: str
    opportunity_score: float | None
    likelihood: QualitativeLevel | None
    components: list[ScoreComponent]
    input_fingerprint: str
    calculated_at: datetime


class NatureOpportunitySummary(BaseModel):
    id: int
    company_id: int
    assessment_id: int
    site_id: int | None
    dependency_id: int | None
    impact_id: int | None
    title: str
    methodology_code: str
    methodology_version: str
    opportunity_score: float | None
    likelihood: QualitativeLevel | None
    confidence: float | None
    components: list[ScoreComponent] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    rationale: str | None
    review_status: ReviewStatus
    reviewed_by: int | None
    reviewed_at: datetime | None
    input_fingerprint: str | None
    calculated_at: datetime | None
    calculated_by: int | None
    created_at: datetime
    updated_at: datetime


class NatureOpportunityListResponse(BaseModel):
    items: list[NatureOpportunitySummary]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# nature_actions — calquée sur mitigation_actions/water_actions
# ---------------------------------------------------------------------------

class NatureActionCreate(BaseModel):
    action_type: ActionType
    title: str = Field(min_length=1, max_length=300)
    risk_id: int | None = None
    opportunity_id: int | None = None
    assessment_id: int | None = None
    description: str | None = Field(default=None, max_length=2000)
    status: ActionStatus = "planned"
    owner: str | None = Field(default=None, max_length=200)
    due_date: date | None = None
    expected_effect: str | None = Field(default=None, max_length=2000)
    expected_risk_reduction_pct: float | None = Field(default=None, ge=0, le=100)


class NatureActionResponse(BaseModel):
    id: int
    company_id: int
    risk_id: int | None
    opportunity_id: int | None
    assessment_id: int | None
    action_type: ActionType
    title: str
    description: str | None
    status: ActionStatus
    owner: str | None
    due_date: date | None
    completed_at: datetime | None
    expected_effect: str | None
    expected_risk_reduction_pct: float | None
    review_status: ReviewStatus
    created_at: datetime
    updated_at: datetime


class NatureActionListResponse(BaseModel):
    items: list[NatureActionResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# tnfd_disclosure_drafts (Prepare) — TOUJOURS un brouillon
# ---------------------------------------------------------------------------

class TnfdDisclosureSection(BaseModel):
    """Une section structurée du brouillon — jamais un bloc de texte libre
    non typé (« no untyped JSON », CLAUDE.md)."""

    section_code: str
    title: str
    content: str
    data_status: DataStatus | None = None


class TnfdDisclosureDraftCreate(BaseModel):
    assessment_id: int
    title: str = Field(min_length=1, max_length=300)


class TnfdDisclosureDraftResponse(BaseModel):
    id: int
    company_id: int
    assessment_id: int
    title: str
    sections: list[TnfdDisclosureSection]
    is_official_tnfd_disclosure: bool = False
    disclaimer: str
    status: DisclosureStatus
    prepared_by: int | None
    approved_by: int | None
    approved_at: datetime | None
    created_at: datetime
    updated_at: datetime


class TnfdDisclosureDraftListResponse(BaseModel):
    items: list[TnfdDisclosureDraftResponse]
    total: int
    limit: int
    offset: int
