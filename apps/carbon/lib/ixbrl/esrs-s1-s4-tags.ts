/**
 * Tags iXBRL ESRS S1-S4 — Effectifs propres, Chaîne de valeur, Communautés, Consommateurs.
 *
 * Référence : ESRS XBRL Taxonomy 2024-12-04 (EFRAG).
 *
 * S1 — Effectifs propres (20 dps) : politiques, processus, effectif, contrats,
 *      rotation, parité salariale, accidents du travail, droits humains.
 * S2 — Travailleurs chaîne de valeur (11 dps) : politiques, incidents droits humains,
 *      travail des enfants, travail forcé, amendes.
 * S3 — Communautés affectées (9 dps) : politiques, engagement, incidents.
 * S4 — Consommateurs et utilisateurs finaux (11 dps) : politiques, données personnelles,
 *      sécurité produit, plaintes, amendes.
 *
 * Total : 51 datapoints.
 */

import type { IxbrlTagDef } from "./esrs-e1-tags";

// ---------------------------------------------------------------------------
// S1 — Effectifs propres (own workforce)
// ---------------------------------------------------------------------------
const ESRS_S1_TAGS: IxbrlTagDef[] = [
  // S1-1 à S1-3 — Narratifs
  {
    datapointId: "S1-1_policies",
    elementName: "PoliciesRelatedToOwnWorkforce",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },
  {
    datapointId: "S1-2_processes_engagement",
    elementName: "ProcessesForEngagingWithOwnWorkforce",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },
  {
    datapointId: "S1-3_remediation_channels",
    elementName: "ChannelsToRaiseConcernsOwnWorkforce",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },

  // S1-6 — Effectifs (headcount à la clôture = instant)
  {
    datapointId: "S1-6_total_employees",
    elementName: "TotalNumberOfEmployees",
    itemType: "decimalItemType",
    periodType: "instant",
    unitRef: "pure",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "S1-6_employees_male",
    elementName: "NumberOfMaleEmployees",
    itemType: "decimalItemType",
    periodType: "instant",
    unitRef: "pure",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "S1-6_employees_female",
    elementName: "NumberOfFemaleEmployees",
    itemType: "decimalItemType",
    periodType: "instant",
    unitRef: "pure",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "S1-6_employees_other",
    elementName: "NumberOfOtherGenderEmployees",
    itemType: "decimalItemType",
    periodType: "instant",
    unitRef: "pure",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "S1-6_permanent_contracts",
    elementName: "EmployeesOnPermanentContracts",
    itemType: "decimalItemType",
    periodType: "instant",
    unitRef: "pure",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "S1-6_temporary_contracts",
    elementName: "EmployeesOnTemporaryContracts",
    itemType: "decimalItemType",
    periodType: "instant",
    unitRef: "pure",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "S1-6_turnover_rate",
    elementName: "EmployeeTurnoverRate",
    itemType: "percentItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "4",
    nonNegative: true,
  },

  // S1-8 — Couverture conventions collectives
  {
    datapointId: "S1-8_collective_bargaining_coverage",
    elementName: "CollectiveBargainingCoverage",
    itemType: "percentItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "4",
    nonNegative: true,
  },

  // S1-9 — Parité salariale (gap peut être négatif selon le sens de calcul)
  {
    datapointId: "S1-9_gender_pay_gap",
    elementName: "GenderPayGap",
    itemType: "percentItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "4",
  },
  {
    datapointId: "S1-9_ceo_to_median_ratio",
    elementName: "CEOToMedianEmployeePayRatio",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "2",
    nonNegative: true,
  },

  // S1-10 — Salaire décent
  {
    datapointId: "S1-10_adequate_wages",
    elementName: "EmployeesPaidAboveAdequateWage",
    itemType: "percentItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "4",
    nonNegative: true,
  },

  // S1-13 — Formation
  {
    datapointId: "S1-13_training_hours_per_employee",
    elementName: "AverageTrainingHoursPerEmployee",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "1",
    nonNegative: true,
  },

  // S1-14 — Accidents du travail
  {
    datapointId: "S1-14_recordable_work_accidents",
    elementName: "RecordableWorkRelatedAccidents",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "S1-14_fatalities",
    elementName: "FatalitiesDueToWorkRelatedInjuries",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "S1-14_lost_day_rate",
    elementName: "LostDayRateDueToWorkRelatedAccidents",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "2",
    nonNegative: true,
  },

  // S1-16 — Droits humains
  {
    datapointId: "S1-16_human_rights_incidents",
    elementName: "HumanRightsIncidentsInOwnWorkforce",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "0",
    nonNegative: true,
  },

  // S1-17 — Discrimination
  {
    datapointId: "S1-17_discrimination_incidents",
    elementName: "DiscriminationIncidentsInOwnWorkforce",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "0",
    nonNegative: true,
  },
];

