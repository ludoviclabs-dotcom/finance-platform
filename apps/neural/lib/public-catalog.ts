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
  kind: "sector" | "branch" | "agent" | "resource" | "page";
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
  live: "Live avec donnees reelles",
  demo: "Demo orchestree",
  planned: "En preparation",
};

export const PROOF_LEVEL_LABELS: Record<ProofLevel, string> = {
  runtime_data: "Preuve runtime",
  ui_demo: "Preuve UI / demo",
  content_only: "Preuve contenu",
};

// Sprint P0 (19 avril 2026) — `frameworkAgents: 168` remplacé par AGENT_ENTRIES.length
// (valeur dérivée du catalogue réel, pas de nombre théorique non vérifiable).
// Les seuls chiffres exposés restent ceux du catalogue (liveAgents/liveCells/catalogAgents)
// ou les constantes structurelles du framework (branches, secteurs, workbooks runtime).
export const PUBLIC_METRICS = {
  frameworkCells: 42, // 7 branches × 6 secteurs (math structurelle, vérifiable)
  get frameworkAgents() {
    // Somme vraie des agents inscrits dans AGENT_ENTRIES — remplace l'ancien 168.
    return AGENT_ENTRIES.length;
  },
  liveAgents: countLiveAgents(),
  liveCells: countLiveCells(),
  runtimeWorkbooks: 7,
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
  branch: Branch,
  overrides: Omit<PublicEntry, "slug" | "label" | "href" | "kind">
): PublicEntry {
  return {
    slug: branch,
    label: BRANCHES_META[branch].label,
    href: `/solutions/${branch}`,
    kind: "branch",
    ...overrides,
  };
}

