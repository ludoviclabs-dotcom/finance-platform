from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class WorkbookSourceStatus(BaseModel):
    filename: str
    status: str
    path: str
    sheet_count: int | None = None
    named_range_count: int | None = None
    has_claude_log: bool | None = None


class SnapshotSource(BaseModel):
    carbonWorkbook: WorkbookSourceStatus
    esgWorkbook: WorkbookSourceStatus
    financeWorkbook: WorkbookSourceStatus


class SnapshotValidation(BaseModel):
    status: str
    failures: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class CompanySnapshot(BaseModel):
    name: Any = None
    reportingYear: Any = None
    sectorActivity: Any = None
    nafCode: Any = None
    revenueNetEur: Any = None
    fte: Any = None
    surfaceSqm: Any = None
    capexTotalEur: Any = None
    opexEligibleTaxoEur: Any = None


class CarbonKpiSnapshot(BaseModel):
    scope1Tco2e: Any = None
    scope2LbTco2e: Any = None
    scope2MbTco2e: Any = None
    scope3Tco2e: Any = None
    totalS123Tco2e: Any = None
    intensityRevenueTco2ePerMEur: Any = None
    intensityFteTco2ePerFte: Any = None
    shareScope1Pct: Any = None
    shareScope2Pct: Any = None
    shareScope3Pct: Any = None


class EnergySnapshot(BaseModel):
    consumptionMWh: Any = None
    renewableSharePct: Any = None


class TaxonomySnapshot(BaseModel):
    turnoverAlignedPct: Any = None
    capexAlignedPct: Any = None
    opexAlignedPct: Any = None


class CbamSnapshot(BaseModel):
    estimatedCostEur: Any = None


class SbtiSnapshot(BaseModel):
    baselineYear: Any = None
    baselineS12Tco2e: Any = None
    baselineS3Tco2e: Any = None
    targetReductionS12Pct: Any = None
    targetReductionS3Pct: Any = None


class CarbonSnapshotResponse(BaseModel):
    snapshotVersion: str
    generatedAt: str
    source: SnapshotSource
    validation: SnapshotValidation
    company: CompanySnapshot
    carbon: CarbonKpiSnapshot
    energy: EnergySnapshot
    taxonomy: TaxonomySnapshot
    cbam: CbamSnapshot
    sbti: SbtiSnapshot


class CarbonValidationResponse(BaseModel):
    status: str
    checks: list[dict[str, Any]]
    failures: list[str]
    warnings: list[str] = Field(default_factory=list)
