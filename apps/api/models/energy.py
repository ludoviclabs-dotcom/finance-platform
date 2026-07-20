"""
models/energy.py — Énergie & Scope 2 (PR-06A) : compteurs, activités,
instruments contractuels, allocations, métadonnées de facteurs.

Un modèle par table + un modèle de requête par opération d'écriture exposée.
Champs snake_case, alignés sur les colonnes SQL de la migration 031 (même
convention que models/intelligence.py — API interne). Aucun total Scope 2,
aucun résultat de calcul ici : PR-06A est une FONDATION de données, le moteur
de calcul dual LB/MB est PR-06B.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

Carrier = Literal["electricity", "gas", "heat", "steam", "cooling", "other"]
EnergyDataStatus = Literal["verified", "estimated", "manual", "inferred"]
ReviewStatus = Literal["pending", "accepted", "flagged"]
InstrumentType = Literal["rec", "go", "ppa", "green_tariff"]
InstrumentStatus = Literal["active", "expired", "cancelled"]
FactorBasis = Literal["location", "market", "residual_mix"]


# ---------------------------------------------------------------------------
# energy_meters
# ---------------------------------------------------------------------------

class MeterCreate(BaseModel):
    carrier: Carrier
    meter_code: str = Field(min_length=1)
    site_id: int | None = None
    label: str | None = None
    unit: str = "MWh"
    active: bool = True


class MeterResponse(BaseModel):
    id: int
    company_id: int
    site_id: int | None
    carrier: Carrier
    meter_code: str
    label: str | None
    unit: str
    active: bool
    created_at: datetime
    updated_at: datetime


class MeterListResponse(BaseModel):
    items: list[MeterResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# energy_activities
# ---------------------------------------------------------------------------

class ActivityImportRequest(BaseModel):
    """Import CSV d'activités énergie. `csv_text` = contenu brut du fichier
    (colonnes : meter_code, carrier, quantity, unit, period_start, period_end).

    Le front lit le fichier et poste son texte — pas de parseur multipart
    bespoke. Idempotent : réimporter le même CSV ne crée aucun doublon (clé
    naturelle company_id+meter+période UNIQUE en base)."""
    filename: str = Field(min_length=1)
    csv_text: str


class ActivityImportResult(BaseModel):
    import_id: str
    filename: str
    total_rows: int
    created: int
    skipped: int
    review_status: ReviewStatus = "pending"
    warnings: list[str] = Field(default_factory=list)


class ActivityResponse(BaseModel):
    id: int
    company_id: int
    meter_id: int | None
    site_id: int | None
    carrier: Carrier
    quantity: float
    unit: str
    period_start: date
    period_end: date
    import_id: str | None
    data_status: EnergyDataStatus
    evidence_artifact_id: int | None
    review_status: ReviewStatus
    created_at: datetime
    updated_at: datetime


class ActivityListResponse(BaseModel):
    items: list[ActivityResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# contractual_instruments
# ---------------------------------------------------------------------------

class InstrumentCreate(BaseModel):
    instrument_type: InstrumentType
    volume_mwh: float = Field(ge=0)
    valid_from: date
    valid_to: date
    carrier: Carrier = "electricity"
    reference: str | None = None
    geography_code: str | None = None
    certificate_artifact_id: int | None = None


class InstrumentResponse(BaseModel):
    id: int
    company_id: int
    instrument_type: InstrumentType
    carrier: Carrier
    reference: str | None
    volume_mwh: float
    valid_from: date
    valid_to: date
    geography_code: str | None
    certificate_artifact_id: int | None
    status: InstrumentStatus
    created_at: datetime
    updated_at: datetime
    # Champs dérivés (couverture / expiry) — calculés à la lecture, pas stockés.
    allocated_mwh: float = 0.0
    remaining_mwh: float = 0.0
    is_expired: bool = False


class InstrumentListResponse(BaseModel):
    items: list[InstrumentResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# instrument_allocations
# ---------------------------------------------------------------------------

class AllocationRequest(BaseModel):
    energy_activity_id: int
    allocated_mwh: float = Field(gt=0)


class AllocationResponse(BaseModel):
    id: int
    company_id: int
    instrument_id: int
    energy_activity_id: int
    allocated_mwh: float
    allocated_at: datetime
    allocated_by: int | None


# ---------------------------------------------------------------------------
# Moteur de calcul Scope 2 dual (PR-06B) — scope2_calculation_runs /
# scope2_line_results. Ici, et seulement ici, apparaissent des tCO2e.
# ---------------------------------------------------------------------------

Scope2Basis = Literal["location", "market"]
Scope2Segment = Literal["total", "covered", "uncovered"]
Scope2FactorBasis = Literal[
    "location", "market", "residual_mix", "contractual_instrument", "documented_fallback"
]
Scope2RunStatus = Literal["draft", "approved", "superseded"]


class Scope2CalculateRequest(BaseModel):
    """Demande de calcul. `geography_code` (zone de réseau, ex. `FR` ou
    `FR-IDF`) est OBLIGATOIRE : un calcul location-based sans zone déclarée
    n'existe pas, et deviner la zone serait un choix silencieux.

    `allow_market_fallback` est le seul interrupteur autorisant le niveau 4 de
    la hiérarchie market-based ; **faux par défaut** — sans autorisation
    méthodologique explicite, l'absence de facteur de marché est une erreur
    remontée, jamais un repli discret sur une moyenne de réseau.
    """

    period_start: date
    period_end: date
    geography_code: str = Field(min_length=2)
    site_geographies: dict[int, str] = Field(default_factory=dict)
    include_pending: bool = True
    allow_market_fallback: bool = False
    fallback_note: str | None = None


class Scope2MissingFactor(BaseModel):
    energy_activity_id: int
    basis: Scope2Basis
    segment: Scope2Segment
    carrier: Carrier
    geography_code: str | None
    activity_mwh: float
    message: str


class Scope2FactorUsed(BaseModel):
    ef_id: int
    ef_code: str | None = None
    ef_version: str | None = None
    basis: str
    selection_level: str
    factor_basis: str


class Scope2TraceLine(BaseModel):
    """Une ligne de la Trace de calcul. `selection_level` + `selection_reason`
    sont NON NULS : la trace dit toujours d'où vient le facteur retenu."""

    id: int | None = None
    energy_activity_id: int | None
    basis: Scope2Basis
    segment: Scope2Segment
    instrument_id: int | None = None
    carrier: Carrier
    geography_code: str | None
    period_start: date
    period_end: date
    activity_value: float
    activity_unit: str
    activity_mwh: float
    ef_id: int | None = None
    ef_code: str | None = None
    ef_version: str | None = None
    factor_kgco2e_per_mwh: float | None = None
    factor_basis: Scope2FactorBasis | None = None
    selection_level: str
    selection_reason: str
    result_tco2e: float
    uncertainty: float | None = None
    data_quality: EnergyDataStatus
    fallback_reason: str | None = None
    warnings: list[str] = Field(default_factory=list)