export const SECTOR_ENTRIES: PublicEntry[] = [
  buildSectorEntry("luxe", {
    status: "live",
    proofLevel: "runtime_data",
    tagline: "Verticale la plus avancee publiquement",
    description:
      "Le secteur Luxe est aujourd'hui le meilleur point d'entree public pour comprendre NEURAL : hub live, data hub branche sur des workbooks embarques, exports visibles et surfaces Finance/RH.",
    readyNow:
      "Hub Luxe public, Data Hub, exports Excel/ZIP, surface Finance live et surface RH exposee.",
    nextStep:
      "Etendre le nombre d'agents vraiment operes et uniformiser les preuves par agent.",
    dataUsed:
      "7 workbooks embarques dans le runtime NEURAL, lisibles par l'API /api/data.",
    deliverable:
      "Hub secteur, export consolidation, pack complet et surfaces de demonstration Finance/RH.",
    ctaHref: "/secteurs/luxe",
    ctaLabel: "Explorer la verticale Luxe",
    scopeNow: [
      "Expose un parcours public coherent du hub jusqu'aux exports.",
      "Affiche un sous-ensemble branche au runtime actuel.",
      "Concentre la preuve produit la plus tangible du projet.",
    ],
    notYet: [
      "Ne prouve pas encore l'ensemble des 7 agents luxe comme surfaces operables.",
      "Ne couvre pas encore toutes les branches luxe a statut live.",
      "Ne remplace pas un ERP ou un back-office transactionnel complet.",
    ],
  }),
  buildSectorEntry("transport", {
    status: "demo",
    proofLevel: "ui_demo",
    tagline: "Demonstration d'orchestration metier",
    description:
      "Le secteur Transport montre l'ambition d'orchestration de NEURAL avec des agents comptables specialises, un orchestrateur et un parcours de cloture de demonstration.",
    readyNow:
      "Page secteur riche, workflow visuel, stepper et preuves de raisonnement produit.",
    nextStep:
      "Brancher les workbooks transport au runtime public et relier les sorties a de vrais exports.",
    dataUsed:
      "Storyboards, workbooks hors runtime public et preuves de conception d'orchestration.",
    deliverable:
      "Demo orchestree avec parcours comptable, orchestration et livrables cibles.",
    ctaHref: "/secteurs/transport",
    ctaLabel: "Voir la demo transport",
    scopeNow: [
      "Montre un cas d'usage sectoriel clair avec un langage produit fort.",
      "Expose le concept d'orchestrateur et de validation humaine.",
      "Aide a vendre la vision multi-agents sans la presenter comme deja industrialisee.",
    ],
    notYet: [
      "Pas de moteur d'orchestration durable expose publiquement.",
      "Pas de branchement runtime public sur les workbooks transport.",
      "Pas de promesse a interpreter comme automatisation pleinement operee.",
    ],
  }),
  buildSectorEntry("aeronautique", {
    status: "demo",
    proofLevel: "ui_demo",
    tagline: "Premier wedge public : Marketing aero (B2B + defense + sustainability)",
    description:
      "L'aeronautique dispose maintenant d'un premier wedge visible : Marketing B2B technique, conformite ITAR/EAR/sanctions, packs salons 2026 (Farnborough, ILA, Eurosatory, MEBAA) et anti-greenwashing SAF/H2/eVTOL. La page expose 4 agents, 2 services reserves, 44 regles et les 5 workbooks Excel generes.",
    readyNow: "Page Aeronautique / Marketing, hub /secteurs/aeronautique, 5 workbooks Excel locaux et referentiel 2026 documente (AI Act art. 50, OFAC SDN, Green Claims Directive, ReFuelEU).",
    nextStep:
      "Brancher les workbooks au runtime public et ajouter la branche Communications & Affaires publiques (corporate, gov relations).",
    dataUsed: "AeroTechContent + DefenseCommsGuard + AeroEventAI + AeroSustainabilityComms + Aero_Marketing_OVERVIEW (5 workbooks NEURAL).",
    deliverable: "Page /secteurs/aeronautique/marketing avec sourcebook reglementaire 12 sources et catalogue TS.",
    ctaHref: "/secteurs/aeronautique/marketing",
    ctaLabel: "Ouvrir Aeronautique / Marketing",
    scopeNow: [
      "Expose un cas d'usage aero concret sans donnees classifiees.",
      "Montre les guardrails reglementaires : ITAR/EAR, sanctions, AI Act art. 50, anti-greenwashing.",
      "Reste honnete : demo UI et workbooks portfolio, pas production live.",
    ],
    notYet: [
      "Pas encore de parsing runtime des fichiers Excel aero.",
      "Pas encore de pages agents dediees avec API de demo.",
      "Pas encore de branche Communications & Affaires publiques publiee (corporate aero-comms en attente).",
    ],
  }),
  buildSectorEntry("saas", {
    status: "planned",
    proofLevel: "content_only",
    tagline: "Angle de marche, pas surface live",
    description:
      "La verticale SaaS reste visible comme angle d'offre, mais elle n'est pas encore une preuve produit comparable au noyau Luxe.",
    readyNow: "Positionnement secteur et cas d'usage cibles.",
    nextStep:
      "Definir un premier agent wedge et le brancher a une preuve de donnees et de sortie.",
    dataUsed: "Cadrage produit et hypotheses de marche.",
    deliverable: "Page readiness et CTA de contact.",
    ctaHref: "/contact",
    ctaLabel: "Parler du cas SaaS",
    scopeNow: [
      "Conserve un discours de marche lisible.",
      "Rend explicite que la verticale n'est pas encore productisee.",
    ],
    notYet: [
      "Pas de runtime public sectoriel.",
      "Pas de parcours de demo end-to-end.",
      "Pas de preuve par export ou agent live.",
    ],
  }),
  buildSectorEntry("banque", {
    status: "demo",
    proofLevel: "runtime_data",
    tagline: "Communication runtime + Marketing Excel-first",
    description:
      "Le secteur Banque expose deux branches distinctes : Communication bancaire regulee (runtime scenario-id only) et Marketing bancaire Excel-first (AMF/ACPR, education financiere, segmentation, MiFID, PRIIPs, MiCA). Les deux gardent les gates deterministes et la revue humaine visibles.",
    readyNow:
      "Hub /secteurs/banque, branche Communication en demo runtime, branche Marketing avec 6 workbooks generes, console scenario-id et 10 gates MVP.",
    nextStep:
      "Synchroniser les workbooks Banque / Marketing vers content JSON, puis ajouter des fiches agents dediees quand la console branche est stabilisee.",
    dataUsed:
      "Communication : seeds JSON reglementaires. Marketing : NEURAL_BANK_MARKETING_FOUNDATIONS.xlsx, MASTER et 4 workbooks agents generes localement.",
    deliverable: "Hub /secteurs/banque + pages /communication et /marketing avec demos scenario-id only.",
    ctaHref: "/secteurs/banque",
    ctaLabel: "Ouvrir le secteur Banque",
    scopeNow: [
      "Separe clairement Communication corporate et Marketing client.",
      "Expose 8 agents publics, 4 services reserves et 26 gates explicites entre les deux branches.",
      "Maintient le mode scenario-id only pour eviter texte libre, conseil personnalise ou autopublication.",
    ],
    notYet: [
      "Les workbooks Banque / Marketing ne sont pas encore synchronises vers le runtime public.",
      "Pas encore de pages agents dediees pour AG-BM001 a AG-BM004.",
      "Pas de fetch automatise de la veille reglementaire marketing.",
    ],
  }),
  buildSectorEntry("assurance", {
    status: "demo",
    proofLevel: "ui_demo",
    tagline: "Premier wedge public : Supply Chain sinistres et tiers",
    description:
      "L'assurance dispose maintenant d'un premier wedge visible : reparateurs, experts, fraude fournisseur et Sapin II. La page expose 4 agents, 2 services reserves, 10 gates et les 6 workbooks Excel generes.",
    readyNow: "Page Assurance / Supply Chain, console scenario-id, 6 workbooks Excel locaux et gates MVP documentes.",
    nextStep:
      "Brancher les workbooks au runtime public et creer les fiches agents dediees.",
    dataUsed: "NEURAL_INSURANCE_SC_FOUNDATIONS.xlsx, MASTER et 4 workbooks agents generes localement.",
    deliverable: "Page /secteurs/assurance/supply-chain avec console interactive et sourcebook reglementaire.",
    ctaHref: "/secteurs/assurance/supply-chain",
    ctaLabel: "Ouvrir Assurance / Supply Chain",
    scopeNow: [
      "Expose un cas d'usage assurance concret sans donnees personnelles.",
      "Montre les guardrails reglementaires : libre choix reparateur, mandat expert, HITL fraude, Sapin II, DORA.",
      "Reste honnete : demo UI et workbooks portfolio, pas production live.",
    ],
    notYet: [
      "Pas encore de parsing runtime des fichiers Excel assurance.",
      "Pas encore de pages agents dediees avec API de demo.",
      "Pas de donnees assureurs, fournisseurs ou sinistres reels.",
    ],
  }),
];

