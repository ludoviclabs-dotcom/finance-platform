/**
 * lib/api/water.ts — client des endpoints `/water/*` et `/sites/geo*`
 * (PR-08 : géospatial des sites, ledger eau, screening hydrique).
 *
 * Réutilise `API_BASE_URL` + le porteur de token en mémoire de `lib/api.ts`.
 * Types en snake_case, miroir de `apps/api/models/geo.py` / `models/water.py`.
 *
 * Invariants du domaine lisibles dans ces types :
 *
 * 1. **Gate de géocodage.** `SiteGeo.position_usable` n'est vrai qu'après
 *    acceptation HUMAINE — l'UI n'a aucun moyen d'afficher une position
 *    « utilisable » qui ne l'est pas.
 * 2. **Méthode géométrique nommée.** `method_code` du screening est
 *    `geojson_point_in_polygon_v1` (bbox = pré-filtre) — jamais présentée
 *    comme PostGIS/ST_Intersects, et l'UI l'affiche telle quelle.
 * 3. **Risque ≠ confiance.** `risk_category` (data) et `confidence`
 *    (meta.quality) ne partagent aucun champ combiné.
 * 4. **Schéma pas encore migré.** Le backend répond 503 `schema_not_ready`
 *    tant que 036/037 ne sont pas appliquées en production : le client le
 *    traduit en `SchemaNotReadyError`, que chaque page BETA rend comme
 *    « initialisation du schéma en cours » — jamais une erreur brute.
 */

import { API_BASE_URL, getAuthToken } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types (miroir models/geo.py + models/water.py)
// ---------------------------------------------------------------------------

export type ReviewStatus = "pending" | "accepted" | "flagged";
export type CandidateStatus = "proposed" | "accepted" | "rejected";
export type GeocodePrecision = "exact" | "street" | "city" | "country" | "manual";
export type WaterActivityType = "withdrawal" | "consumption" | "discharge";
export type StressCategory = "low" | "low_medium" | "medium_high" | "high" | "extremely_high";

export interface SiteGeo {
  id: number;
  company_id: number;
  name: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  geocode_precision: GeocodePrecision | null;
  geocode_provider: string | null;
  geocode_review_status: ReviewStatus;
  position_usable: boolean;
}

