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
  company_id?: number;
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

// Callback appelé par l'intercepteur 401 pour déclencher la rotation du token
// dans le hook use-auth sans créer de dépendance circulaire.
let _onTokenExpired: (() => Promise<string | null>) | null = null;

export function setAuthToken(token: string | null): void {
  _authToken = token;
}

export function setOnTokenExpired(cb: (() => Promise<string | null>) | null): void {
  _onTokenExpired = cb;
}

function authHeaders(): Record<string, string> {
  return _authToken ? { Authorization: `Bearer ${_authToken}` } : {};
}

// ---------------------------------------------------------------------------
// Fetchers — avec retry automatique sur 401 (rotation silencieuse)
// ---------------------------------------------------------------------------

async function _fetchWithRetry(
  input: RequestInfo,
  init: RequestInit,
): Promise<Response> {
  let res = await fetch(input, { ...init, credentials: "include" });

  // Si 401 et qu'un handler de rotation est enregistré, on tente une rotation
  if (res.status === 401 && _onTokenExpired) {
    const newToken = await _onTokenExpired();
    if (newToken) {
      const newHeaders = {
        ...(init.headers as Record<string, string>),
        Authorization: `Bearer ${newToken}`,
      };
      res = await fetch(input, { ...init, headers: newHeaders, credentials: "include" });
    }
  }
  return res;
}

