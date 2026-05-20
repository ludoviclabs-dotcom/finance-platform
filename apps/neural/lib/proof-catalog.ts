import {
  AGENT_ENTRIES,
  PUBLIC_METRICS,
  type PublicEntry,
  type PublicStatus,
} from "@/lib/public-catalog";
import {
  MATRIX,
  countLiveAgents,
  countLiveCells,
  type Branch,
  type Sector,
} from "@/lib/data/agents-registry";

export type AgentProofStatus =
  | "excel_created"
  | "runtime_parsed"
  | "public_demo"
  | "export_audit"
  | "client_ready";

export type ProofScore = 0 | 1 | 2 | 3 | 4;

export interface WorkbookGroup {
  id: string;
  label: string;
  sector: Sector | "multi";
  branche: Branch | "multi";
  count: number;
  source: "desktop_external" | "runtime_repo";
  status: AgentProofStatus;
  note: string;
}

export interface AgentProofRecord {
  id: string;
  name: string;
  href: string;
  publicStatus: PublicStatus;
  proofStatus: AgentProofStatus;
  proofScore: ProofScore;
  proofScoreLabel: string;
  workbookSource: string;
  runtimeAvailable: boolean;
  publicPage: string;
  proofLimitations: string[];
  humanSupervision: string;
  exportAvailable: boolean;
  auditTrailAvailable: boolean;
  evidenceAssets: string[];
  nextAction: string;
  isFlagship: boolean;
  lastVerifiedAt: string;
}

export interface PriorityModelCard {
  id: string;
  name: string;
  href: string;
  workbookSource: string;
  proofStatus: AgentProofStatus;
  proofScore: ProofScore;
  exampleInput: string;
  exampleOutput: string;
  humanSupervision: string;
  exportAvailable: string;
  auditTrailAvailable: string;
  lastTrace: string;
  limitation: string;
  clientReadyBlocker: string;
  pilotCta: string;
}

interface AgentProofOverride {
  proofScore?: ProofScore;
  humanSupervision: string;
  exportAvailable: boolean;
  auditTrailAvailable: boolean;
  evidenceAssets: string[];
  nextAction: string;
  isFlagship?: boolean;
}

export const PROOF_LAST_VERIFIED_AT = "2026-05-10";

export const PROOF_STATUS_LABELS: Record<AgentProofStatus, string> = {
  excel_created: "Excel créé",
  runtime_parsed: "Runtime parsé",
  public_demo: "Démo publique",
  export_audit: "Export / audit",
  client_ready: "Prêt client",
};

export const PROOF_SCORE_LABELS: Record<ProofScore, string> = {
  0: "Excel only",
  1: "Parsé runtime",
  2: "Démo publique",
  3: "Export / audit",
  4: "Prêt client",
};

