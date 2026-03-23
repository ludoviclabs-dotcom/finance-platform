// ═══════════════════════════════════════════════════════════════════════
// Architecture data — 8 modules, stack, timeline, ticker
// ═══════════════════════════════════════════════════════════════════════

export interface Onglet { name: string; desc: string; }

export interface ArchModule {
  id: string;
  name: string;
  shortName: string;
  file: string;
  color: string;
  colorHex: string;
  icon: string;
  tabs: number;
  status: string;
  description: string;
  onglets: Onglet[];
  kpis: string[];
}

export interface StackLayer {
  layer: string;
  icon: string;
  items: { name: string; desc: string; color: string }[];
}

export interface TimelineYear {
  year: string;
  items: string[];
  color: string;
}

export const ARCH_MODULES: ArchModule[] = [
  {
    id: "cyber", name: "Gouvernance Cyber Financière", shortName: "Cyber",
    file: "Gouvernance_Cyber_Financière_v3", color: "#4edea3", colorHex: "#4edea3",
    icon: "🛡️", tabs: 14, status: "ACTIF",
    description: "Gouvernance cyber-financière : DORA, CSRD, NIS2, FAIR, quantification risque, assurance.",
    onglets: [
      { name: "ACCUEIL", desc: "Navigation, légende, mode d'emploi" },
      { name: "PARAMÈTRES", desc: "Données entreprise (secteur, CA, budget cyber, appétence risque)" },
      { name: "DIAGNOSTIC RÉGL.", desc: "Éligibilité automatique CSRD / DORA / NIS2" },
      { name: "DOUBLE MATÉRIALITÉ", desc: "Matrice IRO, heat map 5×5" },
      { name: "FAIR PERT", desc: "5 scénarios, ALE, VaR 95%, Tornado" },
      { name: "ASSURANCE", desc: "ROSI ENISA, NPV, 4 stratégies ISO 27005" },
      { name: "DORA", desc: "Conformité Art. 5 à 30" },
      { name: "ESRS CSRD", desc: "Data points, taux de conformité" },
      { name: "DASHBOARD", desc: "Indice maturité /100, KRI, benchmark" },
      { name: "PONT CCA-CYBER", desc: "IAS 37, IFRS 3, WACC" },
      { name: "PLAN ACTION", desc: "50 actions avec budget, statut" },
      { name: "RÉFÉRENTIEL", desc: "CSRD, DORA, NIS2, FAIR, NIST CSF 2.0" },
      { name: "HISTORIQUE", desc: "KPI trimestriels" },
      { name: "GLOSSAIRE", desc: "ALE, VaR, ROSI, IRO, CMM..." },
    ],
    kpis: ["Maturité /100", "ALE (€)", "VaR 95%", "ROSI", "Conformité DORA %"],
  },
  {
    id: "globe", name: "Fiscalité Pilier 2 GloBE", shortName: "GloBE",
    file: "Fiscalité_Pilier2_GloBE", color: "#60a5fa", colorHex: "#60a5fa",
    icon: "🌍", tabs: 8, status: "15% MIN",
    description: "Pilier 2 OCDE : ETR juridictionnel, Top-up Tax IIR/UTPR, Safe Harbours, GIR.",
    onglets: [
      { name: "Structure Groupe", desc: "6 entités (FR/DE/IE/SG/US/MU), organigramme" },
      { name: "PL GloBE", desc: "Résultat qualifié, retraitements Art. 15-22" },
      { name: "Impôts Couverts", desc: "IS courant, IS différé ajusté, WHT" },
      { name: "ETR Juridictionnel", desc: "Taux effectif par pays vs 15%" },
      { name: "Substance Carve-out", desc: "SBIE, taux transitoires 2024-2033" },
      { name: "Top-up Tax", desc: "Calcul IIR/UTPR, allocation par entité" },
      { name: "Safe Harbours", desc: "Tests CbCR (de minimis, ETR simplifié)" },
      { name: "Déclaration GIR", desc: "Maquette GloBE Information Return OCDE" },
    ],
    kpis: ["ETR par juridiction", "Top-up Tax (€)", "SBIE Carve-out", "Safe Harbour status"],
  },
  {
    id: "analyse", name: "Simulateur Analyse d'Entreprise", shortName: "Analyse",
    file: "Simulateur_Analyse_Entreprise", color: "#a78bfa", colorHex: "#a78bfa",
    icon: "📊", tabs: 19, status: "LIVE",
    description: "36 ratios PCG, Z-Score Altman, DuPont, EVA, DCF, 3 scénarios, benchmark.",
    onglets: [
      { name: "Accueil", desc: "Sommaire, sélecteur d'unité, indicateurs santé" },
      { name: "Données Brutes", desc: "TBilan, TCPC, TTrésorerie, TBudget (2022-2025)" },
      { name: "Ratios Indicateurs", desc: "36 ratios PCG + 15 avancés (Z-Score, DuPont, EVA, Piotroski)" },
      { name: "Analyse Approfondie", desc: "3 scénarios, waterfall, prévision tréso 12 mois" },
      { name: "Dashboard Interactif", desc: "Score /150, feux tricolores, 6 graphiques" },
      { name: "Benchmark Alertes", desc: "10 benchmarks sectoriels, 10 alertes auto" },
      { name: "One-Pager", desc: "Rapport COMEX, EV DCF" },
      { name: "Valorisation DCF", desc: "WACC CAPM, FCFF 5 ans, multiples" },
      { name: "STOCKS (×4)", desc: "CUMP/FIFO, Wilson, DIO, taux vétusté" },
      { name: "PLANAMORT", desc: "Linéaire/dégressif, VNC, dotation N" },
      { name: "ECARTSBU", desc: "Direct costing, ABC, standard costing, EVA" },
      { name: "IFRS8SEGMENTS", desc: "Information sectorielle IFRS 8" },
      { name: "Modules IFRS", desc: "PERIMETRE, CONSOLVARCP, IFRS16, IAS12, IAS36" },
    ],
    kpis: ["Score /150", "Z-Score Altman", "WACC", "FCFF", "EVA"],
  },
  {
    id: "credit", name: "Projet Banque Credit Risk", shortName: "Crédit",
    file: "Projet_Banque_Credit_Risk", color: "#f59e0b", colorHex: "#f59e0b",
    icon: "💳", tabs: 6, status: "RISQUE BAS",
    description: "IFRS 9 ECL, Bâle IV CET1, stress tests macro + ESG, surveillance prudentielle.",
    onglets: [
      { name: "Portefeuille", desc: "150 crédits (rating, PD/LGD/EAD, LTV, ESG)" },
      { name: "ECL IFRS 9", desc: "Stages 1/2/3, matrice de transition" },
      { name: "Stress Tests", desc: "3 scénarios macro + stress ESG climatique" },
      { name: "CET1 Bâle IV", desc: "RWA standard/IRB, output floor 72.5%" },
      { name: "Dashboard", desc: "CET1, LCR, NSFR, waterfall CET1" },
      { name: "Cartographie Rgl.", desc: "Timeline 2024-2030 (DORA, MiCA, AI Act, CRR III)" },
    ],
    kpis: ["CET1 %", "ECL (€)", "LCR %", "NSFR %", "RWA (€)"],
  },
  {
    id: "ma", name: "M&A Simulator 2026 Pro", shortName: "M&A",
    file: "MA_Simulator_2026_Pro", color: "#f43f5e", colorHex: "#f43f5e",
    icon: "🤝", tabs: 10, status: "3 DEALS",
    description: "Modélisation deal, accretion/dilution, synergies, financement, due diligence.",
    onglets: [
      { name: "Deal Setup", desc: "Structure de transaction, prix, multiples" },
      { name: "Accretion/Dilution", desc: "Impact EPS pro-forma" },
      { name: "Synergies", desc: "Revenus + coûts, phasing sur 3 ans" },
      { name: "Financement", desc: "Mix dette/equity, covenants, LBO" },
      { name: "Due Diligence", desc: "Checklist financière et juridique" },
      { name: "Valorisation", desc: "DCF, comparables, transaction precedents" },
      { name: "Pro-Forma", desc: "Comptes combinés post-deal" },
      { name: "Sensibilité", desc: "Matrices prix/synergies/financement" },
      { name: "Timeline", desc: "Planning transaction, jalons" },
      { name: "Dashboard", desc: "KPIs deal, Go/No-Go" },
    ],
    kpis: ["Accretion %", "Synergies (€M)", "IRR", "Multiple EV/EBITDA", "Leverage ratio"],
  },
  {
    id: "ifrs", name: "IFRS Consolidation", shortName: "IFRS",
    file: "IFRS_Consolidation", color: "#14b8a6", colorHex: "#14b8a6",
    icon: "✅", tabs: 38, status: "CONFORME",
    description: "38 onglets : consolidation 5 filiales, IFRS 18 mapping, ESG/CSRD, Power Query.",
    onglets: [
      { name: "HOME / GUIDE", desc: "Navigation, méthodologie pédagogie" },
      { name: "Sources (×5)", desc: "FRParentCo, DEFiliale, UKFiliale, USFiliale, SGFiliale" },
      { name: "ELIM", desc: "Écritures d'élimination intercompagnies" },
      { name: "CONSOLBILAN", desc: "Bilan consolidé" },
      { name: "CONSOLCR", desc: "Compte de résultat consolidé" },
      { name: "IFRS18MAPPING", desc: "Mapping IFRS 18 nouvelles catégories" },
      { name: "NOTESIFRS", desc: "Notes annexes automatisées" },
      { name: "DASHBOARDS (×3)", desc: "Financier, ESG, Synthétique" },
      { name: "Power Query (×8)", desc: "SRCFR/DE/UK/US/SG, PQMAPPING, taux change" },
      { name: "ESG/CSRD (×6)", desc: "ESGDATA, CSRDRAPPORT, ESGCARBONE, ESGDIVERSITE" },
    ],
    kpis: ["Goodwill (€M)", "Résultat consolidé", "OCI", "Conformité ESRS %", "Périmètre"],
  },
  {
    id: "defense", name: "Simulateur Défense Drones", shortName: "Défense",
    file: "Simulateur_Defense_Drones", color: "#6366f1", colorHex: "#6366f1",
    icon: "🎯", tabs: 15, status: "75 SYS",
    description: "75 systèmes, 50 acteurs, 40 programmes, comparateur, wargaming, supply chain.",
    onglets: [
      { name: "DASHBOARD", desc: "75 systèmes, 50 acteurs, 40 programmes, 20 pays" },
      { name: "BASESYSTEMES", desc: "75 systèmes, 85 champs (coûts, export, scoring)" },
      { name: "BASEACTEURS", desc: "50 industriels (Baykar, MBDA, Thales...)" },
      { name: "BASEPROGRAMMES", desc: "40 programmes (budget, retards, leçons)" },
      { name: "COMPARATEUR", desc: "Radar chart, ratio attaque/défense" },
      { name: "SIMULATEURCOUTS", desc: "TCO consommable vs traditionnel" },
      { name: "MATRICEMENACES", desc: "Coût attaque vs réponse défensive" },
      { name: "PROLIFERATIONMAP", desc: "Export SIPRI" },
      { name: "DOCTRINESPAYS", desc: "14 pays (Ukraine, USA, France, Russie...)" },
      { name: "SUPPLYCHAIN", desc: "Composants critiques, dépendances" },
      { name: "SCENARIOS", desc: "Wargaming (Shahed vs Patriot, FPV...)" },
    ],
    kpis: ["Systèmes évalués", "Ratio coût/efficacité", "TCO (€M)", "Vulnérabilité supply chain"],
  },
  {
    id: "patrimoine", name: "Simulateur Patrimoine PL Santé", shortName: "Patrimoine",
    file: "Simulateur_Patrimoine_PL_Sante", color: "#06b6d4", colorHex: "#06b6d4",
    icon: "🏦", tabs: 20, status: "+4.2%",
    description: "PL Santé : cotisations, fiscalité IR+IFI, retraite CER, PER, transmission Dutreil, projection 30 ans.",
    onglets: [
      { name: "PARAMBaremes", desc: "IR 2026, IFI, IS" },
      { name: "PARAMCaisses", desc: "CARMF, CARPIMKO..." },
      { name: "PARAMCotisations", desc: "Barèmes cotisations obligatoires" },
      { name: "CLIENTIdentite", desc: "Fiche client complète" },
      { name: "CLIENTActivite", desc: "Type exercice, revenus" },
      { name: "CLIENTPatrimoine", desc: "Actifs immobiliers, financiers, pro" },
      { name: "CALCCotisations", desc: "Calcul détaillé toutes caisses" },
      { name: "CALCFiscalite", desc: "IR + IFI détaillé" },
      { name: "CALCRetraite", desc: "CER réforme 2023" },
      { name: "CALCPrevoyance", desc: "Garanties IJ, invalidité, décès" },
      { name: "CALCPER", desc: "Plan Épargne Retraite optimisation" },
      { name: "CALCRemuneration", desc: "Arbitrage rémunération/dividendes" },
      { name: "CALCTransmission", desc: "Dutreil, cession" },
      { name: "CALCProjection", desc: "Projection patrimoniale 30 ans" },
      { name: "CALCComparatif", desc: "EI vs SELARL vs SELAS vs Micro-BNC" },
    ],
    kpis: ["Patrimoine net (€)", "TMI", "Retraite CER (€)", "Gain fiscal Dutreil", "Projection 30 ans"],
  },
];

