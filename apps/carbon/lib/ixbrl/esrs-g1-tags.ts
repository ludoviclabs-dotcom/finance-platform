/**
 * Tags iXBRL ESRS G1 — Conduite des affaires.
 *
 * Référence : ESRS XBRL Taxonomy 2024-12-04 (EFRAG).
 * Couvre : G1-1 politiques, G1-2 fournisseurs, G1-3 anti-corruption,
 *          G1-4 incidents corruption, G1-5 contributions politiques/lobbying,
 *          G1-6 délais de paiement fournisseurs.
 * Total : 11 datapoints (tous mandatory sauf couverture formation anti-corruption).
 */

import type { IxbrlTagDef } from "./esrs-e1-tags";

export const ESRS_G1_TAGS: IxbrlTagDef[] = [
  // G1-1 — Politiques conduite des affaires
  {
    datapointId: "G1-1_business_conduct_policies",
    elementName: "BusinessConductPoliciesAndCorporateCulture",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },

  // G1-2 — Relations fournisseurs
  {
    datapointId: "G1-2_supplier_relationships",
    elementName: "ManagementOfRelationshipsWithSuppliers",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },

  // G1-3 — Prévention corruption
  {
    datapointId: "G1-3_anticorruption_prevention",
    elementName: "PreventionAndDetectionOfCorruptionAndBribery",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },
  {
    datapointId: "G1-3_anticorruption_training_coverage",
    elementName: "AntiCorruptionTrainingCoverage",
    itemType: "percentItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "4",
    nonNegative: true,
  },

  // G1-4 — Incidents corruption
  {
    datapointId: "G1-4_corruption_incidents",
    elementName: "ConfirmedIncidentsOfCorruptionOrBribery",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "G1-4_corruption_convictions",
    elementName: "ConvictionsForCorruption",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "G1-4_corruption_fines",
    elementName: "FinesForCorruption",
    itemType: "monetaryItemType",
    periodType: "duration",
    unitRef: "eur",
    decimals: "0",
    nonNegative: true,
  },

  // G1-5 — Contributions politiques et lobbying
  {
    datapointId: "G1-5_political_contributions",
    elementName: "TotalPoliticalContributions",
    itemType: "monetaryItemType",
    periodType: "duration",
    unitRef: "eur",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "G1-5_lobbying_membership_fees",
    elementName: "LobbyingAndTradeAssociationMembershipFees",
    itemType: "monetaryItemType",
    periodType: "duration",
    unitRef: "eur",
    decimals: "0",
    nonNegative: true,
  },

  // G1-6 — Délais de paiement fournisseurs
  {
    datapointId: "G1-6_supplier_payment_days",
    elementName: "AverageSupplierPaymentDays",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "G1-6_late_payments_pct",
    elementName: "PercentageOfLatePayments",
    itemType: "percentItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "4",
    nonNegative: true,
  },
];

/** Index pour lookup rapide par datapointId. */
export const ESRS_G1_TAG_INDEX: Map<string, IxbrlTagDef> = new Map(
  ESRS_G1_TAGS.map((t) => [t.datapointId, t]),
);

/** Liste des datapointIds couverts. */
export const ESRS_G1_COVERED_IDS = ESRS_G1_TAGS.map((t) => t.datapointId);