export const DESKTOP_NEURAL_WORKBOOK_GROUPS: WorkbookGroup[] = [
  {
    id: "desktop-root-inventaire-luxe",
    label: "Inventaire Luxe racine",
    sector: "luxe",
    branche: "comptabilite",
    count: 1,
    source: "desktop_external",
    status: "excel_created",
    note: "Workbook NEURAL hors dossier sectoriel, exclut Carbon and Co.",
  },
  {
    id: "desktop-aero-rh",
    label: "Aéronautique / RH",
    sector: "aeronautique",
    branche: "rh",
    count: 2,
    source: "desktop_external",
    status: "excel_created",
    note: "Agents ITAR compliance et certification RH aéro.",
  },
  {
    id: "desktop-aero-supply",
    label: "Aéronautique / Supply Chain",
    sector: "aeronautique",
    branche: "supply-chain",
    count: 3,
    source: "desktop_external",
    status: "excel_created",
    note: "Config, master data et vigilance supply aéro.",
  },
  {
    id: "desktop-assurance-compta",
    label: "Assurance / Comptabilité",
    sector: "assurance",
    branche: "comptabilite",
    count: 1,
    source: "desktop_external",
    status: "excel_created",
    note: "IFRS 17 Assurance.",
  },
  {
    id: "desktop-banque-compta",
    label: "Banque / Comptabilité",
    sector: "banque",
    branche: "comptabilite",
    count: 4,
    source: "desktop_external",
    status: "excel_created",
    note: "Hedge accounting, IFRS 9, intérêts et reporting réglementaire.",
  },
  {
    id: "desktop-banque-finance",
    label: "Banque / Finance",
    sector: "banque",
    branche: "finance",
    count: 4,
    source: "desktop_external",
    status: "excel_created",
    note: "ALM, Pilier II, resolution planning et stress tests.",
  },
  {
    id: "desktop-luxe-comms",
    label: "Luxe / Communication",
    sector: "luxe",
    branche: "communication",
    count: 7,
    source: "desktop_external",
    status: "public_demo",
    note: "Pack le plus prouve publiquement avec 5 agents et master/foundations.",
  },
  {
    id: "desktop-luxe-compta",
    label: "Luxe / Comptabilité",
    sector: "luxe",
    branche: "comptabilite",
    count: 3,
    source: "desktop_external",
    status: "runtime_parsed",
    note: "Consolidation, IAS 21 et royalty accounting.",
  },
  {
    id: "desktop-luxe-marketing",
    label: "Luxe / Marketing",
    sector: "luxe",
    branche: "marketing",
    count: 1,
    source: "desktop_external",
    status: "excel_created",
    note: "ClientelingAI.",
  },
  {
    id: "desktop-luxe-supply",
    label: "Luxe / Supply Chain",
    sector: "luxe",
    branche: "supply-chain",
    count: 2,
    source: "desktop_external",
    status: "excel_created",
    note: "Traceability et ESG supply.",
  },
  {
    id: "desktop-transport-finance",
    label: "Transport / Finance",
    sector: "transport",
    branche: "finance",
    count: 7,
    source: "desktop_external",
    status: "excel_created",
    note: "Pack finance transport, demand model, CAPEX et cockpit.",
  },
  {
    id: "desktop-transport-compta",
    label: "Transport / Comptabilité",
    sector: "transport",
    branche: "comptabilite",
    count: 4,
    source: "desktop_external",
    status: "excel_created",
    note: "Fleet, concession, TVA et orchestrateur comptable.",
  },
  {
    id: "desktop-luxe-rh",
    label: "Luxe / RH",
    sector: "luxe",
    branche: "rh",
    count: 5,
    source: "desktop_external",
    status: "runtime_parsed",
    note: "Recrutement, influence, artisan talent, benchmark et onboarding.",
  },
];

export const RUNTIME_WORKBOOK_GROUPS: WorkbookGroup[] = [
  {
    id: "runtime-core",
    label: "Runtime core",
    sector: "multi",
    branche: "multi",
    count: 10,
    source: "runtime_repo",
    status: "runtime_parsed",
    note: "Workbooks racine embarqués dans apps/neural/data.",
  },
  {
    id: "runtime-aero-comms",
    label: "Aéro Comms",
    sector: "aeronautique",
    branche: "communication",
    count: 6,
    source: "runtime_repo",
    status: "runtime_parsed",
    note: "Pack communication aéro embarqué, parser preuve à brancher en profondeur.",
  },
  {
    id: "runtime-bank-marketing",
    label: "Bank Marketing",
    sector: "banque",
    branche: "marketing",
    count: 6,
    source: "runtime_repo",
    status: "runtime_parsed",
    note: "Pack marketing bancaire embarqué.",
  },
  {
    id: "runtime-insurance-sc",
    label: "Insurance Supply Chain",
    sector: "assurance",
    branche: "supply-chain",
    count: 6,
    source: "runtime_repo",
    status: "public_demo",
    note: "Console publique scénario-id et workbooks embarqués.",
  },
  {
    id: "runtime-luxe-comms",
    label: "Luxe Communication",
    sector: "luxe",
    branche: "communication",
    count: 7,
    source: "runtime_repo",
    status: "public_demo",
    note: "Pack public le plus visible : 5 agents, master et foundations.",
  },
];

