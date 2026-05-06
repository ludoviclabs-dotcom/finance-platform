/**
 * Corpus de règles ESRS Set 2 — basé sur les guidances EFRAG IG-2 (2024) et
 * EFRAG IG-3 (2025), simplifié post-Omnibus mars 2026.
 *
 * Chaque règle est déclarative : elle référence des datapoint IDs définis
 * dans `lib/esrs-set2.json` et utilise les fabriques de `validator.ts`.
 *
 * Catégories couvertes :
 *   1. E1 climat : Scope 2 LB ≥ MB, total GHG = Σ scopes, intensité GHG, % renouvelable
 *   2. E5 économie circulaire : waste_total = diverted + directed
 *   3. E3 eau : water_consumption ≤ withdrawal
 *   4. Bornes pourcentages : 0 ≤ % ≤ 100 sur tous les datapoints en %
 *   5. Bornes positives : émissions, énergie, eau, déchets ≥ 0
 *   6. Complétude par standard : seuils obligatoires
 *   7. Dépendances déclarées : règle générique
 */

import {
  type Rule,
  ruleGte,
  ruleSumWithinTolerance,
  ruleValueRange,
  ruleCompletenessByStandard,
  ruleIntensityRatio,
  ruleDependenciesPresent,
} from "./validator";
import { ESRS_SET2 } from "@/lib/esrs/schema";

// ─── 1. Règles cohérence E1 climat ──────────────────────────────────────────

const E1_RULES: Rule[] = [
  ruleGte({
    id: "E1-scope2-LB-gte-MB",
    description:
      "ESRS E1-6 : la valeur location-based doit être ≥ market-based (les contrats verts réduisent uniquement le market-based).",
    a: "E1-6_scope2_location_based",
    b: "E1-6_scope2_market_based",
    severity: "error",
    standards: ["E1"],
    message: (a, b) =>
      `Scope 2 location-based (${a} tCO₂e) doit être ≥ Scope 2 market-based (${b} tCO₂e). Les contrats d'achat d'électricité verte ne peuvent réduire que le market-based.`,
  }),
  ruleSumWithinTolerance({
    id: "E1-total-GHG-equals-sum-scopes",
    description:
      "ESRS E1-6 : émissions GES totales ≈ Scope 1 + Scope 2 (market-based) + Scope 3 (tolérance ±2 %).",
    target: "E1-6_total_ghg",
    components: ["E1-6_scope1_gross", "E1-6_scope2_market_based", "E1-6_scope3_total"],
    tolerancePct: 2,
    severity: "error",
    standards: ["E1"],
  }),
  ruleSumWithinTolerance({
    id: "E1-energy-total-equals-renewable-plus-non-renewable",
    description:
      "ESRS E1-5 : consommation énergétique totale ≈ renouvelable + non renouvelable (tolérance ±2 %).",
    target: "E1-5_energy_consumption_total",
    components: [
      "E1-5_energy_consumption_renewable",
      "E1-5_energy_consumption_non_renewable",
    ],
    tolerancePct: 2,
    severity: "error",
    standards: ["E1"],
  }),
];

// ─── 2. Règles cohérence E5 économie circulaire ─────────────────────────────

const E5_RULES: Rule[] = [
  ruleSumWithinTolerance({
    id: "E5-waste-total-equals-diverted-plus-directed",
    description:
      "ESRS E5-5 : déchets totaux ≈ détournés + dirigés vers élimination (tolérance ±2 %).",
    target: "E5-5_waste_total",
    components: [
      "E5-5_waste_diverted_from_disposal",
      "E5-5_waste_directed_to_disposal",
    ],
    tolerancePct: 2,
    severity: "error",
    standards: ["E5"],
  }),
];

// ─── 3. Règles cohérence E3 eau ─────────────────────────────────────────────

