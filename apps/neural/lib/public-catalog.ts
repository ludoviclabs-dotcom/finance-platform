import {
  BRANCHES_META,
  SECTORS_META,
  countLiveAgents,
  countLiveCells,
  type Branch,
  type Sector,
} from "@/lib/data/agents-registry";

export type PublicStatus = "live" | "demo" | "planned";
export type ProofLevel = "runtime_data" | "ui_demo" | "content_only";
export type ClaimStatus = "active" | "qualified" | "retired";

export interface PublicEntry {
  slug: string;
  label: string;
  href: string;
  kind: "sector" | "branche" | "agent" | "resource" | "page";
  status: PublicStatus;
  proofLevel: ProofLevel;
  tagline: string;
  description: string;
  readyNow: string;
  nextStep: string;
  dataUsed: string;
  deliverable: string;
  ctaHref: string;
  ctaLabel: string;
  scopeNow: string[];
  notYet: string[];
}

export interface PublicClaim {
  id: string;
  claim: string;
  status: ClaimStatus;
  source: string;
  allowedOn: string[];
  note?: string;
}

export const PUBLIC_STATUS_LABELS: Record<PublicStatus, string> = {
  live: "Live avec données réelles",
  demo: "Démo orchestrée",
  planned: "En préparation",
};

export const PROOF_LEVEL_LABELS: Record<ProofLevel, string> = {
  runtime_data: "Preuve runtime",
  ui_demo: "Preuve UI / démo",
  content_only: "Preuve contenu",
};

// Sprint P0 (19 avril 2026) — `frameworkAgents: 168` remplacé par AGENT_ENTRIES.length
// (valeur dérivée du catalogue réel, pas de nombre théorique non vérifiable).
// Les seuls chiffres exposés restent ceux du catalogue (liveAgents/liveCells/catalogAgents)
// ou les constantes structurelles du framework (branches, secteurs, workbooks runtime).
export const PUBLIC_METRICS = {
  frameworkTargetAgents: 168, // capacité cible du framework, jamais périmètre live
  externalNeuralWorkbooks: 44, // audit local Desktop hors Carbon and Co (2026-05-06)
  excludedCarbonWorkbooks: 6,
  frameworkCells: 42, // 7 branches × 6 secteurs (math structurelle, vérifiable)
  get frameworkAgents() {
    // Somme vraie des agents inscrits dans AGENT_ENTRIES — remplace l'ancien 168.
    return AGENT_ENTRIES.length;
  },
  get publicAgentPages() {
    return AGENT_ENTRIES.length;
  },
  liveAgents: countLiveAgents(),
  liveCells: countLiveCells(),
  runtimeWorkbooks: 35,
  publicSectors: 6,
  publicBranches: 7,
} as const;

function buildSectorEntry(
  sector: Sector,
  overrides: Omit<PublicEntry, "slug" | "label" | "href" | "kind">
): PublicEntry {
  return {
    slug: sector,
    label: SECTORS_META[sector].label,
    href: `/secteurs/${sector}`,
    kind: "sector",
    ...overrides,
  };
}

function buildBranchEntry(
  branche: Branch,
  overrides: Omit<PublicEntry, "slug" | "label" | "href" | "kind">
): PublicEntry {
  return {
    slug: branche,
    label: BRANCHES_META[branche].label,
    href: `/solutions/${branche}`,
    kind: "branche",
    ...overrides,
  };
}