class Scope2ResultData(BaseModel):
    """Le `data` de l'enveloppe analytique (contrats §4).

    Les DEUX totaux coexistent toujours — aucun champ ne peut en masquer un
    autre côté API, comme côté UI.
    """

    run_id: int
    status: Scope2RunStatus
    period_start: date
    period_end: date
    geography_code: str
    location_based_tco2e: float
    market_based_tco2e: float
    total_consumption_mwh: float
    calculated_consumption_mwh: float
    contractual_coverage_mwh: float
    contractual_coverage_pct: float
    uncovered_mwh: float
    residual_mix_used: bool
    is_complete: bool
    input_fingerprint: str
    calculated_at: datetime
    approved_at: datetime | None = None
    missing_factors: list[Scope2MissingFactor] = Field(default_factory=list)
    factors_used: list[Scope2FactorUsed] = Field(default_factory=list)
    trace: list[Scope2TraceLine] = Field(default_factory=list)


class Scope2RunSummary(BaseModel):
    """Vue de liste d'un run — sans la trace complète (payload contenu)."""

    id: int
    company_id: int
    methodology_code: str
    methodology_version: str
    period_start: date
    period_end: date
    geography_code: str
    status: Scope2RunStatus
    location_based_tco2e: float | None = None
    market_based_tco2e: float | None = None
    confidence: float | None = None
    coverage_pct: float | None = None
    is_complete: bool = False
    input_fingerprint: str
    calculated_at: datetime
    approved_at: datetime | None = None
    warning_count: int = 0


class Scope2RunListResponse(BaseModel):
    items: list[Scope2RunSummary]
    total: int
    limit: int
    offset: int


class Scope2TraceResponse(BaseModel):
    run_id: int
    items: list[Scope2TraceLine]
    total: int
    created_at: datetime
