/**
 * lib/api/water-decision.ts — clients des surfaces décisionnelles Water
 * Intelligence (Wave E-Interface, commit F1).
 *
 * Quatre endpoints livrés par la Wave E-Core (PR #158) :
 *
 * | Endpoint | Auth |
 * |---|---|
 * | `GET /water-intelligence/public-snapshot` | publique |
 * | `GET /water-intelligence/regulatory-registry` | publique |
 * | `GET /water/decision-synthesis` | requise |
 * | `POST /water/financial-scenarios/evaluate` | requise |
 *
 * ## Ce que ce module n'expose pas, et pourquoi
 *
 * **Aucun `company_id` dans un type de requête.** Le périmètre vient
 * exclusivement du jeton côté serveur ; offrir le champ côté client donnerait
 * l'impression qu'il est paramétrable, et quelqu'un finirait par le remplir.
 * Le backend le refuse déjà (`extra="forbid"`), mais un contrat qui ne le
 * propose pas vaut mieux qu'un contrat qui le rejette.
 *
 * **Aucune valeur par défaut financière.** Ni taux d'actualisation, ni revenu,
 * ni marge, ni probabilité. Le moteur les exige explicitement, et un défaut
 * posé ici serait une hypothèse invisible au nom de l'utilisateur.
 *
 * **Aucune donnée de démonstration.** Une réponse invalide lève ; elle n'est
 * jamais remplacée par un objet vide plausible.
 *
 * ## ETag et 304
 *
 * Le snapshot public est le seul endpoint du produit à servir un validateur.
 * Le client le mémorise et le renvoie en `If-None-Match` : sur 304, le corps
 * est vide, et c'est la charge PRÉCÉDENTE qui reste valide. Retourner `null`
 * sur un 304 serait un contresens — 304 signifie « inchangé », pas « absent ».
 */

import { z } from "zod";

import { API_BASE_URL, getAuthToken } from "@/lib/api";
import {
  WaterPublicSnapshotSchema,
  type WaterPublicSnapshot,
} from "@/lib/water-intelligence/public-snapshot";

/* ------------------------------------------------------------------ Erreurs */

/** Réponse hors contrat — jamais dégradée en objet vide. */
export class DecisionContractError extends Error {
  constructor(path: string, cause?: unknown) {
    super(`Réponse hors contrat sur ${path}`);
    this.name = "DecisionContractError";
    this.cause = cause;
  }
}

/** Authentification requise ou refusée (401 / 403). */
export class DecisionAuthError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(
      status === 401
        ? "Authentification requise."
        : "Accès refusé pour ce compte.",
    );
    this.name = "DecisionAuthError";
    this.status = status;
  }
}

/** Schéma pas encore migré — 503 `schema_not_ready`, contrat PR-08. */
export class DecisionSchemaNotReadyError extends Error {
  constructor() {
    super("Initialisation du schéma en cours.");
    this.name = "DecisionSchemaNotReadyError";
  }
}

/* ------------------------------------------------------------------ Schémas */

export const WiFacetKindEnum = z.enum([
  "risk",
  "confidence",
  "dependency",
  "resource_material",
  "iro",
  "action",
]);
export type WiFacetKind = z.infer<typeof WiFacetKindEnum>;

export const WiFacetEntrySchema = z.object({
  facet: WiFacetKindEnum,
  source_module: z.string().min(1),
  label: z.string().min(1),
  vocabulary: z.string().min(1),
  value: z.string().nullable(),
  evidence_ref: z.string().nullable(),
  absence_reason: z.string().nullable(),
});
export type WiFacetEntry = z.infer<typeof WiFacetEntrySchema>;

export const WiFacetSummarySchema = z.object({
  facet: WiFacetKindEnum,
  label: z.string().min(1),
  is_empty: z.boolean(),
  vocabularies: z.array(z.string()),
  has_mixed_vocabularies: z.boolean(),
  entries: z.array(WiFacetEntrySchema),
});
export type WiFacetSummary = z.infer<typeof WiFacetSummarySchema>;

/**
 * Synthèse à six facettes.
 *
 * Aucun champ de score : le contrat serveur n'en produit pas, et le déclarer
 * ici en ouvrirait la possibilité.
 */
export const WiDecisionSynthesisSchema = z.object({
  company_id: z.number().int(),
  is_empty: z.boolean(),
  facets: z.array(WiFacetSummarySchema),
});
export type WiDecisionSynthesis = z.infer<typeof WiDecisionSynthesisSchema>;