export const SECTOR_ENTRIES: PublicEntry[] = [
  buildSectorEntry("luxe", {
    status: "live",
    proofLevel: "runtime_data",
    tagline: "Verticale la plus avancée publiquement",
    description:
      "Le secteur Luxe est aujourd'hui le meilleur point d'entrée public pour comprendre NEURAL : hub live, data hub branché sur des workbooks embarqués, exports visibles et surfaces Finance/RH.",
    readyNow:
      "Hub Luxe public, Data Hub, exports Excel/ZIP, surface Finance live et surface RH exposée.",
    nextStep:
      "Etendre le nombre d'agents vraiment opérés et uniformiser les preuves par agent.",
    dataUsed:
      "7 workbooks embarqués dans le runtime NEURAL, lisibles par l'API /api/data.",
    deliverable:
      "Hub secteur, export consolidation, pack complet et surfaces de démonstration Finance/RH.",
    ctaHref: "/secteurs/luxe",
    ctaLabel: "Explorer la verticale Luxe",
    scopeNow: [
      "Expose un parcours public cohérent du hub jusqu'aux exports.",
      "Affiche un sous-ensemble branché au runtime actuel.",
      "Concentre la preuve produit la plus tangible du projet.",
    ],
    notYet: [
      "Ne prouve pas encore l'ensemble des 7 agents luxe comme surfaces opérables.",
      "Ne couvre pas encore toutes les branches luxe à statut live.",
      "Ne remplace pas un ERP ou un back-office transactionnel complet.",
    ],
  }),
  buildSectorEntry("transport", {
    status: "demo",
    proofLevel: "ui_demo",
    tagline: "Démonstration d'orchestration métier",
    description:
      "Le secteur Transport montre l'ambition d'orchestration de NEURAL avec des agents comptables spécialisés, un orchestrateur et un parcours de clôture de démonstration.",
    readyNow:
      "Page secteur riche, workflow visuel, stepper et preuves de raisonnement produit.",
    nextStep:
      "Brancher les workbooks transport au runtime public et relier les sorties a de vrais exports.",
    dataUsed:
      "Storyboards, workbooks hors runtime public et preuves de conception d'orchestration.",
    deliverable:
      "Démo orchestrée avec parcours comptable, orchestration et livrables ciblés.",
    ctaHref: "/secteurs/transport",
    ctaLabel: "Voir la démo transport",
    scopeNow: [
      "Montre un cas d'usage sectoriel clair avec un langage produit fort.",
      "Expose le concept d'orchestrateur et de validation humaine.",
      "Aide à vendre la vision multi-agents sans la présenter comme déjà industrialisée.",
    ],
    notYet: [
      "Pas de moteur d'orchestration durable exposé publiquement.",
      "Pas de brancheement runtime public sur les workbooks transport.",
      "Pas de promesse à interpréter comme automatisation pleinement opérée.",
    ],
  }),
  buildSectorEntry("aeronautique", {
    status: "demo",
    proofLevel: "ui_demo",
    tagline: "Premier wedge public : Marketing aéro (B2B + defense + sustainability)",
    description:
      "L'aéronautique dispose maintenant d'un premier wedge visible : Marketing B2B technique, conformité ITAR/EAR/sanctions, packs salons 2026 (Farnborough, ILA, Eurosatory, MEBAA) et anti-greenwashing SAF/H2/eVTOL. La page expose 4 agents, 2 services réservés, 44 règles et les 5 workbooks Excel générés.",
    readyNow: "Page Aéronautique / Marketing, hub /secteurs/aeronautique, 5 workbooks Excel locaux et référentiel 2026 documenté (AI Act art. 50, OFAC SDN, Green Claims Directive, ReFuelEU).",
    nextStep:
      "Brancher les workbooks au runtime public et ajouter la branche Communications & Affaires publiques (corporate, gov relations).",
    dataUsed: "AeroTechContent + DefenseCommsGuard + AeroEventAI + AeroSustainabilityComms + Aero_Marketing_OVERVIEW (5 workbooks NEURAL).",
    deliverable: "Page /secteurs/aeronautique/marketing avec sourcebook réglementaire 12 sources et catalogue TS.",
    ctaHref: "/secteurs/aeronautique/marketing",
    ctaLabel: "Ouvrir Aéronautique / Marketing",
    scopeNow: [
      "Expose un cas d'usage aéro concret sans données classifiées.",
      "Montre les guardrails réglementaires : ITAR/EAR, sanctions, AI Act art. 50, anti-greenwashing.",
      "Reste honnête : démo UI et workbooks portfolio, pas production live.",
    ],
    notYet: [
      "Pas encore de parsing runtime des fichiers Excel aéro.",
      "Pas encore de pages agents dédiées avec API de démo.",
      "Pas encore de branche Communications & Affaires publiques publiée (corporate aéro-comms en attente).",
    ],
  }),
  buildSectorEntry("saas", {
    status: "planned",
    proofLevel: "content_only",
    tagline: "Angle de marche, pas surface live",
    description:
      "La verticale SaaS reste visible comme angle d'offre, mais elle n'est pas encore une preuve produit comparable au noyau Luxe.",
    readyNow: "Positionnement secteur et cas d'usage ciblés.",
    nextStep:
      "Definir un premier agent wedge et le brancher à une preuve de données et de sortie.",
    dataUsed: "Cadrage produit et hypothèses de marche.",
    deliverable: "Page readiness et CTA de contact.",
    ctaHref: "/contact",
    ctaLabel: "Parler du cas SaaS",
    scopeNow: [
      "Conserve un discours de marche lisible.",
      "Rend explicite que la verticale n'est pas encore productisée.",
    ],
    notYet: [
      "Pas de runtime public sectoriel.",
      "Pas de parcours de démo end-to-end.",
      "Pas de preuve par export ou agent live.",
    ],
  }),
  buildSectorEntry("banque", {
    status: "demo",
    proofLevel: "runtime_data",
    tagline: "Communication runtime + Marketing Excel-first",
    description:
      "Le secteur Banque expose deux branches distinctes : Communication bancaire régulée (runtime scénario-id only) et Marketing bancaire Excel-first (AMF/ACPR, éducation financière, segmentation, MiFID, PRIIPs, MiCA). Les deux gardent les gates déterministes et la revue humaine visibles.",
    readyNow:
      "Hub /secteurs/banque, branche Communication en démo runtime, branche Marketing avec 6 workbooks générés, console scénario-id et 10 gates MVP.",
    nextStep:
      "Synchroniser les workbooks Banque / Marketing vers content JSON, puis ajouter des fiches agents dédiées quand la console branche est stabilisée.",
    dataUsed:
      "Communication : seeds JSON réglementaires. Marketing : NEURAL_BANK_MARKETING_FOUNDATIONS.xlsx, MASTER et 4 workbooks agents générés localement.",
    deliverable: "Hub /secteurs/banque + pages /communication et /marketing avec démos scénario-id only.",
    ctaHref: "/secteurs/banque",
    ctaLabel: "Ouvrir le secteur Banque",
    scopeNow: [
      "Sépare clairement Communication corporate et Marketing client.",
      "Expose 8 agents publics, 4 services réservés et 26 gates explicites entre les deux branches.",
      "Maintient le mode scénario-id only pour éviter texte libre, conseil personnalisé ou autopublication.",
    ],
    notYet: [
      "Les workbooks Banque / Marketing ne sont pas encore synchronises vers le runtime public.",
      "Pas encore de pages agents dédiées pour AG-BM001 à AG-BM004.",
      "Pas de fetch automatisé de la veille réglementaire marketing.",
    ],
  }),
  buildSectorEntry("assurance", {
    status: "demo",
    proofLevel: "ui_demo",
    tagline: "Premier wedge public : Supply Chain sinistres et tiers",
    description:
      "L'assurance dispose maintenant d'un premier wedge visible : réparateurs, experts, fraude fournisseur et Sapin II. La page expose 4 agents, 2 services réservés, 10 gates et les 6 workbooks Excel générés.",
    readyNow: "Page Assurance / Supply Chain, console scénario-id, 6 workbooks Excel locaux et gates MVP documentés.",
    nextStep:
      "Brancher les workbooks au runtime public et créer les fiches agents dédiées.",
    dataUsed: "NEURAL_INSURANCE_SC_FOUNDATIONS.xlsx, MASTER et 4 workbooks agents générés localement.",
    deliverable: "Page /secteurs/assurance/supply-chain avec console interactive et sourcebook réglementaire.",
    ctaHref: "/secteurs/assurance/supply-chain",
    ctaLabel: "Ouvrir Assurance / Supply Chain",
    scopeNow: [
      "Expose un cas d'usage assurance concret sans données personnelles.",
      "Montre les guardrails réglementaires : libre choix réparateur, mandat expert, HITL fraude, Sapin II, DORA.",
      "Reste honnête : démo UI et workbooks portfolio, pas production live.",
    ],
    notYet: [
      "Pas encore de parsing runtime des fichiers Excel assurance.",
      "Pas encore de pages agents dédiées avec API de démo.",
      "Pas de données assureurs, fournisseurs ou sinistres réels.",
    ],
  }),
];

