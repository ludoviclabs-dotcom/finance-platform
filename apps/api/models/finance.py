from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class FinanceClimatSnapshot(BaseModel):
    """Carbon exposure & Green CapEx."""
    prixEts: Any = None
    expositionTotaleEur: Any = None
    cagrPrixCarbone: Any = None
    capexDecarbS12Eur: Any = None
    capexDecarbS3Eur: Any = None
    greenCapexPct: Any = None
    statutAlignementParis: Any = None


class SfdrPaiSnapshot(BaseModel):
    """SFDR Principal Adverse Impacts (14 mandatory indicators)."""
    pai1_totalGes: Any = None
    pai2_empreinteCarbone: Any = None
    pai3_intensiteGes: Any = None
    pai4_combustiblesFossilesPct: Any = None
    pai5_partEnrNonRenouvelablePct: Any = None
    pai6_intensiteEnergie: Any = None
    pai7_biodiversite: Any = None
    pai8_rejetsEau: Any = None
    pai9_dechetsDangPct: Any = None
    pai10_violationsUngc: Any = None
    pai11_absenceConformiteUngc: Any = None
    pai12_ecartSalaireHf: Any = None
    pai13_diversiteGenreGouv: Any = None
    pai14_armesControversees: Any = None
    scoreEsgInvestisseur: Any = None


class BenchmarkIndicateur(BaseModel):
    label: str
    valeurClient: Any = None
    medianneSecteur: Any = None
    top25Pct: Any = None
    ecartPct: Any = None
    position: str | None = None   # Leader / Bon / Moyen / A améliorer


class BenchmarkSnapshot(BaseModel):
    secteurNaf: Any = None
    indicateurs: list[BenchmarkIndicateur] = Field(default_factory=list)
    nbLeader: int = 0
    nbAAmeliorer: int = 0


class FinanceQcControl(BaseModel):
    id: str
    label: str
    statut: str | None = None
    criticite: str | None = None
    action: str | None = None


class FinanceSnapshotResponse(BaseModel):
    snapshotVersion: str = "v1"
    generatedAt: str
    financeClimat: FinanceClimatSnapshot
    sfdrPai: SfdrPaiSnapshot
    benchmark: BenchmarkSnapshot
    qcControls: list[FinanceQcControl] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
