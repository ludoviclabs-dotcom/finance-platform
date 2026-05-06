/**
 * Tags iXBRL ESRS E4 — Biodiversité et écosystèmes.
 *
 * Référence : ESRS XBRL Taxonomy 2024-12-04 (EFRAG).
 * Couvre : E4-1 plan transition, E4-2 politiques, E4-3 actions, E4-4 cibles,
 *          E4-5 sites sensibles / changement usage sols / déforestation / restauration,
 *          E4-6 impacts financiers.
 * Total : 9 datapoints (6 mandatory, 3 voluntary).
 */

import type { IxbrlTagDef } from "./esrs-e1-tags";

export const ESRS_E4_TAGS: IxbrlTagDef[] = [
  // E4-1 — Plan de transition (voluntary)
  {
    datapointId: "E4-1_transition_plan",
    elementName: "BiodiversityAndEcosystemsTransitionPlan",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },

  // E4-2 — Politiques
  {
    datapointId: "E4-2_policies",
    elementName: "BiodiversityAndEcosystemsPolicies",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },

  // E4-3 — Actions et ressources
  {
    datapointId: "E4-3_actions",
    elementName: "BiodiversityActionsAndResources",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },

  // E4-4 — Cibles
  {
    datapointId: "E4-4_targets",
    elementName: "BiodiversityAndEcosystemsTargets",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },

  // E4-5 — Métriques biodiversité
  {
    datapointId: "E4-5_sites_near_sensitive_areas",
    elementName: "SitesNearBiodiversitySensitiveAreas",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "E4-5_land_use_change",
    elementName: "LandUseChange",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "ha",
    decimals: "2",
    nonNegative: true,
  },
  {
    datapointId: "E4-5_deforestation_footprint",
    elementName: "DeforestationFootprint",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "ha",
    decimals: "2",
    nonNegative: true,
  },
  {
    datapointId: "E4-5_ecosystems_restored",
    elementName: "AreaOfRestoredEcosystems",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "ha",
    decimals: "2",
    nonNegative: true,
  },

  // E4-6 — Impacts financiers (voluntary)
  {
    datapointId: "E4-6_biodiversity_financial_effects",
    elementName: "FinancialEffectsFromBiodiversityAndEcosystems",
    itemType: "monetaryItemType",
    periodType: "instant",
    unitRef: "m_eur",
    decimals: "-6",
    nonNegative: true,
  },
];

/** Index pour lookup rapide par datapointId. */
export const ESRS_E4_TAG_INDEX: Map<string, IxbrlTagDef> = new Map(
  ESRS_E4_TAGS.map((t) => [t.datapointId, t]),
);

/** Liste des datapointIds couverts. */
export const ESRS_E4_COVERED_IDS = ESRS_E4_TAGS.map((t) => t.datapointId);