export interface GeocodeCandidate {
  id: number;
  site_id: number;
  provider: string;
  provider_ref: string | null;
  latitude: number;
  longitude: number;
  precision: GeocodePrecision | null;
  method_code: string;
  status: CandidateStatus;
  review_note: string | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface WaterActivity {
  id: number;
  site_id: number;
  activity_type: WaterActivityType;
  source_type: string;
  quantity_m3: number;
  period_start: string;
  period_end: string;
  data_status: string;
  review_status: ReviewStatus;
  evidence_artifact_id: number | null;
}

export interface WaterImportResult {
  id: number;
  filename: string;
  row_count: number;
  accepted_count: number;
  rejected_count: number;
  status: "pending" | "validated" | "rejected";
  already_imported: boolean;
  errors: string[];
}

export interface WaterPermit {
  id: number;
  site_id: number;
  permit_type: string;
  permit_reference: string | null;
  authorized_volume_m3: number | null;
  valid_from: string | null;
  valid_to: string | null;
  issuing_authority: string | null;
  evidence_artifact_id: number | null;
  status: "active" | "expired" | "revoked";
  review_status: ReviewStatus;
}

export interface WaterRiskArea {
  id: number;
  company_id: number | null;
  code: string;
  label: string;
  area_kind: string;
  scenario_code: string;
  /** `null` quand la licence refuse l'affichage (`value_withheld`). */
  baseline_stress_category: StressCategory | null;
  source_code: string | null;
  display_allowed: boolean;
  derived_use_allowed: boolean;
  license_reasons: string[];
  attribution_text: string | null;
  value_withheld: boolean;
  data_status: string;
}

export interface MatchedArea {
  area_id: number;
  code: string;
  label: string;
  stress_category: StressCategory;
  data_status: string;
  bbox_candidate: boolean;
  matched: boolean;
  method_code: string;
  prefilter_code: string;
}

export interface WaterScreeningData {
  screening_id: number;
  site_id: number;
  scenario_code: string;
  method_code: string;
  methodology_code: string;
  methodology_version: string;
  risk_category: StressCategory | null;
  matched_areas: MatchedArea[];
  candidate_area_count: number;
  matched_area_count: number;
  iro_signal: boolean;
  input_fingerprint: string;
  calculated_at: string | null;
}

export interface WaterScreeningEnvelope {
  data: WaterScreeningData;
  meta: {
    as_of: string | null;
    status: string;
    method: { code: string; version: string };
    quality: { confidence: number | null; coverage_pct: number | null; warnings: string[] };
  };
  evidence: { source_code: string | null; note: string | null }[];
}

export interface WaterScreeningSummary {
  id: number;
  site_id: number;
  method_code: string;
  methodology_code: string;
  methodology_version: string;
  scenario_code: string;
  risk_category: StressCategory | null;
  confidence: number | null;
  coverage_pct: number | null;
  warnings: string[];
  iro_signal: boolean;
  iro_signal_rationale: string | null;
  calculated_at: string;
}

export interface WaterTarget {
  id: number;
  site_id: number | null;
  screening_id: number | null;
  target_type: string;
  title: string;
  baseline_year: number | null;
  target_year: number | null;
  baseline_value_m3: number | null;
  target_value_m3: number | null;
  status: string;
  review_status: ReviewStatus;
}

export interface WaterAction {
  id: number;
  site_id: number | null;
  screening_id: number | null;
  target_id: number | null;
  action_type: string;
  title: string;
  status: string;
  expected_reduction_m3: number | null;
  review_status: ReviewStatus;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// ---------------------------------------------------------------------------
// Client — avec détection contractuelle de `schema_not_ready`
// ---------------------------------------------------------------------------

/** 503 `schema_not_ready` : les migrations 036/037 ne sont pas encore
 * appliquées. Les pages BETA rendent « initialisation du schéma en cours ». */
export class SchemaNotReadyError extends Error {
  constructor() {
    super("schema_not_ready");
    this.name = "SchemaNotReadyError";
  }
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle<T>(res: Response, path: string): Promise<T> {
  if (res.status === 503) {
    let detail: unknown = null;
    try {
      detail = ((await res.json()) as { detail?: unknown }).detail;
    } catch {
      /* corps non-JSON : erreur générique ci-dessous */
    }
    if (detail === "schema_not_ready") throw new SchemaNotReadyError();
  }
  if (!res.ok) {
    let detail = "";
    try {
      detail = String(((await res.json()) as { detail?: unknown }).detail ?? "");
    } catch {
      /* garder le message générique */
    }
    throw new Error(detail || `API ${res.status} on ${path}`);
  }
  return (await res.json()) as T;
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: { Accept: "application/json", ...authHeaders() },
    credentials: "include",
    signal,
  });
  return handle<T>(res, path);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    credentials: "include",
    body: JSON.stringify(body),
  });
  return handle<T>(res, path);
}

// ── Sites géo & candidats ────────────────────────────────────────────────────

export function fetchSitesGeo(signal?: AbortSignal): Promise<Paginated<SiteGeo>> {
  return get<Paginated<SiteGeo>>("/sites/geo?limit=200", signal);
}

export function fetchGeocodeCandidates(
  siteId: number,
  signal?: AbortSignal,
): Promise<Paginated<GeocodeCandidate>> {
  return get<Paginated<GeocodeCandidate>>(`/sites/${siteId}/geocode-candidates?limit=100`, signal);
}

