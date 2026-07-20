"""
models/water.py — ledger eau et screening hydrique (PR-08).

Tranche A : imports/activités/permis/zones de stress (migration 036).
Tranche B : screenings versionnés, cibles et actions (migration 037).

Champs snake_case alignés sur les colonnes SQL. Invariants portés par les
types (pas seulement par la documentation) :

- `WaterScreeningData.risk_category` et `confidence` sont DEUX champs
  distincts — aucun champ combiné n'existe (précédent CRMA, contrats §6
  Wave 4) : l'UI ne peut pas afficher un « risque net » par accident.
- `method_code` nomme TOUJOURS la méthode géométrique réellement utilisée
  (geojson_point_in_polygon_v1) — jamais présentée comme ST_Intersects.
- `iro_signal` n'est jamais une décision : le modèle ne porte aucun champ de
  « matérialité » — seulement le signal, sa justification et son auteur.
- Le référentiel de zones expose sa licence (`display_allowed`,
  `derived_use_allowed`, `attribution_text`) lue via license_policy.evaluate —
  jamais dénormalisée en base.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

WaterActivityType = Literal["withdrawal", "consumption", "discharge"]
WaterSourceType = Literal["surface", "groundwater", "municipal", "seawater", "other"]
WaterDataStatus = Literal["verified", "estimated", "manual", "inferred"]
ReviewStatus = Literal["pending", "accepted", "flagged"]
ImportStatus = Literal["pending", "validated", "rejected"]
PermitType = Literal["withdrawal", "discharge", "operation", "other"]
PermitStatus = Literal["active", "expired", "revoked"]
AreaKind = Literal["basin", "aquifer", "administrative", "custom"]
StressCategory = Literal["low", "low_medium", "medium_high", "high", "extremely_high"]
TargetType = Literal[
    "withdrawal_reduction", "consumption_reduction", "discharge_quality", "reuse_rate", "other"
]
TargetStatus = Literal["draft", "active", "achieved", "abandoned"]
WaterActionType = Literal[
    "efficiency", "reuse", "recycling", "sourcing_change", "treatment", "monitoring", "other"
]
WaterActionStatus = Literal["planned", "in_progress", "completed", "cancelled"]


# ---------------------------------------------------------------------------
# Imports (idempotence de contenu) et activités
# ---------------------------------------------------------------------------

class WaterImportRequest(BaseModel):
    """Import CSV d'activités eau. `csv_text` = contenu brut (colonnes :
    site_id, activity_type, source_type, quantity_m3, period_start,
    period_end). Idempotent par CONTENU (sha256 — patron purchase_imports) ET
    par ligne (clé naturelle UNIQUE en base)."""

    filename: str = Field(min_length=1, max_length=300)
    csv_text: str


class WaterImportResponse(BaseModel):
    id: int
    company_id: int
    filename: str
    sha256: str
    row_count: int
    accepted_count: int
    rejected_count: int
    status: ImportStatus
    imported_by: int | None
    imported_at: datetime
    already_imported: bool = False
    errors: list[str] = Field(default_factory=list)


class WaterImportReviewRequest(BaseModel):
    accept: bool


class WaterActivityCreate(BaseModel):
    site_id: int
    activity_type: WaterActivityType
    source_type: WaterSourceType = "other"
    quantity_m3: float = Field(ge=0)
    period_start: date
    period_end: date
    data_status: WaterDataStatus = "manual"
    evidence_artifact_id: int | None = None


class WaterActivityResponse(BaseModel):
    id: int
    company_id: int
    site_id: int
    activity_type: WaterActivityType
    source_type: WaterSourceType
    quantity_m3: float
    period_start: date
    period_end: date
    import_id: int | None
    data_status: WaterDataStatus
    evidence_artifact_id: int | None
    review_status: ReviewStatus
    created_at: datetime
    updated_at: datetime


class WaterActivityListResponse(BaseModel):
    items: list[WaterActivityResponse]
    total: int
    limit: int
    offset: int


class WaterActivityReviewRequest(BaseModel):
    accept: bool


# ---------------------------------------------------------------------------
# Permis
# ---------------------------------------------------------------------------

class WaterPermitCreate(BaseModel):
    site_id: int
    permit_type: PermitType
    permit_reference: str | None = Field(default=None, max_length=200)
    authorized_volume_m3: float | None = Field(default=None, ge=0)
    valid_from: date | None = None
    valid_to: date | None = None
    issuing_authority: str | None = Field(default=None, max_length=300)
    evidence_artifact_id: int | None = None
    status: PermitStatus = "active"
    notes: str | None = Field(default=None, max_length=2000)


class WaterPermitResponse(BaseModel):
    id: int
    company_id: int
    site_id: int
    permit_type: PermitType
    permit_reference: str | None
    authorized_volume_m3: float | None
    valid_from: date | None
    valid_to: date | None
    issuing_authority: str | None
    evidence_artifact_id: int | None
    status: PermitStatus
    review_status: ReviewStatus
    notes: str | None
    created_at: datetime
    updated_at: datetime


class WaterPermitListResponse(BaseModel):
    items: list[WaterPermitResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# Référentiel de zones de stress hydrique (toujours sourcé, licence surfacée)
# ---------------------------------------------------------------------------

class WaterRiskAreaResponse(BaseModel):
    """Zone de stress hydrique. Quand la licence de la source refuse
    l'affichage, `baseline_stress_category` est retirée CÔTÉ SERVEUR
    (`value_withheld=True`) — la valeur ne quitte jamais le backend (précédent
    market_observations PR-07)."""

    id: int
    company_id: int | None
    code: str
    label: str
    area_kind: AreaKind
    scenario_code: str
    horizon_year: int | None
    baseline_stress_category: StressCategory | None
    bbox_min_lat: float
    bbox_max_lat: float
    bbox_min_lon: float
    bbox_max_lon: float
    source_release_id: int
    evidence_artifact_id: int | None
    data_status: WaterDataStatus
    source_code: str | None = None
    # Licence lue à l'usage via license_policy.evaluate (jamais stockée) :
    display_allowed: bool = True
    derived_use_allowed: bool = True
    license_reasons: list[str] = Field(default_factory=list)
    attribution_text: str | None = None
    value_withheld: bool = False
    created_at: datetime
    updated_at: datetime


class WaterRiskAreaListResponse(BaseModel):
    items: list[WaterRiskAreaResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# Screening (tranche B) — risque et confiance SÉPARÉS, méthode explicite
# ---------------------------------------------------------------------------

class WaterScreeningRequest(BaseModel):
    site_id: int
    scenario_code: str = Field(default="baseline", min_length=1, max_length=100)


class MatchedAreaResult(BaseModel):
    """Trace d'appariement d'UNE zone — inspectable, jamais un total opaque."""

    area_id: int
    code: str
    label: str
    area_kind: AreaKind
    stress_category: StressCategory
    data_status: WaterDataStatus
    bbox_candidate: bool
    matched: bool
    method_code: str
    prefilter_code: str


class WaterScreeningData(BaseModel):
    """Résultat métier d'un screening — `data` de l'enveloppe analytique.

    `risk_category` (intensité, issue des zones appariées) et `confidence`
    (solidité du socle documentaire, portée par meta.quality) ne se combinent
    JAMAIS. `risk_category=None` signifie « aucune zone connue appariée », ce
    qui n'est PAS un risque nul — les warnings le disent explicitement."""

    screening_id: int
    site_id: int
    scenario_code: str
    method_code: str
    methodology_code: str
    methodology_version: str
    risk_category: StressCategory | None
    matched_areas: list[MatchedAreaResult]
    candidate_area_count: int
    matched_area_count: int
    iro_signal: bool
    iro_signal_rationale: str | None
    input_fingerprint: str
    calculated_at: datetime | None


