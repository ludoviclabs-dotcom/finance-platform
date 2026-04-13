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
// VSME snapshot — mirrors apps/api/models/vsme.py
// ---------------------------------------------------------------------------

export interface VsmeProfileSnapshot {
  raisonSociale: unknown;
  secteurNaf: unknown;
  etp: unknown;
  caNet: unknown;
  anneeReporting: unknown;
  pays: unknown;
  perimetre: unknown;
}

export interface VsmeEnvironSnapshot {
  scope1Tco2e: unknown;
  scope2LbTco2e: unknown;
  scope2MbTco2e: unknown;
  scope3Tco2e: unknown;
  totalGesTco2e: unknown;
  intensiteCaGes: unknown;
  energieMwh: unknown;
  partEnrPct: unknown;
  eauM3: unknown;
  dechetsTonnes: unknown;
  valorisationDechetsPct: unknown;
  planReductionGes: unknown;
}

export interface VsmeSocialSnapshot {
  effectifTotal: unknown;
  pctCdi: unknown;
  tauxRotation: unknown;
  ltir: unknown;
  formationHEtp: unknown;
  ecartSalaireHf: unknown;
  pctFemmesMgmt: unknown;
  diversite: unknown;
  dialogueSocial: unknown;
  litigesSociaux: unknown;
}

export interface VsmeGovSnapshot {
  antiCorruption: unknown;
  formationEthique: unknown;
  whistleblowing: unknown;
  pctCaIndependants: unknown;
  protectionDonnees: unknown;
}

export interface VsmeCompletudeSnapshot {
  indicateursCompletes: number;
  totalIndicateurs: number;
  scorePct: number;
  statut: string;
}

