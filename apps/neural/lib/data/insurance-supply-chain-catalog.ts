export type InsuranceScAgentSlug =
  | "repair-network-insur"
  | "expert-mgmt-insur"
  | "fraud-detect-sc"
  | "sapin2-compliance";

export type InsuranceScVerdict = "PASS" | "PASS_WITH_REVIEW" | "BLOCK";
export type InsuranceScGateState = "pass" | "review" | "block";

export interface InsuranceScAgent {
  id: string;
  slug: InsuranceScAgentSlug;
  name: string;
  owner: string;
  mission: string;
  primaryGate: string;
  workbook: string;
  kpis: string[];
}

export interface InsuranceScGate {
  id: string;
  label: string;
  severity: "HIGH" | "CRITICAL";
  blocking: boolean;
  source: string;
  owner: string;
}

export interface InsuranceScSource {
  id: string;
  domain: string;
  authority: string;
  title: string;
  date: string;
  impact: string;
}

export interface InsuranceScScenario {
  id: string;
  agentSlug: InsuranceScAgentSlug;
  label: string;
  claimLine: string;
  verdict: InsuranceScVerdict;
  summary: string;
  gates: Array<{
    id: string;
    state: InsuranceScGateState;
    note: string;
  }>;
}

export const INSURANCE_SC_SUMMARY = {
  agents: 4,
  reservedServices: 2,
  workbooks: 6,
  gates: 10,
  scenarios: 12,
  sourceDate: "25/04/2026",
} as const;

export const INSURANCE_SC_AGENTS: InsuranceScAgent[] = [
  {
    id: "ISC-A001",
    slug: "repair-network-insur",
    name: "RepairNetworkInsur",
    owner: "Claims Supply Chain",
    mission:
      "Piloter le reseau de reparateurs, comparer qualite/cout/delai, et preserver le libre choix de l'assure.",
    primaryGate: "GATE-REPAIRER-FREE-CHOICE",
    workbook: "NEURAL_ISC001_RepairNetworkInsur.xlsx",
    kpis: ["Libre choix trace", "SLA reparateur", "Anomalies devis"],
  },
  {
    id: "ISC-A002",
    slug: "expert-mgmt-insur",
    name: "ExpertMgmtInsur",
    owner: "Claims Expertise",
    mission:
      "Dispatcher les experts, verifier mandat, rapport, contestations et completude des pieces.",
    primaryGate: "GATE-EXPERT-MANDATE",
    workbook: "NEURAL_ISC002_ExpertMgmtInsur.xlsx",
    kpis: ["Mandat ecrit", "Rapport complet", "Delai expertise"],
  },
  {
    id: "ISC-A003",
    slug: "fraud-detect-sc",
    name: "FraudDetectSC",
    owner: "Fraud + DPO",
    mission:
      "Detecter surfacturation, collusion et fausses factures comme alertes explicables avec revue humaine.",
    primaryGate: "GATE-GDPR-AUTO-DECISION",
    workbook: "NEURAL_ISC003_FraudDetectSC.xlsx",
    kpis: ["Alertes expliquees", "HITL fraude", "Zero auto-denial"],
  },
  {
    id: "ISC-A004",
    slug: "sapin2-compliance",
    name: "Sapin2Compliance",
    owner: "Compliance",
    mission:
      "Verifier l'evaluation des tiers, les risques de corruption et les controles comptables fournisseurs.",
    primaryGate: "GATE-SAPIN2-THIRD-PARTY",
    workbook: "NEURAL_ISC004_Sapin2Compliance.xlsx",
    kpis: ["Due diligence tiers", "COI", "Controles paiement"],
  },
];

export const INSURANCE_SC_SERVICES = [
  {
    id: "ISC-A005",
    name: "InsurRegWatch",
    mission: "Veille ACPR, CNIL, AFA, DGCCRF, Legifrance et DORA.",
  },
  {
    id: "ISC-A006",
    name: "InsurEvidenceVault",
    mission: "Resolveur de sources et coffre de preuves avant generation.",
  },
] as const;

