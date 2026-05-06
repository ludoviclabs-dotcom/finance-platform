/**
 * Mapping datapoints CarbonCo → tags iXBRL ESRS Set 2.
 *
 * Référence : ESRS XBRL Taxonomy 2024-12-04 (EFRAG) — namespaces officiels :
 *   esrs   = https://xbrl.efrag.org/taxonomy/esrs/2024-12-04/esrs
 *   esrs_cor = https://xbrl.efrag.org/taxonomy/esrs/2024-12-04/esrs_cor
 *
 * Chaque entrée :
 *   - datapointId   id interne CarbonCo
 *   - elementName   nom de l'élément XBRL (sans préfixe)
 *   - itemType      "monetaryItemType" | "decimalItemType" | "stringItemType" | "booleanItemType"
 *   - periodType    "instant" | "duration"
 *   - balance       "credit" | "debit" (pour items monétaires)
 *   - decimals      précision déclarée (ex : "0", "-3" pour milliers, "INF" pour exact)
 *
 * Phase 2 : ce fichier expose également les unités XBRL pour E2-E5, S1-S4, G1
 * (tonne, m3, ha, m3_per_meur) afin que le builder les découvre dans IXBRL_UNITS.
 */

export type IxbrlItemType =
  | "monetaryItemType"
  | "decimalItemType"
  | "percentItemType"
  | "stringItemType"
  | "booleanItemType";

export type IxbrlPeriodType = "instant" | "duration";

export interface IxbrlTagDef {
  datapointId: string;
  elementName: string;
  itemType: IxbrlItemType;
  periodType: IxbrlPeriodType;
  unitRef: string; // référence au unit défini dans l'instance (eur, tco2e, mwh, pure, etc.)
  decimals: string;
  /** Si true, valeur attendue strictement positive (validation). */
  nonNegative?: boolean;
}

/** Unités XBRL réutilisables dans toute l'instance. */
export const IXBRL_UNITS: Record<
  string,
  { id: string; measures: string[] | { numerator: string; denominator: string } }
> = {
  // --- Unités Phase 1 ---
  eur: { id: "eur", measures: ["iso4217:EUR"] },
  m_eur: { id: "m_eur", measures: ["iso4217:EUR"] }, // affiché en millions via decimals=-6
  tco2e: { id: "tco2e", measures: ["esrs:tCO2e"] },
  mwh: { id: "mwh", measures: ["esrs:MWh"] },
  pure: { id: "pure", measures: ["xbrli:pure"] },
  mwh_per_meur: {
    id: "mwh_per_meur",
    measures: { numerator: "esrs:MWh", denominator: "iso4217:EUR" },
  },
  tco2e_per_meur: {
    id: "tco2e_per_meur",
    measures: { numerator: "esrs:tCO2e", denominator: "iso4217:EUR" },
  },
  eur_per_tco2e: {
    id: "eur_per_tco2e",
    measures: { numerator: "iso4217:EUR", denominator: "esrs:tCO2e" },
  },
  // --- Unités Phase 2 (E2-E5, S1-S4, G1) ---
  tonne: { id: "tonne", measures: ["esrs:tonne"] },
  m3: { id: "m3", measures: ["esrs:m3"] },
  ha: { id: "ha", measures: ["esrs:ha"] },
  m3_per_meur: {
    id: "m3_per_meur",
    measures: { numerator: "esrs:m3", denominator: "iso4217:EUR" },
  },
};

export const ESRS_E1_TAGS: IxbrlTagDef[] = [
  // E1-1 / E1-2 / E1-3 / E1-4 — narratifs (textBlock)
  {
    datapointId: "E1-1_transition_plan",
    elementName: "TransitionPlanForClimateChangeMitigation",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },
  {
    datapointId: "E1-2_policies",
    elementName: "PoliciesRelatedToClimateChangeMitigationAndAdaptation",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },
  {
    datapointId: "E1-3_actions",
    elementName: "ActionsAndResourcesInRelationToClimateChangePolicies",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },
  {
    datapointId: "E1-4_targets",
    elementName: "GHGEmissionReductionTargets",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },

  // E1-5 — Énergie
  {
    datapointId: "E1-5_energy_consumption_total",
    elementName: "TotalEnergyConsumption",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "mwh",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "E1-5_energy_consumption_renewable",
    elementName: "RenewableEnergyConsumption",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "mwh",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "E1-5_energy_consumption_non_renewable",
    elementName: "NonRenewableEnergyConsumption",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "mwh",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "E1-5_energy_intensity",
    elementName: "EnergyIntensityPerNetRevenue",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "mwh_per_meur",
    decimals: "2",
    nonNegative: true,
  },

  // E1-6 — Émissions GES Scope 1, 2, 3
  {
    datapointId: "E1-6_scope1_gross",
    elementName: "GrossScope1GHGEmissions",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "tco2e",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "E1-6_scope2_location_based",
    elementName: "GrossLocationBasedScope2GHGEmissions",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "tco2e",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "E1-6_scope2_market_based",
    elementName: "GrossMarketBasedScope2GHGEmissions",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "tco2e",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "E1-6_scope3_total",
    elementName: "GrossScope3GHGEmissions",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "tco2e",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "E1-6_total_ghg",
    elementName: "TotalGHGEmissions",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "tco2e",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "E1-6_ghg_intensity",
    elementName: "GHGEmissionsIntensityPerNetRevenue",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "tco2e_per_meur",
    decimals: "2",
    nonNegative: true,
  },

  // E1-7 — Suppression / crédits carbone
  {
    datapointId: "E1-7_removals_storage",
    elementName: "GHGRemovalsAndStorage",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "tco2e",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "E1-7_carbon_credits",
    elementName: "CarbonCreditsCancelledOrPlannedToBeUsed",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "tco2e",
    decimals: "0",
    nonNegative: true,
  },

  // E1-8 — Prix interne du carbone
  {
    datapointId: "E1-8_internal_carbon_price",
    elementName: "InternalCarbonPriceApplied",
    itemType: "monetaryItemType",
    periodType: "instant",
    unitRef: "eur_per_tco2e",
    decimals: "0",
    nonNegative: true,
  },

  // E1-9 — Risques climatiques
  {
    datapointId: "E1-9_assets_at_physical_risk",
    elementName: "AssetsAtMaterialPhysicalRisk",
    itemType: "monetaryItemType",
    periodType: "instant",
    unitRef: "m_eur",
    decimals: "-6",
    nonNegative: true,
  },
  {
    datapointId: "E1-9_assets_at_transition_risk",
    elementName: "AssetsAtMaterialTransitionRisk",
    itemType: "monetaryItemType",
    periodType: "instant",
    unitRef: "m_eur",
    decimals: "-6",
    nonNegative: true,
  },
  {
    datapointId: "E1-9_capex_aligned_taxonomy",
    elementName: "CapexAlignedWithEUTaxonomy",
    itemType: "percentItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "4",
    nonNegative: true,
  },
];

/** Index pour lookup rapide par datapointId. */
export const ESRS_E1_TAG_INDEX: Map<string, IxbrlTagDef> = new Map(
  ESRS_E1_TAGS.map((t) => [t.datapointId, t]),
);

/** Liste des datapointIds couverts. */
export const ESRS_E1_COVERED_IDS = ESRS_E1_TAGS.map((t) => t.datapointId);
