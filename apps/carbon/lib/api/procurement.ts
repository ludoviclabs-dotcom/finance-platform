/**
 * lib/api/procurement.ts — client API achats/fournisseurs (PR-05A + PR-05B).
 *
 * Réutilise `API_BASE_URL` et le token en mémoire (`getAuthToken`) du client
 * principal (`@/lib/api`) — pas de second mécanisme d'auth.
 *
 * PR-05A : socle d'exposition (imports idempotents, file de résolution,
 * déclarations/PCF sourcées).
 * PR-05B : moteur Scope 3 catégorie 1 — runs, couverture, hotspots, sélection
 * humaine, campagnes fournisseurs, score en 5 dimensions, Evidence Pack.
 */

import { API_BASE_URL, getAuthToken } from "@/lib/api";

// ── Types (miroir de apps/api/models/procurement.py) ─────────────────────────

export type MappingStatus = "unmapped" | "mapped" | "needs_review" | "resolved";
export type PurchaseImportStatus = "pending" | "validated" | "emitted" | "rejected";
export type ProcurementDataStatus = "verified" | "estimated" | "manual" | "inferred";
export type ProcurementReviewStatus = "pending" | "accepted" | "flagged";

export interface PurchaseImport {
  id: number;
  company_id: number;
  filename: string;
  sha256: string;
  period_start: string | null;
  period_end: string | null;
  status: PurchaseImportStatus;
  row_count: number;
  accepted_count: number;
  rejected_count: number;
  error_summary: string | null;
  imported_by: number | null;
  imported_at: string;
  updated_at: string;
  already_imported: boolean;
}

export interface PurchaseLine {
  id: number;
  company_id: number;
  import_id: number;
  supplier_id: number | null;
  supplier_external_code: string | null;
  product_id: number | null;
  product_external_code: string | null;
  purchase_date: string | null;
  quantity: number | null;
  unit: string | null;
  spend_amount: number | null;
  currency: string | null;
  category_code: string | null;
  origin_country: string | null;
  raw_row_json: Record<string, unknown>;
  mapping_status: MappingStatus;
  created_at: string;
  updated_at: string;
}

export interface Declaration {
  id: number;
  supplier_id: number;
  supplier_product_id: number | null;
  metric_code: string;
  value: number | null;
  unit: string | null;
  reporting_year: number | null;
  data_status: ProcurementDataStatus;
  review_status: ProcurementReviewStatus;
  observation_id: number | null;
  source_release_id: number | null;
  evidence_artifact_id: number | null;
  created_at: string;
}

export interface Pcf {
  id: number;
  supplier_product_id: number;
  value_kgco2e: number | null;
  declared_unit: string | null;
  verification_status: string | null;
  data_status: ProcurementDataStatus;
  observation_id: number | null;
  source_release_id: number | null;
  evidence_artifact_id: number | null;
  created_at: string;
}

interface ListEnvelope<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface LineResolutionInput {
  line_id: number;
  supplier_id?: number | null;
  product_id?: number | null;
  mapping_status?: MappingStatus;
}

// ── Fetch helpers (auth partagée avec le client principal) ────────────────────

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: { Accept: "application/json", ...authHeaders() },
    credentials: "include",
    signal,
  });
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
  return (await res.json()) as T;
}

async function apiSend<T>(method: "POST", path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
  return (await res.json()) as T;
}

// ── Imports d'achats ─────────────────────────────────────────────────────────

export interface PurchaseImportCreateInput {
  filename: string;
  csv_text: string;
  period_start?: string | null;
  period_end?: string | null;
}

export function createPurchaseImport(body: PurchaseImportCreateInput): Promise<PurchaseImport> {
  return apiSend<PurchaseImport>("POST", "/procurement/imports", body);
}

export async function fetchPurchaseImports(signal?: AbortSignal): Promise<PurchaseImport[]> {
  const env = await apiGet<ListEnvelope<PurchaseImport>>("/procurement/imports?limit=200", signal);
  return env.items;
}

export function fetchPurchaseImport(id: number, signal?: AbortSignal): Promise<PurchaseImport> {
  return apiGet<PurchaseImport>(`/procurement/imports/${id}`, signal);
}

export async function fetchImportLines(
  id: number,
  mappingStatus?: MappingStatus,
  signal?: AbortSignal,
): Promise<PurchaseLine[]> {
  const q = mappingStatus ? `?mapping_status=${mappingStatus}&limit=200` : "?limit=200";
  const env = await apiGet<ListEnvelope<PurchaseLine>>(`/procurement/imports/${id}/lines${q}`, signal);
  return env.items;
}

export async function fetchResolutionQueue(id: number, signal?: AbortSignal): Promise<PurchaseLine[]> {
  const env = await apiGet<ListEnvelope<PurchaseLine>>(
    `/procurement/imports/${id}/resolution-queue?limit=200`,
    signal,
  );
  return env.items;
}