export const INSURANCE_SC_GATES: InsuranceScGate[] = [
  {
    id: "GATE-REPAIRER-FREE-CHOICE",
    label: "Libre choix du reparateur",
    severity: "CRITICAL",
    blocking: true,
    source: "Code des assurances L211-5-1",
    owner: "Claims Legal",
  },
  {
    id: "GATE-EXPERT-MANDATE",
    label: "Mandat expert present",
    severity: "CRITICAL",
    blocking: true,
    source: "Code de la route R326",
    owner: "Claims Expertise",
  },
  {
    id: "GATE-REPORT-COMPLETE",
    label: "Rapport d'expertise complet",
    severity: "HIGH",
    blocking: false,
    source: "Code de la route R326",
    owner: "Claims Expertise",
  },
  {
    id: "GATE-INVOICE-ANOMALY",
    label: "Anomalie devis/facture",
    severity: "HIGH",
    blocking: false,
    source: "DGCCRF ordre de reparation",
    owner: "Fraud",
  },
  {
    id: "GATE-COLLUSION-REVIEW",
    label: "Collusion potentielle revue",
    severity: "CRITICAL",
    blocking: true,
    source: "ALFA fraude assurance",
    owner: "Fraud",
  },
  {
    id: "GATE-HITL-FRAUD",
    label: "Revue humaine fraude",
    severity: "CRITICAL",
    blocking: true,
    source: "CNIL RGPD IA",
    owner: "Fraud + DPO",
  },
  {
    id: "GATE-GDPR-AUTO-DECISION",
    label: "Pas de decision defavorable automatique",
    severity: "CRITICAL",
    blocking: true,
    source: "RGPD article 22 / CNIL",
    owner: "DPO",
  },
  {
    id: "GATE-SAPIN2-THIRD-PARTY",
    label: "Evaluation tiers Sapin II",
    severity: "CRITICAL",
    blocking: true,
    source: "AFA recommandations",
    owner: "Compliance",
  },
  {
    id: "GATE-DORA-ICT-THIRD-PARTY",
    label: "Tiers TIC critique qualifie",
    severity: "HIGH",
    blocking: false,
    source: "ACPR DORA / ROI",
    owner: "Risk",
  },
  {
    id: "GATE-SOURCE-ACTIVE",
    label: "Source active",
    severity: "HIGH",
    blocking: true,
    source: "Sourcebook",
    owner: "AI Ops",
  },
];

export const INSURANCE_SC_SOURCES: InsuranceScSource[] = [
  {
    id: "SRC-ACPR-DORA-001",
    domain: "DORA",
    authority: "ACPR",
    title: "Registre d'information fournisseurs TIC",
    date: "2025-04-11",
    impact: "Inventaire, criticite, continuite et preuve fournisseur.",
  },
  {
    id: "SRC-ACPR-OUT-001",
    domain: "Externalisation",
    authority: "ACPR",
    title: "Activite ou fonction importante ou critique",
    date: "2025-01-03",
    impact: "Analyse cout, exit plan et notification ACPR si necessaire.",
  },
  {
    id: "SRC-CODE-ASS-001",
    domain: "Reparation",
    authority: "Legifrance",
    title: "Libre choix du reparateur",
    date: "2014-03-19",
    impact: "L'agent recommande sans imposer le reseau agree.",
  },
  {
    id: "SRC-DGCCRF-REP-001",
    domain: "Reparation",
    authority: "DGCCRF",
    title: "Ordre de reparation, devis, delai, PIEC",
    date: "2022-06-30",
    impact: "Controle les champs devis/facture et les pieces justificatives.",
  },
  {
    id: "SRC-ROUTE-EXP-001",
    domain: "Expertise",
    authority: "Legifrance",
    title: "Profession d'expert en automobile",
    date: "2026-04-25",
    impact: "Mandat, rapport, contestation et defauts dangereux.",
  },
  {
    id: "SRC-AFA-REC-001",
    domain: "Sapin II",
    authority: "AFA",
    title: "Recommandations anticorruption",
    date: "2021-01-12",
    impact: "Cartographie, evaluation tiers, controles et remediation.",
  },
  {
    id: "SRC-CNIL-AI-001",
    domain: "RGPD",
    authority: "CNIL",
    title: "IA et decision automatisee",
    date: "2026-04-25",
    impact: "Fraude = alerte explicable, pas sanction automatique.",
  },
  {
    id: "SRC-ALFA-2024-001",
    domain: "Fraude",
    authority: "ALFA",
    title: "902 M EUR de fraude totale identifiee en 2024",
    date: "2025-12-11",
    impact: "Justifie le business case fraude fournisseur sans donnees sensibles.",
  },
];

