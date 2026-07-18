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
    created_at: datetime
