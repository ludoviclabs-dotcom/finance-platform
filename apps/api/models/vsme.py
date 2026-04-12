from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class VsmeProfileSnapshot(BaseModel):
    """VSME Section A — Business Profile."""
    raisonSociale: Any = None
    secteurNaf: Any = None
    etp: Any = None
    caNet: Any = None
    anneeReporting: Any = None
    pays: Any = None
    perimetre: Any = None


class VsmeEnvironSnapshot(BaseModel):
    """VSME Section B — Environment."""
    scope1Tco2e: Any = None
    scope2LbTco2e: Any = None
    scope2MbTco2e: Any = None
    scope3Tco2e: Any = None
    totalGesTco2e: Any = None
    intensiteCaGes: Any = None
    energieMwh: Any = None
    partEnrPct: Any = None
    eauM3: Any = None
    dechetsTonnes: Any = None
    valorisationDechetsPct: Any = None
    planReductionGes: Any = None


class VsmeSocialSnapshot(BaseModel):
    """VSME Section C — Social."""
    effectifTotal: Any = None
    pctCdi: Any = None
    tauxRotation: Any = None
    ltir: Any = None
    formationHEtp: Any = None
    ecartSalaireHf: Any = None
    pctFemmesMgmt: Any = None
    diversite: Any = None
    dialogueSocial: Any = None
    litigesSociaux: Any = None


class VsmeGovSnapshot(BaseModel):
    """VSME Section D — Governance."""
    antiCorruption: Any = None
    formationEthique: Any = None
    whistleblowing: Any = None
    pctCaIndependants: Any = None
    protectionDonnees: Any = None


class VsmeCompletudeSnapshot(BaseModel):
    """VSME completeness score."""
    indicateursCompletes: int = 0
    totalIndicateurs: int = 34
    scorePct: float = 0.0
    statut: str = "incomplet"


class VsmeSnapshotResponse(BaseModel):
    snapshotVersion: str = "v1"
    generatedAt: str
    completude: VsmeCompletudeSnapshot
    profile: VsmeProfileSnapshot
    environnement: VsmeEnvironSnapshot
    social: VsmeSocialSnapshot
    gouvernance: VsmeGovSnapshot
    warnings: list[str] = Field(default_factory=list)