const EXPORT_OR_AUDIT_AGENT_SLUGS = new Set([
  "consolidation",
  "maison-voice-guard",
  "green-claim-checker",
  "reg-bank-comms",
  "bank-evidence-guard",
]);
const CLIENT_READY_AGENT_SLUGS = new Set<string>();

const PROOF_OVERRIDES: Record<string, AgentProofOverride> = {
  consolidation: {
    proofScore: 3,
    humanSupervision:
      "DAF ou contrôleur groupe valide périmètre, hypothèses WACC et traitements IFRS avant usage.",
    exportAvailable: true,
    auditTrailAvailable: true,
    evidenceAssets: ["Export XLSX public", "KPIs runtime Luxe Finance", "Pack complet ZIP"],
    nextAction: "Ajouter un audit trail client connecté à un pilot réel.",
    isFlagship: true,
  },
  "maison-voice-guard": {
    proofScore: 3,
    humanSupervision:
      "Brand lead ou direction communication arbitre les alertes sensibles avant publication.",
    exportAvailable: true,
    auditTrailAvailable: true,
    evidenceAssets: [
      "Démo live Voice Scorer",
      "Rapport JSON téléchargeable côté client",
      "Trace API x-neural-voice-score-trace",
    ],
    nextAction: "Brancher un workflow de validation DAM/CMS avec historique signé.",
    isFlagship: true,
  },
  "green-claim-checker": {
    proofScore: 3,
    humanSupervision:
      "Juridique, DPO ou RSE valide les preuves et la reformulation avant diffusion.",
    exportAvailable: true,
    auditTrailAvailable: true,
    evidenceAssets: [
      "Démo live Claim Checker",
      "Rapport JSON téléchargeable côté client",
      "Trace API x-neural-claim-check-trace",
    ],
    nextAction: "Connecter une source juridique externe ou un registre de preuves client.",
    isFlagship: true,
  },
  "reg-bank-comms": {
    proofScore: 3,
    humanSupervision:
      "DirCom et conformité bancaire valident toute sortie PASS_WITH_REVIEW ou BLOCK avant diffusion.",
    exportAvailable: true,
    auditTrailAvailable: true,
    evidenceAssets: ["Pack Markdown signé SHA-256", "5 scénarios figés", "4 gates serveur"],
    nextAction: "Protéger l'inbox reviewer et relier les runs à un vrai tenant client.",
    isFlagship: true,
  },
  "bank-evidence-guard": {
    proofScore: 3,
    humanSupervision:
      "Compliance maintient le registre fermé de sources et valide les politiques de fraîcheur.",
    exportAvailable: true,
    auditTrailAvailable: true,
    evidenceAssets: ["Résolveur déterministe", "Testset auditable", "Endpoint interne de résolution"],
    nextAction: "Ajouter un export de registre complet et une gouvernance de mise à jour des sources.",
    isFlagship: true,
  },
  "fraud-detect-sc": {
    proofScore: 2,
    humanSupervision:
      "Equipe fraude et conformité revoient toute alerte; aucune sanction ou décision sensible automatisée.",
    exportAvailable: true,
    auditTrailAvailable: true,
    evidenceAssets: [
      "Console Assurance Supply Chain",
      "Scénarios PASS / REVIEW / BLOCK",
      "Gates HITL fraude",
    ],
    nextAction: "Créer une fiche agent dédiée et un export investigateur structuré.",
    isFlagship: true,
  },
};

