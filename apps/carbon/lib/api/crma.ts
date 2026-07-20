/**
 * lib/api/crma.ts — client des endpoints `/crma/*` (PR-07 : CRMA, aimants
 * permanents et exposition matières critiques).
 *
 * Réutilise `API_BASE_URL` + le porteur de token en mémoire de `lib/api.ts`
 * (JWT posé par use-auth). Types en snake_case, miroir de
 * `apps/api/models/crma.py`.
 *
 * Trois invariants du domaine se lisent directement dans ces types :
 *
 * 1. **Risque ≠ confiance.** `MaterialExposureScore` a deux champs distincts,
 *    `risk_score` et `confidence`. Il n'existe aucun champ combiné — l'UI ne
 *    peut donc pas afficher un « score net » par accident.
 * 2. **Concentration par étape.** `StageConcentration` porte toujours un
 *    `stage_code` ; il n'existe aucun type de concentration sans étape, donc
 *    aucune façon de rendre un chiffre mélangeant extraction et raffinage.
 * 3. **Licence avant affichage.** `MarketObservation.numeric_value` est
 *    `number | null` avec `value_withheld` : quand la licence refuse
 *    l'affichage, le backend ne transmet PAS la valeur. Le front n'a rien à
 *    masquer — il n'a rien reçu.
 */

import { API_BASE_URL, getAuthToken } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types (miroir models/crma.py)
// ---------------------------------------------------------------------------

export type BackendDataStatus = "verified" | "estimated" | "manual" | "inferred";
export type Maturity = "research" | "pilot" | "commercial" | "mature";
export type EventSeverity = "low" | "medium" | "high" | "critical";
export type AssessmentStatus = "draft" | "under_review" | "approved" | "submitted";
export type ActionStatus = "planned" | "in_progress" | "completed" | "cancelled";

export interface ProcessingStage {
  id: number;
  company_id: number | null;
  code: string;
  label: string;
  stage_order: number;
  is_upstream: boolean;
  description: string | null;
}

export interface CountryShare {
  country_code: string;
  share_pct: number;
  data_status: BackendDataStatus;
  source_release_id: number | null;
}

/** Concentration d'UNE étape — jamais « toutes étapes confondues ». */
export interface StageConcentration {
  stage_code: string;
  stage_label: string | null;
  stage_order: number | null;
  is_upstream: boolean;
  reference_year: number | null;
  country_shares: CountryShare[];
  observed_total_pct: number;
  top_country_code: string | null;
  top_country_share_pct: number | null;
  hhi_pct: number | null;
  country_count: number;
  data_status_mix: Record<string, number>;
}

export interface ValueChain {
  material_id: string;
  reference_year: number | null;
  stages: StageConcentration[];
  stages_with_data: number;
  stages_total: number;
}

export interface ScoreComponent {
  code: string;
  label: string;
  available: boolean;
  risk_value: number | null;
  weight: number;
  contribution: number;
  raw_value: number | null;
  raw_unit: string | null;
  rationale: string;
  stage_code: string | null;
}

export interface ConfidenceComponent {
  code: string;
  label: string;
  value: number;
  weight: number;
  rationale: string;
}

export interface MaterialExposureScore {
  material_id: string;
  methodology_code: string;
  methodology_version: string;
  /** Intensité du risque (0-100). Séparé de `confidence` — ne jamais fusionner. */
  risk_score: number | null;
  /** Qualité du socle documentaire (0-100). Ne dit RIEN du niveau de risque. */
  confidence: number;
  coverage_pct: number;
  components: ScoreComponent[];
  confidence_components: ConfidenceComponent[];
  drivers: ScoreComponent[];
  warnings: string[];
  stage_concentrations: StageConcentration[];
  disclaimer: string;
  calculated_at: string | null;
}

export interface ExposureAnalysis {
  data: MaterialExposureScore;
  meta: {
    as_of: string | null;
    status: BackendDataStatus;
    method: Record<string, string>;
    quality: Record<string, unknown>;
  };
  evidence: Array<Record<string, unknown>>;
}