export const WiPublicSnapshotEnvelopeSchema = z.object({
  schema_version: z.string().min(1),
  is_empty: z.boolean(),
  snapshot: WaterPublicSnapshotSchema,
});
export type WiPublicSnapshotEnvelope = z.infer<typeof WiPublicSnapshotEnvelopeSchema>;

export const WiPublicRuleSchema = z.object({
  rule_id: z.string().min(1),
  text_version: z.string().min(1),
  jurisdiction: z.string().min(1),
  instrument_kind: z.string().min(1),
  is_binding: z.boolean(),
  title: z.string().min(1),
  text_reference: z.string().min(1),
  legal_status: z.string().min(1),
  public_legal_status: z.string().min(1),
  transposition_status: z.string().min(1),
  criteria: z.array(z.string()),
  missing_fields: z.array(z.string()),
  notes: z.string(),
});

export const WiPublicRegistrySchema = z.object({
  registry_version: z.string().min(1),
  verified_rule_count: z.number().int().min(0),
  rules: z.array(WiPublicRuleSchema),
});
export type WiPublicRegistry = z.infer<typeof WiPublicRegistrySchema>;

/* --------------------------------------------------- Requête financière */

/** Un client déclare ce qu'il a observé ou supposé — jamais `derived`. */
export const WiInputProvenanceEnum = z.enum(["observed", "assumption"]);
export type WiInputProvenance = z.infer<typeof WiInputProvenanceEnum>;

/**
 * Grandeur fournie par l'utilisateur.
 *
 * `value` est une CHAÎNE décimale, pas un nombre : les montants voyagent en
 * décimal exact de bout en bout, et un `number` JavaScript réintroduirait le
 * flottant binaire que le moteur a explicitement écarté.
 */
export const WiQuantityInputSchema = z.object({
  value: z.string().nullable(),
  provenance: WiInputProvenanceEnum,
  basis: z.string().min(1).max(500),
});
export type WiQuantityInput = z.infer<typeof WiQuantityInputSchema>;

/**
 * Scénario à évaluer.
 *
 * **Aucun champ n'a de valeur par défaut** — c'est le point du contrat, pas un
 * oubli. Le type est déclaré explicitement plutôt qu'inféré pour que tout ajout
 * de défaut soit un changement visible.
 */
export const WiFinancialScenarioRequestSchema = z.object({
  scenario_code: z.string().min(1).max(64),
  label: z.string().min(1).max(200),
  base_year: z.number().int(),
  horizon_year: z.number().int(),
  outage_days: WiQuantityInputSchema,
  affected_capacity_share: WiQuantityInputSchema,
  revenue_per_day: WiQuantityInputSchema,
  margin_rate: WiQuantityInputSchema,
  additional_opex_per_day: WiQuantityInputSchema,
  adaptation_capex: WiQuantityInputSchema,
  discount_rate: WiQuantityInputSchema,
  probability: WiQuantityInputSchema.nullable().optional(),
  sensitivity_variation_pct: z.string().min(1),
  signals: z.array(z.string()).max(20),
});
export type WiFinancialScenarioRequest = z.infer<typeof WiFinancialScenarioRequestSchema>;

export const WiSensitivityBandSchema = z.object({
  driver: z.string().min(1),
  variation_pct: z.string(),
  low: z.string().nullable(),
  base: z.string().nullable(),
  high: z.string().nullable(),
});
export type WiSensitivityBand = z.infer<typeof WiSensitivityBandSchema>;

export const WiQuantityOutputSchema = z.object({
  value: z.string().nullable(),
  unit: z.string().min(1),
  provenance: z.string().min(1),
  basis: z.string().min(1),
});

export const WiFinancialScenarioResponseSchema = z.object({
  scenario_code: z.string().min(1),
  label: z.string().min(1),
  horizon_year: z.number().int(),
  is_absent: z.boolean(),
  absence_reason: z.string().nullable(),
  components: z.record(z.string(), WiQuantityOutputSchema),
  present_value: z.string().nullable(),
  probability_weighted: z.string().nullable(),
  sensitivities: z.array(WiSensitivityBandSchema),
  signals: z.array(z.string()),
});
export type WiFinancialScenarioResponse = z.infer<typeof WiFinancialScenarioResponseSchema>;

/* ------------------------------------------------------------- Transport */

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Traduit un statut HTTP en erreur typée, avant toute lecture de corps. */
async function assertOk(res: Response, path: string): Promise<void> {
  if (res.status === 401 || res.status === 403) throw new DecisionAuthError(res.status);
  if (res.status === 503) {
    let detail: unknown = null;
    try {
      detail = ((await res.clone().json()) as { detail?: unknown }).detail;
    } catch {
      /* corps non-JSON : erreur générique ci-dessous */
    }
    if (detail === "schema_not_ready") throw new DecisionSchemaNotReadyError();
  }
  if (!res.ok) {
    let detail = "";
    try {
      detail = String(((await res.clone().json()) as { detail?: unknown }).detail ?? "");
    } catch {
      /* garder le message générique */
    }
    throw new Error(detail || `API ${res.status} on ${path}`);
  }
}

