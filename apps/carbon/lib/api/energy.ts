/**
 * Energy & Scope 2 API client.
 *
 * PR-06A — fondation énergie : compteurs, activités, instruments contractuels
 * et allocations (quantités en MWh, aucun tCO2e).
 * PR-06B — moteur de calcul Scope 2 dual : runs, trace de calcul, approbation,
 * Evidence Pack (`/energy/scope2/*`). C'est la seule partie qui porte des tCO2e,
 * et elle en porte TOUJOURS deux : location-based ET market-based.
 *
 * Types en snake_case, miroir de apps/api/models/energy.py. Réutilise
 * `API_BASE_URL` + `getAuthToken` du client principal (@/lib/api) plutôt que de
 * dupliquer la config.
 */

import { API_BASE_URL, getAuthToken } from "@/lib/api";

// ── Vocabulaires (miroir des Literal Pydantic) ──────────────────────────────
export type Carrier = "electricity" | "gas" | "heat" | "steam" | "cooling" | "other";
export type EnergyDataStatus = "verified" | "estimated" | "manual" | "inferred";
export type EnergyReviewStatus = "pending" | "accepted" | "flagged";
export type InstrumentType = "rec" | "go" | "ppa" | "green_tariff";
export type InstrumentStatus = "active" | "expired" | "cancelled";
export type FactorBasis = "location" | "market" | "residual_mix";

// ── Types de réponse ────────────────────────────────────────────────────────
export interface EnergyMeter {
  id: number;
  company_id: number;
  site_id: number | null;
  carrier: Carrier;
  meter_code: string;
  label: string | null;
  unit: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EnergyActivity {
  id: number;
  company_id: number;
  meter_id: number | null;
  site_id: number | null;
  carrier: Carrier;
  quantity: number;
  unit: string;
  period_start: string;
  period_end: string;
  import_id: string | null;
  data_status: EnergyDataStatus;
  evidence_artifact_id: number | null;
  review_status: EnergyReviewStatus;
  created_at: string;
  updated_at: string;
}

export interface ContractualInstrument {
  id: number;
  company_id: number;
  instrument_type: InstrumentType;
  carrier: Carrier;
  reference: string | null;
  volume_mwh: number;
  valid_from: string;
  valid_to: string;
  geography_code: string | null;
  certificate_artifact_id: number | null;
  status: InstrumentStatus;
  created_at: string;
  updated_at: string;
  allocated_mwh: number;
  remaining_mwh: number;
  is_expired: boolean;
}

export interface InstrumentAllocation {
  id: number;
  company_id: number;
  instrument_id: number;
  energy_activity_id: number;
  allocated_mwh: number;
  allocated_at: string;
  allocated_by: number | null;
  created_at: string;
}

export interface ActivityImportResult {
  import_id: string;
  filename: string;
  total_rows: number;
  created: number;
  skipped: number;
  review_status: EnergyReviewStatus;
  warnings: string[];
}

interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export type MeterList = Paginated<EnergyMeter>;
export type ActivityList = Paginated<EnergyActivity>;
export type InstrumentList = Paginated<ContractualInstrument>;

// ── Fetch helpers (auth + base URL réutilisés du client principal) ──────────
function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function energyGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: { Accept: "application/json", ...authHeaders() },
    credentials: "include",
    signal,
  });
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
  return (await res.json()) as T;
}

async function energyPost<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
    credentials: "include",
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `API ${res.status} on ${path}`);
  }
  return (await res.json()) as T;
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// ── Compteurs ───────────────────────────────────────────────────────────────
export function fetchMeters(
  opts: { carrier?: Carrier; activeOnly?: boolean; limit?: number; offset?: number } = {},
  signal?: AbortSignal,
): Promise<MeterList> {
  return energyGet<MeterList>(
    `/energy/meters${qs({ carrier: opts.carrier, active_only: opts.activeOnly, limit: opts.limit, offset: opts.offset })}`,
    signal,
  );
}

