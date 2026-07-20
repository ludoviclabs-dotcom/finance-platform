/**
 * lib/api/iro.ts — client des endpoints `/iro/*` (PR-10 : IRO, double
 * matérialité et transmission financière).
 *
 * Réutilise `API_BASE_URL` + le porteur de token en mémoire de `lib/api.ts`,
 * même convention que `lib/api/water.ts`/`lib/api/nature.ts`. Types en
 * snake_case, miroir de `apps/api/models/iro.py`.
 *
 * Invariants du domaine lisibles dans ces types (motif `lib/api/water.ts`) :
 *
 * 1. **Jamais un score unique.** `ImpactAssessment` porte
 *    `scale`/`scope`/`irremediability`/`likelihood` en QUATRE champs
 *    séparés ; `FinancialAssessment` porte `likelihood`/`magnitude` en DEUX
 *    champs séparés. `threshold_crossed` est INDICATIF, jamais une décision.
 * 2. **Chaîne de transmission, jamais un chiffre.**
 *    `FinancialAssessment.transmission_chain` est un tableau d'étapes
 *    typées (`channel`+`rationale` obligatoires par étape).
 * 3. **Décision humaine, append-only.** `MaterialityDecision` n'est jamais
 *    modifiée : une redécision crée une nouvelle ligne
 *    (`supersedes_id`) — l'historique complet reste visible.
 * 4. **Candidat, jamais une décision.** `createIro` produit toujours un IRO
 *    `status: 'candidate'`, qu'il vienne d'un geste manuel ou d'un point
 *    d'appel domaine (`IroCandidateButton`).
 * 5. **Schéma pas encore migré.** Le backend répond 503 `schema_not_ready`
 *    tant que 040 n'est pas appliquée en production : le client le traduit
 *    en `SchemaNotReadyError`, rendu par la page comme « initialisation du
 *    schéma en cours » — jamais une erreur brute.
 */

import { API_BASE_URL, getAuthToken } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types (miroir models/iro.py)
// ---------------------------------------------------------------------------

export type IroType = "impact" | "risk" | "opportunity";
export type IroStatus = "candidate" | "under_assessment" | "assessed" | "decided" | "archived";
export type OriginDomain = "water" | "nature" | "crma" | "energy" | "manual";
export type ValueChainLocation = "upstream" | "own_operations" | "downstream";
export type TimeHorizon = "short" | "medium" | "long";
export type Polarity = "positive" | "negative";
export type FinancialChannel = "revenue" | "cost" | "asset_value" | "capital_cost" | "liability" | "other";
export type DecisionBasis = "impact" | "financial" | "both";
export type IroActionType = "mitigation" | "adaptation" | "enhancement" | "monitoring" | "engagement" | "other";
export type IroActionStatus = "planned" | "in_progress" | "completed" | "cancelled";
export type DisclosureStatus = "draft" | "mapped" | "disclosed";

export interface ScoreComponent {
  code: string;
  label: string;
  available: boolean;
  value: number | null;
  weight: number;
  contribution: number;
  rationale: string;
}