export const BRANCH_ENTRIES: PublicEntry[] = [
  buildBranchEntry("finance", {
    status: "live",
    proofLevel: "runtime_data",
    tagline: "La branche la plus tangible aujourd'hui",
    description:
      "Finance concentre la meilleure preuve publique de NEURAL : données runtime, hub, consolidation, exports et parcours sectoriel luxe.",
    readyNow:
      "Surface Luxe Finance, agent consolidation live et exports reliés au Data Hub.",
    nextStep:
      "Rendre plus d'agents finance opérables publiquement au même niveau que la consolidation.",
    dataUsed: "Workbooks runtime Luxe Finance et APIs d'export publiques.",
    deliverable: "Surface Finance live, export xlsx et pack zip.",
    ctaHref: "/secteurs/luxe/finance",
    ctaLabel: "Ouvrir Luxe Finance",
    scopeNow: [
      "Montre une vraie sortie métier et un agent live.",
      "Prouve la logique hub -> agent -> export.",
      "Donne une surface de démo vendable dès aujourd'hui.",
    ],
    notYet: [
      "Tous les agents finance annoncés ne sont pas encore exposés comme surfaces completes.",
      "La branche n'est pas encore généralisée à tous les secteurs.",
      "Le périmètre reste plus étroit que le discours historique.",
    ],
  }),
  buildBranchEntry("rh", {
    status: "demo",
    proofLevel: "runtime_data",
    tagline: "Données prêtes, surface encore en démonstration",
    description:
      "La branche RH dispose de workbooks et d'une page publique solide, mais elle doit encore transformer ses agents en surfaces aussi convaincantes que Finance.",
    readyNow:
      "Surface RH luxe, datasets prêts et parcours de démonstration sectoriel.",
    nextStep:
      "Relier les agents RH à un niveau de preuve produit comparable à Finance.",
    dataUsed: "Workbooks RH luxe embarqués dans l'application.",
    deliverable: "Page RH sectorielle, cartes agents, démonstration de parcours.",
    ctaHref: "/secteurs/luxe/rh",
    ctaLabel: "Voir la branche RH",
    scopeNow: [
      "Montre la profondeur du travail RH luxe.",
      "Expose la logique métier et les livrables ciblés.",
      "Sert de surface commerciale sans mentir sur le statut.",
    ],
    notYet: [
      "Pas d'agent RH public avec le même niveau d'opérabilité que consolidation.",
      "Pas de sortie publique aussi tangible qu'un export lié au hub.",
      "Pas encore une branche live à pleine maturité.",
    ],
  }),
  buildBranchEntry("comptabilite", {
    status: "demo",
    proofLevel: "ui_demo",
    tagline: "Narratif métier fort, exécution encore sélective",
    description:
      "Comptabilité est porte par la démo transport et par des workbooks spécialisés, mais la couche publique reste surtout démonstrative à ce stade.",
    readyNow: "Démonstration transport et cadrage comptable par cas d'usage.",
    nextStep:
      "Remonter une surface comptable live clairement branchée à des données et à un export.",
    dataUsed: "Storyboards publics et workbooks spécialisés hors runtime principal.",
    deliverable: "Page de readiness branche et démo transport.",
    ctaHref: "/secteurs/transport",
    ctaLabel: "Voir la démo comptable",
    scopeNow: [
      "Aide à vendre la competence normative.",
      "Relie le discours comptable à un cas sectoriel concret.",
    ],
    notYet: [
      "Pas de branche comptabilité live à l'échelle publique.",
      "Pas de sortie exportable généralisée.",
      "Pas de couche d'orchestration prouvee dans le runtime public.",
    ],
  }),
  buildBranchEntry("supply-chain", {
    status: "demo",
    proofLevel: "ui_demo",
    tagline: "Premier wedge Assurance / Supply Chain exposé",
    description:
      "Supply Chain dispose maintenant d'un cas public concret dans l'assurance : réseau de réparateurs, experts, fraude fournisseur et conformité Sapin II.",
    readyNow: "Page Assurance / Supply Chain avec 4 agents, console scénario-id et workbooks Excel générés.",
    nextStep:
      "Transformer la démo en runtime public branché aux workbooks puis décliner d'autres secteurs.",
    dataUsed: "Workbooks NEURAL Insurance Supply Chain générés localement.",
    deliverable: "Page sectorielle Assurance / Supply Chain.",
    ctaHref: "/secteurs/assurance/supply-chain",
    ctaLabel: "Voir Assurance / Supply Chain",
    scopeNow: [
      "Montre un wedge Supply Chain concret et auditable.",
      "Rend visibles les gates de conformité avant une integration production.",
    ],
    notYet: [
      "Pas encore de runtime public connecté aux xlsx assurance.",
      "Pas de déclinaison multi-secteurs Supply Chain.",
      "Pas de données client ou fournisseur réelles.",
    ],
  }),
  buildBranchEntry("marketing", {
    status: "demo",
    proofLevel: "ui_demo",
    tagline: "Deux wedges démo : Assurance / Marketing et Banque / Marketing",
    description:
      "Marketing dispose maintenant de surfaces démontrables : Assurance / Marketing pour DDA et RGPD, et Banque / Marketing pour AMF/ACPR, education, segmentation, MiFID, PRIIPs et MiCA.",
    readyNow:
      "Pages UI démo, workbooks locaux, sourcebooks réglementaires et consoles scénario-id only.",
    nextStep:
      "Synchroniser les workbooks vers content JSON et transformer les consoles branche en fiches agents dédiées.",
    dataUsed:
      "Workbooks Assurance / Marketing existants et NEURAL_BANK_MARKETING_* générés localement.",
    deliverable: "Pages /secteurs/assurance/marketing et /secteurs/banque/marketing.",
    ctaHref: "/secteurs/banque/marketing",
    ctaLabel: "Ouvrir Banque / Marketing",
    scopeNow: [
      "Montre une branche Marketing concrète sans promettre de production live.",
      "Expose les gates et les limites de conseil personnalisé.",
      "Présenté des livrables Excel utiles en portfolio recruteur.",
    ],
    notYet: [
      "Pas de runtime Excel direct.",
      "Pas de generation libre de campagne.",
      "Pas de connecteur CRM/CMS production.",
    ],
  }),
  buildBranchEntry("communication", {
    status: "live",
    proofLevel: "runtime_data",
    tagline: "2 verticales live : 5 agents Luxe + 4 agents Banque, tous prouvables",
    description:
      "La branche Communication couvre deux verticales : LUXE (5 agents — MaisonVoiceGuard, LuxePressAgent, LuxeEventComms, HeritageComms, GreenClaimChecker) et BANQUE (4 agents publics + 2 services — RegBankComms, BankCrisisComms, ESGBankComms, ClientBankComms, RegWatchBank, BankEvidenceGuard). Tous en démo scénario-id only, avec gates déterministes qui overrident le LLM.",
    readyNow:
      "Luxe : 7 workbooks runtime, gate brand scoring, matrice 5 juridictions. Banque : 16 gates déterministes, 19 scénarios testset, 4 packs Markdown exportables avec hash SHA-256, resolveur EvidenceGuard déterministe sans LLM.",
    nextStep:
      "Workbooks Excel réels banque, fetch live veille réglementaire (ACPR/AMF/EBA), persistance runs multi-tenant, tests unitaires des gates.",
    dataUsed:
      "Luxe : 7 workbooks Luxe Comms synchronises via scripts/sync-luxe-comms.ts. Banque : 10 sources ACPR/AMF/EBA/ECB/ESMA/IFRS/EUR-Lex + 13 disclosure rules + 10 patterns ESG library + 18 subjects EvidenceGuard.",
    deliverable: "Hub Luxe / Communication (5 agents) + Hub Banque / Communication avec dashboard opérationnel (6 agents) + 11 packs .md exportables.",
    ctaHref: "/secteurs/luxe/communication",
    ctaLabel: "Ouvrir Luxe / Communication",
    scopeNow: [
      "Deux verticales live avec preuves runtime distinctes (contenu luxe vs. conformité bancaire).",
      "16 gates banque + 5 gates luxe, tous déterministes et serveur-side.",
      "Couverture réglementaire : EU Green Claims 2024, Loi Climat FR, SFDR, taxonomie UE, MAR, CRR Part 8, Art. L.312-1-1 CMF.",
    ],
    notYet: [
      "Workbooks Excel banque (les seeds JSON suffisent en runtime mais xlsx visible prouverait la chaîne).",
      "Fetch automatisé de la veille réglementaire (seed Sprint 3).",
      "Persistence runs cross-verticales pour inbox HITL.",
    ],
  }),
  buildBranchEntry("si", {
    status: "planned",
    proofLevel: "content_only",
    tagline: "Capacité a expliciter, pas surface live",
    description:
      "SI reste une branche de vision pour NEURAL, utile au récit plateforme mais encore sans surface publique comparable à Finance.",
    readyNow: "Positionnement dans le framework global.",
    nextStep: "Formuler un premier use case SI avec preuve de sortie.",
    dataUsed: "Contenus de positionnement et vision produit.",
    deliverable: "Page readiness et CTA.",
    ctaHref: "/contact",
    ctaLabel: "Parler SI",
    scopeNow: ["Contribue à la carte d'offre globale."],
    notYet: [
      "Pas de branche live.",
      "Pas de preuves runtime publiques.",
      "Pas d'agent exposé.",
    ],
  }),
];