export const PRIORITY_MODEL_CARDS: PriorityModelCard[] = [
  {
    id: "consolidation",
    name: "Consolidation Groupe",
    href: "/agents/consolidation",
    workbookSource: "NEURAL_Consolidation_Groupe.xlsx",
    proofStatus: "export_audit",
    proofScore: 3,
    exampleInput: "Clôture mensuelle, 7 entites, taux FX, WACC, goodwill et périmètre IFRS.",
    exampleOutput: "KPIs consolidation, goodwill, éliminations interco, risques et export Excel.",
    humanSupervision: "DAF ou contrôleur groupe valide périmètre, hypothèses WACC et seuils IAS 36.",
    exportAvailable: "Oui: export Excel consolidation disponible publiquement.",
    auditTrailAvailable: "Oui: export horodaté et pack ZIP; audit trail client encore à connecter.",
    lastTrace: "export/consolidation + export/full-pack",
    limitation: "Démo mono-scénario; pas encore connectée a l'ERP ni à un audit trail client.",
    clientReadyBlocker: "Connexion ERP, tenant client et journal d'audit signé.",
    pilotCta: "/contact?subject=Agent%20Pack%2030%20jours%20-%20Consolidation",
  },
  {
    id: "maison-voice-guard",
    name: "MaisonVoiceGuard",
    href: "/agents/maison-voice-guard",
    workbookSource: "NEURAL_AG001_MaisonVoiceGuard.xlsx",
    proofStatus: "export_audit",
    proofScore: 3,
    exampleInput: "Message marque, canal, contexte marche, niveau de risque reputationnel.",
    exampleOutput: "Score de coherence maison, alertes tonales et recommandations de reformulation.",
    humanSupervision: "Communication ou brand lead tranche les alertes sensibles avant publication.",
    exportAvailable: "Oui: rapport JSON téléchargeable après analyse.",
    auditTrailAvailable: "Oui: trace API exposée dans le rapport, sans tenant client.",
    lastTrace: "x-neural-voice-score-trace",
    limitation: "Ne prouve pas encore l'exécution dans DAM, CMS ou workflow de validation client.",
    clientReadyBlocker: "Workflow de validation client et historique signé.",
    pilotCta: "/contact?subject=Agent%20Pack%2030%20jours%20-%20MaisonVoiceGuard",
  },
  {
    id: "green-claim-checker",
    name: "GreenClaimChecker",
    href: "/agents/green-claim-checker",
    workbookSource: "NEURAL_AG005_GreenClaimChecker.xlsx",
    proofStatus: "export_audit",
    proofScore: 3,
    exampleInput: "Claim environnemental, preuves disponibles, marche cible et canal de diffusion.",
    exampleOutput: "Niveau de risque greenwashing, preuves manquantes et wording alternatif.",
    humanSupervision: "DPO, juridique ou RSE valide la preuve et la formulation avant diffusion.",
    exportAvailable: "Oui: rapport JSON preuve/risque téléchargeable après analyse.",
    auditTrailAvailable: "Oui: trace API exposée dans le rapport, sans registre client.",
    lastTrace: "x-neural-claim-check-trace",
    limitation: "Classification indicative; ne remplace pas une revue juridique documentée.",
    clientReadyBlocker: "Registre de preuves client et validation juridique externe.",
    pilotCta: "/contact?subject=Agent%20Pack%2030%20jours%20-%20GreenClaimChecker",
  },
  {
    id: "reg-bank-comms",
    name: "RegBankComms / BankEvidenceGuard",
    href: "/agents/reg-bank-comms",
    workbookSource: "NEURAL_BANK_COMMS_MASTER.xlsx + registre sources banque",
    proofStatus: "export_audit",
    proofScore: 3,
    exampleInput: "Scénario de communication bancaire régulée, période, chiffres validés et sources actives.",
    exampleOutput: "Verdict PASS / REVIEW / BLOCK, blockers, checklist reviewer et pack Markdown signé.",
    humanSupervision: "DirCom, conformité et juridique bancaire valident tout draft sensible.",
    exportAvailable: "Oui: pack Markdown signé SHA-256 disponible depuis la démo.",
    auditTrailAvailable: "Oui: trace de run, gates serveur et registre de sources fermé.",
    lastTrace: "x-neural-regbank-trace",
    limitation: "Scénarios figés; pas de texte libre pour éviter données privilégiées non publiques.",
    clientReadyBlocker: "Tenant client, auth reviewer et registre de sources client à connecter.",
    pilotCta: "/contact?subject=Agent%20Pack%2030%20jours%20-%20RegBankComms",
  },
  {
    id: "insurance-supply-chain-guard",
    name: "Insurance Supply Chain Guard",
    href: "/secteurs/assurance/supply-chain",
    workbookSource: "NEURAL_INSURANCE_SC_MASTER.xlsx + ISC-A001..A004",
    proofStatus: "public_demo",
    proofScore: 2,
    exampleInput: "Scénario réparateur, expert, fraude fournisseur ou due diligence Sapin II.",
    exampleOutput: "Verdict PASS / REVIEW / BLOCK, gates, HITL requis et limite de décision.",
    humanSupervision: "Claims, fraude et compliance revoient toute alerte; aucun refus automatique.",
    exportAvailable: "Oui: rapport JSON scénario téléchargeable côté console.",
    auditTrailAvailable: "Partiel: trace scenario-id et gates visibles, sans persistance client.",
    lastTrace: "scenario-id + hash workbook",
    limitation: "Console scenario-id; pas encore de fiche agent dédiée ni d'intégration SI sinistre.",
    clientReadyBlocker: "Fiche agent, export investigateur et données client anonymisées.",
    pilotCta: "/contact?subject=Agent%20Pack%2030%20jours%20-%20Assurance%20Supply%20Chain",
  },
];

