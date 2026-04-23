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
    status: "planned",
    proofLevel: "content_only",
    tagline: "Verticale en cadrage",
    description:
      "L'aeronautique reste visible pour conserver la vision multi-secteurs, mais le perimetre public doit etre lu comme une trajectoire produit et non comme une verticale deja live.",
    readyNow: "Narratif secteur, cas d'usage cibles et matiere workbook hors runtime public.",
    nextStep:
      "Selectionner un premier wedge aeronautique et le transformer en surface demonstrable.",
    dataUsed: "Documentation et workbooks hors runtime public.",
    deliverable: "Page readiness, cadrage d'usage et call-to-action de contact.",
    ctaHref: "/contact",
    ctaLabel: "Discuter de l'aeronautique",
    scopeNow: [
      "Preserve la lisibilite de la vision multi-secteurs.",
      "Permet une conversation commerciale sans surestimer le niveau de maturite.",
    ],
    notYet: [
      "Pas de page secteur live avec preuves runtime.",
      "Pas d'exports publics relies a cette verticale.",
      "Pas d'agent expose comme surface operable.",
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
    tagline: "Branche Communication bancaire en demo — 4 agents + 2 services",
    description:
      "Banque / Communication expose 4 agents publics (RegBankComms, BankCrisisComms, ESGBankComms, ClientBankComms) et 2 services transverses (RegWatchBank, BankEvidenceGuard). 16 gates deterministes MVP, 19 scenarios pre-charges, registre de 10 sources ACTIVE ACPR/AMF/EBA/ECB/ESMA. Mode scenario-id only pour eviter toute ingestion d'info privilegiee non publique.",
    readyNow:
      "4 demos live (scenario-id uniquement), 4 packs Markdown exportables avec hash SHA-256, resolveur EvidenceGuard deterministe sans LLM, 18 subjects mappes aux agents, veille reglementaire seed (5 digests 2025-2026).",
    nextStep:
      "Persister les runs (Postgres), fetch live des feeds ACPR/AMF/EBA (cron hebdo + classifier), produire les workbooks Excel reels.",
    dataUsed:
      "10 sources reglementaires ACTIVE, 13 disclosure rules bloquantes, 5 holding statements pre-approuves, 10 patterns ESG library, 5 mentions legales clients obligatoires.",
    deliverable: "Branche /secteurs/banque/communication live + dashboard operationnel + 6 pages agents + 4 packs .md.",
    ctaHref: "/secteurs/banque/communication",
    ctaLabel: "Ouvrir Banque / Communication",
    scopeNow: [
      "Trust-first : 4 agents en demo, aucun texte libre accepte, gates determinnistes qui overrident le LLM.",
      "Modele pilote prive cadre (setup 25-60 k EUR, 80-180 k EUR/an par domaine), aucun forfait public.",
      "Perimetre FR + UE, cadres ACPR/AMF/EBA/ECB/ESMA/IFRS/EUR-Lex couverts.",
    ],
    notYet: [
      "Workbooks Excel reels non encore produits — les seeds JSON font le job runtime.",
      "Fetch automatise de la veille reglementaire en Sprint suivant (seed aujourd'hui).",
      "Persistence runs multi-tenant a brancher avant premier pilote paye.",
    ],
  }),
  buildSectorEntry("assurance", {
    status: "planned",
    proofLevel: "content_only",
    tagline: "Matiere forte, surface encore a exposer",
    description:
      "L'assurance beneficie d'une matiere workbook precieuse, mais cette profondeur n'est pas encore transformee en surface publique verifiable.",
    readyNow: "Profondeur de travail sur IFRS 17 et discours sectoriel.",
    nextStep:
      "Remonter un premier agent assurance ou une demo sectorielle avec preuves visibles.",
    dataUsed: "Workbook IFRS 17 et contenus de cadrage.",
    deliverable: "Page readiness avec CTA et transparence sur le niveau de maturite.",
    ctaHref: "/contact",
    ctaLabel: "Parler assurance",
    scopeNow: [
      "Expose un angle de valeur credible pour les prospects du secteur.",
      "Evite de presenter le secteur comme deja industrialise.",
    ],
    notYet: [
      "Pas de runtime assurance expose publiquement.",
      "Pas de demo sectorielle publique end-to-end.",
      "Pas de preuves exportees depuis une surface assurance.",
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
    status: "planned",
    proofLevel: "content_only",
    tagline: "Angle fort a transformer en wedge",
    description:
      "Supply Chain reste un angle prometteur pour NEURAL, mais il n'est pas encore expose comme une branche publique operable.",
    readyNow: "Narratif et matiere de cadrage.",
    nextStep:
      "Choisir un cas d'usage supply chain et le pousser jusqu'a la preuve visible.",
    dataUsed: "Contenus et matieres hors runtime public principal.",
    deliverable: "Page readiness et contact.",
    ctaHref: "/contact",
    ctaLabel: "Discuter supply chain",
    scopeNow: [
      "Conserve la vision multi-branches.",
      "Evite toute confusion avec une branche deja live.",
    ],
    notYet: [
      "Pas de surface produit live.",
      "Pas d'exports ou d'agents publics relies.",
      "Pas de preuve runtime publique.",
    ],
  }),
  buildBranchEntry("marketing", {
    status: "planned",
    proofLevel: "content_only",
    tagline: "Vision de branche",
    description:
      "Marketing est conserve comme composante du framework NEURAL, sans etre presente comme une branche deja active publiquement.",
    readyNow: "Promesse de branche et cadrage de valeur.",
    nextStep: "Identifier un agent wedge et une preuve metier concrete.",
    dataUsed: "Contenus de positionnement.",
    deliverable: "Page readiness et CTA.",
    ctaHref: "/contact",
    ctaLabel: "Parler marketing",
    scopeNow: ["Maintient le recit multi-branches."],
    notYet: [
      "Pas de surface publique live.",
      "Pas de sortie ou export public.",
      "Pas de branchement runtime expose.",
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
  Ressources: [
    { label: "Publications", href: "/publications", status: "live" as PublicStatus },
    // Etudes de cas, White Papers, Calculateur ROI, Audit maturite IA — masqués Sprint P0
    // tant que le flag NEXT_PUBLIC_FEATURE_RESOURCES est off. Voir lib/features.ts.
  ],
  Entreprise: [
    { label: "A propos", href: "/about", status: "demo" as PublicStatus },
    { label: "Contact", href: "/contact", status: "live" as PublicStatus },
    { label: "Trust", href: "/trust", status: "live" as PublicStatus },
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