export function resolveImportMappings(
  id: number,
  resolutions: LineResolutionInput[],
): Promise<{ resolved: number; requested: number }> {
  return apiSend("POST", `/procurement/imports/${id}/resolve-mappings`, { resolutions });
}

export function reviewImport(id: number, accept: boolean): Promise<PurchaseImport> {
  return apiSend<PurchaseImport>("POST", `/procurement/imports/${id}/review`, { accept });
}

// ── Déclarations & PCF (sourcées) ─────────────────────────────────────────────

export async function fetchDeclarations(
  supplierId?: number,
  signal?: AbortSignal,
): Promise<Declaration[]> {
  const q = supplierId ? `?supplier_id=${supplierId}&limit=200` : "?limit=200";
  const env = await apiGet<ListEnvelope<Declaration>>(`/procurement/declarations${q}`, signal);
  return env.items;
}

export async function fetchPcfs(supplierProductId?: number, signal?: AbortSignal): Promise<Pcf[]> {
  const q = supplierProductId ? `?supplier_product_id=${supplierProductId}&limit=200` : "?limit=200";
  const env = await apiGet<ListEnvelope<Pcf>>(`/procurement/pcfs${q}`, signal);
  return env.items;
}

/** Part résolue des lignes d'un import (mapped + resolved sur total). */
export function resolvedShare(imp: PurchaseImport, lines: PurchaseLine[]): number {
  if (lines.length === 0) return 0;
  const resolved = lines.filter(
    (l) => l.mapping_status === "mapped" || l.mapping_status === "resolved",
  ).length;
  return Math.round((resolved / lines.length) * 100);
}

// ═══════════════════════════════════════════════════════════════════════════
// PR-05B — Moteur Scope 3 catégorie 1
// ═══════════════════════════════════════════════════════════════════════════

/** Hiérarchie de méthode — miroir exact du Literal Python (rangs 1 à 5). */
export type CalculationMethod =
  | "supplier_pcf_verified"
  | "supplier_specific_hybrid"
  | "average_physical"
  | "spend_based_economic"
  | "unresolved";

export type RunStatus = "calculated" | "approved" | "superseded";
export type HotspotType = "supplier" | "supplier_product" | "category" | "country";
export type SelectionStatus = "selected" | "dismissed" | "campaign_created";

/** Libellés d'affichage — une seule source côté front. */
export const METHOD_LABELS: Record<CalculationMethod, string> = {
  supplier_pcf_verified: "PCF fournisseur vérifiée",
  supplier_specific_hybrid: "Méthode fournisseur spécifique",
  average_physical: "Facteur physique moyen",
  spend_based_economic: "Facteur monétaire (dépense)",
  unresolved: "Non résolu",
};

export const METHOD_RANKS: Record<CalculationMethod, number> = {
  supplier_pcf_verified: 1,
  supplier_specific_hybrid: 2,
  average_physical: 3,
  spend_based_economic: 4,
  unresolved: 5,
};

/** Enveloppe analytique `{data, meta, evidence}` — contrats Wave 2 §4. */
export interface AnalyticalMeta {
  as_of: string | null;
  status: ProcurementDataStatus;
  method: { code: string; version: string };
  quality: {
    confidence: number | null;
    coverage_pct: number | null;
    warnings: string[];
  };
}

export interface EvidenceRef {
  artifact_id: number | null;
  fact_id: number | null;
  source_code: string | null;
  release_key: string | null;
  page_reference: string | null;
  excerpt: string | null;
  note: string | null;
}

export interface AnalyticalEnvelope<T> {
  data: T;
  meta: AnalyticalMeta;
  evidence: EvidenceRef[];
}

export interface CalculationRun {
  id: number;
  company_id: number;
  import_id: number | null;
  period_start: string | null;
  period_end: string | null;
  methodology_code: string;
  methodology_version: string;
  input_fingerprint: string;
  factor_versions: Record<string, string>;
  result: Record<string, unknown>;
  warnings: string[];
  confidence: number | null;
  coverage_pct: number | null;
  line_count: number;
  unresolved_count: number;
  total_tco2e: number | null;
  status: RunStatus;
  calculated_at: string;
  approved_at: string | null;
  already_calculated: boolean;
}