export const AGENT_ENTRIES: PublicEntry[] = [
  {
    slug: "consolidation",
    label: "Consolidation Groupe",
    href: "/agents/consolidation",
    kind: "agent",
    status: "live",
    proofLevel: "runtime_data",
    tagline: "Agent le plus prouve publiquement",
    description:
      "Consolidation Groupe est aujourd'hui la surface agent la plus crédible de NEURAL : données runtime, resultat visible dans Luxe Finance et export relie au Data Hub.",
    readyNow:
      "Données de consolidation disponibles dans le runtime, KPI exposés dans la verticale Finance et export xlsx public.",
    nextStep:
      "Enrichir la surface agent avec davantage d'entrées, de sorties et de preuves de validation.",
    dataUsed: "NEURAL_Consolidation_Groupe.xlsx",
    deliverable: "Surface Finance live, KPI consolides et export xlsx.",
    ctaHref: "/secteurs/luxe/finance",
    ctaLabel: "Voir Luxe Finance",
    scopeNow: [
      "Prouve la logique workbook -> hub -> sortie métier.",
      "Montre un agent public avec données réelles.",
      "Ancre la crédibilité publique du projet.",
    ],
    notYet: [
      "N'exposé pas encore toute la profondeur fonctionnelle de l'agent.",
      "Ne constitue pas à lui seul un cockpit finance complet.",
    ],
  },
  {
    slug: "inventaire-luxe",
    label: "Inventaire Luxe",
    href: "/agents/inventaire-luxe",
    kind: "agent",
    status: "demo",
    proofLevel: "runtime_data",
    tagline: "Agent préparé autour d'un workbook runtime",
    description:
      "Inventaire Luxe repose sur un workbook embarqué et sur une presence dans le Data Hub, mais la surface publique reste encore une page de readiness.",
    readyNow: "Workbook runtime, données d'inventaire et references dans le hub.",
    nextStep: "Transformer l'agent en surface publique opérable avec sorties visibles.",
    dataUsed: "NEURAL_Inventaire_Luxe.xlsx",
    deliverable: "Page de readiness et orientation vers Luxe Finance.",
    ctaHref: "/secteurs/luxe/finance",
    ctaLabel: "Voir l'écosystème Finance",
    scopeNow: [
      "Prouve l'existence du workbook et son integration dans le runtime.",
      "Clarifie que la surface agent publique n'est pas encore finalisée.",
    ],
    notYet: [
      "Pas d'interface agent finale publique.",
      "Pas de promesse d'autonomie opérationnelle.",
    ],
  },
  {
    slug: "multi-currency",
    label: "Multi-Currency IAS 21",
    href: "/agents/multi-currency",
    kind: "agent",
    status: "demo",
    proofLevel: "runtime_data",
    tagline: "Brique finance prête a être exposée",
    description:
      "La logique multi-devises existe dans le runtime et dans les workbooks, mais l'agent n'est pas encore exposé comme surface complète.",
    readyNow: "Données IAS 21, references dans Luxe Finance et export full pack.",
    nextStep: "Publier une surface agent avec entrées, sorties et preuves explicites.",
    dataUsed: "NEURAL_MultiCurrency_IAS21.xlsx",
    deliverable: "Page de readiness et passage vers Luxe Finance.",
    ctaHref: "/secteurs/luxe/finance",
    ctaLabel: "Voir les preuves Finance",
    scopeNow: [
      "Montre la profondeur du framework finance.",
      "Reste honnête sur le niveau de surface publique.",
    ],
    notYet: ["Pas d'agent public finalisé.", "Pas de parcours autonome exposé."],
  },
  {
    slug: "royalty",
    label: "Royalty Accounting",
    href: "/agents/royalty",
    kind: "agent",
    status: "demo",
    proofLevel: "runtime_data",
    tagline: "Brique normative à rendre démontrable",
    description:
      "Royalty Accounting participe à la narration finance normative, mais sa surface publique doit encore être consolidee.",
    readyNow: "Workbook runtime et references dans la verticale Luxe Finance.",
    nextStep: "Exposer les entrées/sorties et le niveau de preuve agent par agent.",
    dataUsed: "NEURAL_Royalty_Accounting.xlsx",
    deliverable: "Page de readiness et lien vers la verticale Finance.",
    ctaHref: "/secteurs/luxe/finance",
    ctaLabel: "Voir la verticale Finance",
    scopeNow: [
      "Ancre la specialisation normative dans le discours.",
      "Evite la sur-promesse sur une surface pas encore finalisée.",
    ],
    notYet: ["Pas d'agent public finalisé.", "Pas de parcours autonome exposé."],
  },
  {
    slug: "artisan-talent",
    label: "Artisan Talent",
    href: "/agents/artisan-talent",
    kind: "agent",
    status: "demo",
    proofLevel: "runtime_data",
    tagline: "Surface RH en démonstration",
    description:
      "Artisan Talent repose sur un workbook embarqué et une presence dans la page RH, mais le niveau public reste démonstratif.",
    readyNow: "Donnnees RH luxe, page RH sectorielle et narration agent.",
    nextStep: "Passer d'une carte agent à une vraie surface de travail publique.",
    dataUsed: "NEURAL_LuxeArtisanTalent.xlsx",
    deliverable: "Page de readiness et lien vers Luxe RH.",
    ctaHref: "/secteurs/luxe/rh",
    ctaLabel: "Voir Luxe RH",
    scopeNow: [
      "Rend visible la profondeur du travail RH luxe.",
      "Cadre honnetement le niveau de maturité publique.",
    ],
    notYet: ["Pas de surface agent publique finale."],
  },
  {
    slug: "comp-benchmark",
    label: "Comp & Benchmark",
    href: "/agents/comp-benchmark",
    kind: "agent",
    status: "demo",
    proofLevel: "runtime_data",
    tagline: "Brique RH prête a être mieux exposée",
    description:
      "Comp & Benchmark beneficie déjà d'un workbook runtime, mais la presentation publique doit encore converger vers un vrai parcours agent.",
    readyNow: "References RH et données runtime dans l'application.",
    nextStep: "Construire une surface publique autonome et des preuves de sortie.",
    dataUsed: "NEURAL_LuxeCompBenchmark.xlsx",
    deliverable: "Page de readiness et orientation RH.",
    ctaHref: "/secteurs/luxe/rh",
    ctaLabel: "Voir la branche RH",
    scopeNow: ["Expose l'intention produit sans exagérer la maturité."],
    notYet: ["Pas d'agent public finalisé."],
  },
  {
    slug: "onboarding",
    label: "Onboarding Luxe",
    href: "/agents/onboarding",
    kind: "agent",
    status: "demo",
    proofLevel: "runtime_data",
    tagline: "Parcours RH encore en exposition",
    description:
      "Onboarding Luxe apparait déjà dans la branche RH, mais la surface publique doit encore évoluer vers un niveau de préparation équivalent au noyau Finance.",
    readyNow: "Workbook runtime et page RH sectorielle.",
    nextStep: "Rendre la surface agent plus explicite et plus opérable.",
    dataUsed: "NEURAL_LuxeOnboarding.xlsx",
    deliverable: "Page de readiness et lien vers RH.",
    ctaHref: "/secteurs/luxe/rh",
    ctaLabel: "Explorer la branche RH",
    scopeNow: ["Conserve la lisibilité du catalogue agent."],
    notYet: ["Pas d'agent public finalisé."],
  },

  // ═══ LUXE × COMMUNICATION — 5 agents (Sprint 1 — avril 2026) ═══
  // ASSURANCE x SUPPLY CHAIN - 4 agents portfolio (avril 2026)
  {
    slug: "repair-network-insur",
    label: "RepairNetworkInsur",
    href: "/agents/repair-network-insur",
    kind: "agent",
    status: "demo",
    proofLevel: "ui_demo",
    tagline: "Pilotage réparateurs avec libre choix assure",
    description:
      "Agent Assurance / Supply Chain pour comparer qualite, couts et delais des réparateurs tout en bloquant tout wording qui imposerait un réparateur agree.",
    readyNow: "Workbook ISC-A001 généré, scénarios PASS/REVIEW/BLOCK et gate libre choix visibles sur la page Assurance / Supply Chain.",
    nextStep: "Creer une fiche agent dédiée et brancher le workbook au runtime public.",
    dataUsed: "NEURAL_ISC001_RepairNetworkInsur.xlsx",
    deliverable: "Console scénario-id sur /secteurs/assurance/supply-chain.",
    ctaHref: "/secteurs/assurance/supply-chain",
    ctaLabel: "Voir Assurance / Supply Chain",
    scopeNow: [
      "Recommandation réseau sans contrainte de choix.",
      "Review des anomalies devis/facture.",
      "Données synthétiques uniquement.",
    ],
    notYet: ["Pas encore d'API agent dédiée.", "Pas de données sinistres réelles."],
  },
  {
    slug: "expert-mgmt-insur",
    label: "ExpertMgmtInsur",
    href: "/agents/expert-mgmt-insur",
    kind: "agent",
    status: "demo",
    proofLevel: "ui_demo",
    tagline: "Dispatch experts, mandat et rapport complet",
    description:
      "Agent pour controler le dispatch des experts et la readiness des rapports : mandat ecrit, operations, personnes presentes, documents, conclusions et contestations.",
    readyNow: "Workbook ISC-A002 généré et scénarios mandat/rapport disponibles dans la console.",
    nextStep: "Ajouter une fiche agent avec timeline d'expertise et checklist rapport.",
    dataUsed: "NEURAL_ISC002_ExpertMgmtInsur.xlsx",
    deliverable: "Console scénario-id sur /secteurs/assurance/supply-chain.",
    ctaHref: "/secteurs/assurance/supply-chain",
    ctaLabel: "Voir Assurance / Supply Chain",
    scopeNow: [
      "Blocage mandat manquant.",
      "Review des rapports incomplets.",
      "Trace des contestations en cadrage.",
    ],
    notYet: ["Pas encore d'OCR rapport.", "Pas de workflow expert production."],
  },
  {
    slug: "fraud-detect-sc",
    label: "FraudDetectSC",
    href: "/agents/fraud-detect-sc",
    kind: "agent",
    status: "demo",
    proofLevel: "ui_demo",
    tagline: "Fraude fournisseur en alerte explicable, jamais en sanction auto",
    description:
      "Agent de detection de surfacturation, collusion et fausses factures. Le MVP produit des alertes explicables avec revue humaine obligatoire.",
    readyNow: "Workbook ISC-A003 généré, gates HITL fraude et RGPD décision automatisée visibles.",
    nextStep: "Ajouter graph de collusion et export de brief investigateur.",
    dataUsed: "NEURAL_ISC003_FraudDetectSC.xlsx",
    deliverable: "Console scénario-id sur /secteurs/assurance/supply-chain.",
    ctaHref: "/secteurs/assurance/supply-chain",
    ctaLabel: "Voir Assurance / Supply Chain",
    scopeNow: [
      "Alertes fournisseur explicables.",
      "Blocage des refus automatiques par score.",
      "Revue humaine explicite.",
    ],
    notYet: ["Pas de modele fraude entraine.", "Pas d'integration SI sinistre."],
  },
  {
    slug: "sapin2-compliance",
    label: "Sapin2Compliance",
    href: "/agents/sapin2-compliance",
    kind: "agent",
    status: "demo",
    proofLevel: "ui_demo",
    tagline: "Due diligence tiers et contrôles anticorruption",
    description:
      "Agent de contrôle Sapin II pour fournisseurs et intermediaires : identite, beneficiaires, conflits d'intérêts, risque pays et contrôles comptables.",
    readyNow: "Workbook ISC-A004 généré avec scénarios due diligence complète, risque élevé et onboarding bloqué.",
    nextStep: "Ajouter matrice de risque tiers et registre de remediations.",
    dataUsed: "NEURAL_ISC004_Sapin2Compliance.xlsx",
    deliverable: "Console scénario-id sur /secteurs/assurance/supply-chain.",
    ctaHref: "/secteurs/assurance/supply-chain",
    ctaLabel: "Voir Assurance / Supply Chain",
    scopeNow: [
      "Blocage onboarding sans evaluation tiers.",
      "Review renforcee des signaux collusion/COI.",
      "AFA sourcebook intégré.",
    ],
    notYet: ["Pas encore de screening externe.", "Pas de connecteur compliance production."],
  },

  // BANQUE x COMMUNICATION - agents vitrine gouvernés
  {
    slug: "reg-bank-comms",
    label: "RegBankComms",
    href: "/agents/reg-bank-comms",
    kind: "agent",
    status: "live",
    proofLevel: "runtime_data",
    tagline: "Communication bancaire régulée avec gates serveur et export signé",
    description:
      "Agent Banque / Communication pour relire des communications régulées sur scénarios figés. Les gates serveur bloquent chiffres non validés, information privilégiée, source inactive et wording restreint avant tout enrichissement LLM.",
    readyNow:
      "5 scénarios figés, 4 gates déterministes, démo live, export Markdown signé SHA-256 et registre de sources ACTIVE.",
    nextStep:
      "Brancher un tenant client, protéger l'inbox reviewer et connecter un registre de sources propre au client.",
    dataUsed: "NEURAL_BANK_COMMS_MASTER.xlsx + content/bank-comms/foundations.json",
    deliverable: "Démo live RegBankComms + pack d'export Markdown signé.",
    ctaHref: "/secteurs/banque/communication",
    ctaLabel: "Voir Banque / Communication",
    scopeNow: [
      "Expose une logique agentique défendable en secteur régulé.",
      "Produit un verdict PASS / REVIEW / BLOCK avec blockers lisibles.",
      "Prouve l'export audit et la séparation gates serveur / génération.",
    ],
    notYet: [
      "Pas de texte libre public pour éviter les informations non publiques.",
      "Pas encore de SSO reviewer ni de tenant client.",
    ],
  },
  {
    slug: "bank-evidence-guard",
    label: "BankEvidenceGuard",
    href: "/agents/bank-evidence-guard",
    kind: "agent",
    status: "live",
    proofLevel: "runtime_data",
    tagline: "Résolveur déterministe de sources pour agents banque",
    description:
      "Service transversal consommé par les agents Banque / Communication. Il filtre un registre fermé par type de communication, juridiction, subjects et fraîcheur, sans appel LLM.",
    readyNow:
      "Résolveur live, testset auditable, registre enrichi de sources et endpoint interne de résolution.",
    nextStep:
      "Ajouter un export complet du registre, une gouvernance de mise à jour et un owner client.",
    dataUsed: "content/bank-comms/foundations.json + registre sources banque",
    deliverable: "Démo résolveur live + testset auditable.",
    ctaHref: "/secteurs/banque/communication",
    ctaLabel: "Voir Banque / Communication",
    scopeNow: [
      "Prouve le mécanisme anti-hallucination par registre fermé.",
      "Rend les sources rejetées aussi visibles que les sources retenues.",
      "Fonctionne comme service zero-LLM reproductible.",
    ],
    notYet: [
      "Pas encore de registre client versionné.",
      "Pas d'export complet téléchargeable du sourcebook.",
    ],
  },

  {
    slug: "maison-voice-guard",
    label: "MaisonVoiceGuard",
    href: "/agents/maison-voice-guard",
    kind: "agent",
    status: "live",
    proofLevel: "runtime_data",
    tagline: "Le gardien du verbe — score brand et hard-fail, démo live",
    description:
      "Moteur central de scoring brand pour la branche Communication Luxe. Lit la charte (15 règles, 17 hard-fail) et retourne un score /100 + décision APPROVE/REWORK/REJECT en temps réel. Démo Live Scorer accessible publiquement depuis avril 2026.",
    readyNow: "Règles brand runtime, hard-fail dictionnaire FR+EN, testset 12 cas, démo Live Scorer branchée AI Gateway.",
    nextStep: "Connecter le flux presse AG-002 et le flux event AG-003 au moteur.",
    dataUsed: "NEURAL_AG001_MaisonVoiceGuard.xlsx + 3_BRAND_VOCAB_FR",
    deliverable: "Démo Live Scorer + API /api/démo/voice-score.",
    ctaHref: "/secteurs/luxe/communication",
    ctaLabel: "Voir la branche Communication",
    scopeNow: [
      "Expose la discipline zero-tolerance (hard-fail) dans un contexte luxe.",
      "Democratise la charte de marque en API scorable.",
      "Couvre FR et EN avec même rigueur.",
    ],
    notYet: [
      "Page agent publique dédiée pas encore livree (Sprint 2).",
      "Démo interactive Live Scorer à déployer Sprint 3.",
    ],
  },
  {
    slug: "luxe-press-agent",
    label: "LuxePressAgent",
    href: "/agents/luxe-press-agent",
    kind: "agent",
    status: "live",
    proofLevel: "runtime_data",
    tagline: "Rediger pour Vogue ET le FT, avec la même exigence — démo live",
    description:
      "Redige communiqués dans le registre du luxe. Adapte presse lifestyle (Vogue, HB, Numero) vs. business (FT, BoF, WWD) via media matrix. Gere embargos et angles editoriaux. 20 medias references. Démo Press Angle accessible publiquement.",
    readyNow: "Media directory 20 outlets, media matrix 7 formats, workflow brand handoff + claim handoff, press pickup tracking, démo Press Angle live.",
    nextStep: "Connexion CRM presse (HubSpot / Cision) + generation dossier presse complet.",
    dataUsed: "NEURAL_AG002_LuxePressAgent.xlsx + 6_MEDIA_DIRECTORY",
    deliverable: "Démo Press Angle + /api/démo/press-angle.",
    ctaHref: "/secteurs/luxe/communication",
    ctaLabel: "Voir la branche Communication",
    scopeNow: [
      "Mappe les attentes editoriales outlet-par-outlet.",
      "Gere l'embargo comme critere opérationnel.",
      "Trace le pickup post-publication (reach, sentiment).",
    ],
    notYet: [
      "Démo Rewriter interactive à livrer Sprint 4.",
      "Connection CRM presse (HubSpot / Cision) en v2.",
    ],
  },
  {
    slug: "luxe-event-comms",
    label: "LuxeEventComms",
    href: "/agents/luxe-event-comms",
    kind: "agent",
    status: "live",
    proofLevel: "runtime_data",
    tagline: "Packs evenementiels complets — defile, expo, lancement",
    description:
      "Pack multi-format pour defiles, lancements, expositions : invitations VIP, scripts, social live, captions. 12 evenements mappes avec niveau VIP et angle patrimoine.",
    readyNow: "Calendrier 12 evenements, matrice 27 formats par type, pack completion tracking, gates brand + heritage.",
    nextStep: "Exposer le generateur de pack (Sprint 4).",
    dataUsed: "NEURAL_AG003_LuxeEventComms.xlsx + 8_EVENTS_CALENDAR",
    deliverable: "Démo Event Pack + /api/démo/event-pack.",
    ctaHref: "/secteurs/luxe/communication",
    ctaLabel: "Voir la branche Communication",
    scopeNow: [
      "Industrialise la production content cross-format.",
      "Force les gates brand + heritage avant diffusion.",
      "Tracabilite SLA 2h social live temps réel.",
    ],
    notYet: [
      "Integration live social (Instagram, Weibo) en v2.",
      "Gestion RSVP / attendee non couverte.",
    ],
  },
  {
    slug: "heritage-comms",
    label: "HeritageComms",
    href: "/agents/heritage-comms",
    kind: "agent",
    status: "live",
    proofLevel: "runtime_data",
    tagline: "Zero citation sans source — la discipline patrimoniale, démo live",
    description:
      "Sourcing patrimonial : aucune sortie sans source cataloguee + citation formatee. 10 sources classifiées PRIMARY/SECONDARY/TERTIARY, 10 faits approuves, 6 blocs narratifs reutilisables. Démo Heritage Quote accessible publiquement.",
    readyNow: "Source catalog runtime, narrative blocks avec statut USABLE, citation control avec blockage TERTIARY-only, démo Heritage Quote live (4 formats).",
    nextStep: "Connexion archives OCR scan + registre droits image.",
    dataUsed: "NEURAL_AG004_HeritageComms.xlsx + 5_HERITAGE_SOURCEBOOK",
    deliverable: "Démo Heritage Quote + /api/démo/heritage-quote.",
    ctaHref: "/secteurs/luxe/communication",
    ctaLabel: "Voir la branche Communication",
    scopeNow: [
      "Anti-hallucination native : pas de source = pas de sortie.",
      "Supporte 4 formats de citation (Maison-style, Chicago, APA, Juridique).",
      "Mesure le staleness des sources (CF J-30 automatique).",
    ],
    notYet: [
      "Registre droits images non connecté.",
      "OCR archives scannees non opérationnel.",
    ],
  },
  {
    slug: "green-claim-checker",
    label: "GreenClaimChecker",
    href: "/agents/green-claim-checker",
    kind: "agent",
    status: "live",
    proofLevel: "runtime_data",
    tagline: "Conformité Green Claims — EU, FR, UK, US, CH — démo live",
    description:
      "Detection claims RSE + matching preuve + scoring risque (LOW/MEDIUM/HIGH/CRITICAL). Matrice 5 juridictions (EU, FR, UK, US, CH) avec regulations intégrées (EU Green Claims Directive 2024, Loi Climat FR, CMA UK, FTC US). Démo Claim Checker accessible publiquement.",
    readyNow: "Claim library 17 patterns, evidence registry 17 entrées, matrice juridictionnelle 10 claims-types, testset 10 cas, démo Claim Checker live (5 juridictions).",
    nextStep: "Integration jurisprudence externe + API DGCCRF.",
    dataUsed: "NEURAL_AG005_GreenClaimChecker.xlsx + 7_CLAIMS_EVIDENCE_REGISTRY",
    deliverable: "Démo Claim Checker + /api/démo/claim-check.",
    ctaHref: "/secteurs/luxe/communication",
    ctaLabel: "Voir la branche Communication",
    scopeNow: [
      "Anticipe l'application pleine de la Green Claims Directive en 2026.",
      "Differencie ABSOLUTE / QUALIFIED / COMPARATIVE.",
      "Fournit l'escalation (Legal + ESG Lead) en cas de risque CRITICAL.",
    ],
    notYet: [
      "Integration juridique externe (Lexis) non prevue.",
      "Base de jurisprudence non connectée en v1.",
    ],
  },
];