export const INSURANCE_SC_SCENARIOS: InsuranceScScenario[] = [
  {
    id: "REP-PASS-CHOICE",
    agentSlug: "repair-network-insur",
    label: "Recommandation reparateur neutre",
    claimLine: "auto",
    verdict: "PASS",
    summary: "Rang par SLA/cout/qualite, avec libre choix explicite.",
    gates: [
      { id: "GATE-REPAIRER-FREE-CHOICE", state: "pass", note: "Mention presente" },
      { id: "GATE-INVOICE-ANOMALY", state: "pass", note: "Pas d'ecart" },
      { id: "GATE-SOURCE-ACTIVE", state: "pass", note: "Source active" },
    ],
  },
  {
    id: "REP-REVIEW-INVOICE",
    agentSlug: "repair-network-insur",
    label: "Devis au-dessus du benchmark",
    claimLine: "auto",
    verdict: "PASS_WITH_REVIEW",
    summary: "Ecart tarifaire transmis a Claims Supply Chain.",
    gates: [
      { id: "GATE-REPAIRER-FREE-CHOICE", state: "pass", note: "Mention presente" },
      { id: "GATE-INVOICE-ANOMALY", state: "review", note: "Peer p90 depasse" },
      { id: "GATE-SOURCE-ACTIVE", state: "pass", note: "Source active" },
    ],
  },
  {
    id: "REP-BLOCK-NOCHOICE",
    agentSlug: "repair-network-insur",
    label: "Reseau impose sans mention",
    claimLine: "auto",
    verdict: "BLOCK",
    summary: "Blocage jusqu'a correction du wording libre choix.",
    gates: [
      { id: "GATE-REPAIRER-FREE-CHOICE", state: "block", note: "Mention absente" },
      { id: "GATE-SOURCE-ACTIVE", state: "pass", note: "Source active" },
    ],
  },
  {
    id: "EXP-PASS-REPORT",
    agentSlug: "expert-mgmt-insur",
    label: "Rapport expert complet",
    claimLine: "auto",
    verdict: "PASS",
    summary: "Mandat, operations, presents, documents et conclusions sont traces.",
    gates: [
      { id: "GATE-EXPERT-MANDATE", state: "pass", note: "Mandat OK" },
      { id: "GATE-REPORT-COMPLETE", state: "pass", note: "Champs OK" },
      { id: "GATE-SOURCE-ACTIVE", state: "pass", note: "Source active" },
    ],
  },
  {
    id: "EXP-REVIEW-INCOMPLETE",
    agentSlug: "expert-mgmt-insur",
    label: "Rapport incomplet",
    claimLine: "auto",
    verdict: "PASS_WITH_REVIEW",
    summary: "Retour a l'expert avant utilisation settlement.",
    gates: [
      { id: "GATE-EXPERT-MANDATE", state: "pass", note: "Mandat OK" },
      { id: "GATE-REPORT-COMPLETE", state: "review", note: "Presents manquants" },
      { id: "GATE-SOURCE-ACTIVE", state: "pass", note: "Source active" },
    ],
  },
  {
    id: "EXP-BLOCK-MANDATE",
    agentSlug: "expert-mgmt-insur",
    label: "Action sans mandat",
    claimLine: "auto",
    verdict: "BLOCK",
    summary: "Substitution au proprietaire bloquee sans mandat ecrit.",
    gates: [
      { id: "GATE-EXPERT-MANDATE", state: "block", note: "Mandat absent" },
      { id: "GATE-SOURCE-ACTIVE", state: "pass", note: "Source active" },
    ],
  },
  {
    id: "FRD-PASS-TRIAGE",
    agentSlug: "fraud-detect-sc",
    label: "Triage facture faible risque",
    claimLine: "home",
    verdict: "PASS",
    summary: "Trace audit uniquement, aucune action contre l'assure.",
    gates: [
      { id: "GATE-GDPR-AUTO-DECISION", state: "pass", note: "Pas d'auto-decision" },
      { id: "GATE-HITL-FRAUD", state: "pass", note: "Non requis" },
      { id: "GATE-SOURCE-ACTIVE", state: "pass", note: "Source active" },
    ],
  },
  {
    id: "FRD-REVIEW-COLLUSION",
    agentSlug: "fraud-detect-sc",
    label: "Boucle expert / reparateur",
    claimLine: "auto",
    verdict: "PASS_WITH_REVIEW",
    summary: "Brief d'enquete explicable, revu par un investigateur.",
    gates: [
      { id: "GATE-COLLUSION-REVIEW", state: "review", note: "Boucle detectee" },
      { id: "GATE-HITL-FRAUD", state: "review", note: "Investigateur assigne" },
      { id: "GATE-GDPR-AUTO-DECISION", state: "pass", note: "Pas de sanction auto" },
    ],
  },
  {
    id: "FRD-BLOCK-AUTODECISION",
    agentSlug: "fraud-detect-sc",
    label: "Refus automatique par score",
    claimLine: "home",
    verdict: "BLOCK",
    summary: "Blocage RGPD : l'agent ne peut produire qu'une alerte.",
    gates: [
      { id: "GATE-GDPR-AUTO-DECISION", state: "block", note: "Decision defavorable auto" },
      { id: "GATE-HITL-FRAUD", state: "block", note: "HITL absent" },
      { id: "GATE-SOURCE-ACTIVE", state: "pass", note: "Source active" },
    ],
  },
  {
    id: "S2-PASS-DUE",
    agentSlug: "sapin2-compliance",
    label: "Renouvellement tiers complet",
    claimLine: "auto",
    verdict: "PASS",
    summary: "Identite, beneficiaire, COI et risque pays documentes.",
    gates: [
      { id: "GATE-SAPIN2-THIRD-PARTY", state: "pass", note: "Evaluation complete" },
      { id: "GATE-COLLUSION-REVIEW", state: "pass", note: "Pas de signal" },
      { id: "GATE-SOURCE-ACTIVE", state: "pass", note: "Source active" },
    ],
  },
  {
    id: "S2-REVIEW-HIGHRISK",
    agentSlug: "sapin2-compliance",
    label: "Intermediaire a risque eleve",
    claimLine: "home",
    verdict: "PASS_WITH_REVIEW",
    summary: "Due diligence renforcee et revue compliance.",
    gates: [
      { id: "GATE-SAPIN2-THIRD-PARTY", state: "pass", note: "Evaluation presente" },
      { id: "GATE-COLLUSION-REVIEW", state: "review", note: "Relation a clarifier" },
      { id: "GATE-SOURCE-ACTIVE", state: "pass", note: "Source active" },
    ],
  },
  {
    id: "S2-BLOCK-MISSING",
    agentSlug: "sapin2-compliance",
    label: "Onboarding sans evaluation tiers",
    claimLine: "auto",
    verdict: "BLOCK",
    summary: "Blocage onboarding jusqu'a evidence Sapin II.",
    gates: [
      { id: "GATE-SAPIN2-THIRD-PARTY", state: "block", note: "Evaluation absente" },
      { id: "GATE-SOURCE-ACTIVE", state: "pass", note: "Source active" },
    ],
  },
];

export function getInsuranceScScenarios(agentSlug: InsuranceScAgentSlug) {
  return INSURANCE_SC_SCENARIOS.filter((scenario) => scenario.agentSlug === agentSlug);
}
