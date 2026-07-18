"""
models/intelligence.py — Evidence Kernel (PR-03) : sources, releases,
artefacts, ingestions, observations, liens de preuve.

Un modèle par table + un modèle de requête par opération d'écriture exposée.
Champs en snake_case, alignés sur les colonnes SQL de la migration 028 (pas
de camelCase ici — ce noyau n'a encore aucun consommateur frontend, cf.
routers/facts.py qui suit la même convention pour la donnée API interne).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

SourceType = Literal["api", "file", "webpage", "manual", "licensed_feed"]
ReleaseStatus = Literal[
    "detected", "quarantined", "validated", "published", "superseded", "blocked_license"
]
IngestionStatus = Literal[
    "pending", "running", "quarantined", "validated", "published", "failed", "blocked_license"
]
ArtifactSensitivity = Literal["public", "internal", "confidential", "restricted"]
DataStatus = Literal["verified", "estimated", "manual", "inferred"]
ClaimRelationType = Literal["supports", "contradicts", "contextualizes", "derived_from"]


# ---------------------------------------------------------------------------
# source_registry
# ---------------------------------------------------------------------------

class SourceCreate(BaseModel):
    code: str
    publisher: str
    title: str
    source_type: SourceType
    adapter_kind: str | None = None
    base_uri: str | None = None
    license_code: str | None = None
    automated_access_allowed: bool = False
    storage_allowed: bool = False
    commercial_use_allowed: bool = False
    redistribution_allowed: bool = False
    derived_use_allowed: bool = False
    display_allowed: bool = False
    attribution_text: str | None = None
    terms_uri: str | None = None


class SourceUpdate(BaseModel):
    """PATCH — tous les champs optionnels, seuls les champs fournis sont modifiés."""
    publisher: str | None = None
    title: str | None = None
    adapter_kind: str | None = None
    base_uri: str | None = None
    license_code: str | None = None
    automated_access_allowed: bool | None = None
    storage_allowed: bool | None = None
    commercial_use_allowed: bool | None = None
    redistribution_allowed: bool | None = None
    derived_use_allowed: bool | None = None
    display_allowed: bool | None = None
    attribution_text: str | None = None
    terms_uri: str | None = None
    active: bool | None = None


class SourceResponse(BaseModel):
    id: int
    company_id: int | None
    code: str
    publisher: str
    title: str
    source_type: SourceType
    adapter_kind: str | None
    base_uri: str | None
    license_code: str | None
    automated_access_allowed: bool
    storage_allowed: bool
    commercial_use_allowed: bool
    redistribution_allowed: bool
    derived_use_allowed: bool
    display_allowed: bool
    attribution_text: str | None
    terms_uri: str | None
    active: bool
    created_by: int | None
    created_at: datetime
    updated_at: datetime


class SourceListResponse(BaseModel):
    items: list[SourceResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# source_releases
# ---------------------------------------------------------------------------

class ReleaseCreate(BaseModel):
    release_key: str
    checksum_sha256: str = Field(min_length=64, max_length=64)
    published_at: datetime | None = None
    valid_from: datetime | None = None
    valid_to: datetime | None = None
    blob_key: str | None = None
    mime_type: str | None = None
    schema_version: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    # Fixé à la création, jamais modifié ensuite (evidence_kernel_guard le
    # gèle avec le reste de la ligne une fois published) — la release qui
    # CORRIGE une autre déclare le lien dès sa détection, pas après coup.
    supersedes_id: int | None = None


class ReleaseResponse(BaseModel):
    id: int
    source_id: int
    company_id: int | None
    release_key: str
    published_at: datetime | None
    retrieved_at: datetime
    valid_from: datetime | None
    valid_to: datetime | None
    checksum_sha256: str
    blob_key: str | None
    mime_type: str | None
    schema_version: str | None
    status: ReleaseStatus
    supersedes_id: int | None
    metadata: dict[str, Any]
    created_by: int | None
    created_at: datetime


class ReleaseListResponse(BaseModel):
    items: list[ReleaseResponse]
    total: int
    limit: int
    offset: int


class ReleaseValidateRequest(BaseModel):
    """Corps de POST /releases/{id}/validate — `passed=false` met en quarantaine."""
    passed: bool = True


# ---------------------------------------------------------------------------
# evidence_artifacts
# ---------------------------------------------------------------------------

class ArtifactResponse(BaseModel):
    id: int
    company_id: int | None
    source_release_id: int | None
    blob_key: str
    sha256: str
    filename: str
    mime_type: str
    size_bytes: int | None
    page_reference: str | None
    table_reference: str | None
    cell_reference: str | None
    excerpt: str | None
    sensitivity: ArtifactSensitivity
    created_by: int | None
    created_at: datetime


# ---------------------------------------------------------------------------
# ingestion_runs
# ---------------------------------------------------------------------------

class IngestionRunResponse(BaseModel):
    id: int
    company_id: int | None
    source_id: int
    source_release_id: int | None
    adapter_kind: str | None
    idempotency_key: str
    status: IngestionStatus
    detected_count: int
    accepted_count: int
    rejected_count: int
    warning_count: int
    error_summary: str | None
    started_at: datetime
    completed_at: datetime | None
    created_by: int | None
    metadata: dict[str, Any]


class IngestionRunListResponse(BaseModel):
    items: list[IngestionRunResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# observations
# ---------------------------------------------------------------------------

class ObservationCreate(BaseModel):
    subject_type: str
    subject_key: str
    metric_code: str
    numeric_value: float | None = None
    text_value: str | None = None
    boolean_value: bool | None = None
    unit: str | None = None
    geography_code: str | None = None
    stage_code: str | None = None
    observed_at: datetime | None = None
    valid_from: datetime | None = None
    valid_to: datetime | None = None
    source_release_id: int
    evidence_artifact_id: int | None = None
    data_status: DataStatus
    confidence: float | None = Field(default=None, ge=0, le=1)
    methodology_version: str | None = None
    supersedes_id: int | None = None


class ObservationResponse(BaseModel):
    id: int
    company_id: int | None
    subject_type: str
    subject_key: str
    metric_code: str
    numeric_value: float | None
    text_value: str | None
    boolean_value: bool | None
    unit: str | None
    geography_code: str | None
    stage_code: str | None
    observed_at: datetime | None
    valid_from: datetime | None
    valid_to: datetime | None
    source_release_id: int
    evidence_artifact_id: int | None
    data_status: DataStatus
    confidence: float | None
    methodology_version: str | None
    supersedes_id: int | None
    created_at: datetime


class ObservationListResponse(BaseModel):
    items: list[ObservationResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# claim_evidence_links (schéma PR-03 ; service livré par PR-05A —
# claim_link_service.py, cf. WAVE_2_INTERFACE_CONTRACTS.md §1)
# ---------------------------------------------------------------------------

class ClaimEvidenceLinkCreate(BaseModel):
    claim_type: str = Field(min_length=1, max_length=100)
    claim_key: str = Field(min_length=1, max_length=255)
    evidence_artifact_id: int
    relation_type: ClaimRelationType


class ClaimEvidenceLinkResponse(BaseModel):
    id: int
    company_id: int | None
    claim_type: str
    claim_key: str
    evidence_artifact_id: int
    relation_type: ClaimRelationType
    created_by: int | None
    created_at: datetime


class ClaimEvidenceLinkListResponse(BaseModel):
    items: list[ClaimEvidenceLinkResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# license_policy — décision structurée (jamais un booléen nu)
# ---------------------------------------------------------------------------

class LicenseDecision(BaseModel):
    allow_ingest: bool
    allow_store: bool
    allow_display: bool
    allow_derived_use: bool
    reasons: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Fraîcheur des sources (PR-04) — vue source_freshness + licence évaluée
# ---------------------------------------------------------------------------

class SourceFreshness(BaseModel):
    source_id: int
    company_id: int | None
    code: str
    publisher: str
    title: str
    source_type: SourceType
    active: bool
    last_release_id: int | None
    last_release_key: str | None
    last_release_status: ReleaseStatus | None
    last_release_at: datetime | None
    published_release_count: int
    total_release_count: int
    has_release: bool
    age_days: int | None
    is_stale: bool
    # Licence évaluée déterministe (license_policy) — jamais un booléen nu.
    license_ok: bool
    allow_display: bool
    allow_derived_use: bool
    license_reasons: list[str] = Field(default_factory=list)
    license_warnings: list[str] = Field(default_factory=list)


class SourceFreshnessListResponse(BaseModel):
    items: list[SourceFreshness]
    total: int
    limit: int
    offset: int


class IntelligenceHealthSource(BaseModel):
    """Ligne minimale et publique (aucun secret) — sources GLOBALES uniquement."""
    code: str
    last_release_at: datetime | None
    age_days: int | None
    last_release_status: ReleaseStatus | None
    is_stale: bool
    license_ok: bool


class IntelligenceHealthResponse(BaseModel):
    status: Literal["ok", "degraded", "empty"]
    checked_at: datetime
    source_count: int
    stale_count: int
    license_anomaly_count: int
    sources: list[IntelligenceHealthSource]
    db: Literal["ok", "not_configured", "down"] = "ok"