export interface LineResult {
  id: number;
  run_id: number;
  purchase_line_id: number;
  supplier_id: number | null;
  supplier_product_id: number | null;
  calculation_method: CalculationMethod;
  method_rank: number;
  factor_id: string | null;
  factor_version: string | null;
  factor_source: string | null;
  activity_value: number | null;
  activity_unit: string | null;
  converted_value: number | null;
  converted_unit: string | null;
  conversion_factor: number | null;
  conversion_note: string | null;
  result_tco2e: number | null;
  uncertainty_pct: number | null;
  uncertainty_low_tco2e: number | null;
  uncertainty_high_tco2e: number | null;
  data_quality: number | null;
  data_quality_label: string | null;
  confidence: number | null;
  data_status: ProcurementDataStatus;
  /** Non vide dès que `method_rank > 1` — aucun repli n'est silencieux. */
  fallback_reason: string | null;
  warnings: string[];
  method_trace: Array<{
    rank: number;
    method: string;
    outcome: "selected" | "rejected";
    reason: string;
  }>;
  evidence_artifact_id: number | null;
  source_release_id: number | null;
}

export interface MethodBreakdownRow {
  calculation_method: CalculationMethod;
  method_rank: number;
  label: string;
  line_count: number;
  result_tco2e: number | null;
  spend_amount: number | null;
  share_of_lines_pct: number;
  share_of_emissions_pct: number | null;
}

export interface CoverageData {
  run_id: number;
  line_count: number;
  resolved_count: number;
  unresolved_count: number;
  unresolved_spend_amount: number | null;
  coverage_lines_pct: number;
  coverage_spend_pct: number | null;
  total_tco2e: number | null;
  primary_data_share_pct: number;
  methods: MethodBreakdownRow[];
}

export interface TraceStep {
  level: string;
  label: string;
  reference: string | null;
  detail: Record<string, unknown>;
  data_status: ProcurementDataStatus | null;
  observed_at: string | null;
  source_release_id: number | null;
  evidence_artifact_id: number | null;
}

export interface CalculationTrace {
  run_id: number;
  purchase_line_id: number;
  calculation_method: CalculationMethod;
  method_rank: number;
  fallback_reason: string | null;
  result_tco2e: number | null;
  steps: TraceStep[];
  method_trace: LineResult["method_trace"];
  warnings: string[];
}

export interface Hotspot {
  hotspot_type: HotspotType;
  hotspot_key: string;
  hotspot_label: string;
  supplier_id: number | null;
  line_count: number;
  contribution_tco2e: number | null;
  contribution_pct: number | null;
  spend_amount: number | null;
  /** Part non calculée du poste — affichée à côté de la contribution. */
  unresolved_line_count: number;
  unresolved_spend_amount: number | null;
  dominant_method: CalculationMethod | null;
  rank_position: number;
  selection_status: SelectionStatus | null;
  selection_id: number | null;
}

export interface HotspotsData {
  run_id: number;
  hotspot_type: HotspotType;
  total_tco2e: number | null;
  items: Hotspot[];
}

export interface ExposureRow {
  key: string;
  label: string;
  line_count: number;
  spend_amount: number | null;
  mass_kg: number | null;
  contribution_tco2e: number | null;
  contribution_pct: number | null;
  unresolved_line_count: number;
}

export interface ExposureData {
  run_id: number;
  dimension: "materials" | "countries";
  items: ExposureRow[];
}

export interface HotspotSelection {
  id: number;
  run_id: number;
  hotspot_type: HotspotType;
  hotspot_key: string;
  hotspot_label: string | null;
  supplier_id: number | null;
  contribution_tco2e: number | null;
  contribution_pct: number | null;
  rank_position: number | null;
  selection_status: SelectionStatus;
  selection_reason: string | null;
  campaign_id: number | null;
  selected_at: string;
}

export interface CampaignFromHotspot {
  selection: HotspotSelection;
  campaign_id: number;
  campaign_name: string;
  invited_supplier_ids: number[];
}

export type ScoreDimensionCode =
  | "evidence_maturity"
  | "ghg_data_quality"
  | "supply_concentration"
  | "location_exposure"
  | "compliance_response";

export interface ScoreDimension {
  code: ScoreDimensionCode;
  label: string;
  value: number | null;
  scale: string;
  /** Sans cette direction, « 80 » est illisible : excellent ou très exposé ? */
  direction: "higher_is_better" | "higher_is_riskier";
  confidence: number | null;
  basis: string;
  inputs: Record<string, unknown>;
  warnings: string[];
}

/**
 * Cinq dimensions indépendantes. Le backend ne renvoie AUCUN score agrégé et
 * l'interface ne doit pas en fabriquer un : `no_aggregate_score` porte ce refus
 * jusqu'au client.
 */
export interface SupplierScoreCard {
  supplier_id: number;
  supplier_name: string | null;
  dimensions: ScoreDimension[];
  no_aggregate_score: true;
  note: string;
}

// ── Runs ─────────────────────────────────────────────────────────────────────

export interface CalculateInput {
  import_id?: number | null;
  period_start?: string | null;
  period_end?: string | null;
  force_recalculate?: boolean;
}

