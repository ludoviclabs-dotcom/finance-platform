/**
 * lib/water-intelligence/public-snapshot.ts — miroir TypeScript/Zod de
 * l'enveloppe publique assemblée par
 * `apps/api/services/water_intelligence/public_snapshot.py` (P10, Wave C).
 *
 * Même discipline que `contracts.ts` : champs en snake_case, alignés sur le
 * JSON Python, validés par `zod` (déjà une dépendance — aucun ajout).
 *
 * L'enveloppe peut être VIDE et rester valide : `manifest` vaut `null` quand
 * aucune source n'est autorisée à la publication. C'est l'état attendu du MVP,
 * pas une panne — le gate licence exige une décision humaine explicite par
 * source, et aucune n'est active à ce jour.
 */

import { z } from "zod";

import { WaterIntelligenceManifestSchema } from "./contracts";

export const SNAPSHOT_SCHEMA_VERSION = "1.0.0";

/** Motifs d'exclusion normalisés, identiques côté Python. */
export const WiExclusionReasonEnum = z.enum([
  "no_human_decision",
  "decision_proposed_not_reviewed",
  "decision_refused",
  "provenance_information_url_missing",
  "outside_authorized_scope",
  "approved_but_no_observation_supplied",
]);
export type WiExclusionReason = z.infer<typeof WiExclusionReasonEnum>;

export const WiSourceExclusionSchema = z.object({
  source_code: z.string().min(1),
  reason: WiExclusionReasonEnum,
  detail: z.string().min(1),
});
export type WiSourceExclusion = z.infer<typeof WiSourceExclusionSchema>;

/**
 * Périmètre EXACT couvert par une signature humaine.
 *
 * Il accompagne la décision jusqu'à la surface : afficher « source publiée »
 * sans dire sur quel territoire ni sur quelle année laisserait croire que
 * toute la source l'est. Le pilote BNPE couvre une commune et une année.
 */
export const WiAuthorizedScopeSchema = z.object({
  geography_type: z.string().min(1),
  geography_code: z.string().min(1),
  period_start: z.string().min(1),
  period_end: z.string().min(1),
  measurement_only: z.boolean(),
});
export type WiAuthorizedScope = z.infer<typeof WiAuthorizedScopeSchema>;

/**
 * Les quatre permissions du formulaire humain, transportées verbatim.
 *
 * `derived_use_allowed` n'est pas décoratif : à `false`, la surface ne doit
 * produire aucun total, aucune moyenne, aucun classement ni aucun score à
 * partir des valeurs publiées.
 */
export const WiDecisionPermissionsSchema = z.object({
  display_allowed: z.boolean(),
  derived_use_allowed: z.boolean(),
  automated_access_allowed: z.boolean(),
  storage_allowed: z.boolean(),
});
export type WiDecisionPermissions = z.infer<typeof WiDecisionPermissionsSchema>;

export const WiPublicationDecisionSchema = z.object({
  source_code: z.string().min(1),
  status: z.enum(["approved", "proposed", "refused"]),
  reason: z.string().min(1),
  reviewed_by: z.string().nullable(),
  reviewed_on: z.string().nullable(),
  allows_publication: z.boolean(),
  authorized_scope: WiAuthorizedScopeSchema.nullable(),
  permissions: WiDecisionPermissionsSchema,
});
export type WiPublicationDecision = z.infer<typeof WiPublicationDecisionSchema>;

export const WiCoverageSchema = z.object({
  observation_count: z.number().int().min(0),
  layer_count: z.number().int().min(0),
  period_count: z.number().int().min(0),
  source_count: z.number().int().min(0),
  excluded_source_count: z.number().int().min(0),
});
export type WiCoverage = z.infer<typeof WiCoverageSchema>;

export const WaterPublicSnapshotSchema = z.object({
  schema_version: z.string().min(1),
  generated_at: z.string(),
  is_empty: z.boolean(),
  manifest: WaterIntelligenceManifestSchema.nullable(),
  included_source_codes: z.array(z.string()).default([]),
  exclusions: z.array(WiSourceExclusionSchema).default([]),
  decisions: z.array(WiPublicationDecisionSchema).default([]),
  warnings: z.array(z.string()).default([]),
  budgets: z.record(z.string(), z.number()).default({}),
  coverage: WiCoverageSchema,
  periods: z.array(z.array(z.string())).default([]),
  methods: z.array(z.array(z.string())).default([]),
});
export type WaterPublicSnapshot = z.infer<typeof WaterPublicSnapshotSchema>;

/** Motifs d'exclusion en français, pour un rendu lisible. */
export const EXCLUSION_LABELS: Record<WiExclusionReason, string> = {
  no_human_decision: "Aucune décision humaine de publication",
  decision_proposed_not_reviewed: "Décision proposée, non revue",
  decision_refused: "Publication refusée",
  provenance_information_url_missing: "Provenance non citable — URL officielle absente",
  outside_authorized_scope: "Hors du périmètre autorisé par la décision",
  approved_but_no_observation_supplied: "Publication autorisée, aucune observation fournie",
};

/**
 * Snapshot vide canonique, utilisé tant qu'aucun snapshot réel n'est servi.
 *
 * Ne contient AUCUNE valeur inventée : pas de date de récupération, pas
 * d'empreinte, pas de mesure. `generated_at` est la chaîne vide — l'UI rend
 * alors « n.c. » plutôt qu'une date plausible.
 */
export const EMPTY_SNAPSHOT: WaterPublicSnapshot = {
  schema_version: SNAPSHOT_SCHEMA_VERSION,
  generated_at: "",
  is_empty: true,
  manifest: null,
  included_source_codes: [],
  exclusions: [],
  decisions: [],
  warnings: [],
  budgets: {},
  coverage: {
    observation_count: 0,
    layer_count: 0,
    period_count: 0,
    source_count: 0,
    excluded_source_count: 0,
  },
  periods: [],
  methods: [],
};

/**
 * Valide un snapshot reçu. Un snapshot illisible ne devient jamais un
 * snapshot vide silencieux : l'appelant reçoit `null` et doit rendre l'état
 * d'erreur, distinct de l'état vide.
 */
export function parsePublicSnapshot(input: unknown): WaterPublicSnapshot | null {
  const parsed = WaterPublicSnapshotSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

/** Dimensions réellement publiées, dérivées du manifest — jamais codées en dur. */
export function availableDimensions(snapshot: WaterPublicSnapshot): string[] {
  if (!snapshot.manifest) return [];
  return [...new Set(snapshot.manifest.geo_layers.map((layer) => layer.layer_id))].sort();
}

/** Périodes réellement publiées, sous forme de paires lisibles. */
export function availablePeriods(snapshot: WaterPublicSnapshot): Array<[string, string]> {
  return snapshot.periods
    .filter((period): period is [string, string] => period.length === 2)
    .map(([start, end]) => [start, end] as [string, string]);
}
