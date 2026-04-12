from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class MaterialiteIssue(BaseModel):
    """Single IRO issue from double materiality matrix."""
    code: str               # E1, E2, S1, G1, …
    label: str
    categorie: str          # Environnement / Social / Gouvernance
    normeEsrs: str
    scoreImpact: Any = None
    scoreProbabilite: Any = None
    scoreImpactTotal: Any = None
    materiel: bool | None = None


class MaterialiteSnapshot(BaseModel):
    """Double materiality analysis."""
    enjeuxEvalues: int = 0
    enjeuxMateriels: int = 0
    enjeuxNonMateriels: int = 0
    enjeuxMaterielsE: int = 0
    enjeuxMaterielsS: int = 0
    enjeuxMaterielsG: int = 0
    issues: list[MaterialiteIssue] = Field(default_factory=list)


class EsgScoreSnapshot(BaseModel):
    """Consolidated ESG score per pillar."""
    scoreGlobal: Any = None
    scoreE: Any = None
    scoreS: Any = None
    scoreG: Any = None
    enjeuxMateriels: Any = None
    statut: str | None = None


class EsgQcControl(BaseModel):
    """Single QC control result."""
    id: str
    label: str
    statut: str | None = None   # OK / WARNING / ERROR
    criticite: str | None = None
    action: str | None = None


class EsgSnapshotResponse(BaseModel):
    snapshotVersion: str = "v1"
    generatedAt: str
    scores: EsgScoreSnapshot
    materialite: MaterialiteSnapshot
    qcControls: list[EsgQcControl] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