function scoreFromEntry(entry: PublicEntry): ProofScore {
  const override = PROOF_OVERRIDES[entry.slug];
  if (override?.proofScore !== undefined) return override.proofScore;
  if (CLIENT_READY_AGENT_SLUGS.has(entry.slug)) return 4;
  if (EXPORT_OR_AUDIT_AGENT_SLUGS.has(entry.slug)) return 3;
  if (entry.status === "live") return 2;
  if (entry.status !== "planned" && entry.proofLevel === "ui_demo") return 2;
  if (entry.proofLevel === "runtime_data") return 1;
  return 0;
}

function statusFromScore(score: ProofScore): AgentProofStatus {
  if (score >= 4) return "client_ready";
  if (score >= 3) return "export_audit";
  if (score >= 2) return "public_demo";
  if (score >= 1) return "runtime_parsed";
  return "excel_created";
}

function toProofRecord(entry: PublicEntry): AgentProofRecord {
  const proofScore = scoreFromEntry(entry);
  const override = PROOF_OVERRIDES[entry.slug];
  return {
    id: entry.slug,
    name: entry.label,
    href: entry.href,
    publicStatus: entry.status,
    proofStatus: statusFromScore(proofScore),
    proofScore,
    proofScoreLabel: PROOF_SCORE_LABELS[proofScore],
    workbookSource: entry.dataUsed,
    runtimeAvailable: entry.proofLevel === "runtime_data" || entry.status === "live",
    publicPage: entry.href,
    proofLimitations: entry.notYet,
    humanSupervision:
      override?.humanSupervision ?? "Supervision humaine à définir avant tout usage client.",
    exportAvailable: override?.exportAvailable ?? proofScore >= 3,
    auditTrailAvailable: override?.auditTrailAvailable ?? proofScore >= 3,
    evidenceAssets: override?.evidenceAssets ?? [entry.dataUsed, entry.deliverable],
    nextAction: override?.nextAction ?? entry.nextStep,
    isFlagship: override?.isFlagship ?? false,
    lastVerifiedAt: PROOF_LAST_VERIFIED_AT,
  };
}