export const BRANCH_ENTRIES: PublicEntry[] = [
  buildBranchEntry("finance", {
    status: "live",
    proofLevel: "runtime_data",
    tagline: "La branche la plus tangible aujourd'hui",
    description:
      "Finance concentre la meilleure preuve publique de NEURAL : donnees runtime, hub, consolidation, exports et parcours sectoriel luxe.",
    readyNow:
      "Surface Luxe Finance, agent consolidation live et exports relies au Data Hub.",
    nextStep:
      "Rendre plus d'agents finance operables publiquement au meme niveau que la consolidation.",
    dataUsed: "Workbooks runtime Luxe Finance et APIs d'export publiques.",
    deliverable: "Surface Finance live, export xlsx et pack zip.",
    ctaHref: "/secteurs/luxe/finance",
    ctaLabel: "Ouvrir Luxe Finance",
    scopeNow: [
      "Montre une vraie sortie metier et un agent live.",
      "Prouve la logique hub -> agent -> export.",
      "Donne une surface de demo vendable des aujourd'hui.",
    ],
    notYet: [
      "Tous les agents finance annonces ne sont pas encore exposes comme surfaces completes.",
      "La branche n'est pas encore generalisee a tous les secteurs.",
      "Le perimetre reste plus etroit que le discours historique.",
    ],
  }),
  buildBranchEntry("rh", {
    status: "demo",
    proofLevel: "runtime_data",
    tagline: "Donnees pretes, surface encore en demonstration",
    description:
      "La branche RH dispose de workbooks et d'une page publique solide, mais elle doit encore transformer ses agents en surfaces aussi convaincantes que Finance.",
    readyNow:
      "Surface RH luxe, datasets prets et parcours de demonstration sectoriel.",
    nextStep:
      "Relier les agents RH a un niveau de preuve produit comparable a Finance.",
    dataUsed: "Workbooks RH luxe embarques dans l'application.",
    deliverable: "Page RH sectorielle, cartes agents, demonstration de parcours.",
    ctaHref: "/secteurs/luxe/rh",
    ctaLabel: "Voir la branche RH",
    scopeNow: [
      "Montre la profondeur du travail RH luxe.",
      "Expose la logique metier et les livrables cibles.",
      "Sert de surface commerciale sans mentir sur le statut.",
    ],
    notYet: [
      "Pas d'agent RH public avec le meme niveau d'operabilite que consolidation.",
      "Pas de sortie publique aussi tangible qu'un export lie au hub.",
      "Pas encore une branche live a pleine maturite.",
    ],
  }),
  buildBranchEntry("comptabilite", {
    status: "demo",
    proofLevel: "ui_demo",
    tagline: "Narratif metier fort, execution encore selective",
    description:
      "Comptabilite est porte par la demo transport et par des workbooks specialises, mais la couche publique reste surtout demonstrative a ce stade.",
    readyNow: "Demonstration transport et cadrage comptable par cas d'usage.",
    nextStep:
      "Remonter une surface comptable live clairement branchee a des donnees et a un export.",
    dataUsed: "Storyboards publics et workbooks specialises hors runtime principal.",
    deliverable: "Page de readiness branche et demo transport.",
    ctaHref: "/secteurs/transport",
    ctaLabel: "Voir la demo comptable",
    scopeNow: [
      "Aide a vendre la competence normative.",
      "Relie le discours comptable a un cas sectoriel concret.",
    ],
    notYet: [
      "Pas de branche comptabilite live a l'echelle publique.",
      "Pas de sortie exportable generalisee.",
      "Pas de couche d'orchestration prouvee dans le runtime public.",
    ],
  }),
  buildBranchEntry("supply-chain", {
    status: "demo",
    proofLevel: "ui_demo",
    tagline: "Premier wedge Assurance / Supply Chain expose",
    description:
      "Supply Chain dispose maintenant d'un cas public concret dans l'assurance : reseau de reparateurs, experts, fraude fournisseur et conformite Sapin II.",
    readyNow: "Page Assurance / Supply Chain avec 4 agents, console scenario-id et workbooks Excel generes.",
    nextStep:
      "Transformer la demo en runtime public branche aux workbooks puis decliner d'autres secteurs.",
    dataUsed: "Workbooks NEURAL Insurance Supply Chain generes localement.",
    deliverable: "Page sectorielle Assurance / Supply Chain.",
    ctaHref: "/secteurs/assurance/supply-chain",
    ctaLabel: "Voir Assurance / Supply Chain",
    scopeNow: [
      "Montre un wedge Supply Chain concret et auditable.",
      "Rend visibles les gates de conformite avant une integration production.",
    ],
    notYet: [
      "Pas encore de runtime public connecte aux xlsx assurance.",
      "Pas de declinaison multi-secteurs Supply Chain.",
      "Pas de donnees client ou fournisseur reelles.",
    ],
  }),
  buildBranchEntry("marketing", {
    status: "demo",
    proofLevel: "ui_demo",
    tagline: "Deux wedges demo : Assurance / Marketing et Banque / Marketing",
    description:
      "Marketing dispose maintenant de surfaces demonstrables : Assurance / Marketing pour DDA et RGPD, et Banque / Marketing pour AMF/ACPR, education, segmentation, MiFID, PRIIPs et MiCA.",
    readyNow:
      "Pages UI demo, workbooks locaux, sourcebooks reglementaires et consoles scenario-id only.",
    nextStep:
      "Synchroniser les workbooks vers content JSON et transformer les consoles branche en fiches agents dediees.",
    dataUsed:
      "Workbooks Assurance / Marketing existants et NEURAL_BANK_MARKETING_* generes localement.",
    deliverable: "Pages /secteurs/assurance/marketing et /secteurs/banque/marketing.",
    ctaHref: "/secteurs/banque/marketing",
    ctaLabel: "Ouvrir Banque / Marketing",
    scopeNow: [
      "Montre une branche Marketing concrete sans promettre de production live.",
      "Expose les gates et les limites de conseil personnalise.",
      "Presente des livrables Excel utiles en portfolio recruteur.",
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
      "La branche Communication couvre deux verticales : LUXE (5 agents — MaisonVoiceGuard, LuxePressAgent, LuxeEventComms, HeritageComms, GreenClaimChecker) et BANQUE (4 agents publics + 2 services — RegBankComms, BankCrisisComms, ESGBankComms, ClientBankComms, RegWatchBank, BankEvidenceGuard). Tous en demo scenario-id only, avec gates deterministes qui overrident le LLM.",
    readyNow:
      "Luxe : 7 workbooks runtime, gate brand scoring, matrice 5 juridictions. Banque : 16 gates deterministes, 19 scenarios testset, 4 packs Markdown exportables avec hash SHA-256, resolveur EvidenceGuard deterministe sans LLM.",
    nextStep:
      "Workbooks Excel reels banque, fetch live veille reglementaire (ACPR/AMF/EBA), persistance runs multi-tenant, tests unitaires des gates.",
    dataUsed:
      "Luxe : 7 workbooks Luxe Comms synchronises via scripts/sync-luxe-comms.ts. Banque : 10 sources ACPR/AMF/EBA/ECB/ESMA/IFRS/EUR-Lex + 13 disclosure rules + 10 patterns ESG library + 18 subjects EvidenceGuard.",
    deliverable: "Hub Luxe / Communication (5 agents) + Hub Banque / Communication avec dashboard operationnel (6 agents) + 11 packs .md exportables.",
    ctaHref: "/secteurs/luxe/communication",
    ctaLabel: "Ouvrir Luxe / Communication",
    scopeNow: [
      "Deux verticales live avec preuves runtime distinctes (contenu luxe vs. conformite bancaire).",
      "16 gates banque + 5 gates luxe, tous deterministes et serveur-side.",
      "Couverture reglementaire : EU Green Claims 2024, Loi Climat FR, SFDR, taxonomie UE, MAR, CRR Part 8, Art. L.312-1-1 CMF.",
    ],
    notYet: [
      "Workbooks Excel banque (les seeds JSON suffisent en runtime mais xlsx visible prouverait la chaine).",
      "Fetch automatise de la veille reglementaire (seed Sprint 3).",
      "Persistence runs cross-verticales pour inbox HITL.",
    ],
  }),
  buildBranchEntry("si", {
    status: "planned",
    proofLevel: "content_only",
    tagline: "Capacite a expliciter, pas surface live",
    description:
      "SI reste une branche de vision pour NEURAL, utile au recit plateforme mais encore sans surface publique comparable a Finance.",
    readyNow: "Positionnement dans le framework global.",
    nextStep: "Formuler un premier use case SI avec preuve de sortie.",
    dataUsed: "Contenus de positionnement et vision produit.",
    deliverable: "Page readiness et CTA.",
    ctaHref: "/contact",
    ctaLabel: "Parler SI",
    scopeNow: ["Contribue a la carte d'offre globale."],
    notYet: [
      "Pas de branche live.",
      "Pas de preuves runtime publiques.",
      "Pas d'agent expose.",
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
      "Consolidation Groupe est aujourd'hui la surface agent la plus credible de NEURAL : donnees runtime, resultat visible dans Luxe Finance et export relie au Data Hub.",
    readyNow:
      "Donnees de consolidation disponibles dans le runtime, KPI exposes dans la verticale Finance et export xlsx public.",
    nextStep:
      "Enrichir la surface agent avec davantage d'entrees, de sorties et de preuves de validation.",
    dataUsed: "NEURAL_Consolidation_Groupe.xlsx",
    deliverable: "Surface Finance live, KPI consolides et export xlsx.",
    ctaHref: "/secteurs/luxe/finance",
    ctaLabel: "Voir Luxe Finance",
    scopeNow: [
      "Prouve la logique workbook -> hub -> sortie metier.",
      "Montre un agent public avec donnees reelles.",
      "Ancre la credibilite publique du projet.",
    ],
    notYet: [
      "N'expose pas encore toute la profondeur fonctionnelle de l'agent.",
      "Ne constitue pas a lui seul un cockpit finance complet.",
    ],
  },
  {
    slug: "inventaire-luxe",
    label: "Inventaire Luxe",
    href: "/agents/inventaire-luxe",
    kind: "agent",
    status: "demo",
    proofLevel: "runtime_data",
    tagline: "Agent prepare autour d'un workbook runtime",
    description:
      "Inventaire Luxe repose sur un workbook embarque et sur une presence dans le Data Hub, mais la surface publique reste encore une page de readiness.",
    readyNow: "Workbook runtime, donnees d'inventaire et references dans le hub.",
    nextStep: "Transformer l'agent en surface publique operable avec sorties visibles.",
    dataUsed: "NEURAL_Inventaire_Luxe.xlsx",
    deliverable: "Page de readiness et orientation vers Luxe Finance.",
    ctaHref: "/secteurs/luxe/finance",
    ctaLabel: "Voir l'ecosysteme Finance",
    scopeNow: [
      "Prouve l'existence du workbook et son integration dans le runtime.",
      "Clarifie que la surface agent publique n'est pas encore finalisee.",
    ],
    notYet: [
      "Pas d'interface agent finale publique.",
      "Pas de promesse d'autonomie operationnelle.",
    ],
  },
  {
    slug: "multi-currency",
    label: "Multi-Currency IAS 21",
    href: "/agents/multi-currency",
    kind: "agent",
    status: "demo",
    proofLevel: "runtime_data",
    tagline: "Brique finance prete a etre exposee",
    description:
      "La logique multi-devises existe dans le runtime et dans les workbooks, mais l'agent n'est pas encore expose comme surface complete.",
    readyNow: "Donnees IAS 21, references dans Luxe Finance et export full pack.",
    nextStep: "Publier une surface agent avec entrees, sorties et preuves explicites.",
    dataUsed: "NEURAL_MultiCurrency_IAS21.xlsx",
    deliverable: "Page de readiness et passage vers Luxe Finance.",
    ctaHref: "/secteurs/luxe/finance",
    ctaLabel: "Voir les preuves Finance",
    scopeNow: [
      "Montre la profondeur du framework finance.",
      "Reste honnete sur le niveau de surface publique.",
    ],
    notYet: ["Pas d'agent public finalise.", "Pas de parcours autonome expose."],
  },
  {
    slug: "royalty",
    label: "Royalty Accounting",
    href: "/agents/royalty",
    kind: "agent",
    status: "demo",
    proofLevel: "runtime_data",
    tagline: "Brique normative a rendre demonstrable",
    description:
      "Royalty Accounting participe a la narration finance normative, mais sa surface publique doit encore etre consolidee.",
    readyNow: "Workbook runtime et references dans la verticale Luxe Finance.",
    nextStep: "Exposer les entrees/sorties et le niveau de preuve agent par agent.",
    dataUsed: "NEURAL_Royalty_Accounting.xlsx",
    deliverable: "Page de readiness et lien vers la verticale Finance.",
    ctaHref: "/secteurs/luxe/finance",
    ctaLabel: "Voir la verticale Finance",
    scopeNow: [
      "Ancre la specialisation normative dans le discours.",
      "Evite la sur-promesse sur une surface pas encore finalisee.",
    ],
    notYet: ["Pas d'agent public finalise.", "Pas de parcours autonome expose."],
  },
  {
    slug: "artisan-talent",
    label: "Artisan Talent",
    href: "/agents/artisan-talent",
    kind: "agent",
    status: "demo",
    proofLevel: "runtime_data",
    tagline: "Surface RH en demonstration",
    description:
      "Artisan Talent repose sur un workbook embarque et une presence dans la page RH, mais le niveau public reste demonstratif.",
    readyNow: "Donnnees RH luxe, page RH sectorielle et narration agent.",
    nextStep: "Passer d'une carte agent a une vraie surface de travail publique.",
    dataUsed: "NEURAL_LuxeArtisanTalent.xlsx",
    deliverable: "Page de readiness et lien vers Luxe RH.",
    ctaHref: "/secteurs/luxe/rh",
    ctaLabel: "Voir Luxe RH",
    scopeNow: [
      "Rend visible la profondeur du travail RH luxe.",
      "Cadre honnetement le niveau de maturite publique.",
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
    tagline: "Brique RH prete a etre mieux exposee",
    description:
      "Comp & Benchmark beneficie deja d'un workbook runtime, mais la presentation publique doit encore converger vers un vrai parcours agent.",
    readyNow: "References RH et donnees runtime dans l'application.",
    nextStep: "Construire une surface publique autonome et des preuves de sortie.",
    dataUsed: "NEURAL_LuxeCompBenchmark.xlsx",
    deliverable: "Page de readiness et orientation RH.",
    ctaHref: "/secteurs/luxe/rh",
    ctaLabel: "Voir la branche RH",
    scopeNow: ["Expose l'intention produit sans exagérer la maturite."],
    notYet: ["Pas d'agent public finalise."],
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
      "Onboarding Luxe apparait deja dans la branche RH, mais la surface publique doit encore evoluer vers un niveau de preparation equivalent au noyau Finance.",
    readyNow: "Workbook runtime et page RH sectorielle.",
    nextStep: "Rendre la surface agent plus explicite et plus operable.",
    dataUsed: "NEURAL_LuxeOnboarding.xlsx",
    deliverable: "Page de readiness et lien vers RH.",
    ctaHref: "/secteurs/luxe/rh",
    ctaLabel: "Explorer la branche RH",
    scopeNow: ["Conserve la lisibilite du catalogue agent."],
    notYet: ["Pas d'agent public finalise."],
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
    tagline: "Pilotage reparateurs avec libre choix assure",
    description:
      "Agent Assurance / Supply Chain pour comparer qualite, couts et delais des reparateurs tout en bloquant tout wording qui imposerait un reparateur agree.",
    readyNow: "Workbook ISC-A001 genere, scenarios PASS/REVIEW/BLOCK et gate libre choix visibles sur la page Assurance / Supply Chain.",
    nextStep: "Creer une fiche agent dediee et brancher le workbook au runtime public.",
    dataUsed: "NEURAL_ISC001_RepairNetworkInsur.xlsx",
    deliverable: "Console scenario-id sur /secteurs/assurance/supply-chain.",
    ctaHref: "/secteurs/assurance/supply-chain",
    ctaLabel: "Voir Assurance / Supply Chain",
    scopeNow: [
      "Recommandation reseau sans contrainte de choix.",
      "Review des anomalies devis/facture.",
      "Donnees synthetiques uniquement.",
    ],
    notYet: ["Pas encore d'API agent dediee.", "Pas de donnees sinistres reelles."],
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
    readyNow: "Workbook ISC-A002 genere et scenarios mandat/rapport disponibles dans la console.",
    nextStep: "Ajouter une fiche agent avec timeline d'expertise et checklist rapport.",
    dataUsed: "NEURAL_ISC002_ExpertMgmtInsur.xlsx",
    deliverable: "Console scenario-id sur /secteurs/assurance/supply-chain.",
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
    readyNow: "Workbook ISC-A003 genere, gates HITL fraude et RGPD decision automatisee visibles.",
    nextStep: "Ajouter graph de collusion et export de brief investigateur.",
    dataUsed: "NEURAL_ISC003_FraudDetectSC.xlsx",
    deliverable: "Console scenario-id sur /secteurs/assurance/supply-chain.",
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
    tagline: "Due diligence tiers et controles anticorruption",
    description:
      "Agent de controle Sapin II pour fournisseurs et intermediaires : identite, beneficiaires, conflits d'interets, risque pays et controles comptables.",
    readyNow: "Workbook ISC-A004 genere avec scenarios due diligence complete, risque eleve et onboarding bloque.",
    nextStep: "Ajouter matrice de risque tiers et registre de remediations.",
    dataUsed: "NEURAL_ISC004_Sapin2Compliance.xlsx",
    deliverable: "Console scenario-id sur /secteurs/assurance/supply-chain.",
    ctaHref: "/secteurs/assurance/supply-chain",
    ctaLabel: "Voir Assurance / Supply Chain",
    scopeNow: [
      "Blocage onboarding sans evaluation tiers.",
      "Review renforcee des signaux collusion/COI.",
      "AFA sourcebook integre.",
    ],
    notYet: ["Pas encore de screening externe.", "Pas de connecteur compliance production."],
  },

  {
    slug: "maison-voice-guard",
    label: "MaisonVoiceGuard",
    href: "/agents/maison-voice-guard",
    kind: "agent",
    status: "live",
    proofLevel: "runtime_data",
    tagline: "Le gardien du verbe — score brand et hard-fail, demo live",
    description:
      "Moteur central de scoring brand pour la branche Communication Luxe. Lit la charte (15 regles, 17 hard-fail) et retourne un score /100 + decision APPROVE/REWORK/REJECT en temps reel. Demo Live Scorer accessible publiquement depuis avril 2026.",
    readyNow: "Regles brand runtime, hard-fail dictionnaire FR+EN, testset 12 cas, demo Live Scorer branchee AI Gateway.",
    nextStep: "Connecter le flux presse AG-002 et le flux event AG-003 au moteur.",
    dataUsed: "NEURAL_AG001_MaisonVoiceGuard.xlsx + 3_BRAND_VOCAB_FR",
    deliverable: "Demo Live Scorer + API /api/demo/voice-score.",
    ctaHref: "/secteurs/luxe/communication",
    ctaLabel: "Voir la branche Communication",
    scopeNow: [
      "Expose la discipline zero-tolerance (hard-fail) dans un contexte luxe.",
      "Democratise la charte de marque en API scorable.",
      "Couvre FR et EN avec meme rigueur.",
    ],
    notYet: [
      "Page agent publique dediee pas encore livree (Sprint 2).",
      "Demo interactive Live Scorer a deployer Sprint 3.",
    ],
  },
  {
    slug: "luxe-press-agent",
    label: "LuxePressAgent",
    href: "/agents/luxe-press-agent",
    kind: "agent",
    status: "live",
    proofLevel: "runtime_data",
    tagline: "Rediger pour Vogue ET le FT, avec la meme exigence — demo live",
    description:
      "Redige communiques dans le registre du luxe. Adapte presse lifestyle (Vogue, HB, Numero) vs. business (FT, BoF, WWD) via media matrix. Gere embargos et angles editoriaux. 20 medias references. Demo Press Angle accessible publiquement.",
    readyNow: "Media directory 20 outlets, media matrix 7 formats, workflow brand handoff + claim handoff, press pickup tracking, demo Press Angle live.",
    nextStep: "Connexion CRM presse (HubSpot / Cision) + generation dossier presse complet.",
    dataUsed: "NEURAL_AG002_LuxePressAgent.xlsx + 6_MEDIA_DIRECTORY",
    deliverable: "Demo Press Angle + /api/demo/press-angle.",
    ctaHref: "/secteurs/luxe/communication",
    ctaLabel: "Voir la branche Communication",
    scopeNow: [
      "Mappe les attentes editoriales outlet-par-outlet.",
      "Gere l'embargo comme critere operationnel.",
      "Trace le pickup post-publication (reach, sentiment).",
    ],
    notYet: [
      "Demo Rewriter interactive a livrer Sprint 4.",
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
    deliverable: "Demo Event Pack + /api/demo/event-pack.",
    ctaHref: "/secteurs/luxe/communication",
    ctaLabel: "Voir la branche Communication",
    scopeNow: [
      "Industrialise la production content cross-format.",
      "Force les gates brand + heritage avant diffusion.",
      "Tracabilite SLA 2h social live temps reel.",
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
    tagline: "Zero citation sans source — la discipline patrimoniale, demo live",
    description:
      "Sourcing patrimonial : aucune sortie sans source cataloguee + citation formatee. 10 sources classifiees PRIMARY/SECONDARY/TERTIARY, 10 faits approuves, 6 blocs narratifs reutilisables. Demo Heritage Quote accessible publiquement.",
    readyNow: "Source catalog runtime, narrative blocks avec statut USABLE, citation control avec blockage TERTIARY-only, demo Heritage Quote live (4 formats).",
    nextStep: "Connexion archives OCR scan + registre droits image.",
    dataUsed: "NEURAL_AG004_HeritageComms.xlsx + 5_HERITAGE_SOURCEBOOK",
    deliverable: "Demo Heritage Quote + /api/demo/heritage-quote.",
    ctaHref: "/secteurs/luxe/communication",
    ctaLabel: "Voir la branche Communication",
    scopeNow: [
      "Anti-hallucination native : pas de source = pas de sortie.",
      "Supporte 4 formats de citation (Maison-style, Chicago, APA, Juridique).",
      "Mesure le staleness des sources (CF J-30 automatique).",
    ],
    notYet: [
      "Registre droits images non connecte.",
      "OCR archives scannees non operationnel.",
    ],
  },
  {
    slug: "green-claim-checker",
    label: "GreenClaimChecker",
    href: "/agents/green-claim-checker",
    kind: "agent",
    status: "live",
    proofLevel: "runtime_data",
    tagline: "Conformite Green Claims — EU, FR, UK, US, CH — demo live",
    description:
      "Detection claims RSE + matching preuve + scoring risque (LOW/MEDIUM/HIGH/CRITICAL). Matrice 5 juridictions (EU, FR, UK, US, CH) avec regulations integrees (EU Green Claims Directive 2024, Loi Climat FR, CMA UK, FTC US). Demo Claim Checker accessible publiquement.",
    readyNow: "Claim library 17 patterns, evidence registry 17 entrees, matrice juridictionnelle 10 claims-types, testset 10 cas, demo Claim Checker live (5 juridictions).",
    nextStep: "Integration jurisprudence externe + API DGCCRF.",
    dataUsed: "NEURAL_AG005_GreenClaimChecker.xlsx + 7_CLAIMS_EVIDENCE_REGISTRY",
    deliverable: "Demo Claim Checker + /api/demo/claim-check.",
    ctaHref: "/secteurs/luxe/communication",
    ctaLabel: "Voir la branche Communication",
    scopeNow: [
      "Anticipe l'application pleine de la Green Claims Directive en 2026.",
      "Differencie ABSOLUTE / QUALIFIED / COMPARATIVE.",
      "Fournit l'escalation (Legal + ESG Lead) en cas de risque CRITICAL.",
    ],
    notYet: [
      "Integration juridique externe (Lexis) non prevue.",
      "Base de jurisprudence non connectee en v1.",
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
    tagline: "Preuve commerciale a construire",
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
    tagline: "Bibliotheque editoriale en preparation",
    description:
      "Le site garde une place pour les contenus longs, sans faire croire qu'ils sont deja publies.",
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
    tagline: "Outil en preparation",
    description:
      "Le calculateur ROI n'est pas encore en libre-service. Cette page sert de point d'atterrissage honnete en attendant une version publique.",
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
    label: "Audit maturite IA",
    href: "/resources/outils/maturity-score",
    kind: "resource",
    status: "planned",
    proofLevel: "content_only",
    tagline: "Outil lead-gen a venir",
    description:
      "L'audit maturite IA reste annonce comme prochain livrable public, pas comme outil deja disponible.",
    readyNow: "Page readiness et CTA vers contact.",
    nextStep: "Mettre en ligne un premier questionnaire de maturite.",
    dataUsed: "Cadrage et hypotheses d'evaluation.",
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
    nextStep: "Passer du shell public a un catalogue achetable agent par agent.",
    dataUsed: "Catalogue public et pages readiness.",
    deliverable: "Page readiness et contact.",
    ctaHref: "/contact",
    ctaLabel: "Parler d'un agent",
    scopeNow: ["Maintient la lisibilite de la trajectoire produit."],
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
      "La page forfaits reste visible pour preparer le packaging commercial, sans simuler une grille finalisee.",
    readyNow: "Orientation vers contact et cadrage sur demande.",
    nextStep: "Formaliser une offre publique avec perimetres et preuves associees.",
    dataUsed: "Cadrage commercial.",
    deliverable: "Page readiness et contact.",
    ctaHref: "/contact",
    ctaLabel: "Recevoir un cadrage",
    scopeNow: ["Evite les liens morts tout en restant prudent."],
    notYet: ["Pas de pricing public finalise."],
  },
  {
    slug: "about",
    label: "A propos",
    href: "/about",
    kind: "page",
    status: "demo",
    proofLevel: "content_only",
    tagline: "Page socle de presentation",
    description:
      "A propos sert a poser la trajectoire de NEURAL et sa logique de truth layer, sans extrapoler au-dela du perimetre visible.",
    readyNow: "Presentation synthétique du positionnement et des preuves visibles.",
    nextStep: "Ajouter davantage de preuves clients et de contexte equipe.",
    dataUsed: "Contenu editorial interne.",
    deliverable: "Page de presentation et CTA contact.",
    ctaHref: "/contact",
    ctaLabel: "Contacter NEURAL",
    scopeNow: ["Renforce la lisibilite de la marque."],
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
    note: "Claude Sonnet 4.6 reste le modele principal du chat public, avec GPT-5.4 prepare en fallback.",
  },
  {
    id: "framework-capacity",
    claim: `${PUBLIC_METRICS.frameworkCells} combinaisons / ${PUBLIC_METRICS.frameworkAgents} agents correspondent a la capacite du framework`,
    status: "qualified",
    source: "apps/neural/lib/data/agents-registry.ts",
    allowedOn: ["/", "/trust"],
    note: "A presenter comme capacite du framework, pas comme perimetre live.",
  },
  {
    id: "live-agents",
    claim: `${PUBLIC_METRICS.liveAgents} agents avec donnees reelles`,
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
    source: "apps/neural/app/api/data/route.ts",
    allowedOn: ["/", "/trust", "/secteurs/luxe"],
  },
  {
    id: "anthropic-partner",
    claim: "Partenaire Anthropic",
    status: "retired",
    source: "apps/neural/components/sections/hero.tsx",
    allowedOn: ["/trust"],
    note: "Retire du discours public tant qu'une reconnaissance officielle n'est pas verifiable.",
  },
  {
    id: "infrastructure-claims",
    claim: "SLA 99.9% / hebergement europeen / AES-256 / RGPD",
    status: "retired",
    source: "apps/neural/components/sections/faq-accordion.tsx",
    allowedOn: ["/trust"],
    note: "Retire du discours public tant que ces claims ne sont pas documentes dans le produit.",
  },
];

/**
 * Navigation primaire — 5 items.
 * Sprint P0 (19 avril 2026) : recentrage sur les pages qui créent de la confiance.
 * - "Preuve produit" pointe vers la flagship Luxe Finance (seule preuve live complète).
 * - "Secteurs" filtre les status "planned" côté rendu navbar pour ne montrer que Luxe + Transport.
 * - Forfaits / Marketplace / Resources sont retirés de la nav publique et masqués derrière
 *   les flags NEXT_PUBLIC_FEATURE_* (cf. lib/features.ts).
 * - Trust descend en navigation secondaire (footer) — la page reste accessible.
 */
export const NAVIGATION = [
  { label: "Preuve produit", href: "/secteurs/luxe/finance" },
  {
    label: "Secteurs",
    href: "/secteurs/luxe",
    children: SECTOR_ENTRIES.filter((entry) => entry.status !== "planned").map((entry) => ({
      label: entry.label,
      href: entry.href,
      status: entry.status,
    })),
  },
  { label: "Publications", href: "/publications" },
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
    { label: "Trust", href: "/trust", status: "live" as PublicStatus },
    { label: "Status", href: "/status", status: "live" as PublicStatus },
    { label: "Roadmap", href: "/roadmap", status: "live" as PublicStatus },
    { label: "Conformité", href: "/conformite", status: "live" as PublicStatus },
    { label: "Comparatifs", href: "/contre", status: "live" as PublicStatus },
    { label: "Operator Gateway", href: "/operator-gateway", status: "demo" as PublicStatus },
  ],
  Outils: [
    { label: "AI Act Classifier", href: "/outils/ai-act-classifier", status: "live" as PublicStatus },
    { label: "ROI Calculator", href: "/outils/roi", status: "live" as PublicStatus },
    { label: "Audit Maturité IA", href: "/outils/maturite", status: "live" as PublicStatus },
  ],
  Entreprise: [
    { label: "A propos", href: "/about", status: "demo" as PublicStatus },
    { label: "Publications", href: "/publications", status: "live" as PublicStatus },
    { label: "Contact", href: "/contact", status: "live" as PublicStatus },
    { label: "Mentions legales", href: "/legal", status: "demo" as PublicStatus },
    { label: "Confidentialite", href: "/legal/confidentialite", status: "demo" as PublicStatus },
  ],
} as const;

export const DEMO_JOURNEY = [
  {
    step: "01",
    title: "Accueil",
    href: "/",
    status: "live" as PublicStatus,
    description:
      "Comprendre en un coup d'oeil ce qui est live, demo ou en preparation.",
  },
  {
    step: "02",
    title: "Secteur",
    href: "/secteurs/luxe",
    status: "live" as PublicStatus,
    description:
      "Choisir la verticale la plus prouvee, ou explorer une demo d'orchestration.",
  },
  {
    step: "03",
    title: "Agent / Hub",
    href: "/secteurs/luxe/finance",
    status: "live" as PublicStatus,
    description:
      "Voir un hub, des surfaces agent et le niveau de maturite reel par brique.",
  },
  {
    step: "04",
    title: "Export",
    href: "/secteurs/luxe/finance",
    status: "live" as PublicStatus,
    description:
      "Montrer que NEURAL sait produire un livrable metier, pas seulement une interface.",
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