export interface VsmeSnapshot {
  snapshotVersion: string;
  generatedAt: string;
  completude: VsmeCompletudeSnapshot;
  profile: VsmeProfileSnapshot;
  environnement: VsmeEnvironSnapshot;
  social: VsmeSocialSnapshot;
  gouvernance: VsmeGovSnapshot;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// ESG snapshot — mirrors apps/api/models/esg.py
// ---------------------------------------------------------------------------

export interface MaterialiteIssue {
  code: string;
  label: string;
  categorie: string;
  normeEsrs: string;
  scoreImpact: unknown;
  scoreProbabilite: unknown;
  scoreImpactTotal: unknown;
  materiel: boolean | null;
}

export interface MaterialiteSnapshot {
  enjeuxEvalues: number;
  enjeuxMateriels: number;
  enjeuxNonMateriels: number;
  enjeuxMaterielsE: number;
  enjeuxMaterielsS: number;
  enjeuxMaterielsG: number;
  issues: MaterialiteIssue[];
}

export interface EsgScoreSnapshot {
  scoreGlobal: unknown;
  scoreE: unknown;
  scoreS: unknown;
  scoreG: unknown;
  enjeuxMateriels: unknown;
  statut: string | null;
}

export interface EsgQcControl {
  id: string;
  label: string;
  statut: "OK" | "WARNING" | "ERROR" | "INFO" | "UNKNOWN" | string | null;
  criticite: "Bloquant" | "Avert." | "Info" | string | null;
  action: string | null;
}

export interface EsgSnapshot {
  snapshotVersion: string;
  generatedAt: string;
  scores: EsgScoreSnapshot;
  materialite: MaterialiteSnapshot;
  qcControls: EsgQcControl[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Finance snapshot — mirrors apps/api/models/finance.py
// ---------------------------------------------------------------------------

export interface FinanceClimatSnapshot {
  prixEts: unknown;
  expositionTotaleEur: unknown;
  cagrPrixCarbone: unknown;
  capexDecarbS12Eur: unknown;
  capexDecarbS3Eur: unknown;
  greenCapexPct: unknown;
  statutAlignementParis: unknown;
}

export interface SfdrPaiSnapshot {
  pai1_totalGes: unknown;
  pai2_empreinteCarbone: unknown;
  pai3_intensiteGes: unknown;
  pai4_combustiblesFossilesPct: unknown;
  pai5_partEnrNonRenouvelablePct: unknown;
  pai6_intensiteEnergie: unknown;
  pai7_biodiversite: unknown;
  pai8_rejetsEau: unknown;
  pai9_dechetsDangPct: unknown;
  pai10_violationsUngc: unknown;
  pai11_absenceConformiteUngc: unknown;
  pai12_ecartSalaireHf: unknown;
  pai13_diversiteGenreGouv: unknown;
  pai14_armesControversees: unknown;
  scoreEsgInvestisseur: unknown;
}

export interface BenchmarkIndicateur {
  label: string;
  valeurClient: unknown;
  medianneSecteur: unknown;
  top25Pct: unknown;
  ecartPct: unknown;
  position: "Leader" | "Bon" | "Moyen" | "À améliorer" | "N/A" | string | null;
}

export interface BenchmarkSnapshot {
  secteurNaf: unknown;
  indicateurs: BenchmarkIndicateur[];
  nbLeader: number;
  nbAAmeliorer: number;
}

export interface FinanceQcControl {
  id: string;
  label: string;
  statut: "OK" | "WARNING" | "ERROR" | "INFO" | "UNKNOWN" | string | null;
  criticite: "Bloquant" | "Avert." | "Info" | string | null;
  action: string | null;
}

export interface FinanceSnapshot {
  snapshotVersion: string;
  generatedAt: string;
  financeClimat: FinanceClimatSnapshot;
  sfdrPai: SfdrPaiSnapshot;
  benchmark: BenchmarkSnapshot;
  qcControls: FinanceQcControl[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Ingest / cache status
// ---------------------------------------------------------------------------

export interface IngestDomainResult {
  domain: "carbon" | "vsme" | "esg" | "finance" | string;
  status: "ok" | "error" | string;
  detail?: string | null;
  cachedAt?: string | null;
}

export interface IngestResponse {
  status: "ok" | "partial" | string;
  domains: IngestDomainResult[];
}

export interface CacheDomainStatus {
  exists: boolean;
  cachedAt?: string;
  ageSeconds?: number;
  stale?: boolean;
  error?: string;
}

export interface CacheStatusResponse {
  domains: Record<string, CacheDomainStatus>;
}

// ---------------------------------------------------------------------------
// Auth types
// ---------------------------------------------------------------------------

export interface AuthUser {
  email: string;
  role: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresAt: string;
  user: AuthUser;
}

export interface MeResponse {
  user: AuthUser;
}

// ---------------------------------------------------------------------------
// Token holder — set by use-auth on login/rehydrate, read by every request
// so protected endpoints (VSME/ESG/Finance/Carbon...) carry the bearer token
// without threading it through hooks.
// ---------------------------------------------------------------------------

let _authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  _authToken = token;
}

function authHeaders(): Record<string, string> {
  return _authToken ? { Authorization: `Bearer ${_authToken}` } : {};
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: { Accept: "application/json", ...authHeaders() },
    signal,
  });
  if (!res.ok) {
    throw new Error(`API ${res.status} on ${path}`);
  }
  return (await res.json()) as T;
}

async function apiSend<T>(
  method: "POST" | "DELETE",
  path: string,
  signal?: AbortSignal,
  body?: unknown
): Promise<T | null> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...authHeaders(),
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });
  if (!res.ok) {
    throw new Error(`API ${res.status} on ${path}`);
  }
  if (res.status === 204) return null;
  return (await res.json()) as T;
}

// --- Auth ---
export async function loginRequest(
  email: string,
  password: string,
  signal?: AbortSignal
): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
    signal,
  });
  if (res.status === 401) {
    throw new Error("Email ou mot de passe incorrect.");
  }
  if (!res.ok) {
    throw new Error(`API ${res.status} on /auth/login`);
  }
  return (await res.json()) as LoginResponse;
}

export function fetchMe(signal?: AbortSignal): Promise<MeResponse> {
  return apiGet<MeResponse>("/auth/me", signal);
}

// --- Carbon ---
export function fetchCarbonSnapshot(signal?: AbortSignal): Promise<CarbonSnapshot> {
  return apiGet<CarbonSnapshot>("/carbon/snapshot", signal);
}

export function fetchCarbonValidation(signal?: AbortSignal): Promise<CarbonValidation> {
  return apiGet<CarbonValidation>("/carbon/validate", signal);
}

// --- VSME ---
export function fetchVsmeSnapshot(signal?: AbortSignal): Promise<VsmeSnapshot> {
  return apiGet<VsmeSnapshot>("/vsme/snapshot", signal);
}