/** Valide une charge contre son schéma. Une réponse hors contrat lève. */
function parseOrThrow<T>(schema: z.ZodType<T>, payload: unknown, path: string): T {
  const result = schema.safeParse(payload);
  if (!result.success) throw new DecisionContractError(path, result.error);
  return result.data;
}

/* --------------------------------------------------------- Snapshot public */

/** Résultat d'une lecture conditionnelle du snapshot. */
export type SnapshotFetchResult =
  | { readonly kind: "fresh"; readonly envelope: WiPublicSnapshotEnvelope; readonly etag: string | null }
  | { readonly kind: "not-modified"; readonly etag: string | null };

const PUBLIC_SNAPSHOT_PATH = "/water-intelligence/public-snapshot";
const PUBLIC_REGISTRY_PATH = "/water-intelligence/regulatory-registry";
const SYNTHESIS_PATH = "/water/decision-synthesis";
const EVALUATE_PATH = "/water/financial-scenarios/evaluate";

/**
 * Lit le snapshot public. **Aucune authentification.**
 *
 * `knownEtag` déclenche une requête conditionnelle. Un 304 rend
 * `kind: "not-modified"` — l'appelant conserve alors la charge qu'il détenait.
 * Rendre `null` laisserait croire à une absence de données.
 */
export async function fetchPublicSnapshot(
  options: { knownEtag?: string | null; signal?: AbortSignal } = {},
): Promise<SnapshotFetchResult> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.knownEtag) headers["If-None-Match"] = options.knownEtag;

  const res = await fetch(`${API_BASE_URL}${PUBLIC_SNAPSHOT_PATH}`, {
    method: "GET",
    headers,
    signal: options.signal,
  });

  if (res.status === 304) {
    return { kind: "not-modified", etag: res.headers.get("etag") ?? options.knownEtag ?? null };
  }
  await assertOk(res, PUBLIC_SNAPSHOT_PATH);
  const envelope = parseOrThrow(
    WiPublicSnapshotEnvelopeSchema,
    await res.json(),
    PUBLIC_SNAPSHOT_PATH,
  );
  return { kind: "fresh", envelope, etag: res.headers.get("etag") };
}

/** Lit le registre juridique public. **Aucune authentification.** */
export async function fetchPublicRegulatoryRegistry(
  signal?: AbortSignal,
): Promise<WiPublicRegistry> {
  const res = await fetch(`${API_BASE_URL}${PUBLIC_REGISTRY_PATH}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });
  await assertOk(res, PUBLIC_REGISTRY_PATH);
  return parseOrThrow(WiPublicRegistrySchema, await res.json(), PUBLIC_REGISTRY_PATH);
}

/* ---------------------------------------------------- Surfaces authentifiées */

/**
 * Synthèse hydrique de l'entreprise authentifiée.
 *
 * Aucun paramètre : le périmètre vient du jeton. La signature elle-même
 * empêche d'en passer un.
 */
export async function fetchDecisionSynthesis(
  signal?: AbortSignal,
): Promise<WiDecisionSynthesis> {
  const res = await fetch(`${API_BASE_URL}${SYNTHESIS_PATH}`, {
    method: "GET",
    headers: { Accept: "application/json", ...authHeaders() },
    credentials: "include",
    signal,
  });
  await assertOk(res, SYNTHESIS_PATH);
  return parseOrThrow(WiDecisionSynthesisSchema, await res.json(), SYNTHESIS_PATH);
}

/**
 * Évalue un scénario financier. **Sans état, sans écriture.**
 *
 * La requête est validée AVANT envoi : une hypothèse manquante est un défaut
 * de saisie, et le dire côté client évite un aller-retour pour l'apprendre.
 */
export async function evaluateFinancialScenario(
  request: WiFinancialScenarioRequest,
  signal?: AbortSignal,
): Promise<WiFinancialScenarioResponse> {
  const body = parseOrThrow(WiFinancialScenarioRequestSchema, request, EVALUATE_PATH);
  const res = await fetch(`${API_BASE_URL}${EVALUATE_PATH}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    credentials: "include",
    body: JSON.stringify(body),
    signal,
  });
  await assertOk(res, EVALUATE_PATH);
  return parseOrThrow(WiFinancialScenarioResponseSchema, await res.json(), EVALUATE_PATH);
}
