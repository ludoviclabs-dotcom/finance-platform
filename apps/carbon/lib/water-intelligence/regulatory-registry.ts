/**
 * lib/water-intelligence/regulatory-registry.ts — miroir TypeScript du registre
 * juridique versionné (P13, Wave D).
 *
 * `regulatory-registry.json` est une COPIE, à l'octet près, du document
 * canonique `docs/carbonco/water-intelligence/contracts/REGULATORY_REGISTRY.json`,
 * lui-même ÉMIS par le registre Python
 * (`services/water_intelligence/regulatory_registry.py::canonical_json`).
 *
 * La copie est une contrainte d'outillage identique à celle documentée pour
 * `fixture-manifest.ts` : Turbopack refuse de résoudre un module hors de la
 * racine de l'application. Le risque de divergence est neutralisé des deux
 * côtés — `apps/api/tests/test_water_intelligence_regulatory_registry.py`
 * compare le document canonique au registre ET au miroir, et le schéma Zod
 * ci-dessous revalide la copie au build.
 *
 * ## Ce que ce module N'EST PAS
 *
 * Ce n'est pas une base de connaissances juridiques, et il ne rend aucun
 * conseil. Aucune date, aucun statut normatif n'y figure : le registre livré
 * ne contient que l'IDENTITÉ des textes à instruire et, pour chacun, la liste
 * des champs qu'un réviseur juridique doit renseigner. Le champ
 * `verified_rule_count` vaut `0` et la surface doit le rendre tel quel.
 *
 * Écrire une date de conformité dans le JSX serait exactement l'erreur que le
 * MACRO-PROMPT D interdit (« registre versionné, pas de dates dans JSX ») :
 * une échéance figée dans un composant survit à la mise à jour du texte.
 */

import { z } from "zod";

import rawRegistry from "./regulatory-registry.json";
import { WaterLegalStatusEnum } from "./contracts";

/** Nature de l'instrument — sépare le droit contraignant du volontaire. */
export const WiInstrumentKindEnum = z.enum([
  "regulation",
  "directive",
  "delegated_act",
  "national_law",
  "voluntary_framework",
]);
export type WiInstrumentKind = z.infer<typeof WiInstrumentKindEnum>;

/** Statut interne du texte. Inclut `repealed`, que le vocabulaire public P02
 *  ne sait pas exprimer — voir la note de conversion côté Python. */
export const WiRuleLegalStatusEnum = z.enum([
  "unknown",
  "proposed",
  "adopted",
  "in_force",
  "amended",
  "repealed",
]);
export type WiRuleLegalStatus = z.infer<typeof WiRuleLegalStatusEnum>;

export const WiTranspositionStatusEnum = z.enum([
  "not_applicable",
  "unknown",
  "pending",
  "completed",
]);
export type WiTranspositionStatus = z.infer<typeof WiTranspositionStatusEnum>;

/** Verdict du moteur de portée. Volontairement limité à quatre valeurs. */
export const WiApplicabilityOutcomeEnum = z.enum([
  "in_scope",
  "out_of_scope",
  "conditional",
  "unknown",
]);
export type WiApplicabilityOutcome = z.infer<typeof WiApplicabilityOutcomeEnum>;

export const WiRegulatoryRuleSchema = z.object({
  rule_id: z.string().min(1),
  text_version: z.string().min(1),
  jurisdiction: z.string().min(1),
  instrument_kind: WiInstrumentKindEnum,
  is_binding: z.boolean(),
  title: z.string().min(1),
  text_reference: z.string().min(1),
  legal_status: WiRuleLegalStatusEnum,
  public_legal_status: WaterLegalStatusEnum,
  transposition_status: WiTranspositionStatusEnum,
  criteria: z.array(z.string()),
  missing_fields: z.array(z.string()),
  notes: z.string(),
});
export type WiRegulatoryRule = z.infer<typeof WiRegulatoryRuleSchema>;

export const WiRegulatoryRegistrySchema = z.object({
  registry_version: z.string().min(1),
  verified_rule_count: z.number().int().min(0),
  rules: z.array(WiRegulatoryRuleSchema),
});
export type WiRegulatoryRegistry = z.infer<typeof WiRegulatoryRegistrySchema>;

/**
 * Registre courant, validé contre le schéma au build.
 *
 * `.parse()` (et non `.safeParse()`) est délibéré, comme pour le manifest de
 * fixture : un registre hors contrat doit casser le build, jamais dégrader
 * silencieusement l'affichage.
 */
export const REGULATORY_REGISTRY: WiRegulatoryRegistry =
  WiRegulatoryRegistrySchema.parse(rawRegistry);

/** Libellés des champs manquants — le registre nomme le champ, l'UI le traduit. */
export const MISSING_FIELD_LABELS: Record<string, string> = {
  source: "source officielle",
  human_review: "revue humaine signée",
  legal_status: "statut juridique",
  application: "date d'application",
  transposition: "état de transposition",
};

/** Libellés des verdicts. Toujours doublés d'un texte : la couleur ne porte
 *  jamais seule le sens (§8.3 du blueprint). */
export const OUTCOME_LABELS: Record<WiApplicabilityOutcome, string> = {
  in_scope: "Dans le champ",
  out_of_scope: "Hors champ",
  conditional: "Sous condition",
  unknown: "Non déterminé",
};

/**
 * Règles contraignantes d'abord, puis référentiels volontaires ; ordre stable
 * à l'intérieur de chaque groupe. Un référentiel volontaire présenté au milieu
 * du droit contraignant se lirait comme une obligation.
 */
export function groupedRules(registry: WiRegulatoryRegistry = REGULATORY_REGISTRY): {
  binding: readonly WiRegulatoryRule[];
  voluntary: readonly WiRegulatoryRule[];
} {
  return {
    binding: registry.rules.filter((rule) => rule.is_binding),
    voluntary: registry.rules.filter((rule) => !rule.is_binding),
  };
}

/**
 * Vrai lorsque AUCUNE règle n'est vérifiée — état actuel, et donc état que la
 * surface doit rendre honnêtement plutôt que d'afficher un tableau de statuts
 * qui n'existent pas.
 */
export function registryIsUnverified(
  registry: WiRegulatoryRegistry = REGULATORY_REGISTRY,
): boolean {
  return registry.verified_rule_count === 0;
}
