/**
 * lib/api/nature.ts — client des endpoints `/nature/*` (PR-09 : biodiversité,
 * TNFD LEAP, risques et opportunités nature).
 *
 * Réutilise `API_BASE_URL` + le porteur de token en mémoire de `lib/api.ts`,
 * et `SchemaNotReadyError` de `lib/api/water.ts` (classe générique, pas
 * spécifique à l'eau — PR-09 ship aussi avant garantie que 038/039 soient
 * appliquées, même motif que PR-08). Types en snake_case, miroir de
 * `apps/api/models/nature.py`.
 *
 * Invariants du domaine lisibles dans ces types :
 *
 * 1. **Proximité ≠ conclusion.** `SiteNatureIntersection.matched` est un FAIT
 *    géométrique, jamais un score — ce type ne porte aucun champ de risque.
 * 2. **Dépendance ≠ impact.** `NatureDependency` et `NatureImpact` sont deux
 *    interfaces SANS champ métier commun (ecosystem_service/dependency_level
 *    d'un côté, pressure_type/impact_kind/magnitude_qualitative de l'autre).
 * 3. **Risque, aléa et confiance ne se fusionnent jamais.** `risk_score`,
 *    `likelihood` et `confidence` sont trois champs indépendants sur
 *    `NatureRiskSummary` — aucun champ combiné n'existe.
 * 4. **Un brouillon TNFD reste un brouillon.**
 *    `TnfdDisclosureDraft.is_official_tnfd_disclosure` est TOUJOURS `false`
 *    (verrouillé côté serveur) — l'UI l'affiche en bandeau permanent, jamais
 *    masquable.
 * 5. **Schéma pas encore migré.** Le backend répond 503 `schema_not_ready`
 *    tant que 038/039 ne sont pas appliquées en production : le client le
 *    traduit en `SchemaNotReadyError`, rendu comme « initialisation du
 *    schéma en cours » — jamais une erreur brute.
 */

import { API_BASE_URL, getAuthToken } from "@/lib/api";
import { SchemaNotReadyError } from "@/lib/api/water";

export { SchemaNotReadyError };

// ---------------------------------------------------------------------------
// Types (miroir models/nature.py)
// ---------------------------------------------------------------------------

export type ReviewStatus = "pending" | "accepted" | "flagged";
export type Sensitivity = "public" | "internal" | "confidential" | "restricted";
export type FeatureKind = "protected_area" | "kba" | "ecosystem" | "other";
export type MethodCode =
  | "geojson_point_in_polygon_v1"
  | "geojson_bbox_prefilter_v1"
  | "manual_coordinates_v1";
export type EcosystemService = "freshwater" | "pollination" | "soil_stability" | "other";
export type QualitativeLevel = "low" | "medium" | "high" | "critical";
export type PressureType =
  | "land_use_change"
  | "water_use"
  | "resource_exploitation"
  | "climate_change"
  | "pollution"
  | "invasive_species"
  | "other";
export type ImpactKind = "positive" | "negative";
export type LeapPhase = "locate" | "evaluate" | "assess" | "prepare" | "completed";
export type AssessmentStatus = "draft" | "under_review" | "approved";
export type ActionType =
  | "restoration"
  | "habitat_protection"
  | "species_monitoring"
  | "pollution_reduction"
  | "water_management"
  | "sourcing_change"
  | "other";
export type ActionStatus = "planned" | "in_progress" | "completed" | "cancelled";
export type DisclosureStatus = "draft" | "under_review" | "approved";

export interface NatureFeature {
  id: number;
  company_id: number | null;
  code: string;
  label: string;
  feature_kind: FeatureKind;
  sensitivity: Sensitivity;
  bbox_min_lat: number | null;
  bbox_max_lat: number | null;
  bbox_min_lon: number | null;
  bbox_max_lon: number | null;
  boundary_geojson: Record<string, unknown> | null;
  /** `true` = géométrie retirée côté serveur (confidential/restricted) — ne
   * JAMAIS interpréter `boundary_geojson === null` autrement. */
  geometry_withheld: boolean;
  data_status: string;
}

export interface SiteNatureIntersection {
  id: number;
  site_id: number;
  feature_id: number;
  feature_code: string | null;
  feature_kind: FeatureKind | null;
  method_code: MethodCode;
  bbox_candidate: boolean;
  matched: boolean;
  review_status: ReviewStatus;
  computed_at: string;
}