export interface Iro {
  id: number;
  company_id: number;
  title: string;
  description: string | null;
  iro_type: IroType;
  topic_code: string | null;
  origin_domain: string;
  origin_reference: string | null;
  status: IroStatus;
  value_chain_location: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface TransmissionStep {
  step: number;
  mechanism: string;
  channel: FinancialChannel;
  rationale: string;
  estimated_amount_eur: number | null;
}

export interface ImpactAssessment {
  id: number;
  company_id: number;
  iro_id: number;
  polarity: Polarity;
  is_actual: boolean;
  scale: number | null;
  scope: number | null;
  irremediability: number | null;
  likelihood: number | null;
  time_horizon: TimeHorizon | null;
  confidence: number | null;
  methodology_code: string;
  methodology_version: string;
  components: ScoreComponent[];
  threshold_crossed: boolean | null;
  rationale: string | null;
  calculated_at: string | null;
  prepared_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface FinancialAssessment {
  id: number;
  company_id: number;
  iro_id: number;
  likelihood: number | null;
  magnitude: number | null;
  time_horizon: TimeHorizon | null;
  confidence: number | null;
  methodology_code: string;
  methodology_version: string;
  transmission_chain: TransmissionStep[];
  primary_channel: string | null;
  components: ScoreComponent[];
  threshold_crossed: boolean | null;
  rationale: string | null;
  calculated_at: string | null;
  prepared_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface MaterialityDecision {
  id: number;
  company_id: number;
  iro_id: number;
  decided_by: number;
  decided_at: string;
  is_material: boolean;
  basis: DecisionBasis;
  justification: string;
  supersedes_id: number | null;
  created_at: string;
}

export interface IroAction {
  id: number;
  company_id: number;
  iro_id: number;
  action_type: IroActionType;
  title: string;
  description: string | null;
  status: IroActionStatus;
  owner: string | null;
  due_date: string | null;
  completed_at: string | null;
  expected_effect: string | null;
  expected_risk_reduction_pct: number | null;
  created_at: string;
  updated_at: string;
}

export interface DisclosureMapping {
  id: number;
  company_id: number;
  iro_id: number;
  esrs_reference: string | null;
  status: DisclosureStatus;
  notes: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface EvidenceLink {
  id: number;
  claim_type: string;
  claim_key: string;
  evidence_artifact_id: number;
  relation_type: string;
  created_at: string;
}

export interface IroDetail {
  iro: Iro;
  impact_assessments: ImpactAssessment[];
  financial_assessments: FinancialAssessment[];
  decisions: MaterialityDecision[];
  actions: IroAction[];
  disclosure_mappings: DisclosureMapping[];
  evidence_links: EvidenceLink[];
}

export interface AnalyticalEnvelope<T> {
  data: T;
  meta: {
    as_of: string | null;
    status: string;
    method: { code: string; version: string };
    quality: { confidence: number | null; coverage_pct: number | null; warnings: string[] };
  };
  evidence: { artifact_id: number | null; fact_id: number | null; source_code: string | null; note: string | null }[];
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

/** 503 `schema_not_ready` : la migration 040 n'est pas encore appliquée. */
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

// ── Registre IRO ─────────────────────────────────────────────────────────

export function fetchIros(
  params: { status?: IroStatus; iro_type?: IroType; origin_domain?: OriginDomain; limit?: number } = {},
  signal?: AbortSignal,
): Promise<Paginated<Iro>> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.iro_type) qs.set("iro_type", params.iro_type);
  if (params.origin_domain) qs.set("origin_domain", params.origin_domain);
  qs.set("limit", String(params.limit ?? 100));
  return get<Paginated<Iro>>(`/iro/iros?${qs.toString()}`, signal);
}

export function createIro(body: {
  title: string;
  description?: string | null;
  iro_type: IroType;
  topic_code?: string | null;
  origin_domain?: OriginDomain;
  origin_reference?: string | null;
  value_chain_location?: ValueChainLocation | null;
}): Promise<Iro> {
  return post<Iro>("/iro/iros", body);
}

export function fetchIroDetail(iroId: number, signal?: AbortSignal): Promise<IroDetail> {
  return get<IroDetail>(`/iro/iros/${iroId}`, signal);
}

// ── Évaluations — deux dimensions strictement séparées ──────────────────

export function createImpactAssessment(
  iroId: number,
  body: {
    polarity: Polarity;
    is_actual?: boolean;
    scale?: number | null;
    scope?: number | null;
    irremediability?: number | null;
    likelihood?: number | null;
    time_horizon?: TimeHorizon | null;
    confidence?: number | null;
    rationale?: string | null;
  },
): Promise<AnalyticalEnvelope<ImpactAssessment>> {
  return post<AnalyticalEnvelope<ImpactAssessment>>(`/iro/iros/${iroId}/impact-assessment`, body);
}

export function createFinancialAssessment(
  iroId: number,
  body: {
    likelihood?: number | null;
    magnitude?: number | null;
    time_horizon?: TimeHorizon | null;
    confidence?: number | null;
    transmission_chain: Omit<TransmissionStep, "estimated_amount_eur">[] &
      { estimated_amount_eur?: number | null }[];
    rationale?: string | null;
  },
): Promise<AnalyticalEnvelope<FinancialAssessment>> {
  return post<AnalyticalEnvelope<FinancialAssessment>>(`/iro/iros/${iroId}/financial-assessment`, body);
}

// ── Décision de matérialité — require_admin côté API ─────────────────────

export function decideMateriality(
  iroId: number,
  body: { is_material: boolean; basis: DecisionBasis; justification: string },
): Promise<MaterialityDecision> {
  return post<MaterialityDecision>(`/iro/iros/${iroId}/decide`, body);
}

export function fetchDecisions(iroId: number, signal?: AbortSignal): Promise<Paginated<MaterialityDecision>> {
  return get<Paginated<MaterialityDecision>>(`/iro/iros/${iroId}/decisions?limit=100`, signal);
}

// ── Actions ───────────────────────────────────────────────────────────────

export function createIroAction(
  iroId: number,
  body: {
    action_type: IroActionType;
    title: string;
    description?: string | null;
    status?: IroActionStatus;
    owner?: string | null;
    due_date?: string | null;
    expected_effect?: string | null;
    expected_risk_reduction_pct?: number | null;
  },
): Promise<IroAction> {
  return post<IroAction>(`/iro/iros/${iroId}/actions`, body);
}

export function fetchIroActions(iroId: number, signal?: AbortSignal): Promise<Paginated<IroAction>> {
  return get<Paginated<IroAction>>(`/iro/iros/${iroId}/actions?limit=100`, signal);
}

// ── Disclosure mappings ────────────────────────────────────────────────────

export function createDisclosureMapping(
  iroId: number,
  body: { esrs_reference?: string | null; status?: DisclosureStatus; notes?: string | null },
): Promise<DisclosureMapping> {
  return post<DisclosureMapping>(`/iro/iros/${iroId}/disclosure-mappings`, body);
}

export function fetchDisclosureMappings(iroId: number, signal?: AbortSignal): Promise<Paginated<DisclosureMapping>> {
  return get<Paginated<DisclosureMapping>>(`/iro/iros/${iroId}/disclosure-mappings?limit=100`, signal);
}

// ── Evidence Pack — téléchargement authentifié (motif lib/api/energy.ts) ──

export async function downloadIroEvidencePack(iroId: number): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}/iro/iros/${iroId}/evidence-pack`, {
    method: "GET",
    headers: { ...authHeaders() },
    credentials: "include",
  });
  if (!res.ok) throw new Error(`API ${res.status} on evidence-pack`);
  return res.blob();
}

// ---------------------------------------------------------------------------
// Présentation
// ---------------------------------------------------------------------------

export const IRO_TYPE_LABEL: Record<IroType, string> = {
  impact: "Impact",
  risk: "Risque",
  opportunity: "Opportunité",
};

export const IRO_STATUS_LABEL: Record<IroStatus, string> = {
  candidate: "Candidat",
  under_assessment: "En évaluation",
  assessed: "Évalué",
  decided: "Décidé",
  archived: "Archivé",
};

export const IRO_STATUS_TONE: Record<IroStatus, string> = {
  candidate: "bg-neutral-100 text-neutral-700 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700",
  under_assessment: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-500/30",
  assessed: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-500/30",
  decided: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-500/30",
  archived: "bg-neutral-100 text-neutral-500 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-500 dark:border-neutral-700",
};

export const ORIGIN_DOMAIN_LABEL: Record<string, string> = {
  water: "Eau",
  nature: "Nature",
  crma: "Matières critiques",
  energy: "Énergie",
  manual: "Manuel",
};

export const FINANCIAL_CHANNEL_LABEL: Record<FinancialChannel, string> = {
  revenue: "Revenu",
  cost: "Coût",
  asset_value: "Valeur d'actif",
  capital_cost: "Coût du capital",
  liability: "Passif",
  other: "Autre",
};

/** Formate une composante 0-100, ou « n. d. » si absente. */
export function formatComponent(value: number | null): string {
  return value === null || value === undefined ? "n. d." : `${Math.round(value)}/100`;
}
