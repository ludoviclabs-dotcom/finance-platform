"""
models/iro.py — IRO, double matérialité et transmission financière (PR-10,
migration 040).

Le principe structurant de tout ce fichier (plan §6, non négociable) : AUCUN
modèle n'expose un champ numérique combinant impact et financier. Vérifié par
un test dédié (`tests/test_iro.py::test_no_model_exposes_a_single_fused_
materiality_score`) qui inspecte automatiquement `model_fields` de chaque
classe de ce module et échoue sur tout nom de champ évoquant un score
fusionné — la discipline est structurelle, pas seulement documentée ici.

- `ImpactAssessmentResponse` porte `scale`/`scope`/`irremediability`/
  `likelihood` en QUATRE colonnes séparées ; `FinancialAssessmentResponse`
  porte `likelihood`/`magnitude` en DEUX colonnes séparées. `confidence` est
  encore une colonne séparée de toutes les précédentes, dans les deux
  modèles. `threshold_crossed` est INDICATIF (calculé par une règle OR
  transparente côté service), jamais une décision.
- `components` est une LISTE de composantes inspectables (`ScoreComponent`,
  motif simplifié de `models/crma.py`/`models/nature.py` — chaque domaine
  garde sa propre définition locale plutôt que d'importer celle d'un autre,
  pour ne pas coupler ce module à un autre domaine).
- `FinancialAssessmentResponse.transmission_chain` est une liste TYPÉE de
  `TransmissionStep` (`channel`+`rationale` obligatoires par étape) — jamais
  un `dict` libre ni un chiffre unique (« no untyped JSON », CLAUDE.md).
- `MaterialityDecisionResponse.is_material` est un booléen décidé par un
  HUMAIN (`decided_by` non optionnel côté service), motivé
  (`justification` non optionnelle), qui indique QUELLE dimension (`basis`)
  a pesé — jamais un score qui franchit un seuil automatiquement.

Champs snake_case alignés sur les colonnes SQL de la migration 040.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Vocabulaire partagé (Literal Pydantic = source de vérité, alignée sur les
# CHECK SQL de la migration 040)
# ---------------------------------------------------------------------------

IroType = Literal["impact", "risk", "opportunity"]
IroStatus = Literal["candidate", "under_assessment", "assessed", "decided", "archived"]
OriginDomain = Literal["water", "nature", "crma", "energy", "manual"]
ValueChainLocation = Literal["upstream", "own_operations", "downstream"]
TimeHorizon = Literal["short", "medium", "long"]
Polarity = Literal["positive", "negative"]
FinancialChannel = Literal["revenue", "cost", "asset_value", "capital_cost", "liability", "other"]
DecisionBasis = Literal["impact", "financial", "both"]
ActionType = Literal["mitigation", "adaptation", "enhancement", "monitoring", "engagement", "other"]
ActionStatus = Literal["planned", "in_progress", "completed", "cancelled"]
DisclosureStatus = Literal["draft", "mapped", "disclosed"]


class ScoreComponent(BaseModel):
    """Une composante, INSPECTABLE isolément (motif `models/nature.py::
    ScoreComponent`, lui-même motif de `models/crma.py::ScoreComponent`,
    PR-07). `available=False` signifie « pas de donnée » — la composante est
    EXCLUE de la lecture indicative (`threshold_crossed`), jamais comptée à
    zéro. Dérivée par le service depuis les colonnes typées
    (scale/scope/irremediability/likelihood ou likelihood/magnitude) —
    jamais soumise telle quelle par l'appelant."""

    code: str
    label: str
    available: bool
    value: float | None = None
    weight: float = 0.0
    contribution: float = 0.0
    rationale: str = ""


# ---------------------------------------------------------------------------
# iros — entité centrale
# ---------------------------------------------------------------------------

class IroCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=4000)
    iro_type: IroType
    # Rattachement indicatif à la taxonomie des enjeux de
    # `materialite_service.ISSUE_LABELS`/`ISSUE_ESRS` (ex. 'CC-1', 'WR-1') —
    # TEXT libre, cette taxonomie est un dict Python, pas une table SQL.
    topic_code: str | None = Field(default=None, max_length=20)
    origin_domain: OriginDomain = "manual"
    # Pointeur libre vers l'enregistrement source (ex.
    # 'site_water_screening:123') — volontairement pas une FK (plan §5).
    origin_reference: str | None = Field(default=None, max_length=200)
    value_chain_location: ValueChainLocation | None = None


class IroResponse(BaseModel):
    id: int
    company_id: int
    title: str
    description: str | None
    iro_type: IroType
    topic_code: str | None
    origin_domain: str
    origin_reference: str | None
    status: IroStatus
    value_chain_location: str | None
    created_by: int | None
    created_at: datetime
    updated_at: datetime


class IroListResponse(BaseModel):
    items: list[IroResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# impact_assessments — matérialité D'IMPACT, composantes séparées
# ---------------------------------------------------------------------------

class ImpactAssessmentCreate(BaseModel):
    polarity: Polarity
    is_actual: bool = False
    scale: int | None = Field(default=None, ge=0, le=100)
    scope: int | None = Field(default=None, ge=0, le=100)
    irremediability: int | None = Field(default=None, ge=0, le=100)
    # NULL si is_actual=true (un impact avéré n'a pas besoin de probabilité) —
    # revalidé côté service (message clair) ET par un CHECK SQL (défense en
    # profondeur, comme le reste du dépôt).
    likelihood: int | None = Field(default=None, ge=0, le=100)
    time_horizon: TimeHorizon | None = None
    confidence: int | None = Field(default=None, ge=0, le=100)
    rationale: str | None = Field(default=None, max_length=4000)


class ImpactAssessmentResponse(BaseModel):
    id: int
    company_id: int
    iro_id: int
    polarity: Polarity
    is_actual: bool
    scale: int | None
    scope: int | None
    irremediability: int | None
    likelihood: int | None
    time_horizon: str | None
    confidence: int | None
    methodology_code: str
    methodology_version: str
    components: list[ScoreComponent] = Field(default_factory=list)
    threshold_crossed: bool | None
    rationale: str | None
    calculated_at: datetime | None
    prepared_by: int | None
    created_at: datetime
    updated_at: datetime


class ImpactAssessmentListResponse(BaseModel):
    items: list[ImpactAssessmentResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# financial_assessments — matérialité FINANCIÈRE, chaîne de transmission
# ---------------------------------------------------------------------------

class TransmissionStep(BaseModel):
    """Un maillon de la chaîne de transmission financière — JAMAIS un chiffre
    unique. `channel` et `rationale` sont obligatoires (Pydantic, pas
    seulement documentaire) : PostgreSQL interdit les sous-requêtes dans un
    CHECK, donc la complétude par étape ne peut pas être portée par le
    schéma seul — ce modèle EST le point d'application de la règle §8."""

    step: int = Field(ge=1)
    mechanism: str = Field(min_length=1, max_length=2000)
    channel: FinancialChannel
    rationale: str = Field(min_length=1, max_length=2000)
    estimated_amount_eur: float | None = None


class FinancialAssessmentCreate(BaseModel):
    likelihood: int | None = Field(default=None, ge=0, le=100)
    magnitude: int | None = Field(default=None, ge=0, le=100)
    time_horizon: TimeHorizon | None = None
    confidence: int | None = Field(default=None, ge=0, le=100)
    # Non vide (§8) : au moins un maillon documenté, jamais un chiffre nu.
    transmission_chain: list[TransmissionStep] = Field(min_length=1)
    rationale: str | None = Field(default=None, max_length=4000)


class FinancialAssessmentResponse(BaseModel):
    id: int
    company_id: int
    iro_id: int
    likelihood: int | None
    magnitude: int | None
    time_horizon: str | None
    confidence: int | None
    methodology_code: str
    methodology_version: str
    transmission_chain: list[TransmissionStep]
    primary_channel: str | None
    components: list[ScoreComponent] = Field(default_factory=list)
    threshold_crossed: bool | None
    rationale: str | None
    calculated_at: datetime | None
    prepared_by: int | None
    created_at: datetime
    updated_at: datetime


class FinancialAssessmentListResponse(BaseModel):
    items: list[FinancialAssessmentResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# materiality_decisions — décision HUMAINE obligatoire, append-only
# ---------------------------------------------------------------------------

class MaterialityDecisionCreate(BaseModel):
    is_material: bool
    basis: DecisionBasis
    justification: str = Field(min_length=1, max_length=4000)


class MaterialityDecisionResponse(BaseModel):
    id: int
    company_id: int
    iro_id: int
    decided_by: int
    decided_at: datetime
    is_material: bool
    basis: DecisionBasis
    justification: str
    supersedes_id: int | None
    created_at: datetime


class MaterialityDecisionListResponse(BaseModel):
    items: list[MaterialityDecisionResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# iro_actions — calquée sur mitigation_actions (034) / water_actions (037) /
# nature_actions (039), table PROPRE
# ---------------------------------------------------------------------------

class IroActionCreate(BaseModel):
    action_type: ActionType
    title: str = Field(min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=2000)
    status: ActionStatus = "planned"
    owner: str | None = Field(default=None, max_length=200)
    due_date: date | None = None
    expected_effect: str | None = Field(default=None, max_length=2000)
    # INTENTION déclarée — jamais soustraite automatiquement d'un score
    # (même règle que 034/037/039).
    expected_risk_reduction_pct: float | None = Field(default=None, ge=0, le=100)


class IroActionResponse(BaseModel):
    id: int
    company_id: int
    iro_id: int
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
    updated_at: datetime


class IroActionListResponse(BaseModel):
    items: list[IroActionResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# disclosure_mappings — correspondance PURE, aucune publication automatique
# ---------------------------------------------------------------------------

class DisclosureMappingCreate(BaseModel):
    # Libre : code vsme_datapoints (ex. 'C1-3') si le rattachement existe, ou
    # référence ESRS libre (ex. 'ESRS E1-6') sinon — voir note migration 040.
    esrs_reference: str | None = Field(default=None, max_length=100)
    status: DisclosureStatus = "draft"
    notes: str | None = Field(default=None, max_length=2000)


class DisclosureMappingResponse(BaseModel):
    id: int
    company_id: int
    iro_id: int
    esrs_reference: str | None
    status: DisclosureStatus
    notes: str | None
    created_by: int | None
    created_at: datetime
    updated_at: datetime


class DisclosureMappingListResponse(BaseModel):
    items: list[DisclosureMappingResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# Vue complète d'un IRO — PAS une AnalyticalEnvelope (agrégation de
# sous-ressources déjà persistées, pas un calcul dérivé présenté ; motif
# `article24_service.build_report`, qui renvoie lui aussi un modèle simple)
# ---------------------------------------------------------------------------

class IroEvidenceLinkRef(BaseModel):
    """Reflet minimal d'un `ClaimEvidenceLinkResponse` (services/intelligence/
    claim_link_service.py) — pas de ré-import du modèle intelligence complet
    pour ne pas coupler ce fichier à `models/intelligence.py` au-delà du
    nécessaire d'affichage."""

    id: int
    claim_type: str
    claim_key: str
    evidence_artifact_id: int
    relation_type: str
    created_at: datetime


class IroDetailResponse(BaseModel):
    iro: IroResponse
    # Historique complet, le plus récent en tête — le panneau frontend
    # affiche `impact_assessments[0]`/`financial_assessments[0]` comme
    # évaluation courante tout en gardant l'historique visible.
    impact_assessments: list[ImpactAssessmentResponse] = Field(default_factory=list)
    financial_assessments: list[FinancialAssessmentResponse] = Field(default_factory=list)
    decisions: list[MaterialityDecisionResponse] = Field(default_factory=list)
    actions: list[IroActionResponse] = Field(default_factory=list)
    disclosure_mappings: list[DisclosureMappingResponse] = Field(default_factory=list)
    evidence_links: list[IroEvidenceLinkRef] = Field(default_factory=list)