export const STACK_DATA: StackLayer[] = [
  {
    layer: "Frontend", icon: "🖥️",
    items: [
      { name: "Next.js 16", desc: "SSR, App Router, TypeScript", color: "bg-zinc-800 text-white" },
      { name: "Tailwind v4", desc: "Styling + design tokens", color: "bg-cyan-500/10 text-cyan-400" },
      { name: "Recharts + D3", desc: "Graphiques interactifs", color: "bg-orange-500/10 text-orange-400" },
      { name: "Lucide React", desc: "Icônes", color: "bg-green-500/10 text-green-400" },
    ],
  },
  {
    layer: "Backend", icon: "⚙️",
    items: [
      { name: "FastAPI", desc: "API Python, calculs financiers", color: "bg-emerald-500/10 text-emerald-400" },
      { name: "openpyxl", desc: "Parsing Excel serveur", color: "bg-lime-500/10 text-lime-400" },
      { name: "React-PDF", desc: "Rapports professionnels", color: "bg-red-500/10 text-red-400" },
      { name: "Auth JWT", desc: "Authentification par client", color: "bg-violet-500/10 text-violet-400" },
    ],
  },
  {
    layer: "Infrastructure", icon: "☁️",
    items: [
      { name: "Vercel", desc: "Déploiement automatique", color: "bg-blue-500/10 text-blue-400" },
      { name: "PostgreSQL", desc: "Données clients, diagnostics", color: "bg-blue-500/10 text-blue-400" },
      { name: "GitHub Actions", desc: "CI/CD automatique", color: "bg-zinc-500/10 text-zinc-400" },
      { name: "Redis", desc: "Cache temps réel", color: "bg-red-500/10 text-red-400" },
    ],
  },
];

