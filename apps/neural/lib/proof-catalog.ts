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
  | "client_ready";

export type ProofScore = 0 | 1 | 2 | 3 | 4;

export interface WorkbookGroup {
  id: string;
  label: string;
  sector: Sector | "multi";
  branch: Branch | "multi";
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
  limitation: string;
}

export const PROOF_LAST_VERIFIED_AT = "2026-05-06";

export const PROOF_STATUS_LABELS: Record<AgentProofStatus, string> = {
  excel_created: "Excel cree",
  runtime_parsed: "Runtime parse",
  public_demo: "Demo publique",
  client_ready: "Pret client",
};

export const PROOF_SCORE_LABELS: Record<ProofScore, string> = {
  0: "Excel only",
  1: "Parse runtime",
  2: "Demo publique",
  3: "Export / audit",
  4: "Pret client",
};

export const DESKTOP_NEURAL_WORKBOOK_GROUPS: WorkbookGroup[] = [
  {
    id: "desktop-root-inventaire-luxe",
    label: "Inventaire Luxe racine",
    sector: "luxe",
    branch: "comptabilite",
    count: 1,
    source: "desktop_external",
    status: "excel_created",
    note: "Workbook NEURAL hors dossier sectoriel, exclut Carbon and Co.",
  },
  {
    id: "desktop-aero-rh",
    label: "Aeronautique / RH",
    sector: "aeronautique",
    branch: "rh",
    count: 2,
    source: "desktop_external",
    status: "excel_created",
    note: "Agents ITAR compliance et certification RH aero.",
  },
  {
    id: "desktop-aero-supply",
    label: "Aeronautique / Supply Chain",
    sector: "aeronautique",
    branch: "supply-chain",
    count: 3,
    source: "desktop_external",
    status: "excel_created",
    note: "Config, master data et vigilance supply aero.",
  },
  {
    id: "desktop-assurance-compta",
    label: "Assurance / Comptabilite",
    sector: "assurance",
    branch: "comptabilite",
    count: 1,
    source: "desktop_external",
    status: "excel_created",
    note: "IFRS 17 Assurance.",
  },
  {
    id: "desktop-banque-compta",
    label: "Banque / Comptabilite",
    sector: "banque",
    branch: "comptabilite",
    count: 4,
    source: "desktop_external",
    status: "excel_created",
    note: "Hedge accounting, IFRS 9, interets et reporting reglementaire.",
  },
  {
    id: "desktop-banque-finance",
    label: "Banque / Finance",
    sector: "banque",
    branch: "finance",
    count: 4,
    source: "desktop_external",
    status: "excel_created",
    note: "ALM, Pilier II, resolution planning et stress tests.",
  },
  {
    id: "desktop-luxe-comms",
    label: "Luxe / Communication",
    sector: "luxe",
    branch: "communication",
    count: 7,
    source: "desktop_external",
    status: "public_demo",
    note: "Pack le plus prouve publiquement avec 5 agents et master/foundations.",
  },
  {
    id: "desktop-luxe-compta",
    label: "Luxe / Comptabilite",
    sector: "luxe",
    branch: "comptabilite",
    count: 3,
    source: "desktop_external",
    status: "runtime_parsed",
    note: "Consolidation, IAS 21 et royalty accounting.",
  },
  {
    id: "desktop-luxe-marketing",
    label: "Luxe / Marketing",
    sector: "luxe",
    branch: "marketing",
    count: 1,
    source: "desktop_external",
    status: "excel_created",
    note: "ClientelingAI.",
  },
  {
    id: "desktop-luxe-supply",
    label: "Luxe / Supply Chain",
    sector: "luxe",
    branch: "supply-chain",
    count: 2,
    source: "desktop_external",
    status: "excel_created",
    note: "Traceability et ESG supply.",
  },
  {
    id: "desktop-transport-finance",
    label: "Transport / Finance",
    sector: "transport",
    branch: "finance",
    count: 7,
    source: "desktop_external",
    status: "excel_created",
    note: "Pack finance transport, demand model, CAPEX et cockpit.",
  },
  {
    id: "desktop-transport-compta",
    label: "Transport / Comptabilite",
    sector: "transport",
    branch: "comptabilite",
    count: 4,
    source: "desktop_external",
    status: "excel_created",
    note: "Fleet, concession, TVA et orchestrateur comptable.",
  },
  {
    id: "desktop-luxe-rh",
    label: "Luxe / RH",
    sector: "luxe",
    branch: "rh",
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
    branch: "multi",
    count: 10,
    source: "runtime_repo",
    status: "runtime_parsed",
    note: "Workbooks racine embarques dans apps/neural/data.",
  },
  {
    id: "runtime-aero-comms",
    label: "Aero Comms",
    sector: "aeronautique",
    branch: "communication",
    count: 6,
    source: "runtime_repo",
    status: "runtime_parsed",
    note: "Pack communication aero embarque, parser preuve a brancher en profondeur.",
  },
  {
    id: "runtime-bank-marketing",
    label: "Bank Marketing",
    sector: "banque",
    branch: "marketing",
    count: 6,
    source: "runtime_repo",
    status: "runtime_parsed",
    note: "Pack marketing bancaire embarque.",
  },
  {
    id: "runtime-insurance-sc",
    label: "Insurance Supply Chain",
    sector: "assurance",
    branch: "supply-chain",
    count: 6,
    source: "runtime_repo",
    status: "public_demo",
    note: "Console publique scenario-id et workbooks embarques.",
  },
  {
    id: "runtime-luxe-comms",
    label: "Luxe Communication",
    sector: "luxe",
    branch: "communication",
    count: 7,
    source: "runtime_repo",
    status: "public_demo",
    note: "Pack public le plus visible : 5 agents, master et foundations.",
  },
];