export interface NatureDependency {
  id: number;
  site_id: number | null;
  bom_item_id: number | null;
  material_id: string | null;
  ecosystem_service: EcosystemService;
  dependency_level: QualitativeLevel;
  rationale: string | null;
  review_status: ReviewStatus;
}

export interface NatureImpact {
  id: number;
  site_id: number | null;
  bom_item_id: number | null;
  material_id: string | null;
  pressure_type: PressureType;
  impact_kind: ImpactKind;
  magnitude_qualitative: QualitativeLevel;
  rationale: string | null;
  review_status: ReviewStatus;
}

export interface LeapAssessment {
  id: number;
  label: string;
  phase: LeapPhase;
  status: AssessmentStatus;
  site_ids: number[];
  approved_by: number | null;
}

/** Composante inspectable d'un score — jamais un total opaque. */
export interface ScoreComponent {
  code: string;
  label: string;
  available: boolean;
  value: number | null;
  weight: number;
  contribution: number;
  rationale: string;
}

export interface AnalyticalMeta {
  as_of: string | null;
  status: string;
  method: { code: string; version: string };
  quality: { confidence: number | null; coverage_pct: number | null; warnings: string[] };
}

export interface EvidenceRef {
  source_code: string | null;
  note: string | null;
}

export interface NatureRiskSummary {
  id: number;
  assessment_id: number;
  site_id: number | null;
  title: string;
  methodology_code: string;
  methodology_version: string;
  risk_score: number | null;
  likelihood: QualitativeLevel | null;
  confidence: number | null;
  components: ScoreComponent[];
  warnings: string[];
  review_status: ReviewStatus;
  calculated_at: string | null;
}

export interface NatureRiskEnvelope {
  data: {
    risk_id: number;
    assessment_id: number;
    site_id: number | null;
    title: string;
    methodology_code: string;
    methodology_version: string;
    risk_score: number | null;
    likelihood: QualitativeLevel | null;
    components: ScoreComponent[];
    input_fingerprint: string;
    calculated_at: string;
  };
  meta: AnalyticalMeta;
  evidence: EvidenceRef[];
}

export interface NatureOpportunitySummary {
  id: number;
  assessment_id: number;
  site_id: number | null;
  title: string;
  methodology_code: string;
  methodology_version: string;
  opportunity_score: number | null;
  likelihood: QualitativeLevel | null;
  confidence: number | null;
  components: ScoreComponent[];
  warnings: string[];
  review_status: ReviewStatus;
  calculated_at: string | null;
}

export interface NatureOpportunityEnvelope {
  data: {
    opportunity_id: number;
    assessment_id: number;
    site_id: number | null;
    title: string;
    methodology_code: string;
    methodology_version: string;
    opportunity_score: number | null;
    likelihood: QualitativeLevel | null;
    components: ScoreComponent[];
    input_fingerprint: string;
    calculated_at: string;
  };
  meta: AnalyticalMeta;
  evidence: EvidenceRef[];
}

export interface NatureAction {
  id: number;
  risk_id: number | null;
  opportunity_id: number | null;
  assessment_id: number | null;
  action_type: ActionType;
  title: string;
  status: ActionStatus;
  expected_risk_reduction_pct: number | null;
  review_status: ReviewStatus;
}

export interface TnfdDisclosureSection {
  section_code: string;
  title: string;
  content: string;
  data_status: string | null;
}