const E3_RULES: Rule[] = [
  ruleGte({
    id: "E3-withdrawal-gte-consumption",
    description:
      "ESRS E3-4 : prélèvement d'eau ≥ consommation (la consommation est une fraction des prélèvements après rejets).",
    a: "E3-4_water_withdrawal",
    b: "E3-4_water_consumption_total",
    severity: "error",
    standards: ["E3"],
  }),
  ruleGte({
    id: "E3-consumption-total-gte-stress-areas",
    description:
      "ESRS E3-4 : consommation totale ≥ consommation en zones de stress hydrique.",
    a: "E3-4_water_consumption_total",
    b: "E3-4_water_consumption_stress_areas",
    severity: "error",
    standards: ["E3"],
  }),
];

// ─── 4. Bornes des pourcentages (0 ≤ % ≤ 100) ───────────────────────────────

const PERCENT_DPS = ESRS_SET2.datapoints
  .filter((d) => d.unit === "%")
  .map((d) => d.id);

const PERCENT_RULES: Rule[] = PERCENT_DPS.map((id) =>
  ruleValueRange({
    id: `range-percent-${id}`,
    description: `${id} (pourcentage) doit être entre 0 et 100.`,
    datapointId: id,
    min: 0,
    max: 100,
    severity: "error",
  }),
);

// ─── 5. Bornes positives (émissions, énergie, eau, déchets ≥ 0) ─────────────

const POSITIVE_UNITS = new Set([
  "tCO2e",
  "MWh",
  "MWh/M€",
  "tCO2e/M€",
  "m3",
  "m3/M€",
  "t",
  "ha",
  "FTE",
  "€",
  "€/tCO2e",
  "M€",
  "heures",
  "jours",
  "jours/200k h",
]);

const POSITIVE_DPS = ESRS_SET2.datapoints.filter(
  (d) => d.type === "number" && d.unit && POSITIVE_UNITS.has(d.unit),
);

const POSITIVE_RULES: Rule[] = POSITIVE_DPS.map((d) =>
  ruleValueRange({
    id: `range-positive-${d.id}`,
    description: `${d.id} (${d.unit}) doit être ≥ 0.`,
    datapointId: d.id,
    min: 0,
    severity: "error",
  }),
);

// Compteurs nominaux (sans unité, type number) doivent aussi être ≥ 0
const COUNT_DPS = ESRS_SET2.datapoints.filter(
  (d) => d.type === "number" && !d.unit,
);

const COUNT_RULES: Rule[] = COUNT_DPS.map((d) =>
  ruleValueRange({
    id: `range-count-${d.id}`,
    description: `${d.id} (compteur) doit être ≥ 0.`,
    datapointId: d.id,
    min: 0,
    severity: "error",
  }),
);

// ─── 6. Complétude par standard ─────────────────────────────────────────────

const COMPLETENESS_RULES: Rule[] = [
  ruleCompletenessByStandard({
    id: "completeness-E1",
    standard: "E1",
    minMandatoryPct: 80,
    severity: "warning",
  }),
  ruleCompletenessByStandard({
    id: "completeness-S1",
    standard: "S1",
    minMandatoryPct: 70,
    severity: "warning",
  }),
  ruleCompletenessByStandard({
    id: "completeness-G1",
    standard: "G1",
    minMandatoryPct: 70,
    severity: "warning",
  }),
  ruleCompletenessByStandard({
    id: "completeness-E2",
    standard: "E2",
    minMandatoryPct: 50,
    severity: "info",
  }),
  ruleCompletenessByStandard({
    id: "completeness-E3",
    standard: "E3",
    minMandatoryPct: 50,
    severity: "info",
  }),
  ruleCompletenessByStandard({
    id: "completeness-E4",
    standard: "E4",
    minMandatoryPct: 50,
    severity: "info",
  }),
  ruleCompletenessByStandard({
    id: "completeness-E5",
    standard: "E5",
    minMandatoryPct: 50,
    severity: "info",
  }),
  ruleCompletenessByStandard({
    id: "completeness-S2",
    standard: "S2",
    minMandatoryPct: 50,
    severity: "info",
  }),
  ruleCompletenessByStandard({
    id: "completeness-S3",
    standard: "S3",
    minMandatoryPct: 50,
    severity: "info",
  }),
  ruleCompletenessByStandard({
    id: "completeness-S4",
    standard: "S4",
    minMandatoryPct: 50,
    severity: "info",
  }),
];

