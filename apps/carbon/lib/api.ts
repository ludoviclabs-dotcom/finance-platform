/**
 * Carbon API client — Phase 0.
 *
 * Talks to the FastAPI backend (apps/api) to fetch the normalized Carbon
 * snapshot built from the three master Excel workbooks. Pages should
 * degrade gracefully to mocks from lib/data.ts when the API is unreachable.
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// ---------------------------------------------------------------------------
// Response types — mirror apps/api/models/carbon.py (snapshot v1)
// ---------------------------------------------------------------------------

export interface WorkbookSourceStatus {
  filename: string;
  status: string;
  path: string;
  sheet_count: number | null;
  named_range_count: number | null;
  has_claude_log: boolean | null;
}

export interface SnapshotSource {
  carbonWorkbook: WorkbookSourceStatus;
  esgWorkbook: WorkbookSourceStatus;
  financeWorkbook: WorkbookSourceStatus;
}

export interface SnapshotValidation {
  status: string;
  failures: string[];
  warnings: string[];
}

export interface CompanySnapshot {
  name: string | null;
  reportingYear: number | null;
  sectorActivity: string | null;
  nafCode: string | null;
  revenueNetEur: number | null;
  fte: number | null;
  surfaceSqm: number | null;
  capexTotalEur: number | null;
  opexEligibleTaxoEur: number | null;
}

export interface CarbonKpiSnapshot {
  scope1Tco2e: number | null;
  scope2LbTco2e: number | null;
  scope2MbTco2e: number | null;
  scope3Tco2e: number | null;
  totalS123Tco2e: number | null;
  intensityRevenueTco2ePerMEur: number | null;
  intensityFteTco2ePerFte: number | null;
  shareScope1Pct: number | null;
  shareScope2Pct: number | null;
  shareScope3Pct: number | null;
}

export interface EnergySnapshot {
  consumptionMWh: number | null;
  renewableSharePct: number | null;
}

export interface TaxonomySnapshot {
  turnoverAlignedPct: number | null;
  capexAlignedPct: number | null;
  opexAlignedPct: number | null;
}

export interface CbamSnapshot {
  estimatedCostEur: number | null;
}

export interface SbtiSnapshot {
  baselineYear: number | null;
  baselineS12Tco2e: number | null;
  baselineS3Tco2e: number | null;
  targetReductionS12Pct: number | null;
  targetReductionS3Pct: number | null;
}

export interface CarbonSnapshot {
  snapshotVersion: string;
  generatedAt: string;
  source: SnapshotSource;
  validation: SnapshotValidation;
  company: CompanySnapshot;
  carbon: CarbonKpiSnapshot;
  energy: EnergySnapshot;
  taxonomy: TaxonomySnapshot;
  cbam: CbamSnapshot;
  sbti: SbtiSnapshot;
}

export interface CarbonValidation {
  status: string;
  checks: Array<Record<string, unknown>>;
  failures: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!res.ok) {
    throw new Error(`API ${res.status} on ${path}`);
  }
  return (await res.json()) as T;
}

export function fetchCarbonSnapshot(signal?: AbortSignal): Promise<CarbonSnapshot> {
  return apiGet<CarbonSnapshot>("/carbon/snapshot", signal);
}

export function fetchCarbonValidation(signal?: AbortSignal): Promise<CarbonValidation> {
  return apiGet<CarbonValidation>("/carbon/validate", signal);
}
