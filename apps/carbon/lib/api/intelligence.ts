/**
 * lib/api/intelligence.ts — client des endpoints `/intelligence/*` + fraîcheur
 * (PR-04, noyau Evidence Kernel PR-03).
 *
 * Réutilise `API_BASE_URL` + le porteur de token en mémoire de `lib/api.ts`
 * (JWT posé par use-auth). Types en snake_case, miroir de
 * `apps/api/models/intelligence.py`.
 */

import { API_BASE_URL, getAuthToken } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types (miroir models/intelligence.py)
// ---------------------------------------------------------------------------

export type SourceType = "api" | "file" | "webpage" | "manual" | "licensed_feed";
export type ReleaseStatus =
  | "detected"
  | "quarantined"
  | "validated"
  | "published"
  | "superseded"
  | "blocked_license";
export type BackendDataStatus = "verified" | "estimated" | "manual" | "inferred";

export interface IntelligenceSource {
  id: number;
  company_id: number | null;
  code: string;
  publisher: string;
  title: string;
  source_type: SourceType;
  adapter_kind: string | null;
  base_uri: string | null;
  license_code: string | null;
  automated_access_allowed: boolean;
  storage_allowed: boolean;
  commercial_use_allowed: boolean;
  redistribution_allowed: boolean;
  derived_use_allowed: boolean;
  display_allowed: boolean;
  attribution_text: string | null;
  terms_uri: string | null;
  active: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface SourceListResponse {
  items: IntelligenceSource[];
  total: number;
  limit: number;
  offset: number;
}

export interface Release {
  id: number;
  source_id: number;
  company_id: number | null;
  release_key: string;
  published_at: string | null;
  retrieved_at: string;
  valid_from: string | null;
  valid_to: string | null;
  checksum_sha256: string;
  blob_key: string | null;
  mime_type: string | null;
  schema_version: string | null;
  status: ReleaseStatus;
  supersedes_id: number | null;
  metadata: Record<string, unknown>;
  created_by: number | null;
  created_at: string;
}

export interface ReleaseListResponse {
  items: Release[];
  total: number;
  limit: number;
  offset: number;
}

export interface Observation {
  id: number;
  company_id: number | null;
  subject_type: string;
  subject_key: string;
  metric_code: string;
  numeric_value: number | null;
  text_value: string | null;
  boolean_value: boolean | null;
  unit: string | null;
  geography_code: string | null;
  stage_code: string | null;
  observed_at: string | null;
  valid_from: string | null;
  valid_to: string | null;
  source_release_id: number;
  evidence_artifact_id: number | null;
  data_status: BackendDataStatus;
  confidence: number | null;
  methodology_version: string | null;
  supersedes_id: number | null;
  created_at: string;
}

export interface ObservationListResponse {
  items: Observation[];
  total: number;
  limit: number;
  offset: number;
}

export interface SourceFreshness {
  source_id: number;
  company_id: number | null;
  code: string;
  publisher: string;
  title: string;
  source_type: SourceType;
  active: boolean;
  last_release_id: number | null;
  last_release_key: string | null;
  last_release_status: ReleaseStatus | null;
  last_release_at: string | null;
  published_release_count: number;
  total_release_count: number;
  has_release: boolean;
  age_days: number | null;
  is_stale: boolean;
  license_ok: boolean;
  allow_display: boolean;
  allow_derived_use: boolean;
  license_reasons: string[];
  license_warnings: string[];
}

export interface SourceFreshnessListResponse {
  items: SourceFreshness[];
  total: number;
  limit: number;
  offset: number;
}

export interface IntelligenceHealthSource {
  code: string;
  last_release_at: string | null;
  age_days: number | null;
  last_release_status: ReleaseStatus | null;
  is_stale: boolean;
  license_ok: boolean;
}

export interface IntelligenceHealth {
  status: "ok" | "degraded" | "empty";
  checked_at: string;
  source_count: number;
  stale_count: number;
  license_anomaly_count: number;
  sources: IntelligenceHealthSource[];
  db: "ok" | "not_configured" | "down";
}

// ---------------------------------------------------------------------------
// Fetch helpers — token JWT en mémoire (posé par use-auth)
// ---------------------------------------------------------------------------

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: { Accept: "application/json", ...authHeaders() },
    credentials: "include",
    signal,
  });
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
  return (await res.json()) as T;
}

async function post<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", ...authHeaders() };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "include",
    signal,
  });
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export function fetchSources(
  opts: { limit?: number; offset?: number; activeOnly?: boolean } = {},
  signal?: AbortSignal,
): Promise<SourceListResponse> {
  const p = new URLSearchParams();
  if (opts.limit != null) p.set("limit", String(opts.limit));
  if (opts.offset != null) p.set("offset", String(opts.offset));
  if (opts.activeOnly) p.set("active_only", "true");
  const qs = p.toString() ? `?${p.toString()}` : "";
  return get<SourceListResponse>(`/intelligence/sources${qs}`, signal);
}

export function fetchSource(id: number, signal?: AbortSignal): Promise<IntelligenceSource> {
  return get<IntelligenceSource>(`/intelligence/sources/${id}`, signal);
}

export function fetchSourceReleases(
  id: number,
  opts: { limit?: number; offset?: number } = {},
  signal?: AbortSignal,
): Promise<ReleaseListResponse> {
  const p = new URLSearchParams();
  if (opts.limit != null) p.set("limit", String(opts.limit));
  if (opts.offset != null) p.set("offset", String(opts.offset));
  const qs = p.toString() ? `?${p.toString()}` : "";
  return get<ReleaseListResponse>(`/intelligence/sources/${id}/releases${qs}`, signal);
}

export function fetchObservations(
  opts: { subjectType?: string; subjectKey?: string; metricCode?: string; limit?: number; offset?: number } = {},
  signal?: AbortSignal,
): Promise<ObservationListResponse> {
  const p = new URLSearchParams();
  if (opts.subjectType) p.set("subject_type", opts.subjectType);
  if (opts.subjectKey) p.set("subject_key", opts.subjectKey);
  if (opts.metricCode) p.set("metric_code", opts.metricCode);
  if (opts.limit != null) p.set("limit", String(opts.limit));
  if (opts.offset != null) p.set("offset", String(opts.offset));
  const qs = p.toString() ? `?${p.toString()}` : "";
  return get<ObservationListResponse>(`/intelligence/observations${qs}`, signal);
}

export function fetchSourceFreshness(id: number, signal?: AbortSignal): Promise<SourceFreshness> {
  return get<SourceFreshness>(`/intelligence/sources/${id}/freshness`, signal);
}

/** État public de fraîcheur (sources globales) — ne nécessite pas d'auth. */
export function fetchIntelligenceHealth(signal?: AbortSignal): Promise<IntelligenceHealth> {
  return get<IntelligenceHealth>(`/health/intelligence`, signal);
}

// Transitions de release (require_admin côté API).
export function validateRelease(id: number, passed = true, signal?: AbortSignal): Promise<Release> {
  return post<Release>(`/intelligence/releases/${id}/validate`, { passed }, signal);
}

export function publishRelease(id: number, signal?: AbortSignal): Promise<Release> {
  return post<Release>(`/intelligence/releases/${id}/publish`, undefined, signal);
}

export function supersedeRelease(id: number, signal?: AbortSignal): Promise<Release> {
  return post<Release>(`/intelligence/releases/${id}/supersede`, undefined, signal);
}