export function calculateScope3(body: CalculateInput): Promise<CalculationRun> {
  return apiSend<CalculationRun>("POST", "/procurement/calculate", body);
}

export async function fetchRuns(signal?: AbortSignal): Promise<CalculationRun[]> {
  const env = await apiGet<ListEnvelope<CalculationRun>>("/procurement/runs?limit=200", signal);
  return env.items;
}

export function fetchRun(runId: number, signal?: AbortSignal): Promise<CalculationRun> {
  return apiGet<CalculationRun>(`/procurement/runs/${runId}`, signal);
}

export function approveRun(runId: number): Promise<CalculationRun> {
  return apiSend<CalculationRun>("POST", `/procurement/runs/${runId}/approve`, {});
}

export async function fetchRunLines(
  runId: number,
  method?: CalculationMethod,
  signal?: AbortSignal,
): Promise<LineResult[]> {
  const q = method ? `?calculation_method=${method}&limit=200` : "?limit=200";
  const env = await apiGet<ListEnvelope<LineResult>>(
    `/procurement/runs/${runId}/lines${q}`,
    signal,
  );
  return env.items;
}

export function fetchRunCoverage(
  runId: number,
  signal?: AbortSignal,
): Promise<AnalyticalEnvelope<CoverageData>> {
  return apiGet<AnalyticalEnvelope<CoverageData>>(
    `/procurement/runs/${runId}/coverage`,
    signal,
  );
}

export function fetchCalculationTrace(
  runId: number,
  lineId: number,
  signal?: AbortSignal,
): Promise<AnalyticalEnvelope<CalculationTrace>> {
  return apiGet<AnalyticalEnvelope<CalculationTrace>>(
    `/procurement/runs/${runId}/trace/${lineId}`,
    signal,
  );
}

/** URL de téléchargement de l'Evidence Pack (le proxy authentifié sert le ZIP). */
export function evidencePackUrl(runId: number): string {
  return `${API_BASE_URL}/procurement/runs/${runId}/evidence-pack`;
}

/** Télécharge l'Evidence Pack en portant le jeton d'auth (pas d'URL signée). */
export async function downloadEvidencePack(runId: number): Promise<Blob> {
  const res = await fetch(evidencePackUrl(runId), {
    method: "GET",
    headers: { ...authHeaders() },
    credentials: "include",
  });
  if (!res.ok) throw new Error(`API ${res.status} on evidence-pack`);
  return res.blob();
}

// ── Hotspots ─────────────────────────────────────────────────────────────────

export function fetchHotspots(
  runId: number,
  hotspotType: HotspotType = "supplier",
  signal?: AbortSignal,
): Promise<AnalyticalEnvelope<HotspotsData>> {
  return apiGet<AnalyticalEnvelope<HotspotsData>>(
    `/procurement/hotspots?run_id=${runId}&hotspot_type=${hotspotType}&limit=20`,
    signal,
  );
}

export function fetchExposure(
  runId: number,
  dimension: "materials" | "countries",
  signal?: AbortSignal,
): Promise<AnalyticalEnvelope<ExposureData>> {
  return apiGet<AnalyticalEnvelope<ExposureData>>(
    `/procurement/exposures/${dimension}?run_id=${runId}&limit=50`,
    signal,
  );
}

export interface SelectHotspotInput {
  run_id: number;
  hotspot_type: HotspotType;
  hotspot_key: string;
  hotspot_label?: string | null;
  selection_status?: SelectionStatus;
  selection_reason?: string | null;
}

export function selectHotspot(body: SelectHotspotInput): Promise<HotspotSelection> {
  return apiSend<HotspotSelection>("POST", "/procurement/hotspots/select", body);
}

export async function fetchHotspotSelections(
  runId: number,
  signal?: AbortSignal,
): Promise<HotspotSelection[]> {
  const env = await apiGet<ListEnvelope<HotspotSelection>>(
    `/procurement/hotspots/selections?run_id=${runId}&limit=200`,
    signal,
  );
  return env.items;
}

export function createCampaignFromHotspot(
  selectionId: number,
  body: { campaign_name: string; exercise_year?: number | null; deadline?: string | null },
): Promise<CampaignFromHotspot> {
  return apiSend<CampaignFromHotspot>(
    "POST",
    `/procurement/hotspots/selections/${selectionId}/campaign`,
    body,
  );
}

// ── Score fournisseur (5 dimensions) ─────────────────────────────────────────

export function fetchSupplierScoreCard(
  supplierId: number,
  runId?: number,
  signal?: AbortSignal,
): Promise<SupplierScoreCard> {
  const q = runId ? `?run_id=${runId}` : "";
  return apiGet<SupplierScoreCard>(`/suppliers/${supplierId}/risk${q}`, signal);
}