// ─── 7. Intensités (ratio = numérateur / dénominateur) ──────────────────────

const INTENSITY_RULES: Rule[] = [
  // GHG intensity = total GHG / revenue. Le revenu n'est pas dans ESRS,
  // mais l'intensité elle-même est un datapoint mandatory. On ne peut donc
  // pas valider mécaniquement le ratio sans data finance externe.
  // → On garde la fabrique disponible pour la suite (Chantier D côté UI).
];

// ─── 8. Sub-totals genres / contrats S1 ─────────────────────────────────────

const S1_RULES: Rule[] = [
  ruleSumWithinTolerance({
    id: "S1-total-equals-sum-genders",
    description:
      "ESRS S1-6 : effectif total ≈ hommes + femmes + autres (tolérance ±1 %).",
    target: "S1-6_total_employees",
    components: ["S1-6_employees_male", "S1-6_employees_female", "S1-6_employees_other"],
    tolerancePct: 1,
    severity: "warning",
    standards: ["S1"],
  }),
  ruleSumWithinTolerance({
    id: "S1-total-equals-sum-contracts",
    description:
      "ESRS S1-6 : effectif total ≈ CDI + CDD (tolérance ±1 %).",
    target: "S1-6_total_employees",
    components: ["S1-6_permanent_contracts", "S1-6_temporary_contracts"],
    tolerancePct: 1,
    severity: "warning",
    standards: ["S1"],
  }),
];

// ─── 9. Cohérence droits humains S2 ─────────────────────────────────────────

const S2_RULES: Rule[] = [
  ruleGte({
    id: "S2-incidents-gte-severe",
    description:
      "ESRS S2-5 : incidents droits humains totaux ≥ incidents graves.",
    a: "S2-5_human_rights_incidents",
    b: "S2-5_severe_human_rights_incidents",
    severity: "error",
    standards: ["S2"],
  }),
];

// ─── 10. Cohérence corruption G1 ────────────────────────────────────────────

const G1_RULES: Rule[] = [
  ruleGte({
    id: "G1-incidents-gte-convictions",
    description:
      "ESRS G1-4 : incidents avérés de corruption ≥ condamnations pour corruption.",
    a: "G1-4_corruption_incidents",
    b: "G1-4_corruption_convictions",
    severity: "error",
    standards: ["G1"],
  }),
];

// ─── 11. S4 vie privée ───────────────────────────────────────────────────────

const S4_RULES: Rule[] = [
  ruleGte({
    id: "S4-incidents-gte-breaches",
    description:
      "ESRS S4-5 : incidents vie privée ≥ violations de données confirmées.",
    a: "S4-5_data_privacy_incidents",
    b: "S4-5_data_breaches",
    severity: "error",
    standards: ["S4"],
  }),
  ruleGte({
    id: "S4-incidents-gte-recalls",
    description:
      "ESRS S4-5 : incidents sécurité produit ≥ rappels produits.",
    a: "S4-5_product_safety_incidents",
    b: "S4-5_product_recalls",
    severity: "warning",
    standards: ["S4"],
  }),
];

// ─── Corpus exporté ─────────────────────────────────────────────────────────

export const RULES_SET2: Rule[] = [
  ...E1_RULES,
  ...E3_RULES,
  ...E5_RULES,
  ...S1_RULES,
  ...S2_RULES,
  ...S4_RULES,
  ...G1_RULES,
  ...PERCENT_RULES,
  ...POSITIVE_RULES,
  ...COUNT_RULES,
  ...COMPLETENESS_RULES,
  ...INTENSITY_RULES,
  ruleDependenciesPresent({ id: "global-dependencies-present", severity: "warning" }),
];

/**
 * Sous-corpus utiles si on veut valider sélectivement.
 */
export const RULES_BY_FAMILY = {
  E1: E1_RULES,
  E3: E3_RULES,
  E5: E5_RULES,
  S1: S1_RULES,
  S2: S2_RULES,
  S4: S4_RULES,
  G1: G1_RULES,
  ranges: [...PERCENT_RULES, ...POSITIVE_RULES, ...COUNT_RULES],
  completeness: COMPLETENESS_RULES,
};