const EXPORT_OR_AUDIT_AGENT_SLUGS = new Set(["consolidation"]);
const CLIENT_READY_AGENT_SLUGS = new Set<string>();

export const PRIORITY_MODEL_CARDS: PriorityModelCard[] = [
  {
    id: "consolidation",
    name: "Consolidation Groupe",
    href: "/agents/consolidation",
    workbookSource: "NEURAL_Consolidation_Groupe.xlsx",
    proofStatus: "public_demo",
    proofScore: 3,
    exampleInput: "Cloture mensuelle, 7 entites, taux FX, WACC, goodwill et perimetre IFRS.",
    exampleOutput: "KPIs consolidation, goodwill, eliminations interco, risques et export Excel.",
    humanSupervision: "DAF ou controleur groupe valide perimetre, hypotheses WACC et seuils IAS 36.",
    exportAvailable: "Oui: export Excel consolidation disponible publiquement.",
    limitation: "Demo mono-scenario; pas encore connectee a l'ERP ni a un audit trail client.",
  },
  {
    id: "maison-voice-guard",
    name: "MaisonVoiceGuard",
    href: "/agents/maison-voice-guard",
    workbookSource: "NEURAL_AG001_MaisonVoiceGuard.xlsx",
    proofStatus: "public_demo",
    proofScore: 2,
    exampleInput: "Message marque, canal, contexte marche, niveau de risque reputationnel.",
    exampleOutput: "Score de coherence maison, alertes tonales et recommandations de reformulation.",
    humanSupervision: "Communication ou brand lead tranche les alertes sensibles avant publication.",
    exportAvailable: "Non: sortie visible en demo, export a durcir.",
    limitation: "Ne prouve pas encore l'execution dans DAM, CMS ou workflow de validation client.",
  },
  {
    id: "green-claim-checker",
    name: "GreenClaimChecker",
    href: "/agents/green-claim-checker",
    workbookSource: "NEURAL_AG005_GreenClaimChecker.xlsx",
    proofStatus: "public_demo",
    proofScore: 2,
    exampleInput: "Claim environnemental, preuves disponibles, marche cible et canal de diffusion.",
    exampleOutput: "Niveau de risque greenwashing, preuves manquantes et wording alternatif.",
    humanSupervision: "DPO, juridique ou RSE valide la preuve et la formulation avant diffusion.",
    exportAvailable: "Non: export preuve/risque a ajouter.",
    limitation: "Classification indicative; ne remplace pas une revue juridique documentee.",
  },
  {
    id: "inventaire-luxe",
    name: "Inventaire Luxe",
    href: "/agents/inventaire-luxe",
    workbookSource: "NEURAL_Inventaire_Luxe.xlsx",
    proofStatus: "runtime_parsed",
    proofScore: 1,
    exampleInput: "Stocks multi-maisons, categories, rotation, NRV, devise et seuils IAS 2.",
    exampleOutput: "Alertes surstock, depreciation potentielle, rotation et synthese inventaire.",
    humanSupervision: "Controle de gestion et supply valident les seuils et arbitrages de depreciation.",
    exportAvailable: "Non: donnees parsees, export agent a construire.",
    limitation: "Workbook embarque; page publique et interaction agent encore incompletes.",
  },
  {
    id: "royalty",
    name: "Royalty Accounting",
    href: "/agents/royalty",
    workbookSource: "NEURAL_Royalty_Accounting.xlsx",
    proofStatus: "runtime_parsed",
    proofScore: 1,
    exampleInput: "Contrats de licence, ventes inter-entites, taux de royalties et devise.",
    exampleOutput: "Calculs royalties, ecritures attendues et points de controle comptable.",
    humanSupervision: "Comptabilite groupe valide contrats, taux et traitements intercompany.",
    exportAvailable: "Non: export dedie a ajouter.",
    limitation: "Actif runtime present, mais preuve publique moins forte que Consolidation Groupe.",
  },
];