export const RESOURCE_ENTRIES: PublicEntry[] = [
  {
    slug: "case-studies",
    label: "Etudes de cas",
    href: "/resources/case-studies",
    kind: "resource",
    status: "planned",
    proofLevel: "content_only",
    tagline: "Preuve commerciale à construire",
    description:
      "Cette page est reservee aux futures preuves clients. Elle reste visible pour orienter la structure du site sans simuler des case studies inexistantes.",
    readyNow: "Structure du hub ressources et publications live.",
    nextStep: "Publier les premiers cas clients signes.",
    dataUsed: "Aucune preuve client publique a date.",
    deliverable: "Page readiness et CTA contact.",
    ctaHref: "/contact",
    ctaLabel: "Parler d'un pilote",
    scopeNow: ["Rend explicite qu'aucun case study public n'est encore publie."],
    notYet: ["Pas de cas client publie."],
  },
  {
    slug: "white-papers",
    label: "White Papers",
    href: "/resources/white-papers",
    kind: "resource",
    status: "planned",
    proofLevel: "content_only",
    tagline: "Bibliotheque editoriale en préparation",
    description:
      "Le site garde une place pour les contenus longs, sans faire croire qu'ils sont déjà publies.",
    readyNow: "Hub Publications live.",
    nextStep: "Transformer les analyses en white papers telechargeables.",
    dataUsed: "Publications existantes.",
    deliverable: "Page readiness et redirection vers Publications.",
    ctaHref: "/publications",
    ctaLabel: "Voir les publications",
    scopeNow: ["Clarifie la trajectoire editoriale."],
    notYet: ["Pas de white paper public."],
  },
  {
    slug: "outils/roi",
    label: "Calculateur ROI",
    href: "/resources/outils/roi",
    kind: "resource",
    status: "planned",
    proofLevel: "content_only",
    tagline: "Outil en préparation",
    description:
      "Le calculateur ROI n'est pas encore en libre-service. Cette page sert de point d'atterrissage honnête en attendant une version publique.",
    readyNow: "Promesse claire et CTA de contact.",
    nextStep: "Publier un premier simulateur de qualification simple.",
    dataUsed: "Hypotheses manuelles et cadrage commercial.",
    deliverable: "Page readiness et contact.",
    ctaHref: "/contact",
    ctaLabel: "Demander un cadrage ROI",
    scopeNow: ["Conserve l'intention produit sans lien mort."],
    notYet: ["Pas de simulateur public."],
  },
  {
    slug: "outils/maturity-score",
    label: "Audit maturité IA",
    href: "/resources/outils/maturity-score",
    kind: "resource",
    status: "planned",
    proofLevel: "content_only",
    tagline: "Outil lead-gen à venir",
    description:
      "L'audit maturité IA reste annonce comme prochain livrable public, pas comme outil déjà disponible.",
    readyNow: "Page readiness et CTA vers contact.",
    nextStep: "Mettre en ligne un premier questionnaire de maturité.",
    dataUsed: "Cadrage et hypothèses d'evaluation.",
    deliverable: "Page readiness et prise de rendez-vous.",
    ctaHref: "/contact",
    ctaLabel: "Demander un audit",
    scopeNow: ["Rend le futur outil visible sans tromper l'utilisateur."],
    notYet: ["Pas d'outil self-service public."],
  },
];