// --- ESG ---
export function fetchEsgSnapshot(signal?: AbortSignal): Promise<EsgSnapshot> {
  return apiGet<EsgSnapshot>("/esg/snapshot", signal);
}

// --- Finance ---
export function fetchFinanceSnapshot(signal?: AbortSignal): Promise<FinanceSnapshot> {
  return apiGet<FinanceSnapshot>("/finance/snapshot", signal);
}

// --- Ingest / cache ---
export function fetchCacheStatus(signal?: AbortSignal): Promise<CacheStatusResponse> {
  return apiGet<CacheStatusResponse>("/ingest/status", signal);
}

export function triggerIngest(signal?: AbortSignal): Promise<IngestResponse> {
  return apiSend<IngestResponse>("POST", "/ingest", signal) as Promise<IngestResponse>;
}

export function invalidateCache(
  domain?: "carbon" | "vsme" | "esg" | "finance",
  signal?: AbortSignal
): Promise<null> {
  const qs = domain ? `?domain=${domain}` : "";
  return apiSend<null>("DELETE", `/ingest/cache${qs}`, signal) as Promise<null>;
}

// ---------------------------------------------------------------------------
// Audit journal
// ---------------------------------------------------------------------------

export type AuditEventType =
  | "ingest"
  | "upload"
  | "cache_clear"
  | "login"
  | "export"
  | "validation"
  | "error";

export type AuditEventStatus = "ok" | "warning" | "error";

export interface AuditEvent {
  id: string;
  timestamp: string;
  type: AuditEventType;
  title: string;
  status: AuditEventStatus;
  detail?: string | null;
  user?: string | null;
  meta?: Record<string, unknown> | null;
}

export interface AuditListResponse {
  total: number;
  events: AuditEvent[];
}

export interface LogEventRequest {
  type: AuditEventType;
  title: string;
  detail?: string;
  status?: AuditEventStatus;
  meta?: Record<string, unknown>;
  user?: string;
}

export function fetchAuditEvents(
  opts?: { limit?: number; type?: AuditEventType },
  signal?: AbortSignal
): Promise<AuditListResponse> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.type) params.set("type", opts.type);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return apiGet<AuditListResponse>(`/audit/events${qs}`, signal);
}

export function logAuditEvent(
  body: LogEventRequest,
  signal?: AbortSignal
): Promise<AuditEvent> {
  return apiSend<AuditEvent>("POST", "/audit/event", signal, body) as Promise<AuditEvent>;
}

// ---------------------------------------------------------------------------
// Snapshot history (PostgreSQL mode)
// ---------------------------------------------------------------------------

export interface SnapshotHistoryEntry {
  id: number;
  version: number;
  generatedAt: string;
  source: string;
  summary: Record<string, unknown>;
}

export interface SnapshotHistoryResponse {
  domain: string;
  available: boolean;
  entries: SnapshotHistoryEntry[];
}

export interface SnapshotVersionDetail {
  id: number;
  version: number;
  domain: string;
  generatedAt: string;
  source: string;
  data: Record<string, unknown>;
}

export function fetchSnapshotHistory(
  domain: "carbon" | "vsme" | "esg" | "finance",
  limit = 10,
  signal?: AbortSignal
): Promise<SnapshotHistoryResponse> {
  return apiGet<SnapshotHistoryResponse>(`/history/${domain}?limit=${limit}`, signal);
}

export function fetchSnapshotVersion(
  domain: "carbon" | "vsme" | "esg" | "finance",
  entryId: number,
  signal?: AbortSignal
): Promise<SnapshotVersionDetail> {
  return apiGet<SnapshotVersionDetail>(`/history/${domain}/${entryId}`, signal);
}

// ---------------------------------------------------------------------------
// Report PDF — server-side generation
// ---------------------------------------------------------------------------

/**
 * Request server-side PDF generation from FastAPI.
 * Returns a Blob that can be downloaded via URL.createObjectURL.
 */
export async function generateReportPdf(
  domain: "esg-synthesis" = "esg-synthesis",
  signal?: AbortSignal
): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}/report/generate?domain=${domain}`, {
    method: "POST",
    headers: { Accept: "application/pdf", ...authHeaders() },
    signal,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`PDF generation failed (${res.status}): ${detail}`);
  }
  return res.blob();
}