class WaterScreeningSummary(BaseModel):
    id: int
    company_id: int
    site_id: int
    methodology_code: str
    methodology_version: str
    method_code: str
    scenario_code: str
    risk_category: StressCategory | None
    confidence: float | None
    coverage_pct: float | None
    warnings: list[Any] = Field(default_factory=list)
    iro_signal: bool
    iro_signal_rationale: str | None
    iro_signal_by: int | None
    iro_signal_at: datetime | None
    input_fingerprint: str
    calculated_at: datetime
    calculated_by: int | None


class WaterScreeningListResponse(BaseModel):
    items: list[WaterScreeningSummary]
    total: int
    limit: int
    offset: int


class IroSignalRequest(BaseModel):
    """Pose le signal « à examiner comme IRO » sur un screening. Un GESTE
    humain avec justification obligatoire — jamais une décision de matérialité
    (la promotion effective en IRO est l'affaire de PR-10)."""

    rationale: str = Field(min_length=1, max_length=2000)


# ---------------------------------------------------------------------------
# Cibles et actions
# ---------------------------------------------------------------------------

class WaterTargetCreate(BaseModel):
    target_type: TargetType
    title: str = Field(min_length=1, max_length=300)
    site_id: int | None = None
    screening_id: int | None = None
    description: str | None = Field(default=None, max_length=2000)
    baseline_year: int | None = Field(default=None, ge=1900, le=2200)
    target_year: int | None = Field(default=None, ge=1900, le=2200)
    baseline_value_m3: float | None = Field(default=None, ge=0)
    target_value_m3: float | None = Field(default=None, ge=0)
    status: TargetStatus = "draft"
    notes: str | None = Field(default=None, max_length=2000)


class WaterTargetResponse(BaseModel):
    id: int
    company_id: int
    site_id: int | None
    screening_id: int | None
    target_type: TargetType
    title: str
    description: str | None
    baseline_year: int | None
    target_year: int | None
    baseline_value_m3: float | None
    target_value_m3: float | None
    status: TargetStatus
    review_status: ReviewStatus
    notes: str | None
    created_at: datetime
    updated_at: datetime


class WaterTargetListResponse(BaseModel):
    items: list[WaterTargetResponse]
    total: int
    limit: int
    offset: int


class WaterActionCreate(BaseModel):
    action_type: WaterActionType
    title: str = Field(min_length=1, max_length=300)
    site_id: int | None = None
    screening_id: int | None = None
    target_id: int | None = None
    description: str | None = Field(default=None, max_length=2000)
    status: WaterActionStatus = "planned"
    owner: str | None = Field(default=None, max_length=200)
    due_date: date | None = None
    expected_effect: str | None = Field(default=None, max_length=2000)
    expected_reduction_m3: float | None = Field(default=None, ge=0)


class WaterActionResponse(BaseModel):
    id: int
    company_id: int
    site_id: int | None
    screening_id: int | None
    target_id: int | None
    action_type: WaterActionType
    title: str
    description: str | None
    status: WaterActionStatus
    owner: str | None
    due_date: date | None
    completed_at: datetime | None
    expected_effect: str | None
    expected_reduction_m3: float | None
    review_status: ReviewStatus
    created_at: datetime
    updated_at: datetime


class WaterActionListResponse(BaseModel):
    items: list[WaterActionResponse]
    total: int
    limit: int
    offset: int