export const PAGE_ENTRIES: PublicEntry[] = [
  {
    slug: "marketplace",
    label: "Marketplace",
    href: "/marketplace",
    kind: "page",
    status: "planned",
    proofLevel: "content_only",
    tagline: "Catalogue futur, pas encore surface d'achat",
    description:
      "La marketplace reste une direction produit. Cette page conserve l'intention sans laisser un lien mort dans la navigation.",
    readyNow: "Catalogage visuel des statuts via le site principal.",
    nextStep: "Passer du shell public à un catalogue achetable agent par agent.",
    dataUsed: "Catalogue public et pages readiness.",
    deliverable: "Page readiness et contact.",
    ctaHref: "/contact",
    ctaLabel: "Parler d'un agent",
    scopeNow: ["Maintient la lisibilité de la trajectoire produit."],
    notYet: ["Pas de catalogue transactif public."],
  },
  {
    slug: "forfaits",
    label: "Forfaits",
    href: "/forfaits",
    kind: "page",
    status: "planned",
    proofLevel: "content_only",
    tagline: "Packaging commercial en cours de clarification",
    description:
      "La page forfaits reste visible pour preparer le packaging commercial, sans simuler une grille finalisée.",
    readyNow: "Orientation vers contact et cadrage sur demande.",
    nextStep: "Formaliser une offre publique avec perimetres et preuves associees.",
    dataUsed: "Cadrage commercial.",
    deliverable: "Page readiness et contact.",
    ctaHref: "/contact",
    ctaLabel: "Recevoir un cadrage",
    scopeNow: ["Evite les liens morts tout en restant prudent."],
    notYet: ["Pas de pricing public finalisé."],
  },
  {
    slug: "about",
    label: "À propos",
    href: "/about",
    kind: "page",
    status: "demo",
    proofLevel: "content_only",
    tagline: "Page socle de presentation",
    description:
      "À propos sert a poser la trajectoire de NEURAL et sa logique de truth layer, sans extrapoler au-dela du périmètre visible.",
    readyNow: "Presentation synthétique du positionnement et des preuves visibles.",
    nextStep: "Ajouter davantage de preuves clients et de contexte equipe.",
    dataUsed: "Contenu éditorial interne.",
    deliverable: "Page de presentation et CTA contact.",
    ctaHref: "/contact",
    ctaLabel: "Contacter NEURAL",
    scopeNow: ["Renforce la lisibilité de la marque."],
    notYet: ["Pas de parcours team/case studies complet."],
  },
];

