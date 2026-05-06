/**
 * Tags iXBRL ESRS E5 — Utilisation des ressources et économie circulaire.
 *
 * Référence : ESRS XBRL Taxonomy 2024-12-04 (EFRAG).
 * Couvre : E5-1 politiques, E5-2 actions, E5-3 cibles,
 *          E5-4 flux entrants (total, % recyclés, % renouvelables),
 *          E5-5 flux sortants produits/emballages, déchets total/dangereux/détournés/éliminés,
 *          E5-6 impacts financiers.
 * Total : 13 datapoints (11 mandatory, 2 voluntary).
 */

import type { IxbrlTagDef } from "./esrs-e1-tags";

export const ESRS_E5_TAGS: IxbrlTagDef[] = [
  // E5-1 — Politiques
  {
    datapointId: "E5-1_policies",
    elementName: "PoliciesOnResourceUseAndCircularEconomy",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },

  // E5-2 — Actions et ressources
  {
    datapointId: "E5-2_actions",
    elementName: "CircularEconomyActionsAndResources",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },

  // E5-3 — Cibles
  {
    datapointId: "E5-3_targets",
    elementName: "ResourceAndCircularEconomyTargets",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },

  // E5-4 — Flux entrants
  {
    datapointId: "E5-4_resource_inflows_total",
    elementName: "TotalResourceInflows",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "tonne",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "E5-4_resource_inflows_recycled_pct",
    elementName: "ShareOfRecycledInputsInResourceInflows",
    itemType: "percentItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "4",
    nonNegative: true,
  },
  {
    datapointId: "E5-4_renewable_inputs_pct",
    elementName: "ShareOfRenewableInputs",
    itemType: "percentItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "4",
    nonNegative: true,
  },

  // E5-5 — Flux sortants et déchets
  {
    datapointId: "E5-5_resource_outflows_products",
    elementName: "ResourceOutflowsProducts",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "tonne",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "E5-5_resource_outflows_packaging",
    elementName: "ResourceOutflowsPackaging",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "tonne",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "E5-5_waste_total",
    elementName: "TotalWasteGenerated",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "tonne",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "E5-5_waste_hazardous",
    elementName: "HazardousWaste",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "tonne",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "E5-5_waste_diverted_from_disposal",
    elementName: "WasteDivertedFromDisposal",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "tonne",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "E5-5_waste_directed_to_disposal",
    elementName: "WasteDirectedToDisposal",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "tonne",
    decimals: "0",
    nonNegative: true,
  },

  // E5-6 — Impacts financiers (voluntary)
  {
    datapointId: "E5-6_circular_financial_effects",
    elementName: "FinancialEffectsFromResourceUseAndCircularEconomy",
    itemType: "monetaryItemType",
    periodType: "instant",
    unitRef: "m_eur",
    decimals: "-6",
    nonNegative: true,
  },
];

/** Index pour lookup rapide par datapointId. */
export const ESRS_E5_TAG_INDEX: Map<string, IxbrlTagDef> = new Map(
  ESRS_E5_TAGS.map((t) => [t.datapointId, t]),
);

/** Liste des datapointIds couverts. */
export const ESRS_E5_COVERED_IDS = ESRS_E5_TAGS.map((t) => t.datapointId);