export function proposeGeocodeCandidate(
  siteId: number,
  body: { latitude: number; longitude: number; precision?: GeocodePrecision; provider?: string },
): Promise<GeocodeCandidate> {
  return post<GeocodeCandidate>(`/sites/${siteId}/geocode-candidates`, body);
}

export function reviewGeocodeCandidate(
  siteId: number,
  candidateId: number,
  accept: boolean,
  note?: string,
): Promise<GeocodeCandidate> {
  return post<GeocodeCandidate>(
    `/sites/${siteId}/geocode-candidates/${candidateId}/review`,
    { accept, note: note ?? null },
  );
}

// ── Eau : activités, permis, zones ──────────────────────────────────────────

export function fetchWaterActivities(signal?: AbortSignal): Promise<Paginated<WaterActivity>> {
  return get<Paginated<WaterActivity>>("/water/activities?limit=200", signal);
}

export function importWaterCsv(filename: string, csvText: string): Promise<WaterImportResult> {
  return post<WaterImportResult>("/water/activities/import", {
    filename,
    csv_text: csvText,
  });
}

export function reviewWaterActivity(activityId: number, accept: boolean): Promise<WaterActivity> {
  return post<WaterActivity>(`/water/activities/${activityId}/review`, { accept });
}

export function fetchWaterPermits(signal?: AbortSignal): Promise<Paginated<WaterPermit>> {
  return get<Paginated<WaterPermit>>("/water/permits?limit=200", signal);
}

export function fetchWaterRiskAreas(signal?: AbortSignal): Promise<Paginated<WaterRiskArea>> {
  return get<Paginated<WaterRiskArea>>("/water/risk-areas?limit=200", signal);
}

// ── Screening, cibles, actions ──────────────────────────────────────────────

export function fetchWaterScreenings(
  signal?: AbortSignal,
): Promise<Paginated<WaterScreeningSummary>> {
  return get<Paginated<WaterScreeningSummary>>("/water/screenings?limit=100", signal);
}

export function calculateWaterScreening(
  siteId: number,
  scenarioCode = "baseline",
): Promise<WaterScreeningEnvelope> {
  return post<WaterScreeningEnvelope>("/water/screenings/calculate", {
    site_id: siteId,
    scenario_code: scenarioCode,
  });
}

export function flagScreeningForIro(
  screeningId: number,
  rationale: string,
): Promise<WaterScreeningSummary> {
  return post<WaterScreeningSummary>(`/water/screenings/${screeningId}/flag-for-iro`, {
    rationale,
  });
}

export function fetchWaterTargets(signal?: AbortSignal): Promise<Paginated<WaterTarget>> {
  return get<Paginated<WaterTarget>>("/water/targets?limit=200", signal);
}

export function fetchWaterActions(signal?: AbortSignal): Promise<Paginated<WaterAction>> {
  return get<Paginated<WaterAction>>("/water/actions?limit=200", signal);
}

// ---------------------------------------------------------------------------
// Présentation
// ---------------------------------------------------------------------------

export const STRESS_LABEL: Record<StressCategory, string> = {
  low: "Faible",
  low_medium: "Faible à moyen",
  medium_high: "Moyen à élevé",
  high: "Élevé",
  extremely_high: "Extrême",
};

export const STRESS_TONE: Record<StressCategory, string> = {
  low: "text-emerald-600 dark:text-emerald-400",
  low_medium: "text-lime-600 dark:text-lime-400",
  medium_high: "text-amber-600 dark:text-amber-400",
  high: "text-orange-600 dark:text-orange-400",
  extremely_high: "text-red-600 dark:text-red-400",
};

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  pending: "En attente de revue",
  accepted: "Acceptée",
  flagged: "Signalée",
};

export const ACTIVITY_LABEL: Record<WaterActivityType, string> = {
  withdrawal: "Prélèvement",
  consumption: "Consommation",
  discharge: "Rejet",
};

/** Formate un volume m³ lisible, ou « n. d. » si absent. */
export function formatM3(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "n. d.";
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value)} m³`;
}