export function createMeter(
  body: { carrier: Carrier; meter_code: string; site_id?: number | null; label?: string | null; unit?: string; active?: boolean },
): Promise<EnergyMeter> {
  return energyPost<EnergyMeter>("/energy/meters", body);
}

// ── Activités ─────────────────────────────────────────────────────────────
export function fetchActivities(
  opts: {
    site_id?: number; carrier?: Carrier; review_status?: EnergyReviewStatus;
    period_from?: string; period_to?: string; limit?: number; offset?: number;
  } = {},
  signal?: AbortSignal,
): Promise<ActivityList> {
  return energyGet<ActivityList>(`/energy/activities${qs(opts)}`, signal);
}

export function importActivities(filename: string, csvText: string): Promise<ActivityImportResult> {
  return energyPost<ActivityImportResult>("/energy/activities/import", { filename, csv_text: csvText });
}

// ── Instruments & allocations ─────────────────────────────────────────────
export function fetchInstruments(
  opts: { carrier?: Carrier; status?: InstrumentStatus; limit?: number; offset?: number } = {},
  signal?: AbortSignal,
): Promise<InstrumentList> {
  return energyGet<InstrumentList>(`/energy/instruments${qs(opts)}`, signal);
}

export function createInstrument(body: {
  instrument_type: InstrumentType; volume_mwh: number; valid_from: string; valid_to: string;
  carrier?: Carrier; reference?: string | null; geography_code?: string | null; certificate_artifact_id?: number | null;
}): Promise<ContractualInstrument> {
  return energyPost<ContractualInstrument>("/energy/instruments", body);
}

export function allocateInstrument(
  instrumentId: number,
  body: { energy_activity_id: number; allocated_mwh: number },
): Promise<InstrumentAllocation> {
  return energyPost<InstrumentAllocation>(`/energy/instruments/${instrumentId}/allocate`, body);
}

// ══════════════════════════════════════════════════════════════════════════
// Moteur de calcul Scope 2 dual (PR-06B)
// ══════════════════════════════════════════════════════════════════════════

export type Scope2Basis = "location" | "market";
export type Scope2Segment = "total" | "covered" | "uncovered";
export type Scope2RunStatus = "draft" | "approved" | "superseded";
export type Scope2FactorBasis =
  | "location"
  | "market"
  | "residual_mix"
  | "contractual_instrument"
  | "documented_fallback";

/** Enveloppe analytique `{data, meta, evidence}` (contrats Wave 2 §4) : un
 *  résultat n'arrive jamais nu, toujours avec sa date, sa méthode versionnée,
 *  son statut et sa qualité. */
export interface AnalyticalEnvelope<T> {
  data: T;
  meta: {
    as_of: string;
    status: EnergyDataStatus;
    method: { code: string; version: string };
    quality: { confidence: number | null; coverage_pct: number | null; warnings: string[] };
  };
  evidence: Array<{
    artifact_id: number | null;
    source_code: string | null;
    release_key: string | null;
    page_reference: string | null;
    note: string | null;
  }>;
}

/** Une ligne de Trace de calcul. `selection_level` et `selection_reason` sont
 *  toujours renseignés — aucun facteur n'est choisi silencieusement. */
export interface Scope2TraceLine {
  id: number | null;
  energy_activity_id: number | null;
  basis: Scope2Basis;
  segment: Scope2Segment;
  instrument_id: number | null;
  carrier: Carrier;
  geography_code: string | null;
  period_start: string;
  period_end: string;
  activity_value: number;
  activity_unit: string;
  activity_mwh: number;
  ef_id: number | null;
  ef_code: string | null;
  ef_version: string | null;
  factor_kgco2e_per_mwh: number | null;
  factor_basis: Scope2FactorBasis | null;
  selection_level: string;
  selection_reason: string;
  result_tco2e: number;
  uncertainty: number | null;
  data_quality: EnergyDataStatus;
  fallback_reason: string | null;
  warnings: string[];
}