// ---------------------------------------------------------------------------
// S2 — Travailleurs de la chaîne de valeur (value chain workers)
// ---------------------------------------------------------------------------
const ESRS_S2_TAGS: IxbrlTagDef[] = [
  // S2-1 à S2-5 — Narratifs
  {
    datapointId: "S2-1_policies",
    elementName: "PoliciesRelatedToValueChainWorkers",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },
  {
    datapointId: "S2-2_engagement_processes",
    elementName: "ProcessesForEngagingWithValueChainWorkers",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },
  {
    datapointId: "S2-3_remediation_channels",
    elementName: "ChannelsToRaiseConcernsValueChain",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },
  {
    datapointId: "S2-4_actions",
    elementName: "ActionsRelatedToValueChainWorkers",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },
  {
    datapointId: "S2-5_targets",
    elementName: "TargetsForValueChainWorkers",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },

  // S2-5 — Métriques
  {
    datapointId: "S2-5_value_chain_workers_estimate",
    elementName: "EstimatedNumberOfValueChainWorkers",
    itemType: "decimalItemType",
    periodType: "instant",
    unitRef: "pure",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "S2-5_human_rights_incidents",
    elementName: "HumanRightsIncidentsInValueChain",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "S2-5_severe_human_rights_incidents",
    elementName: "SevereHumanRightsIncidentsInValueChain",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "S2-5_child_labor_incidents",
    elementName: "ChildLabourIncidentsInValueChain",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "S2-5_forced_labor_incidents",
    elementName: "ForcedLabourIncidentsInValueChain",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "S2-5_human_rights_fines",
    elementName: "FinesRelatedToHumanRightsInValueChain",
    itemType: "monetaryItemType",
    periodType: "duration",
    unitRef: "eur",
    decimals: "0",
    nonNegative: true,
  },
];

// ---------------------------------------------------------------------------
// S3 — Communautés affectées (affected communities)
// ---------------------------------------------------------------------------
const ESRS_S3_TAGS: IxbrlTagDef[] = [
  // S3-1 à S3-5 — Narratifs
  {
    datapointId: "S3-1_policies",
    elementName: "PoliciesRelatedToAffectedCommunities",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },
  {
    datapointId: "S3-2_engagement_processes",
    elementName: "ProcessesForEngagingWithAffectedCommunities",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },
  {
    datapointId: "S3-3_remediation_channels",
    elementName: "ChannelsToRaiseConcernsAffectedCommunities",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },
  {
    datapointId: "S3-4_actions",
    elementName: "ActionsRelatedToAffectedCommunities",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },
  {
    datapointId: "S3-5_targets",
    elementName: "TargetsRelatedToAffectedCommunities",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },

  // S3-5 — Métriques (voluntary)
  {
    datapointId: "S3-5_communities_affected",
    elementName: "NumberOfMateriallyAffectedCommunities",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "S3-5_indigenous_consent_disputes",
    elementName: "IndigenousFPICConsentDisputes",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "S3-5_displacement_incidents",
    elementName: "CommunityDisplacementIncidents",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "S3-5_community_human_rights_incidents",
    elementName: "HumanRightsIncidentsAffectingCommunities",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "0",
    nonNegative: true,
  },
];

// ---------------------------------------------------------------------------
// S4 — Consommateurs et utilisateurs finaux (consumers and end-users)
// ---------------------------------------------------------------------------
const ESRS_S4_TAGS: IxbrlTagDef[] = [
  // S4-1 à S4-5 — Narratifs
  {
    datapointId: "S4-1_policies",
    elementName: "PoliciesRelatedToConsumersAndEndUsers",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },
  {
    datapointId: "S4-2_engagement_processes",
    elementName: "ProcessesForEngagingWithConsumers",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },
  {
    datapointId: "S4-3_remediation_channels",
    elementName: "ChannelsToRaiseConcernsForConsumers",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },
  {
    datapointId: "S4-4_actions",
    elementName: "ActionsRelatedToConsumersAndEndUsers",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },
  {
    datapointId: "S4-5_targets",
    elementName: "TargetsRelatedToConsumers",
    itemType: "stringItemType",
    periodType: "duration",
    unitRef: "",
    decimals: "INF",
  },

  // S4-5 — Métriques
  {
    datapointId: "S4-5_data_privacy_incidents",
    elementName: "DataPrivacyIncidents",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "S4-5_data_breaches",
    elementName: "ConfirmedPersonalDataBreaches",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "S4-5_product_safety_incidents",
    elementName: "ProductSafetyIncidents",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "S4-5_product_recalls",
    elementName: "ProductRecalls",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "S4-5_substantiated_complaints",
    elementName: "SubstantiatedConsumerComplaints",
    itemType: "decimalItemType",
    periodType: "duration",
    unitRef: "pure",
    decimals: "0",
    nonNegative: true,
  },
  {
    datapointId: "S4-5_consumer_protection_fines",
    elementName: "FinesRelatedToConsumerProtection",
    itemType: "monetaryItemType",
    periodType: "duration",
    unitRef: "eur",
    decimals: "0",
    nonNegative: true,
  },
];

// ---------------------------------------------------------------------------
// Export agrégé S1-S4
// ---------------------------------------------------------------------------
export const ESRS_S1_S4_TAGS: IxbrlTagDef[] = [
  ...ESRS_S1_TAGS,
  ...ESRS_S2_TAGS,
  ...ESRS_S3_TAGS,
  ...ESRS_S4_TAGS,
];

/** Index pour lookup rapide par datapointId. */
export const ESRS_S1_S4_TAG_INDEX: Map<string, IxbrlTagDef> = new Map(
  ESRS_S1_S4_TAGS.map((t) => [t.datapointId, t]),
);

/** Liste des datapointIds couverts. */
export const ESRS_S1_S4_COVERED_IDS = ESRS_S1_S4_TAGS.map((t) => t.datapointId);
