"""
models/ai_review.py — modèles typés de l'assistant IA de revue/explication (PR-11).

**No untyped JSON** (CLAUDE.md, plan §16) : la sortie du modèle est validée par
Pydantic AVANT toute persistance ; une sortie non conforme fait échouer le run
(gate `schema_valid`). Vocabulaires alignés sur la migration 041 (CHECK SQL) et
sur AI_GOVERNANCE_CONTRACTS.md (§3 étiquetage, §5 citations, §12 revue).

Aucune de ces structures ne fait autorité sur une donnée métier : toute sortie
reste DRAFT / SUGGESTION / REVIEW_REQUIRED et transite par une revue humaine.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

# --- Vocabulaires gelés (miroir des CHECK de la migration 041) --------------
UseCase = Literal["iro_review", "calc_explanation"]
RunStatus = Literal["pending", "succeeded", "failed", "blocked_license", "refused"]
ReviewStatus = Literal["draft", "needs_review", "approved", "rejected"]
OutputLabel = Literal["DRAFT", "SUGGESTION", "REVIEW_REQUIRED"]
SupportStatus = Literal["supported", "partially_supported", "contradicted", "unsupported"]
ResourceType = Literal["source", "release", "artifact", "observation", "claim_link", "calc_result"]
DecisionAction = Literal["accept", "reject", "modify"]
Feedback = Literal["useful", "not_useful", "incorrect"]
DataStatus = Literal["verified", "estimated", "manual", "inferred"]
Sensitivity = Literal["public", "internal", "confidential", "restricted"]


# --- Reference pack (contexte pré-autorisé envoyé au modèle) ----------------
class ReferenceItem(BaseModel):
    """Une référence AUTORISÉE, résolue sous RLS + licence + sensibilité, envoyée
    au modèle. Extrait présent uniquement si affichable et non sensible."""

    ref_id: str = Field(description="Identifiant local stable dans le pack, ex. 'artifact:415'")
    resource_type: ResourceType
    internal_id: int
    source_id: int | None = None
    release_id: int | None = None
    artifact_id: int | None = None
    observation_id: int | None = None
    label: str | None = None
    locator: dict[str, Any] = Field(default_factory=dict)
    data_status: DataStatus | None = None
    sensitivity: Sensitivity | None = None
    license_ok: bool = False
    stale: bool = False


class ReferencePack(BaseModel):
    """Contexte minimisé et pré-autorisé pour un use case. `input_hash` en est le
    SHA-256 canonique. Jamais d'accès direct DB/Blob/réseau par le modèle."""

    use_case: UseCase
    subject_type: str
    subject_key: str
    company_id: int
    instructions: str
    subject_summary: dict[str, Any] = Field(default_factory=dict)
    references: list[ReferenceItem] = Field(default_factory=list)


# --- Sortie brute du modèle (validée avant persistance) ---------------------
class ModelCitation(BaseModel):
    """Ce que le modèle DÉCLARE citer — non encore résolu contre la base.
    `ref_id` doit correspondre à une référence du pack ; sinon → unsupported."""

    ref_id: str


class ModelClaim(BaseModel):
    claim_text: str = Field(min_length=1)
    structured_payload: dict[str, Any] = Field(default_factory=dict)
    output_label: OutputLabel
    citations: list[ModelCitation] = Field(default_factory=list)


class ModelResult(BaseModel):
    """Sortie structurée du provider (demo ou live), validée par Pydantic."""

    claims: list[ModelClaim] = Field(default_factory=list)
    summary: str | None = None


# --- Requête provider -------------------------------------------------------
class ModelRequest(BaseModel):
    use_case: UseCase
    provider: str
    model: str
    prompt_version: str
    policy_version: str
    system_prompt: str
    pack: ReferencePack


# --- Réponses API (persistance -> client) -----------------------------------
class CitationResponse(BaseModel):
    id: int | None = None
    resource_type: ResourceType
    internal_id: int
    source_id: int | None = None
    release_id: int | None = None
    artifact_id: int | None = None
    observation_id: int | None = None
    locator: dict[str, Any] = Field(default_factory=dict)
    data_status: DataStatus | None = None
    sensitivity: Sensitivity | None = None
    license_ok: bool = False
    stale: bool = False


class ClaimResponse(BaseModel):
    id: int | None = None
    claim_index: int
    claim_text: str
    structured_payload: dict[str, Any] = Field(default_factory=dict)
    output_label: OutputLabel
    support_status: SupportStatus
    citations: list[CitationResponse] = Field(default_factory=list)


class RunResponse(BaseModel):
    id: int
    company_id: int
    use_case: UseCase
    subject_type: str
    subject_key: str
    provider: str
    model: str
    model_version: str | None = None
    prompt_version: str
    policy_version: str
    input_hash: str
    status: RunStatus
    review_status: ReviewStatus
    tokens_input: int | None = None
    tokens_output: int | None = None
    cost_estimate: float | None = None
    latency_ms: int | None = None
    error_code: str | None = None
    created_at: datetime | None = None
    completed_at: datetime | None = None


class ReviewRunResponse(BaseModel):
    """Résultat complet d'une revue : run + claims + citations + statuts.
    `schema_valid`/`citation_resolved`/`license_allowed` = état de la gate §16.4
    (human_review reste à faire côté humain)."""

    run: RunResponse
    claims: list[ClaimResponse] = Field(default_factory=list)
    schema_valid: bool
    citation_resolved: bool
    license_allowed: bool


class RunListResponse(BaseModel):
    items: list[RunResponse] = Field(default_factory=list)
    total: int
    limit: int
    offset: int


# --- Décision humaine -------------------------------------------------------
class ReviewDecisionCreate(BaseModel):
    decision: DecisionAction
    justification: str = Field(min_length=1)
    modified_output: dict[str, Any] | None = None
    feedback: Feedback | None = None


class ReviewDecisionResponse(BaseModel):
    id: int
    run_id: int
    company_id: int
    decision: DecisionAction
    reviewer_id: int
    justification: str
    feedback: Feedback | None = None
    supersedes_id: int | None = None
    created_at: datetime | None = None
    # Effet métier humain déclenché par un 'accept' (ex. IRO candidate créé).
    business_effect: dict[str, Any] | None = None