export interface TnfdDisclosureDraft {
  id: number;
  assessment_id: number;
  title: string;
  sections: TnfdDisclosureSection[];
  /** TOUJOURS `false` — verrouillé côté serveur (CHECK 039). */
  is_official_tnfd_disclosure: boolean;
  disclaimer: string;
  status: DisclosureStatus;
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

// ── Référentiel nature_features ─────────────────────────────────────────────

export function fetchNatureFeatures(signal?: AbortSignal): Promise<Paginated<NatureFeature>> {
  return get<Paginated<NatureFeature>>("/nature/features?limit=200", signal);
}

/** Géométrie PRÉCISE — réservée `require_admin` côté serveur (403 sinon). */
export function fetchNatureFeatureGeometry(featureId: number): Promise<NatureFeature> {
  return get<NatureFeature>(`/nature/features/${featureId}/geometry`);
}

// ── Locate ───────────────────────────────────────────────────────────────────

export function locateSite(siteId: number): Promise<SiteNatureIntersection[]> {
  return post<SiteNatureIntersection[]>(`/nature/sites/${siteId}/locate`, {});
}

export function fetchSiteIntersections(
  siteId: number,
  signal?: AbortSignal,
): Promise<Paginated<SiteNatureIntersection>> {
  return get<Paginated<SiteNatureIntersection>>(
    `/nature/sites/${siteId}/intersections?limit=100`,
    signal,
  );
}

export function reviewIntersection(
  intersectionId: number,
  accept: boolean,
): Promise<SiteNatureIntersection> {
  return post<SiteNatureIntersection>(`/nature/intersections/${intersectionId}/review`, { accept });
}

// ── Evaluate : dépendances (JAMAIS fusionnées avec les impacts) ────────────

export function fetchNatureDependencies(
  signal?: AbortSignal,
): Promise<Paginated<NatureDependency>> {
  return get<Paginated<NatureDependency>>("/nature/dependencies?limit=200", signal);
}

export function createNatureDependency(body: {
  ecosystem_service: EcosystemService;
  dependency_level: QualitativeLevel;
  site_id?: number;
  rationale?: string;
}): Promise<NatureDependency> {
  return post<NatureDependency>("/nature/dependencies", body);
}

export function reviewNatureDependency(
  dependencyId: number,
  accept: boolean,
): Promise<NatureDependency> {
  return post<NatureDependency>(`/nature/dependencies/${dependencyId}/review`, { accept });
}

// ── Evaluate : impacts (JAMAIS fusionnés avec les dépendances) ─────────────

export function fetchNatureImpacts(signal?: AbortSignal): Promise<Paginated<NatureImpact>> {
  return get<Paginated<NatureImpact>>("/nature/impacts?limit=200", signal);
}

export function createNatureImpact(body: {
  pressure_type: PressureType;
  impact_kind: ImpactKind;
  magnitude_qualitative: QualitativeLevel;
  site_id?: number;
  rationale?: string;
}): Promise<NatureImpact> {
  return post<NatureImpact>("/nature/impacts", body);
}

export function reviewNatureImpact(impactId: number, accept: boolean): Promise<NatureImpact> {
  return post<NatureImpact>(`/nature/impacts/${impactId}/review`, { accept });
}

// ── Dossiers LEAP ────────────────────────────────────────────────────────────

export function fetchLeapAssessments(signal?: AbortSignal): Promise<Paginated<LeapAssessment>> {
  return get<Paginated<LeapAssessment>>("/nature/leap-assessments?limit=100", signal);
}

export function createLeapAssessment(label: string, siteIds: number[] = []): Promise<LeapAssessment> {
  return post<LeapAssessment>("/nature/leap-assessments", { label, site_ids: siteIds });
}

export function advanceLeapPhase(
  assessmentId: number,
  targetPhase: LeapPhase,
): Promise<LeapAssessment> {
  return post<LeapAssessment>(`/nature/leap-assessments/${assessmentId}/advance-phase`, {
    target_phase: targetPhase,
  });
}

export function reviewLeapAssessment(assessmentId: number, accept: boolean): Promise<LeapAssessment> {
  return post<LeapAssessment>(`/nature/leap-assessments/${assessmentId}/review`, { accept });
}

// ── Assess : risques et opportunités (AnalyticalEnvelope, risque ≠ confiance) ─

export function fetchNatureRisks(
  assessmentId?: number,
  signal?: AbortSignal,
): Promise<Paginated<NatureRiskSummary>> {
  const qs = assessmentId ? `&assessment_id=${assessmentId}` : "";
  return get<Paginated<NatureRiskSummary>>(`/nature/risks?limit=100${qs}`, signal);
}

export function calculateNatureRisk(
  assessmentId: number,
  title: string,
  siteId?: number,
  likelihood?: QualitativeLevel,
): Promise<NatureRiskEnvelope> {
  return post<NatureRiskEnvelope>("/nature/risks/calculate", {
    assessment_id: assessmentId,
    title,
    site_id: siteId ?? null,
    likelihood: likelihood ?? null,
  });
}

export function reviewNatureRisk(riskId: number, accept: boolean): Promise<NatureRiskSummary> {
  return post<NatureRiskSummary>(`/nature/risks/${riskId}/review`, { accept });
}

export function fetchNatureOpportunities(
  assessmentId?: number,
  signal?: AbortSignal,
): Promise<Paginated<NatureOpportunitySummary>> {
  const qs = assessmentId ? `&assessment_id=${assessmentId}` : "";
  return get<Paginated<NatureOpportunitySummary>>(`/nature/opportunities?limit=100${qs}`, signal);
}

export function calculateNatureOpportunity(
  assessmentId: number,
  title: string,
  siteId?: number,
  likelihood?: QualitativeLevel,
): Promise<NatureOpportunityEnvelope> {
  return post<NatureOpportunityEnvelope>("/nature/opportunities/calculate", {
    assessment_id: assessmentId,
    title,
    site_id: siteId ?? null,
    likelihood: likelihood ?? null,
  });
}

export function reviewNatureOpportunity(
  opportunityId: number,
  accept: boolean,
): Promise<NatureOpportunitySummary> {
  return post<NatureOpportunitySummary>(`/nature/opportunities/${opportunityId}/review`, { accept });
}

// ── Prepare : actions et brouillons TNFD ────────────────────────────────────

export function fetchNatureActions(
  assessmentId?: number,
  signal?: AbortSignal,
): Promise<Paginated<NatureAction>> {
  const qs = assessmentId ? `&assessment_id=${assessmentId}` : "";
  return get<Paginated<NatureAction>>(`/nature/actions?limit=100${qs}`, signal);
}

export function createNatureAction(body: {
  action_type: ActionType;
  title: string;
  risk_id?: number;
  opportunity_id?: number;
  assessment_id?: number;
  expected_risk_reduction_pct?: number;
}): Promise<NatureAction> {
  return post<NatureAction>("/nature/actions", body);
}

export function reviewNatureAction(actionId: number, accept: boolean): Promise<NatureAction> {
  return post<NatureAction>(`/nature/actions/${actionId}/review`, { accept });
}

export function fetchDisclosureDrafts(
  assessmentId?: number,
  signal?: AbortSignal,
): Promise<Paginated<TnfdDisclosureDraft>> {
  const qs = assessmentId ? `&assessment_id=${assessmentId}` : "";
  return get<Paginated<TnfdDisclosureDraft>>(`/nature/disclosure-drafts?limit=50${qs}`, signal);
}

export function createDisclosureDraft(
  assessmentId: number,
  title: string,
): Promise<TnfdDisclosureDraft> {
  return post<TnfdDisclosureDraft>("/nature/disclosure-drafts", {
    assessment_id: assessmentId,
    title,
  });
}

/** Approbation interne — réservée `require_admin` côté serveur (403 sinon).
 * N'affecte JAMAIS `is_official_tnfd_disclosure` (reste `false`). */
export function reviewDisclosureDraft(
  draftId: number,
  accept: boolean,
): Promise<TnfdDisclosureDraft> {
  return post<TnfdDisclosureDraft>(`/nature/disclosure-drafts/${draftId}/review`, { accept });
}

// ---------------------------------------------------------------------------
// Présentation
// ---------------------------------------------------------------------------

export const QUALITATIVE_LABEL: Record<QualitativeLevel, string> = {
  low: "Faible",
  medium: "Moyen",
  high: "Élevé",
  critical: "Critique",
};

export const QUALITATIVE_TONE: Record<QualitativeLevel, string> = {
  low: "text-emerald-600 dark:text-emerald-400",
  medium: "text-amber-600 dark:text-amber-400",
  high: "text-orange-600 dark:text-orange-400",
  critical: "text-red-600 dark:text-red-400",
};

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  pending: "En attente de revue",
  accepted: "Acceptée",
  flagged: "Signalée",
};

export const FEATURE_KIND_LABEL: Record<FeatureKind, string> = {
  protected_area: "Aire protégée",
  kba: "Zone clé pour la biodiversité (KBA)",
  ecosystem: "Écosystème",
  other: "Autre",
};

export const LEAP_PHASE_LABEL: Record<LeapPhase, string> = {
  locate: "Localiser",
  evaluate: "Évaluer",
  assess: "Analyser",
  prepare: "Préparer",
  completed: "Terminé",
};

export const IMPACT_KIND_LABEL: Record<ImpactKind, string> = {
  positive: "Positif",
  negative: "Négatif",
};

export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  planned: "Planifiée",
  in_progress: "En cours",
  completed: "Terminée",
  cancelled: "Annulée",
};
