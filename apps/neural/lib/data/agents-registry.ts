/**
 * NEURAL Agents Registry
 *
 * Source de vérité pour le mapping Secteur × Branche → Agents.
 * Alimenté par les fichiers Excel dans C:\Users\Ludo\Desktop\IA projet entreprises\
 *
 * Convention :
 *   - excelSource: nom du fichier Excel source
 *   - excelSheets: onglets pertinents dans le fichier
 *   - status: "live" = données réelles dans l'Excel, "planned" = à construire
 */

export type Sector =
  | "transport"
  | "luxe"
  | "aeronautique"
  | "saas"
  | "banque"
  | "assurance";

export type Branch =
  | "si"
  | "rh"
  | "marketing"
  | "communication"
  | "comptabilite"
  | "finance"
  | "supply-chain";

export interface AgentDefinition {
  id: string;
  name: string;
  mission: string;
  version: "V1" | "V2";
  kpis: string[];
  status: "live" | "planned";
  /**
   * Agent public (defaut) vs service transverse (pas de page publique /agents/*).
   * Introduit Sprint 0 banque / comms pour marquer RegWatchBank et BankEvidenceGuard
   * comme services internes et ne pas les exposer comme vitrines produit.
   */
  type?: "agent" | "service";
}

export interface CellData {
  sector: Sector;
  branch: Branch;
  agents: AgentDefinition[];
  excelSource: string | null;
  excelSheets: string[];
  topAgent: string;
  roiHighlight: string;
}

// ─── SECTORS & BRANCHES METADATA ────────────────────────────────────────────

export const SECTORS_META: Record<
  Sector,
  { label: string; emoji: string; description: string }
> = {
  transport:    { label: "Transport",    emoji: "\u{1F686}", description: "Optimisation logistique, maintenance prédictive, conformité OIV" },
  luxe:         { label: "Luxe",         emoji: "\u{1F45C}", description: "Inventaire multi-maisons, ESG, recrutement haute couture" },
  aeronautique: { label: "Aéronautique", emoji: "\u{2708}\u{FE0F}", description: "Supply chain critique, conformité EASA, MRO intelligent" },
  saas:         { label: "SaaS",         emoji: "\u{1F4BB}", description: "PLG analytics, churn prediction, revenue intelligence" },
  banque:       { label: "Banque",       emoji: "\u{1F3E6}", description: "Risque crédit, conformité Bâle IV, KYC automatisé" },
  assurance:    { label: "Assurance",    emoji: "\u{1F6E1}\u{FE0F}", description: "IFRS 17, tarification dynamique, gestion sinistres" },
};

export const BRANCHES_META: Record<
  Branch,
  { label: string; shortLabel: string }
> = {
  si:             { label: "Systèmes d'Information", shortLabel: "SI" },
  rh:             { label: "Ressources Humaines",    shortLabel: "RH" },
  marketing:      { label: "Marketing",              shortLabel: "Marketing" },
  communication:  { label: "Communication",          shortLabel: "Comms" },
  comptabilite:   { label: "Comptabilité",           shortLabel: "Compta" },
  finance:        { label: "Finance",                shortLabel: "Finance" },
  "supply-chain": { label: "Supply Chain",           shortLabel: "Supply Ch." },
};

// ─── MATRIX DATA ─────────────────────────────────────────────────────────────
// Cellules avec données réelles (issues des Excel)