export const PUBLIC_CLAIMS: PublicClaim[] = [
  {
    id: "ai-gateway",
    claim: "Chat public route via Vercel AI Gateway",
    status: "active",
    source: "apps/neural/lib/ai/router.ts",
    allowedOn: ["/", "/trust", "/contact"],
    note: "Claude Sonnet 4.6 reste le modèle principal du chat public, avec GPT-5.4 préparé en fallback.",
  },
  {
    id: "framework-capacity",
    claim: `${PUBLIC_METRICS.frameworkTargetAgents} agents restent une capacité cible ; ${PUBLIC_METRICS.frameworkAgents} fiches agents sont publiques`,
    status: "qualified",
    source: "apps/neural/lib/data/agents-registry.ts",
    allowedOn: ["/", "/trust"],
    note: "À présenter comme capacité du framework, pas comme périmètre live.",
  },
  {
    id: "external-workbooks",
    claim: `${PUBLIC_METRICS.externalNeuralWorkbooks} workbooks NEURAL audites hors Carbon and Co`,
    status: "qualified",
    source: "Audit local C:/Users/Ludo/Desktop/IA projet entreprises (2026-05-06)",
    allowedOn: ["/", "/trust", "/proof"],
    note: "Actifs Excel existants, pas tous branchés au runtime public.",
  },
  {
    id: "live-agents",
    claim: `${PUBLIC_METRICS.liveAgents} agents avec données réelles`,
    status: "active",
    source: "apps/neural/lib/data/agents-registry.ts",
    allowedOn: ["/", "/trust", "/secteurs/luxe"],
  },
  {
    id: "live-cells",
    claim: `${PUBLIC_METRICS.liveCells}/42 cellules alimentees`,
    status: "active",
    source: "apps/neural/lib/data/agents-registry.ts",
    allowedOn: ["/", "/trust"],
  },
  {
    id: "runtime-workbooks",
    claim: `${PUBLIC_METRICS.runtimeWorkbooks} workbooks embarques dans le runtime public`,
    status: "active",
    source: "apps/neural/data + apps/neural/app/api/data/route.ts",
    allowedOn: ["/", "/trust", "/secteurs/luxe", "/proof"],
  },
  {
    id: "llm-partner-status",
    claim: "Aucun partenariat LLM officiel revendique",
    status: "retired",
    source: "Ancien wording hero public",
    allowedOn: ["/trust"],
    note: "Retiré du discours public tant qu'une reconnaissance officielle n'est pas vérifiable.",
  },
  {
    id: "infrastructure-claims",
    claim: "SLA 99.9% / hébergement européen / AES-256 / RGPD",
    status: "retired",
    source: "apps/neural/components/sections/faq-accordion.tsx",
    allowedOn: ["/trust"],
    note: "Retiré du discours public tant que ces claims ne sont pas documentés dans le produit.",
  },
];