async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await _fetchWithRetry(`${API_BASE_URL}${path}`, {
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
  const res = await _fetchWithRetry(`${API_BASE_URL}${path}`, {
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

// ---------------------------------------------------------------------------
// Auth endpoints
// ---------------------------------------------------------------------------

export async function loginRequest(
  email: string,
  password: string,
  signal?: AbortSignal
): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include", // reçoit le cookie cc_refresh
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

export async function refreshTokenRequest(signal?: AbortSignal): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { Accept: "application/json" },
    credentials: "include", // envoie le cookie cc_refresh
    signal,
  });
  if (!res.ok) {
    throw new Error(`Refresh failed: ${res.status}`);
  }
  return (await res.json()) as LoginResponse;
}

export async function logoutRequest(signal?: AbortSignal): Promise<void> {
  await fetch(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
    signal,
  }).catch(() => {/* best-effort */});
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
// Admin — companies & users (admin only)
// ---------------------------------------------------------------------------

export interface CompanyOut {
  id: number;
  name: string;
  slug: string;
  naf_code: string | null;
  plan: string;
  created_at: string;
  user_count: number;
}

export interface UserOut {
  id: number;
  company_id: number;
  company_name: string | null;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface CompanyCreate {
  name: string;
  slug: string;
  naf_code?: string;
  plan?: string;
}

export interface UserCreate {
  company_id: number;
  email: string;
  password: string;
  role?: string;
}

export function fetchCompanies(signal?: AbortSignal): Promise<CompanyOut[]> {
  return apiGet<CompanyOut[]>("/admin/companies", signal);
}

export function createCompany(body: CompanyCreate, signal?: AbortSignal): Promise<CompanyOut> {
  return apiSend<CompanyOut>("POST", "/admin/companies", signal, body) as Promise<CompanyOut>;
}

export function fetchUsers(companyId?: number, signal?: AbortSignal): Promise<UserOut[]> {
  const qs = companyId ? `?company_id=${companyId}` : "";
  return apiGet<UserOut[]>(`/admin/users${qs}`, signal);
}

export function createUser(body: UserCreate, signal?: AbortSignal): Promise<UserOut> {
  return apiSend<UserOut>("POST", "/admin/users", signal, body) as Promise<UserOut>;
}

export function deleteUser(userId: number, signal?: AbortSignal): Promise<null> {
  return apiSend<null>("DELETE", `/admin/users/${userId}`, signal) as Promise<null>;
}

export function deleteCompany(companyId: number, signal?: AbortSignal): Promise<null> {
  return apiSend<null>("DELETE", `/admin/companies/${companyId}`, signal) as Promise<null>;
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
// Alertes — règles de notification
// ---------------------------------------------------------------------------

export type AlertOperator = "gt" | "lt" | "gte" | "lte" | "eq";
export type AlertChannel = "webhook" | "email";
export type AlertDomain = "carbon" | "vsme" | "esg" | "finance";

export interface AlertRuleOut {
  id: number;
  company_id: number;
  name: string;
  domain: AlertDomain;
  field_path: string;
  operator: AlertOperator;
  threshold: number;
  channel: AlertChannel;
  destination: string;
  is_active: boolean;
  last_fired_at: string | null;
  created_at: string;
}

export interface AlertRuleCreate {
  name: string;
  domain: AlertDomain;
  field_path: string;
  operator: AlertOperator;
  threshold: number;
  channel: AlertChannel;
  destination: string;
  is_active?: boolean;
}

export interface AlertRulePatch {
  name?: string;
  field_path?: string;
  operator?: AlertOperator;
  threshold?: number;
  channel?: AlertChannel;
  destination?: string;
  is_active?: boolean;
}

export interface AlertFired {
  rule_id: number;
  rule_name: string;
  domain: AlertDomain;
  field_path: string;
  current_value: number;
  threshold: number;
  operator: AlertOperator;
  fired_at: string;
}

export interface AlertEvaluateResponse {
  evaluated: number;
  fired: number;
  alerts: AlertFired[];
}

export interface AlertHistoryResponse {
  total: number;
  limit: number;
  alerts: AlertFired[];
}

export function fetchAlertRules(signal?: AbortSignal): Promise<AlertRuleOut[]> {
  return apiGet<AlertRuleOut[]>("/alerts/rules", signal);
}

export function createAlertRule(body: AlertRuleCreate, signal?: AbortSignal): Promise<AlertRuleOut> {
  return apiSend<AlertRuleOut>("POST", "/alerts/rules", signal, body) as Promise<AlertRuleOut>;
}

export function patchAlertRule(id: number, body: AlertRulePatch, signal?: AbortSignal): Promise<AlertRuleOut> {
  return _fetchWithRetry(`${API_BASE_URL}/alerts/rules/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
    body: JSON.stringify(body),
    signal,
  }).then(async (res) => {
    if (!res.ok) throw new Error(`API ${res.status} on PATCH /alerts/rules/${id}`);
    return res.json() as Promise<AlertRuleOut>;
  });
}

export function deleteAlertRule(id: number, signal?: AbortSignal): Promise<null> {
  return apiSend<null>("DELETE", `/alerts/rules/${id}`, signal) as Promise<null>;
}

export function evaluateAlerts(signal?: AbortSignal): Promise<AlertEvaluateResponse> {
  return apiSend<AlertEvaluateResponse>("POST", "/alerts/evaluate", signal) as Promise<AlertEvaluateResponse>;
}

export function fetchAlertHistory(limit = 20, signal?: AbortSignal): Promise<AlertHistoryResponse> {
  return apiGet<AlertHistoryResponse>(`/alerts/history?limit=${limit}`, signal);
}

// ---------------------------------------------------------------------------
// DPP — Digital Product Passport
// ---------------------------------------------------------------------------

export type EsprStatus = "pending" | "eligible" | "compliant" | "non_compliant";

export interface ProductOut {
  id: number;
  company_id: number;
  name: string;
  sku: string | null;
  sector: string | null;
  pcf_kgco2e: number | null;
  recyclability_pct: number | null;
  lifespan_years: number | null;
  supply_chain: Record<string, unknown> | null;
  espr_status: EsprStatus;
  created_at: string;
  updated_at: string;
}

export interface ProductCreate {
  name: string;
  sku?: string;
  sector?: string;
  pcf_kgco2e?: number;
  recyclability_pct?: number;
  lifespan_years?: number;
  supply_chain?: Record<string, unknown>;
  espr_status?: EsprStatus;
}

export interface ProductPatch {
  name?: string;
  sku?: string;
  sector?: string;
  pcf_kgco2e?: number;
  recyclability_pct?: number;
  lifespan_years?: number;
  supply_chain?: Record<string, unknown>;
  espr_status?: EsprStatus;
}

export function fetchProducts(signal?: AbortSignal): Promise<ProductOut[]> {
  return apiGet<ProductOut[]>("/dpp/products", signal);
}

export function fetchProduct(id: number, signal?: AbortSignal): Promise<ProductOut> {
  return apiGet<ProductOut>(`/dpp/products/${id}`, signal);
}

export function createProduct(body: ProductCreate, signal?: AbortSignal): Promise<ProductOut> {
  return apiSend<ProductOut>("POST", "/dpp/products", signal, body) as Promise<ProductOut>;
}

export function patchProduct(id: number, body: ProductPatch, signal?: AbortSignal): Promise<ProductOut> {
  // PATCH not in apiSend helper — use _fetchWithRetry directly
  return _fetchWithRetry(`${API_BASE_URL}/dpp/products/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
    body: JSON.stringify(body),
    signal,
  }).then(async (res) => {
    if (!res.ok) throw new Error(`API ${res.status} on PATCH /dpp/products/${id}`);
    return res.json() as Promise<ProductOut>;
  });
}

export function deleteProduct(id: number, signal?: AbortSignal): Promise<null> {
  return apiSend<null>("DELETE", `/dpp/products/${id}`, signal) as Promise<null>;
}

// ---------------------------------------------------------------------------
// Excel preview & validation
// ---------------------------------------------------------------------------

export interface SheetPreview {
  name: string;
  row_count: number | null;
  col_count: number | null;
  headers: string[];
  sample_rows: unknown[][];
}

export interface ExcelPreviewResponse {
  filename: string;
  domain: string | null;
  sheet_count: number;
  sheets: SheetPreview[];
  named_ranges: string[];
  detected_domain: string | null;
}

export interface ValidationIssue {
  level: "error" | "warning" | "info";
  message: string;
  sheet?: string | null;
  field?: string | null;
}

export interface ExcelValidateResponse {
  filename: string;
  domain: string | null;
  status: "ok" | "warning" | "error";
  issues: ValidationIssue[];
  named_ranges_found: string[];
  named_ranges_missing: string[];
  sheets_found: string[];
  sheets_missing: string[];
}

export async function previewExcel(
  file: File,
  domain?: string,
  signal?: AbortSignal,
): Promise<ExcelPreviewResponse> {
  const fd = new FormData();
  fd.append("file", file);
  if (domain) fd.append("domain", domain);
  const res = await _fetchWithRetry(`${API_BASE_URL}/excel/preview`, {
    method: "POST",
    headers: { Accept: "application/json", ...authHeaders() },
    body: fd,
    signal,
  });
  if (!res.ok) throw new Error(`Preview failed: ${res.status}`);
  return (await res.json()) as ExcelPreviewResponse;
}

export async function validateExcel(
  file: File,
  domain?: string,
  signal?: AbortSignal,
): Promise<ExcelValidateResponse> {
  const fd = new FormData();
  fd.append("file", file);
  if (domain) fd.append("domain", domain);
  const res = await _fetchWithRetry(`${API_BASE_URL}/excel/validate`, {
    method: "POST",
    headers: { Accept: "application/json", ...authHeaders() },
    body: fd,
    signal,
  });
  if (!res.ok) throw new Error(`Validation failed: ${res.status}`);
  return (await res.json()) as ExcelValidateResponse;
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