export interface Scope2MissingFactor {
  energy_activity_id: number;
  basis: Scope2Basis;
  segment: Scope2Segment;
  carrier: Carrier;
  geography_code: string | null;
  activity_mwh: number;
  message: string;
}

export interface Scope2ResultData {
  run_id: number;
  status: Scope2RunStatus;
  period_start: string;
  period_end: string;
  geography_code: string;
  location_based_tco2e: number;
  market_based_tco2e: number;
  total_consumption_mwh: number;
  calculated_consumption_mwh: number;
  contractual_coverage_mwh: number;
  contractual_coverage_pct: number;
  uncovered_mwh: number;
  residual_mix_used: boolean;
  is_complete: boolean;
  input_fingerprint: string;
  calculated_at: string;
  approved_at: string | null;
  missing_factors: Scope2MissingFactor[];
  factors_used: Array<{
    ef_id: number;
    ef_code: string | null;
    ef_version: string | null;
    basis: string;
    selection_level: string;
    factor_basis: string;
  }>;
  trace: Scope2TraceLine[];
}

export interface Scope2RunSummary {
  id: number;
  company_id: number;
  methodology_code: string;
  methodology_version: string;
  period_start: string;
  period_end: string;
  geography_code: string;
  status: Scope2RunStatus;
  location_based_tco2e: number | null;
  market_based_tco2e: number | null;
  confidence: number | null;
  coverage_pct: number | null;
  is_complete: boolean;
  input_fingerprint: string;
  calculated_at: string;
  approved_at: string | null;
  warning_count: number;
}

export type Scope2RunEnvelope = AnalyticalEnvelope<Scope2ResultData>;
export type Scope2RunList = Paginated<Scope2RunSummary>;

export function fetchScope2Runs(
  opts: { status?: Scope2RunStatus; limit?: number; offset?: number } = {},
  signal?: AbortSignal,
): Promise<Scope2RunList> {
  return energyGet<Scope2RunList>(`/energy/scope2/runs${qs(opts)}`, signal);
}

export function fetchScope2Run(runId: number, signal?: AbortSignal): Promise<Scope2RunEnvelope> {
  return energyGet<Scope2RunEnvelope>(`/energy/scope2/runs/${runId}`, signal);
}

export function fetchScope2Trace(
  runId: number,
  signal?: AbortSignal,
): Promise<{ run_id: number; items: Scope2TraceLine[]; total: number }> {
  return energyGet(`/energy/scope2/runs/${runId}/trace`, signal);
}

export function calculateScope2(body: {
  period_start: string;
  period_end: string;
  geography_code: string;
  site_geographies?: Record<number, string>;
  include_pending?: boolean;
  /** Niveau 4 de la hiérarchie market-based. Faux par défaut : sans
   *  autorisation méthodologique explicite, l'absence de facteur de marché est
   *  une erreur remontée, jamais un repli silencieux. */
  allow_market_fallback?: boolean;
  fallback_note?: string | null;
}): Promise<Scope2RunEnvelope> {
  return energyPost<Scope2RunEnvelope>("/energy/scope2/calculate", body);
}

export function approveScope2Run(runId: number): Promise<Scope2RunEnvelope> {
  return energyPost<Scope2RunEnvelope>(`/energy/scope2/runs/${runId}/approve`, {});
}

/** URL de téléchargement de l'Evidence Pack (ZIP signé). Le téléchargement passe
 *  par une requête authentifiée — pas d'URL signée permanente (contrats §3). */
export async function downloadScope2EvidencePack(runId: number): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}/energy/scope2/runs/${runId}/evidence-pack`, {
    method: "GET",
    headers: { ...authHeaders() },
    credentials: "include",
  });
  if (!res.ok) throw new Error(`API ${res.status} on evidence-pack`);
  return res.blob();
}