/**
 * Navigation primaire V1 — 9 items (dérive historique).
 *
 * @deprecated Refonte V2 (PR 1) : la nouvelle source de vérité est
 *             `lib/navigation.ts` → `NAV_V2` (6 items). La navbar et le
 *             footer V2 consomment directement `NAV_V2` et `FOOTER_V2`.
 *             Cette constante reste exportée jusqu'à PR 6 pour que la V1
 *             (active par défaut tant que `NEXT_PUBLIC_NEURAL_V2` est off)
 *             continue de fonctionner. Aucun ajout/modification dans cette
 *             constante ne doit être fait : éditer `lib/navigation.ts` à la
 *             place.
 *
 * Sprint P0 (19 avril 2026, V1) : recentrage sur les pages qui créent de la confiance.
 * - "Preuve produit" pointe vers la flagship Luxe Finance (seule preuve live complète).
 * - "Secteurs" filtre les status "planned" côté rendu navbar pour ne montrer que Luxe + Transport.
 * - Forfaits / Marketplace / Resources sont retirés de la nav publique et masqués derrière
 *   les flags NEXT_PUBLIC_FEATURE_* (cf. lib/features.ts).
 * - Trust descend en navigation secondaire (footer) — la page reste accessible.
 */
export const NAVIGATION = [
  { label: "Preuve produit", href: "/secteurs/luxe/finance" },
  { label: "Proof Console", href: "/proof" },
  {
    label: "Secteurs",
    href: "/secteurs/luxe",
    children: SECTOR_ENTRIES.map((entry) => ({
      label: entry.label,
      href: entry.href,
      status: entry.status,
    })),
  },
  {
    label: "Ressources",
    href: "/docs",
    children: [
      { label: "Documentation", href: "/docs", status: "live" as PublicStatus },
      { label: "Glossaire IA", href: "/glossaire", status: "live" as PublicStatus },
      { label: "Outils gratuits", href: "/outils/roi", status: "live" as PublicStatus },
      { label: "Sandbox", href: "/sandbox", status: "live" as PublicStatus },
      { label: "Recipes", href: "/recipes", status: "live" as PublicStatus },
      { label: "Cas-types", href: "/cas-types", status: "live" as PublicStatus },
    ],
  },
  { label: "Publications", href: "/publications" },
  { label: "Dossier", href: "/dossier" },
  { label: "À propos", href: "/about" },
  { label: "Contact", href: "/contact" },
] as const;

export const NAVIGATION_SECONDARY = [
  { label: "Trust", href: "/trust", status: "live" as PublicStatus },
  { label: "Mentions légales", href: "/legal", status: "demo" as PublicStatus },
  { label: "Confidentialité", href: "/legal/confidentialite", status: "demo" as PublicStatus },
] as const;

export const FOOTER_LINKS = {
  Solutions: BRANCH_ENTRIES.map((entry) => ({
    label: entry.label,
    href: entry.href,
    status: entry.status,
  })),
  Secteurs: SECTOR_ENTRIES.map((entry) => ({
    label: entry.label,
    href: entry.href,
    status: entry.status,
  })),
  Transparence: [
    { label: "Proof Console", href: "/proof", status: "live" as PublicStatus },
    { label: "Dossier", href: "/dossier", status: "live" as PublicStatus },
    { label: "Trust", href: "/trust", status: "live" as PublicStatus },
    { label: "Agent Safety", href: "/trust/agent-safety", status: "live" as PublicStatus },
    { label: "Status", href: "/status", status: "live" as PublicStatus },
    { label: "Roadmap", href: "/roadmap", status: "live" as PublicStatus },
    { label: "Changelog", href: "/changelog", status: "live" as PublicStatus },
    { label: "Conformité", href: "/conformite", status: "live" as PublicStatus },
    { label: "Comparatifs", href: "/contre", status: "live" as PublicStatus },
    { label: "Operator Gateway", href: "/operator-gateway", status: "demo" as PublicStatus },
    { label: "Connecteurs", href: "/connecteurs", status: "live" as PublicStatus },
    { label: "Documentation", href: "/docs", status: "live" as PublicStatus },
    { label: "Glossaire IA", href: "/glossaire", status: "live" as PublicStatus },
    { label: "Developer", href: "/dev", status: "live" as PublicStatus },
  ],
  Outils: [
    { label: "AI Act Classifier", href: "/outils/ai-act-classifier", status: "live" as PublicStatus },
    { label: "ROI Calculator", href: "/outils/roi", status: "live" as PublicStatus },
    { label: "Audit Maturité IA", href: "/outils/maturite", status: "live" as PublicStatus },
    { label: "Operator Score", href: "/outils/operator-score", status: "live" as PublicStatus },
    { label: "Empreinte IA", href: "/outils/empreinte-ia", status: "live" as PublicStatus },
    { label: "DPIA Generator", href: "/outils/dpia", status: "live" as PublicStatus },
    { label: "Cas-types", href: "/cas-types", status: "live" as PublicStatus },
    { label: "Sandbox", href: "/sandbox", status: "live" as PublicStatus },
    { label: "Recipes", href: "/recipes", status: "live" as PublicStatus },
  ],
  Entreprise: [
    { label: "À propos", href: "/about", status: "demo" as PublicStatus },
    { label: "Publications", href: "/publications", status: "live" as PublicStatus },
    { label: "Dossier", href: "/dossier", status: "live" as PublicStatus },
    { label: "Newsletter", href: "/newsletter", status: "live" as PublicStatus },
    { label: "Témoignages", href: "/temoignages", status: "live" as PublicStatus },
    { label: "Presse", href: "/presse", status: "live" as PublicStatus },
    { label: "Contact", href: "/contact", status: "live" as PublicStatus },
    { label: "Mentions légales", href: "/legal", status: "demo" as PublicStatus },
    { label: "Confidentialité", href: "/legal/confidentialite", status: "demo" as PublicStatus },
  ],
} as const;

export const DEMO_JOURNEY = [
  {
    step: "01",
    title: "Accueil",
    href: "/",
    status: "live" as PublicStatus,
    description:
      "Comprendre en un coup d'oeil ce qui est live, démo ou en préparation.",
  },
  {
    step: "02",
    title: "Secteur",
    href: "/secteurs/luxe",
    status: "live" as PublicStatus,
    description:
      "Choisir la verticale la plus prouvee, ou explorer une démo d'orchestration.",
  },
  {
    step: "03",
    title: "Agent / Hub",
    href: "/secteurs/luxe/finance",
    status: "live" as PublicStatus,
    description:
      "Voir un hub, des surfaces agent et le niveau de maturité réel par brique.",
  },
  {
    step: "04",
    title: "Export",
    href: "/secteurs/luxe/finance",
    status: "live" as PublicStatus,
    description:
      "Montrer que NEURAL sait produire un livrable métier, pas seulement une interface.",
  },
  {
    step: "05",
    title: "Contact",
    href: "/contact",
    status: "live" as PublicStatus,
    description:
      "Transformer la visite en conversation commerciale claire et cadrée.",
  },
];

export function getSectorEntry(slug: string): PublicEntry | undefined {
  return SECTOR_ENTRIES.find((entry) => entry.slug === slug);
}

export function getBranchEntry(slug: string): PublicEntry | undefined {
  return BRANCH_ENTRIES.find((entry) => entry.slug === slug);
}

export function getAgentEntry(slug: string): PublicEntry | undefined {
  return AGENT_ENTRIES.find((entry) => entry.slug === slug);
}

export function getResourceEntry(slug: string): PublicEntry | undefined {
  return RESOURCE_ENTRIES.find((entry) => entry.slug === slug);
}

export function getPageEntry(slug: string): PublicEntry | undefined {
  return PAGE_ENTRIES.find((entry) => entry.slug === slug);
}