export function getAgentProofRecords(): AgentProofRecord[] {
  return AGENT_ENTRIES.map(toProofRecord).sort((a, b) => {
    if (b.proofScore !== a.proofScore) return b.proofScore - a.proofScore;
    return a.name.localeCompare(b.name);
  });
}

export function getProofCatalog() {
  const agentProofs = getAgentProofRecords();
  const publicDemos = agentProofs.filter((agent) => agent.proofScore >= 2).length;
  const exportOrAudit = agentProofs.filter((agent) => agent.proofScore >= 3).length;
  const clientReady = agentProofs.filter((agent) => agent.proofScore >= 4).length;

  return {
    lastVerifiedAt: PROOF_LAST_VERIFIED_AT,
    counts: {
      frameworkTargetAgents: PUBLIC_METRICS.frameworkTargetAgents,
      frameworkCells: PUBLIC_METRICS.frameworkCells,
      liveAgentsWithExcel: countLiveAgents(),
      liveCells: countLiveCells(),
      runtimeWorkbooks: RUNTIME_WORKBOOK_GROUPS.reduce((sum, group) => sum + group.count, 0),
      desktopNeuralWorkbooks: DESKTOP_NEURAL_WORKBOOK_GROUPS.reduce(
        (sum, group) => sum + group.count,
        0,
      ),
      carbonWorkbooksExcluded: PUBLIC_METRICS.excludedCarbonWorkbooks,
      publicAgentPages: AGENT_ENTRIES.length,
      publicDemos,
      exportOrAudit,
      clientReady,
      matrixCellsRegistered: MATRIX.length,
    },
    maturityLevels: [
      {
        status: "excel_created" as AgentProofStatus,
        score: 0 as ProofScore,
        label: PROOF_SCORE_LABELS[0],
        description: "Workbook créé, utile comme actif de conception, pas encore runtime.",
      },
      {
        status: "runtime_parsed" as AgentProofStatus,
        score: 1 as ProofScore,
        label: PROOF_SCORE_LABELS[1],
        description: "Workbook embarqué ou parsé par le site, avec metadata exploitable.",
      },
      {
        status: "public_demo" as AgentProofStatus,
        score: 2 as ProofScore,
        label: PROOF_SCORE_LABELS[2],
        description: "Surface publique ou démo visible, sans promettre production client.",
      },
      {
        status: "export_audit" as AgentProofStatus,
        score: 3 as ProofScore,
        label: PROOF_SCORE_LABELS[3],
        description: "Démo enrichie par export, trace ou preuve de sortie métier.",
      },
      {
        status: "client_ready" as AgentProofStatus,
        score: 4 as ProofScore,
        label: PROOF_SCORE_LABELS[4],
        description: "Prêt à vendre avec contrat, support, security pack et ownership.",
      },
    ],
    workbookGroups: {
      desktopExternal: DESKTOP_NEURAL_WORKBOOK_GROUPS,
      runtimeRepo: RUNTIME_WORKBOOK_GROUPS,
    },
    excludedWorkbooks: [
      {
        label: "Carbon and Co",
        count: PUBLIC_METRICS.excludedCarbonWorkbooks,
        reason: "Produit adjacent ESG/CSRD, exclu du compteur NEURAL pour garder une preuve nette.",
      },
    ],
    clientReadyCriteria: [
      "Demo publique stable",
      "Export ou rapport exploitable",
      "Trace d'audit horodatée",
      "Limites visibles",
      "Supervision humaine explicite",
      "Fallback erreur documenté",
      "CTA pilot et owner clair",
    ],
    warnings: [
      "168 reste une capacité cible du framework, pas un nombre d'agents actifs.",
      "Aucun agent n'est marqué client-ready sans tenant, support, security pack et responsabilité contractuelle.",
      "Les workbooks Excel prouvent un actif de conception; seuls les workbooks parsés ou exposés prouvent un produit public.",
    ],
    agentProofs,
    priorityModelCards: PRIORITY_MODEL_CARDS,
  };
}
