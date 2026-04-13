"""
strategic_mapping.py — Modèles Pydantic pour le module Value Mapping ESG.

Hiérarchie :
  StrategicMappingResponse
    ├── MappingMeta
    ├── HeroContent
    ├── ExecutiveMessage (×4 personas)
    ├── InvestmentPillar (×4 piliers)
    ├── BeforeAfterItem (×7 catégories)
    ├── ValueChainStep (×5 étapes)
    ├── FinancialGain (×6 gains)
    ├── PositiveExternality (×5 externalités)
    ├── CarbonCoLever (×6 capacités)
    ├── GroundedKpis (optionnel — depuis ConsolidatedSnapshot)
    └── FiltersApplied
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

Segment = Literal["pme", "eti", "grand_groupe", "generic"]
Persona = Literal["dg", "daf", "investisseur", "donneur_ordre", "generic"]
Horizon = Literal["court_terme", "moyen_terme", "long_terme", "generic"]


# ---------------------------------------------------------------------------
# Sous-modèles de contenu
# ---------------------------------------------------------------------------


class SourceRef(BaseModel):
    """Référence bibliographique vérifiable."""
    title: str
    publisher: str
    year: int
    url: str | None = None


class MappingMeta(BaseModel):
    version: str
    lastReviewedAt: str
    nextReviewScheduled: str
    regulatoryBaseline: list[str] = Field(default_factory=list)
    contentOwner: str


class HeroContent(BaseModel):
    title: str
    subtitle: str
    summary: str


class ExecutiveMessage(BaseModel):
    persona: Persona
    personaLabel: str
    headline: str
    supporting: list[str] = Field(default_factory=list)


class BudgetRange(BaseModel):
    segment: Segment
    low: int
    high: int
    unit: str = "EUR/an"
    note: str | None = None


class InvestmentPillar(BaseModel):
    id: str
    label: str
    description: str
    implies: list[str] = Field(default_factory=list)
    budgetRanges: list[BudgetRange] = Field(default_factory=list)
    segments: list[Segment] = Field(default_factory=list)
    qualitative: bool = True
    sources: list[SourceRef] = Field(default_factory=list)


class BeforeAfterItem(BaseModel):
    category: str
    before: str
    after: str
    impactTag: str | None = None  # ex: "financement", "réputation", "opérationnel"


class ValueChainStep(BaseModel):
    order: int
    label: str
    description: str
    precisionNote: str | None = None


class FinancialGain(BaseModel):
    id: str
    label: str
    description: str
    magnitude: str | None = None
    qualitative: bool
    segments: list[Segment] = Field(default_factory=list)
    personas: list[Persona] = Field(default_factory=list)
    sources: list[SourceRef] = Field(default_factory=list)


class PositiveExternality(BaseModel):
    id: str
    label: str
    category: str  # "Environnement", "Gouvernance", "Social", "Finance", "Réputation"
    description: str
    qualitative: bool = True
    segments: list[Segment] = Field(default_factory=list)
    sources: list[SourceRef] = Field(default_factory=list)


class CarbonCoLever(BaseModel):
    id: str
    benefit: str          # Le bénéfice que ça active
    capability: str       # Ce que Carbon & Co fait concrètement
    moduleRef: str | None = None  # Route interne ex: "/dashboard"


class GroundedKpis(BaseModel):
    """KPIs personnalisés extraits du ConsolidatedSnapshot si disponible."""
    companyName: str | None = None
    totalS123Tco2e: float | None = None
    esgScoreGlobal: float | None = None
    vsmeCompletion: float | None = None
    greenCapexPct: float | None = None
    reportingYear: int | None = None
    dataAvailable: bool = False
    source: str = "ConsolidatedSnapshot"


class FiltersApplied(BaseModel):
    segment: Segment = "generic"
    persona: Persona = "generic"
    horizon: Horizon = "generic"


# ---------------------------------------------------------------------------
# Réponse principale
# ---------------------------------------------------------------------------


class StrategicMappingResponse(BaseModel):
    meta: MappingMeta
    filters: FiltersApplied
    hero: HeroContent
    executiveMessages: list[ExecutiveMessage] = Field(default_factory=list)
    investments: list[InvestmentPillar] = Field(default_factory=list)
    beforeAfter: list[BeforeAfterItem] = Field(default_factory=list)
    valueChain: list[ValueChainStep] = Field(default_factory=list)
    financialGains: list[FinancialGain] = Field(default_factory=list)
    externalities: list[PositiveExternality] = Field(default_factory=list)
    carbonCoLevers: list[CarbonCoLever] = Field(default_factory=list)
    groundedKpis: GroundedKpis | None = None


class AiContextFact(BaseModel):
    """Un fait vérifiable que le LLM est autorisé à citer."""
    id: str
    label: str
    magnitude: str  # toujours non-null ici — seuls les gains quantifiés passent


class AiContextResponse(BaseModel):
    """Contexte compact transmis au LLM pour la génération de variantes."""
    persona: Persona
    personaLabel: str
    baseHeadline: str
    baseSupporting: list[str] = Field(default_factory=list)
    allowedFacts: list[AiContextFact] = Field(default_factory=list)