export const TIMELINE_DATA: TimelineYear[] = [
  { year: "2024", items: ["DORA (17 jan)", "CSRD wave 1", "Pilier 2 GloBE", "CRR III"], color: "#4edea3" },
  { year: "2025", items: ["CSRD wave 2 (PME)", "NIS2 transposition", "MiCA actif", "IFRS 18 adoption"], color: "#60a5fa" },
  { year: "2026", items: ["Output Floor 50%", "AI Act plein", "PSD3", "CSRD wave 3"], color: "#a78bfa" },
  { year: "2027", items: ["Output Floor 55%", "FIDA", "Pilier 2 revue", "Basel IV IRB"], color: "#f59e0b" },
  { year: "2028", items: ["Output Floor 60%", "CSRD audit", "Taxonomie élargie"], color: "#f43f5e" },
  { year: "2029", items: ["Output Floor 65%", "DORA revue", "NIS3 ?"], color: "#14b8a6" },
  { year: "2030", items: ["Output Floor 72.5%", "Neutralité carbone", "Full Basel IV"], color: "#6366f1" },
];

export const TICKER_ITEMS = [
  { label: "CAC40", value: "+1.24%", positive: true },
  { label: "S&P500", value: "+0.87%", positive: true },
  { label: "EUR/USD", value: "-0.12%", positive: false },
  { label: "GloBE ETR", value: "15.0%", positive: true },
  { label: "CET1", value: "14.2%", positive: true },
  { label: "VIX", value: "14.2", positive: null as boolean | null },
  { label: "DORA", value: "COMPLIANT", positive: true },
  { label: "IFRS 18", value: "ACTIF", positive: true },
  { label: "Z-Score", value: "3.14", positive: true },
];