export interface MaterialStatus {
  material_id: string;
  /** Non exclusif : une matière peut être critique ET stratégique. */
  is_critical_eu: boolean;
  is_strategic_eu: boolean;
  regulation_version: string | null;
  group_codes: string[];
  /** Incohérence de référentiel remontée telle quelle, jamais corrigée en silence. */
  strategic_not_critical: boolean;
}

export interface Substitute {
  id: number;
  material_id: string;
  substitute_material_id: string;
  stage_code: string | null;
  application: string | null;
  maturity: Maturity;
  performance_penalty_pct: number | null;
  data_status: BackendDataStatus;
  notes: string | null;
  source_release_id: number | null;
}

export interface RecyclingRoute {
  id: number;
  material_id: string;
  route_code: string;
  label: string;
  input_stage_code: string | null;
  output_stage_code: string | null;
  maturity: Maturity;
  recycled_content_pct: number | null;
  recovery_rate_pct: number | null;
  data_status: BackendDataStatus;
}

export interface TradeEvent {
  id: number;
  material_id: string | null;
  stage_code: string | null;
  country_code: string | null;
  event_type: string;
  severity: EventSeverity;
  title: string;
  description: string | null;
  effective_from: string | null;
  effective_to: string | null;
  data_status: BackendDataStatus;
}

export interface MaterialExposure {
  id: number;
  material_id: string;
  stage_code: string | null;
  bom_item_id: number | null;
  supplier_id: number | null;
  annual_mass_kg: number | null;
  share_of_supply_pct: number | null;
  stock_coverage_days: number | null;
  reference_year: number | null;
  data_status: BackendDataStatus;
  notes: string | null;
}

export interface MitigationAction {
  id: number;
  assessment_id: number | null;
  material_id: string | null;
  target_stage_code: string | null;
  action_type: string;
  title: string;
  description: string | null;
  status: ActionStatus;
  owner: string | null;
  due_date: string | null;
  expected_risk_reduction_pct: number | null;
}

export interface Article24Assessment {
  id: number;
  material_id: string;
  assessment_year: number;
  status: AssessmentStatus;
  risk_score: number | null;
  confidence: number | null;
  coverage_pct: number | null;
  methodology_code: string;
  methodology_version: string;
  regulation_version: string | null;
  warnings: string[];
  calculated_at: string | null;
  approved_by: number | null;
  approved_at: string | null;
}

/** Observation de marché sous licence. */
export interface MarketObservation {
  id: number;
  material_id: string;
  metric_code: string;
  /** `null` quand `display_allowed=false` : la valeur n'est pas transmise. */
  numeric_value: number | null;
  unit: string | null;
  currency: string | null;
  observed_at: string;
  data_status: BackendDataStatus;
  source_release_id: number;
  source_code: string | null;
  display_allowed: boolean;
  derived_use_allowed: boolean;
  value_withheld: boolean;
  license_reasons: string[];
  attribution_text: string | null;
}

interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// ---------------------------------------------------------------------------
// Client
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

export function fetchStages(signal?: AbortSignal): Promise<Paginated<ProcessingStage>> {
  return get<Paginated<ProcessingStage>>("/crma/stages?limit=200", signal);
}

export function fetchMaterialStatus(
  materialId: string,
  signal?: AbortSignal,
): Promise<MaterialStatus> {
  return get<MaterialStatus>(
    `/crma/materials/${encodeURIComponent(materialId)}/status`,
    signal,
  );
}

export function fetchValueChain(
  materialId: string,
  params: { referenceYear?: number } = {},
  signal?: AbortSignal,
): Promise<ValueChain> {
  const q = new URLSearchParams();
  if (params.referenceYear !== undefined) q.set("reference_year", String(params.referenceYear));
  const suffix = q.toString() ? `?${q}` : "";
  return get<ValueChain>(
    `/crma/materials/${encodeURIComponent(materialId)}/value-chain${suffix}`,
    signal,
  );
}

export function fetchExposureScore(
  materialId: string,
  params: { referenceYear?: number } = {},
  signal?: AbortSignal,
): Promise<ExposureAnalysis> {
  const q = new URLSearchParams();
  if (params.referenceYear !== undefined) q.set("reference_year", String(params.referenceYear));
  const suffix = q.toString() ? `?${q}` : "";
  return get<ExposureAnalysis>(
    `/crma/materials/${encodeURIComponent(materialId)}/exposure${suffix}`,
    signal,
  );
}

