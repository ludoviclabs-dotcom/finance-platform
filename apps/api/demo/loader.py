"""
loader.py — chargement TYPÉ des scénarios de démonstration (No untyped JSON).

Lit ``demo/scenarios/<name>/*.json`` et les valide en modèles Pydantic stricts.
Aucune donnée n'entre dans le seed sans passer par ces frontières de validation.
Tout est 100% fictif (``synthetic=true``) — voir ``ASTERION_SCENARIO.md``.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

SCENARIOS_DIR = Path(__file__).resolve().parent / "scenarios"
DEFAULT_SCENARIO = "asterion-motion-v1"

DataStatus = Literal["verified", "estimated", "manual", "inferred"]
Sensitivity = Literal["public", "internal", "confidential", "restricted"]


class _Base(BaseModel):
    # Tolère les clés annotatives (``note``, ``synthetic`` ...) sans les typer une à une.
    model_config = ConfigDict(extra="ignore")


# --------------------------------------------------------------------------- #
# manifest.json
# --------------------------------------------------------------------------- #
class ExpectedMetrics(_Base):
    motors_per_year: int
    ndfeb_kg_per_motor: float
    copper_kg_per_motor: float
    aluminium_kg_per_motor: float
    purchases_total_eur: float
    scope3_purchases_tco2e: float
    scope3_magnets_share_pct: float
    electricity_gwh: float
    scope2_lb_tco2e: float
    scope2_mb_tco2e: float
    contractual_coverage_pct: float
    water_m3: float
    water_stress: str
    water_confidence: float
    heavy_rare_earth_dependency_pct: float
    heavy_rare_earth_dependency_status: DataStatus
    financial_exposure_indicative_eur: float


class Manifest(_Base):
    scenario: str
    title: str
    synthetic: bool
    tenant_slug: str
    files: list[str]
    expected_metrics: ExpectedMetrics
    ai_expected_support: dict[str, str]


# --------------------------------------------------------------------------- #
# company.json
# --------------------------------------------------------------------------- #
class CompanyInfo(_Base):
    key: str
    slug: str
    legal_name: str
    display_name: str
    sector: str
    country: str
    reporting_year: int
    synthetic: bool


class DemoUser(_Base):
    key: str
    email: str
    display_name: str
    role: str = "analyst"


class Site(_Base):
    key: str
    name: str
    country: str
    latitude: float
    longitude: float
    location_precision: str = "city"
    role: str | None = None
    status: DataStatus = "manual"


class CompanyFile(_Base):
    company: CompanyInfo
    demo_user: DemoUser
    sites: list[Site] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# suppliers / products / purchases
# --------------------------------------------------------------------------- #
class Supplier(_Base):
    key: str
    name: str
    country: str
    material_focus: str | None = None
    criticality: str | None = None
    qualification_status: str | None = None
    status: DataStatus = "manual"


class BomLine(_Base):
    product_key: str
    material: str
    material_code: str
    supplier_key: str
    kg_per_unit: float
    annual_kg: float
    status: DataStatus = "manual"
    method: str | None = None


class Product(_Base):
    key: str
    name: str
    annual_volume: int
    unit: str = "motor"
    status: DataStatus = "manual"


class RecycledContent(_Base):
    material_code: str
    declared_pct: float
    proven_pct: float
    proven_status: DataStatus = "verified"


class ProductsFile(_Base):
    products: list[Product]
    bom: list[BomLine]
    recycled_content: RecycledContent | None = None


class PurchaseLine(_Base):
    key: str
    supplier_key: str
    material_code: str
    category: str
    spend_eur: float
    physical_kg: float
    scope3_tco2e: float
    share_pct: float
    factor_status: DataStatus = "estimated"


class PurchasesFile(_Base):
    total_spend_eur: float
    scope3_purchases_tco2e: float
    magnets_share_pct: float
    lines: list[PurchaseLine]


# --------------------------------------------------------------------------- #
# evidence.json (drives the AI grounding)
# --------------------------------------------------------------------------- #
class EvidenceSource(_Base):
    key: str
    code: str
    publisher: str
    title: str
    source_type: str
    active: bool = True
    display_allowed: bool = True
    derived_use_allowed: bool = True
    attribution_text: str | None = None


class EvidenceRelease(_Base):
    key: str
    source_key: str
    release_key: str
    status: str = "published"


class EvidenceArtifact(_Base):
    key: str
    filename: str
    release_key: str | None = None
    sensitivity: Sensitivity = "internal"
    page_reference: str | None = None
    excerpt: str | None = None
    match_marker: str | None = None
    included_in_pack: bool = True
    excluded_reason: str | None = None


class EvidenceObservation(_Base):
    key: str
    metric: str
    value: float
    unit: str | None = None
    data_status: DataStatus
    methodology_version: str | None = None
    artifact_key: str | None = None


class IroEvidenceLink(_Base):
    iro_key: str
    artifact_key: str
    relation_type: str = "supports"


class EvidenceFile(_Base):
    sources: list[EvidenceSource] = Field(default_factory=list)
    releases: list[EvidenceRelease] = Field(default_factory=list)
    artifacts: list[EvidenceArtifact] = Field(default_factory=list)
    observations: list[EvidenceObservation] = Field(default_factory=list)
    iro_evidence_links: list[IroEvidenceLink] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# iro.json
# --------------------------------------------------------------------------- #
class IroImpact(_Base):
    scale: int | None = None
    scope: int | None = None
    irremediability: int | None = None
    likelihood: str | None = None
    status: DataStatus = "estimated"


class IroFinancial(_Base):
    magnitude: int | None = None
    likelihood: str | None = None
    financial_exposure_eur: float | None = None
    exposure_status: DataStatus = "estimated"


class Iro(_Base):
    key: str
    title: str
    iro_type: Literal["impact", "risk", "opportunity"] = "risk"
    origin_domain: str = "manual"
    origin_reference: str | None = None
    topic_code: str | None = None
    description: str | None = None
    impact_assessment: IroImpact | None = None
    financial_assessment: IroFinancial | None = None
    evidence_keys: list[str] = Field(default_factory=list)


class IroFile(_Base):
    iros: list[Iro]


# --------------------------------------------------------------------------- #
# ai-review.json (deterministic demo claims specification)
# --------------------------------------------------------------------------- #
ExpectedSupport = Literal["supported", "partially_supported", "contradicted", "unsupported"]
OutputLabel = Literal["DRAFT", "SUGGESTION", "REVIEW_REQUIRED"]


class AiClaimSpec(_Base):
    claim_text: str
    output_label: OutputLabel
    cite_marker: str | None = None
    contradiction: bool = False
    expected_support: ExpectedSupport


class AiSubjectSpec(_Base):
    match: dict[str, str] = Field(default_factory=dict)
    use_case: Literal["iro_review", "calc_explanation"]
    claims: list[AiClaimSpec] = Field(default_factory=list)
    review_questions: list[str] = Field(default_factory=list)
    action_suggestions: list[str] = Field(default_factory=list)


class AiReviewFile(_Base):
    subjects: dict[str, AiSubjectSpec] = Field(default_factory=dict)
    excluded_evidence_trace: list[dict[str, str]] = Field(default_factory=list)
    badges: list[str] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Aggregate scenario
# --------------------------------------------------------------------------- #
class Scenario(_Base):
    name: str
    manifest: Manifest
    company: CompanyFile
    suppliers: list[Supplier]
    products: ProductsFile
    purchases: PurchasesFile
    evidence: EvidenceFile
    iro: IroFile
    ai_review: AiReviewFile
    # Domaines seedés en observations canoniques (typés de façon souple).
    energy: dict = Field(default_factory=dict)
    water: dict = Field(default_factory=dict)
    nature: dict = Field(default_factory=dict)
    crma: dict = Field(default_factory=dict)
    narration: dict = Field(default_factory=dict)
    # MODULE 2 (PR-M2D) — ressources stratégiques (dict souple, fichier optionnel).
    resources: dict = Field(default_factory=dict)


def _read_json(scenario_dir: Path, filename: str) -> dict:
    path = scenario_dir / filename
    if not path.exists():
        raise FileNotFoundError(f"Fichier de scénario manquant : {path}")
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def _read_json_optional(scenario_dir: Path, filename: str) -> dict:
    """Comme _read_json mais renvoie {} si le fichier est absent (extension
    facultative d'un scénario — ex. resources.json n'existe que pour Asterion)."""
    path = scenario_dir / filename
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def scenario_dir(name: str = DEFAULT_SCENARIO) -> Path:
    return SCENARIOS_DIR / name


def load_scenario(name: str = DEFAULT_SCENARIO) -> Scenario:
    """Charge et valide un scénario complet. Lève si un fichier manque/est invalide."""
    sdir = scenario_dir(name)
    if not sdir.is_dir():
        raise FileNotFoundError(f"Scénario introuvable : {sdir}")

    manifest = Manifest.model_validate(_read_json(sdir, "manifest.json"))
    company = CompanyFile.model_validate(_read_json(sdir, "company.json"))
    suppliers = [Supplier.model_validate(s) for s in _read_json(sdir, "suppliers.json")["suppliers"]]
    products = ProductsFile.model_validate(_read_json(sdir, "products-and-bom.json"))
    purchases = PurchasesFile.model_validate(_read_json(sdir, "purchases.json"))
    evidence = EvidenceFile.model_validate(_read_json(sdir, "evidence.json"))
    iro = IroFile.model_validate(_read_json(sdir, "iro.json"))
    ai_review = AiReviewFile.model_validate(_read_json(sdir, "ai-review.json"))

    return Scenario(
        name=name,
        manifest=manifest,
        company=company,
        suppliers=suppliers,
        products=products,
        purchases=purchases,
        evidence=evidence,
        iro=iro,
        ai_review=ai_review,
        energy=_read_json(sdir, "energy.json"),
        water=_read_json(sdir, "water.json"),
        nature=_read_json(sdir, "nature.json"),
        crma=_read_json(sdir, "crma.json"),
        narration=_read_json(sdir, "narration.json"),
        resources=_read_json_optional(sdir, "resources.json"),
    )
