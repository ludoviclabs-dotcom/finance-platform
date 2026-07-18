/**
 * Energy & Scope 2 API client (PR-06A).
 *
 * Fondation énergie : compteurs, activités, instruments contractuels et
 * allocations. Types en snake_case, miroir de apps/api/models/energy.py. AUCUN
 * total Scope 2 ici (le moteur de calcul dual LB/MB est PR-06B) — ce client ne
 * sert QUE la fondation de données.
 *
 * Réutilise `API_BASE_URL` + `getAuthToken` du client principal (@/lib/api)
 * plutôt que de dupliquer la config. Le foundation panel est lecture seule ;
 * les mutations (create/import/allocate) sont exposées pour un usage ultérieur.
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