function scoreFromEntry(entry: PublicEntry): ProofScore {
  if (CLIENT_READY_AGENT_SLUGS.has(entry.slug)) return 4;
  if (EXPORT_OR_AUDIT_AGENT_SLUGS.has(entry.slug)) return 3;
  if (entry.status === "live") return 2;
  if (entry.proofLevel === "runtime_data") return 1;
  return 0;
}

function statusFromScore(score: ProofScore): AgentProofStatus {
  if (score >= 4) return "client_ready";
  if (score >= 2) return "public_demo";
  if (score >= 1) return "runtime_parsed";
  return "excel_created";
}

function toProofRecord(entry: PublicEntry): AgentProofRecord {
  const proofScore = scoreFromEntry(entry);
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
        description: "Workbook cree, utile comme actif de conception, pas encore runtime.",
      },
      {
        status: "runtime_parsed" as AgentProofStatus,
        score: 1 as ProofScore,
        label: PROOF_SCORE_LABELS[1],
        description: "Workbook embarque ou parse par le site, avec metadata exploitable.",
      },
      {
        status: "public_demo" as AgentProofStatus,
        score: 2 as ProofScore,
        label: PROOF_SCORE_LABELS[2],
        description: "Surface publique ou demo visible, sans promettre production client.",
      },
      {
        status: "public_demo" as AgentProofStatus,
        score: 3 as ProofScore,
        label: PROOF_SCORE_LABELS[3],
        description: "Demo enrichie par export, trace ou preuve de sortie metier.",
      },
      {
        status: "client_ready" as AgentProofStatus,
        score: 4 as ProofScore,
        label: PROOF_SCORE_LABELS[4],
        description: "Pret a vendre avec contrat, support, security pack et ownership.",
      },
    ],
    workbookGroups: {
      desktopExternal: DESKTOP_NEURAL_WORKBOOK_GROUPS,
      runtimeRepo: RUNTIME_WORKBOOK_GROUPS,
    },
    agentProofs,
    priorityModelCards: PRIORITY_MODEL_CARDS,
  };
}
