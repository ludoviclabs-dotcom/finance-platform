/**
 * Tags iXBRL ESRS E2 — Pollution.
 *
 * Référence : ESRS XBRL Taxonomy 2024-12-04 (EFRAG).
 * Couvre : E2-1 politiques, E2-2 actions, E2-3 cibles, E2-4 polluants air/eau/sol,
 *          E2-5 substances préoccupantes, E2-6 microplastiques + impacts financiers.
 * Total : 13 datapoints (11 mandatory, 2 voluntary).
 */

import type { IxbrlTagDef } from "./esrs-e1-tags";

export const ESRS_E2_TAGS: IxbrlTagDef[] = [
  // E2-1 — Politiques
  {
    datapointId: "E2-1_policies",
    elementName: "PoliciesRelatedToPollution",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },

  // E2-2 — Actions et ressources
  {
    datapointId: "E2-2_actions",
    elementName: "ActionsAndResourcesRelatedToPollution",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },

  // E2-3 — Cibles
  {
    datapointId: "E2-3_targets",
    elementName: "PollutionReductionTargets",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },

  // E2-4 — Polluants atmosphériques
  {
    datapointId: "E2-4_air_pollutants_total",
    elementName: "TotalAirPollutantEmissions",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "tonne",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "E2-4_air_nox",
    elementName: "NitrogenOxidesEmissions",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "tonne",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "E2-4_air_sox",
    elementName: "SulfurOxidesEmissions",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "tonne",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "E2-4_air_particulates",
    elementName: "ParticulateMatterEmissions",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "tonne",
    decimals: "0",
    nonNegative: true,
  },

  // E2-4 — Polluants eau et sol
  {
    datapointId: "E2-4_water_pollutants",
    elementName: "WaterPollutantDischarges",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "tonne",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "E2-4_soil_pollutants",
    elementName: "SoilPollutantReleases",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "tonne",
    decimals: "0",
    nonNegative: true,
  },

  // E2-5 — Substances préoccupantes
  {
    datapointId: "E2-5_substances_of_concern",
    elementName: "SubstancesOfConcernUsedOrProduced",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "tonne",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "E2-5_substances_very_high_concern",
    elementName: "SubstancesOfVeryHighConcern",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "tonne",
    decimals: "0",
    nonNegative: true,
  },

  // E2-6 — Microplastiques + impacts financiers (voluntary)
  {
    datapointId: "E2-6_microplastics_emissions",
    elementName: "MicroplasticsGeneratedOrUsed",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "tonne",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "E2-6_pollution_financial_impact",
    elementName: "FinancialEffectsFromPollutionRisks",
    itemType: "monetaryItemType",
    periodType: "instant",
    unitRef: "m_eur",
    decimals: "-6",
    nonNegative: true,
  },
];

/** Index pour lookup rapide par datapointId. */
export const ESRS_E2_TAG_INDEX: Map<string, IxbrlTagDef> = new Map(
  ESRS_E2_TAGS.map((t) => [t.datapointId, t]),
);

/** Liste des datapointIds couverts. */
export const ESRS_E2_COVERED_IDS = ESRS_E2_TAGS.map((t) => t.datapointId);
