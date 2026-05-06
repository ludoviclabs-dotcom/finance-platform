/**
 * Tags iXBRL ESRS E3 — Eau et ressources marines.
 *
 * Référence : ESRS XBRL Taxonomy 2024-12-04 (EFRAG).
 * Couvre : E3-1 politiques, E3-2 actions, E3-3 cibles,
 *          E3-4 consommation/prélèvement/rejet/recyclage/intensité,
 *          E3-5 impacts financiers.
 * Total : 10 datapoints (8 mandatory, 2 voluntary).
 */

import type { IxbrlTagDef } from "./esrs-e1-tags";

export const ESRS_E3_TAGS: IxbrlTagDef[] = [
  // E3-1 — Politiques
  {
    datapointId: "E3-1_policies",
    elementName: "PoliciesRelatedToWaterAndMarineResources",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },

  // E3-2 — Actions et ressources
  {
    datapointId: "E3-2_actions",
    elementName: "ActionsAndResourcesWaterAndMarine",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },

  // E3-3 — Cibles
  {
    datapointId: "E3-3_targets",
    elementName: "TargetsRelatedToWaterAndMarineResources",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },

  // E3-4 — Métriques eau
  {
    datapointId: "E3-4_water_consumption_total",
    elementName: "TotalWaterConsumption",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "m3",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "E3-4_water_consumption_stress_areas",
    elementName: "WaterConsumptionInWaterStressAreas",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "m3",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "E3-4_water_withdrawal",
    elementName: "TotalWaterWithdrawal",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "m3",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "E3-4_water_discharge",
    elementName: "TotalWaterDischarge",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "m3",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "E3-4_water_recycled",
    elementName: "WaterRecycledAndReused",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "m3",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "E3-4_water_intensity",
    elementName: "WaterIntensityPerNetRevenue",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "m3_per_meur",
    decimals: "2",
    nonNegative: true,
  },

  // E3-5 — Impacts financiers (voluntary)
  {
    datapointId: "E3-5_water_financial_effects",
    elementName: "FinancialEffectsFromWaterAndMarineResources",
    itemType: "monetaryItemType",
    periodType: "instant",
    unitRef: "m_eur",
    decimals: "-6",
    nonNegative: true,
  },
];

/** Index pour lookup rapide par datapointId. */
export const ESRS_E3_TAG_INDEX: Map<string, IxbrlTagDef> = new Map(
  ESRS_E3_TAGS.map((t) => [t.datapointId, t]),
);

/** Liste des datapointIds couverts. */
export const ESRS_E3_COVERED_IDS = ESRS_E3_TAGS.map((t) => t.datapointId);