export function fetchSubstitutes(
  materialId: string,
  signal?: AbortSignal,
): Promise<Paginated<Substitute>> {
  return get<Paginated<Substitute>>(
    `/crma/substitutes?material_id=${encodeURIComponent(materialId)}&limit=200`,
    signal,
  );
}

export function fetchRecyclingRoutes(
  materialId: string,
  signal?: AbortSignal,
): Promise<Paginated<RecyclingRoute>> {
  return get<Paginated<RecyclingRoute>>(
    `/crma/recycling-routes?material_id=${encodeURIComponent(materialId)}&limit=200`,
    signal,
  );
}

export function fetchEvents(
  materialId: string,
  signal?: AbortSignal,
): Promise<Paginated<TradeEvent>> {
  return get<Paginated<TradeEvent>>(
    `/crma/events?material_id=${encodeURIComponent(materialId)}&limit=200`,
    signal,
  );
}

export function fetchExposures(
  materialId: string,
  signal?: AbortSignal,
): Promise<Paginated<MaterialExposure>> {
  return get<Paginated<MaterialExposure>>(
    `/crma/exposures?material_id=${encodeURIComponent(materialId)}&limit=200`,
    signal,
  );
}

export function fetchMarketObservations(
  materialId: string,
  signal?: AbortSignal,
): Promise<Paginated<MarketObservation>> {
  return get<Paginated<MarketObservation>>(
    `/crma/market-observations?material_id=${encodeURIComponent(materialId)}&limit=200`,
    signal,
  );
}

export function fetchAssessments(
  params: { materialId?: string } = {},
  signal?: AbortSignal,
): Promise<Paginated<Article24Assessment>> {
  const q = new URLSearchParams({ limit: "200" });
  if (params.materialId) q.set("material_id", params.materialId);
  return get<Paginated<Article24Assessment>>(`/crma/assessments?${q}`, signal);
}

export function fetchActions(
  params: { materialId?: string; assessmentId?: number } = {},
  signal?: AbortSignal,
): Promise<Paginated<MitigationAction>> {
  const q = new URLSearchParams({ limit: "200" });
  if (params.materialId) q.set("material_id", params.materialId);
  if (params.assessmentId !== undefined) q.set("assessment_id", String(params.assessmentId));
  return get<Paginated<MitigationAction>>(`/crma/actions?${q}`, signal);
}

// ---------------------------------------------------------------------------
// Présentation
// ---------------------------------------------------------------------------

/**
 * Palier de lecture d'un score de risque. Renvoie `null` pour un score absent —
 * il ne faut jamais rendre « 0 / faible » quand la valeur est inconnue.
 */
export function riskBand(
  risk: number | null,
): { label: string; tone: "unknown" | "low" | "moderate" | "high" | "severe" } {
  if (risk === null || Number.isNaN(risk)) {
    return { label: "Non calculé", tone: "unknown" };
  }
  if (risk >= 75) return { label: "Élevé", tone: "severe" };
  if (risk >= 50) return { label: "Notable", tone: "high" };
  if (risk >= 25) return { label: "Modéré", tone: "moderate" };
  return { label: "Faible", tone: "low" };
}

/**
 * Palier de lecture de la CONFIANCE — vocabulaire volontairement différent de
 * celui du risque (« documentation » et non « niveau »), pour qu'un lecteur
 * pressé ne confonde jamais les deux axes.
 */
export function confidenceBand(
  confidence: number,
): { label: string; tone: "weak" | "partial" | "solid" } {
  if (confidence >= 70) return { label: "Documentation solide", tone: "solid" };
  if (confidence >= 40) return { label: "Documentation partielle", tone: "partial" };
  return { label: "Documentation lacunaire", tone: "weak" };
}

/** Formate une part en pourcentage, ou « n. d. » si la donnée manque. */
export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "n. d.";
  return `${value.toFixed(1)} %`;
}