export const MATRIX: CellData[] = [
  // ═══ LUXE × RH ═══
  // Source: Luxe AgentRecrutement.xlsx
  {
    sector: "luxe",
    branch: "rh",
    excelSource: "Luxe AgentRecrutement.xlsx",
    excelSheets: [
      "AGENT ArtisanScout",
      "AGENT EmployerBrandLuxe",
      "AGENT ExpatLuxe",
      "AGENT DEI_Luxe",
      "ORCHESTRATEUR",
    ],
    topAgent: "EmployerBrandLuxe",
    roiHighlight: "Time-to-hire artisan ÷2",
    agents: [
      {
        id: "artisan-scout",
        name: "ArtisanScout",
        mission: "Sourcing et recrutement d'artisans rares — détection du geste + Legacy Risk",
        version: "V2",
        kpis: ["Time-to-hire artisan: 6→3.5 mois", "Taux matching pertinent: 30%→70%", "Candidats artisans/mois: 5→25"],
        status: "live",
      },
      {
        id: "employer-brand-luxe",
        name: "EmployerBrandLuxe",
        mission: "Gardien du Verbe de la Maison — marque employeur premium",
        version: "V2",
        kpis: ["Cohérence marque employeur: 60%→95%", "Temps production contenu: -70%"],
        status: "live",
      },
      {
        id: "expat-luxe",
        name: "ExpatLuxe",
        mission: "Simulation de vie & Soft Landing — mobilité internationale",
        version: "V2",
        kpis: ["Satisfaction expatriés: +40%", "Temps admin mobilité: -60%"],
        status: "live",
      },
      {
        id: "dei-luxe",
        name: "DEI_Luxe",
        mission: "Architecte diversité cognitive — D&I dans le luxe",
        version: "V2",
        kpis: ["Biais recrutement détectés: +80%", "Diversité shortlists: +35%"],
        status: "live",
      },
    ],
  },

  // ═══ LUXE × SUPPLY CHAIN ═══
  // Source: Luxe - solution ESG.xlsx
  {
    sector: "luxe",
    branch: "supply-chain",
    excelSource: "Luxe - solution ESG.xlsx",
    excelSheets: [
      "LuxeTraceability",
      "RareMaterialSourcing",
      "ArtisanalQualityAI",
      "AntiCounterfeitSC",
      "Risk_Matrix",
      "MonteCarlo_Simulation",
      "KPI_Metriques",
    ],
    topAgent: "AntiCounterfeitSC",
    roiHighlight: "Taux conformité certificats 98%",
    agents: [
      {
        id: "luxe-traceability",
        name: "LuxeTraceability",
        mission: "Vérification certificat origine & conformité CITES/Kimberley",
        version: "V1",
        kpis: ["Taux conformité certificats: 98%", "Temps moyen validation: 3.2s"],
        status: "live",
      },
      {
        id: "rare-material-sourcing",
        name: "RareMaterialSourcing",
        mission: "Scoring risque approvisionnement matières rares (python, crocodile, cachemire)",
        version: "V1",
        kpis: ["Couverture matières rares: 18/20", "Score risque moyen: 42/100"],
        status: "live",
      },
      {
        id: "artisanal-quality-ai",
        name: "ArtisanalQualityAI",
        mission: "Contrôle qualité atelier par vision IA (couture sellier, tension fil, symétrie)",
        version: "V1",
        kpis: ["Taux détection défauts: 99.2%", "Temps moyen contrôle: 1.1s"],
        status: "live",
      },
      {
        id: "anti-counterfeit-sc",
        name: "AntiCounterfeitSC",
        mission: "Surveillance anti-contrefaçon NFC — tracking produits sur canaux distribution",
        version: "V1",
        kpis: ["Nb scans traités: 15 842", "Taux succès authentification: 97%"],
        status: "live",
      },
    ],
  },

  // ═══ LUXE × COMPTABILITÉ ═══
  // Source: NEURAL_Inventaire_Luxe.xlsx
  {
    sector: "luxe",
    branch: "comptabilite",
    excelSource: "NEURAL_Inventaire_Luxe.xlsx",
    excelSheets: [
      "Dashboard",
      "Inventaire",
      "Analyse_Risques",
      "Valorisation",
      "Test_NRV_IAS2",
      "Marges_PF",
    ],
    topAgent: "InventaireLuxe",
    roiHighlight: "Stock brut piloté: 3.6M\u{20AC}",
    agents: [
      {
        id: "inventaire-luxe",
        name: "InventaireLuxe",
        mission: "Gestion inventaire luxe multi-maisons — IAS 2 NRV, risques surstock, rotation",
        version: "V1",
        kpis: ["Stock brut suivi: 3.58M\u{20AC}", "Rotation moyenne: 760j", "Articles en alerte obsolescence: 100%"],
        status: "live",
      },
      {
        id: "valorisation-luxe",
        name: "ValorisationLuxe",
        mission: "Valorisation par catégorie (MP, EC, PF) et test NRV IAS 2",
        version: "V1",
        kpis: ["Répartition MP/EC/PF automatisée", "Tests NRV automatiques"],
        status: "live",
      },
      {
        id: "risk-inventaire-luxe",
        name: "RiskInventaireLuxe",
        mission: "Cartographie des risques inventaire — concentration, obsolescence, dépréciation",
        version: "V1",
        kpis: ["Risque concentration: 75.7%", "Risque obsolescence: 100% >365j"],
        status: "live",
      },
      {
        id: "marge-pf-luxe",
        name: "MargePFLuxe",
        mission: "Analyse marges par produit fini — Hermès, Patek Philippe, Cartier, Dior",
        version: "V1",
        kpis: ["Marges PF calculées par maison", "Alertes marge < seuil"],
        status: "live",
      },
    ],
  },

  // ═══ LUXE × FINANCE ═══
  // Source: NEURAL_consomultimaisons.xlsx
  {
    sector: "luxe",
    branch: "finance",
    excelSource: "NEURAL_consomultimaisons.xlsx",
    excelSheets: [
      "01_PARAMETRES",
      "02_PERIMETRE",
      "09_BILAN_CONSO",
      "10_PNL_CONSO",
      "11_TFT_CONSO",
      "15_PILIER2",
      "16_CONTROLES",
    ],
    topAgent: "ConsoMultiMaisons",
    roiHighlight: "Consolidation 7 entités automatisée",
    agents: [
      {
        id: "conso-multi-maisons",
        name: "ConsoMultiMaisons",
        mission: "Consolidation IFRS multi-maisons (Groupe Aurelia) — 16 onglets automatisés",
        version: "V1",
        kpis: ["7 entités consolidées", "Bilan/P&L/TFT automatiques", "16 contrôles de cohérence"],
        status: "live",
      },
      {
        id: "conversion-ias21",
        name: "ConversionIAS21",
        mission: "Conversion devises IAS 21 — EUR, USD, JPY, CHF, CNY, AED",
        version: "V1",
        kpis: ["6 devises converties automatiquement", "Écarts de conversion calculés"],
        status: "live",
      },
      {
        id: "pilier2-globe",
        name: "Pilier2GloBE",
        mission: "Reporting Pilier 2 OCDE GloBE — impôt minimum 15% par juridiction",
        version: "V1",
        kpis: ["ETR calculé par juridiction", "Impôt complémentaire estimé"],
        status: "live",
      },
      {
        id: "goodwill-ifrs3",
        name: "GoodwillIFRS3",
        mission: "Calcul goodwill IFRS 3 & éliminations intra-groupe",
        version: "V1",
        kpis: ["Goodwill: 168.5M\u{20AC}", "Éliminations: 5 catégories"],
        status: "live",
      },
    ],
  },

  // ═══ ASSURANCE × COMPTABILITÉ ═══
  // Source: IFRS17_Assurance.xlsx
  {
    sector: "assurance",
    branch: "comptabilite",
    excelSource: "IFRS17_Assurance.xlsx",
    excelSheets: [
      "HYPOTHESES",
      "BBA",
      "VFA",
      "PAA",
      "CSM_WATERFALL",
      "INSURANCE_PL",
      "TRANSITION",
      "DISCLOSURE",
      "BENCHMARK",
    ],
    topAgent: "IFRS17Engine",
    roiHighlight: "3 modèles IFRS 17 automatisés",
    agents: [
      {
        id: "ifrs17-engine",
        name: "IFRS17Engine",
        mission: "Moteur IFRS 17 complet — BBA, VFA, PAA avec 75 paramètres",
        version: "V1",
        kpis: ["CSM initiale BBA: 46.5M\u{20AC}", "VFA: 171 lignes, 6 dropdowns", "PAA: 220 lignes, 10 sections"],
        status: "live",
      },
      {
        id: "csm-waterfall",
        name: "CSMWaterfall",
        mission: "Tableau de mouvement CSM consolidé — réconciliation BBA/VFA/PAA",
        version: "V1",
        kpis: ["252 lignes, 10 sections", "Réconciliation 3 modèles"],
        status: "live",
      },
      {
        id: "insurance-pl",
        name: "InsurancePL",
        mission: "Insurance Service Result IFRS 17 §80-92 — P&L spécifique assurance",
        version: "V1",
        kpis: ["Expected claims: 197.5M\u{20AC}", "CSM release: 64M\u{20AC}"],
        status: "live",
      },
      {
        id: "disclosure-ifrs17",
        name: "DisclosureIFRS17",
        mission: "Checklist disclosure obligatoire + benchmark grands groupes (AXA, Allianz, CNP, SCOR)",
        version: "V1",
        kpis: ["Checklist §97 automatisée", "Benchmark 4 groupes cotés"],
        status: "live",
      },
    ],
  },

  // ═══ (MULTI-SECTEUR) × FINANCE ═══
  // Source: NEURAL_MultiCurrency_IAS21.xlsx
  {
    sector: "banque",
    branch: "finance",
    excelSource: "NEURAL_MultiCurrency_IAS21.xlsx",
    excelSheets: [],
    topAgent: "MultiCurrencyIAS21",
    roiHighlight: "Conversion multi-devises automatisée",
    agents: [
      {
        id: "multi-currency-ias21",
        name: "MultiCurrencyIAS21",
        mission: "Agent multi-devises IAS 21 — conversion, couverture, reporting",
        version: "V1",
        kpis: ["Conversion automatique multi-devises", "Tests d'efficacité IFRS 9"],
        status: "live",
      },
      {
        id: "hedge-accounting",
        name: "HedgeAccounting",
        mission: "Comptabilité de couverture IFRS 9 §6.4.1 — tests d'efficacité",
        version: "V1",
        kpis: ["Dollar Offset Ratio automatique", "Documentation couverture"],
        status: "live",
      },
      {
        id: "fx-risk-monitor",
        name: "FXRiskMonitor",
        mission: "Monitoring risque de change en temps réel",
        version: "V1",
        kpis: ["Alertes seuils de change", "Sensibilité portefeuille"],
        status: "planned",
      },
      {
        id: "regulatory-fx",
        name: "RegulatoryFX",
        mission: "Reporting réglementaire change — Pilier 2, EMIR",
        version: "V1",
        kpis: ["Rapports réglementaires automatisés"],
        status: "planned",
      },
    ],
  },

  // ═══ LUXE × COMMUNICATION ═══
  // Source : apps/neural/data/luxe-comms/ (7 workbooks synchronises en content/luxe-comms/)
  // Sprint 1 du chantier Luxe / Communication (avril 2026).
  {
    sector: "luxe",
    branch: "communication",
    excelSource: "NEURAL_LUXE_COMMS_MASTER.xlsx",
    excelSheets: [
      "2_AGENT_REGISTRY",
      "3_WORKFLOW_MAP",
      "5_REVIEW_GATES",
      "8_GLOBAL_LOG_IMPORT",
      "9_GLOBAL_KPIS",
      "11_RISK_REGISTER",
    ],
    topAgent: "MaisonVoiceGuard",
    roiHighlight: "Contrôle absolu du brand voice — 100% des sorties scorees",
    agents: [
      {
        id: "maison-voice-guard",
        name: "MaisonVoiceGuard",
        mission:
          "Score chaque communication sur la conformite charte (vocabulaire, ton, hard-fail) — gate brand obligatoire avant publication.",
        version: "V1",
        kpis: [
          "Score brand /100 par sortie",
          "Hard-fail detection zero-tolerance",
          "SLA review 24h (4h en mode crise)",
        ],
        status: "live",
      },
      {
        id: "luxe-press-agent",
        name: "LuxePressAgent",
        mission:
          "Redige communiques dans le registre du luxe — adapte presse lifestyle (Vogue, HB) vs. business (FT, BoF), gere media matrix + embargos.",
        version: "V1",
        kpis: [
          "First-pass validation rate",
          "Nb revisions moyen par draft",
          "Press pickup rate post-publication",
        ],
        status: "live",
      },
      {
        id: "luxe-event-comms",
        name: "LuxeEventComms",
        mission:
          "Pack multi-format pour defiles, lancements, expositions — invitations, scripts, social live, captions — avec gates brand + heritage.",
        version: "V1",
        kpis: [
          "Taux de completion pack par evenement",
          "SLA social live 2h",
          "Brand approve rate 1er jet",
        ],
        status: "live",
      },
      {
        id: "heritage-comms",
        name: "HeritageComms",
        mission:
          "Sourcing patrimonial discipline — aucune sortie sans source cataloguee + citation formatee (Maison-style, Chicago).",
        version: "V1",
        kpis: [
          "Sources actives / stale / rejected",
          "Coverage citation par sortie",
          "Facts approuves (unique source)",
        ],
        status: "live",
      },
      {
        id: "green-claim-checker",
        name: "GreenClaimChecker",
        mission:
          "Detection claims RSE + matching preuve + scoring risque — conformite EU Green Claims Directive, Loi Climat FR, CMA UK, FTC US.",
        version: "V1",
        kpis: [
          "Claims CRITICAL blocked pre-publication",
          "Evidence coverage rate",
          "Multi-juridiction compliance (EU/FR/UK/US/CH)",
        ],
        status: "live",
      },
    ],
  },

  // ═══ BANQUE × COMMUNICATION ═══
  // Sprint 0 scaffold (avril 2026) — blueprint `PLAN projet Banque communication.md`.
  // 4 agents publics + 2 services transverses (type: "service"). Tous `planned`.
  // Wedge MVP : AG-B001 RegBankComms + AG-B005 RegWatchBank + AG-B006 BankEvidenceGuard.
  // Correctif #2 : la demo publique sera en mode "exemples pre-charges" uniquement
  // pour eviter toute ingestion d'info privilegiee non-publique.
  {
    sector: "banque",
    branch: "communication",
    excelSource: null,
    excelSheets: [],
    topAgent: "RegBankComms",
    roiHighlight: "Preparation/validation de communications bancaires defendables",
    agents: [
      {
        id: "reg-bank-comms",
        name: "RegBankComms",
        mission:
          "Redige et relit les communications reglementees (resultats, gouvernance, notices supervision). Bloque tout chiffre non valide ou mention d'info privilegiee non approuvee.",
        version: "V1",
        kpis: [
          "0 chiffre non-validated diffuse",
          "0 mention d'info privilegiee sans approbation",
          "First-pass compliance > 80% sur testset",
        ],
        status: "planned",
        type: "agent",
      },
      {
        id: "bank-crisis-comms",
        name: "BankCrisisComms",
        mission:
          "Assemble messages de crise externes/internes (cyber, fuite, sanction, rumeur liquidite) a partir de playbooks et messages pre-approuves. Jamais de cause racine non confirmee.",
        version: "V1",
        kpis: [
          "MTTA publication initiale (par severite)",
          "% messages adosses a message pre-approuve",
          "0 engagement de remediation non valide",
        ],
        // Sprint 2 : demo live (4 scenarios : cyber, data leak, liquidity rumor, outage).
        status: "planned",
        type: "agent",
      },
      {
        id: "esg-bank-comms",
        name: "ESGBankComms",
        mission:
          "Controle et reformule claims ESG/ISR/finance durable (SFDR, taxonomie). Verdict pass/review/block + reformulation qualifiee sourcee.",
        version: "V1",
        kpis: [
          "% claims bloques pour preuve manquante",
          "% claims valides avec source fraiche",
          "Multi-juridiction : FR, EU",
        ],
        status: "planned",
        type: "agent",
      },
      {
        id: "client-bank-comms",
        name: "ClientBankComms",
        mission:
          "Prepare communications clients sensibles (hausse tarifs, fermeture agence, incident). Ton, mentions legales, segmentation, canal (email/SMS/app/courrier).",
        version: "V2",
        kpis: [
          "% messages avec mentions legales completes",
          "Taux de reformulation vs. seuil lisibilite",
          "Couverture multi-canal (email/SMS/app/courrier)",
        ],
        status: "planned",
        type: "agent",
      },
      {
        id: "reg-watch-bank",
        name: "RegWatchBank",
        mission:
          "Veille ACPR/AMF/EBA/ECB/ESMA/EUR-Lex/IFRS — digest, score d'impact, agents touches, tache de mise a jour workbook. Service transverse non expose publiquement.",
        version: "V1",
        kpis: [
          "Delai de prise en compte d'une nouvelle regle",
          "Couverture autorites FR+EU : 100%",
          "Faux positifs < 10%",
        ],
        status: "planned",
        type: "service",
      },
      {
        id: "bank-evidence-guard",
        name: "BankEvidenceGuard",
        mission:
          "Service transverse — recherche + validation des sources admissibles avant generation. Aucune sortie agent sans paquet de sources ACTIVE. Pas de page publique.",
        version: "V1",
        kpis: [
          "% drafts avec paquet sources complet",
          "% sources expirees bloquees",
          "Latence moyenne de resolution evidence",
        ],
        status: "planned",
        type: "service",
      },
    ],
  },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Get cell data for a specific sector × branch combination */
export function getCell(sector: Sector, branch: Branch): CellData | undefined {
  return MATRIX.find((c) => c.sector === sector && c.branch === branch);
}

/** Get all cells for a given sector */
export function getCellsBySector(sector: Sector): CellData[] {
  return MATRIX.filter((c) => c.sector === sector);
}

/** Get all cells for a given branch */
export function getCellsByBranch(branch: Branch): CellData[] {
  return MATRIX.filter((c) => c.branch === branch);
}

/** Count total agents with "live" status (services transverses exclus) */
export function countLiveAgents(): number {
  return MATRIX.reduce(
    (sum, cell) =>
      sum +
      cell.agents.filter(
        (a) => a.status === "live" && (a.type ?? "agent") === "agent",
      ).length,
    0
  );
}

/** Count total cells that have real Excel data */
export function countLiveCells(): number {
  return MATRIX.filter((c) => c.excelSource !== null).length;
}
