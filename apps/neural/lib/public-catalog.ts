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

export const PUBLIC_METRICS = {
  frameworkAgents: 168,
  frameworkCells: 42,
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
    status: "planned",
    proofLevel: "content_only",
    tagline: "Expertise potentielle a productiser",
    description:
      "La verticale Banque apparait comme un axe prometteur lie a la finance normative, mais elle doit encore etre traduite en surface publique demonstrable.",
    readyNow: "Narratif finance / norme et workbooks hors produit public principal.",
    nextStep:
      "Transformer un cas banque en demo claire avec entree, traitement et livrable.",
    dataUsed: "Workbooks et cadrage hors runtime public principal.",
    deliverable: "Page readiness et contact oriente finance normative.",
    ctaHref: "/contact",
    ctaLabel: "Echanger sur la banque",
    scopeNow: [
      "Maintient l'ambition sectorielle dans le discours.",
      "Prepare un futur wedge sans melanger vision et execution.",
    ],
    notYet: [
      "Pas de verticale banque live.",
      "Pas de page agent banque reliee a une sortie reelle.",
      "Pas de parcours public complet.",
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
    status: "planned",
    proofLevel: "content_only",
    tagline: "Branche visible, perimetre non opere",
    description:
      "Communication reste visible pour conserver la lisibilite du framework, mais la maturite publique est encore preparatoire.",
    readyNow: "Positionnement d'offre et narration framework.",
    nextStep: "Passer d'un angle de discours a un agent demo prouve.",
    dataUsed: "Contenus de cadrage.",
    deliverable: "Page readiness et CTA.",
    ctaHref: "/contact",
    ctaLabel: "Parler communication",
    scopeNow: ["Expose la logique multi-branches du framework."],
    notYet: [
      "Pas de surface live.",
      "Pas d'agent public demonstrable.",
      "Pas de sortie metier visible.",
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
