/**
 * lib/water-intelligence/editorial-matrices.ts — contenus éditoriaux
 * STRUCTURÉS de Water Intelligence.
 *
 * ## La règle qui gouverne tout ce fichier
 *
 * **Aucun chiffre n'y figure.** Ni pourcentage, ni volume, ni classement, ni
 * score. Ce qui est décrit ici est QUALITATIF et vérifiable par lecture : la
 * nature d'une dépendance, le sens d'une exigence, le type de preuve
 * qu'exigerait une affirmation quantitative.
 *
 * La raison est concrète. « Le textile consomme X litres par kilo » se
 * recopie de blog en blog sans que personne ne remonte à la mesure ; publier
 * un tel nombre sans source relevée en ferait un fait de plus dans cette
 * chaîne. Le module dit donc CE QU'IL FAUDRAIT MESURER, et affiche un état de
 * preuve — jamais une valeur d'illustration.
 *
 * Corollaire tenu par les types eux-mêmes : `evidenceLevel` est obligatoire
 * partout, et sa seule valeur « chiffrée » possible (`sourced_figure`) n'est
 * utilisée nulle part aujourd'hui. Le jour où elle le sera, elle exigera une
 * source et une date de revue.
 *
 * ## `derived_use_allowed = false`
 *
 * La décision humaine du 2026-07-28 interdit toute dérivation à partir des
 * valeurs publiées. Ces matrices n'en dérivent aucune : elles ne référencent
 * pas les observations BNPE, ne les agrègent pas, et n'en tirent aucune
 * conclusion sectorielle.
 */

/** Ce qui fonde une affirmation. Aucune n'est présentée comme mesurée. */
export type EvidenceLevel =
  | "institutional_context" // cadre posé par une institution, sans chiffre repris
  | "qualitative_consensus" // description partagée par la littérature technique
  | "requires_measurement" // ne peut être affirmé qu'après mesure sur site
  | "sourced_figure"; // valeur chiffrée AVEC source relevée — aucune à ce jour

export const EVIDENCE_LABELS: Record<EvidenceLevel, string> = {
  institutional_context: "Contexte institutionnel",
  qualitative_consensus: "Description qualitative",
  requires_measurement: "Exige une mesure",
  sourced_figure: "Valeur sourcée",
};

/** Intensité relative — ordinale et NOMMÉE, jamais un nombre. */
export type Intensity = "structurante" | "significative" | "variable" | "faible" | "inconnue";

export const INTENSITY_LABELS: Record<Intensity, string> = {
  structurante: "Structurante",
  significative: "Significative",
  variable: "Variable selon le site",
  faible: "Faible",
  inconnue: "Non déterminée",
};

/**
 * Rang d'affichage. Il ordonne des LIBELLÉS, il ne les note pas : deux
 * secteurs « structurants » ne sont pas comparables entre eux, et la matrice
 * ne prétend pas les départager.
 */
export const INTENSITY_RANK: Record<Intensity, number> = {
  structurante: 4,
  significative: 3,
  variable: 2,
  faible: 1,
  inconnue: 0,
};

/* ==========================================================================
   1 — Water Pulse : huit facettes du contexte hydrique
   ========================================================================== */

export interface PulseFacet {
  readonly id: string;
  readonly label: string;
  readonly accent: "water" | "data" | "stress" | "adapt" | "compliance" | "alert";
  readonly question: string;
  readonly body: string;
  /** Ce que le module publie AUJOURD'HUI sur cette facette. */
  readonly published: string;
  readonly evidenceLevel: EvidenceLevel;
}

export const PULSE_FACETS: readonly PulseFacet[] = [
  {
    id: "disponibilite",
    label: "Disponibilité de la ressource",
    accent: "water",
    question: "La ressource suffit-elle, durablement, là où l'activité se trouve ?",
    body:
      "La disponibilité se joue à l'échelle d'un bassin, pas d'un pays : deux sites d'une même entreprise peuvent connaître des situations opposées. Elle dépend de la ressource renouvelable, des prélèvements de tous les usagers et des transferts entre bassins.",
    published: "Aucune valeur publiée — les sources de disponibilité restent non approuvées.",
    evidenceLevel: "institutional_context",
  },
  {
    id: "prelevements",
    label: "Prélèvements",
    accent: "water",
    question: "Combien est prélevé, par qui, et sur quelle ressource ?",
    body:
      "Un prélèvement déclaré est un fait administratif avant d'être une mesure : sa couverture dépend du régime de redevance qui l'a fait déclarer. Les volumes exonérés et les petits volumes échappent à la déclaration.",
    published:
      "Trois volumes annuels d'ouvrages, sur une commune et une année — la première publication pilote.",
    evidenceLevel: "sourced_figure",
  },
  {
    id: "qualite",
    label: "Qualité",
    accent: "data",
    question: "L'eau disponible est-elle utilisable pour l'usage visé ?",
    body:
      "La qualité est une propriété par paramètre et par usage, jamais un état global. Un paramètre conforme pour un usage industriel peut ne pas l'être pour un usage alimentaire, et les limites de quantification font partie de la mesure.",
    published:
      "Aucune valeur publiée — le périmètre exhaustif mesuré dépasse le budget du snapshot public.",
    evidenceLevel: "institutional_context",
  },
  {
    id: "secheresse",
    label: "Sécheresse",
    accent: "stress",
    question: "La situation actuelle est-elle conjoncturelle ou structurelle ?",
    body:
      "Une sécheresse est un écart à une normale sur une période donnée. Elle ne se confond pas avec le stress structurel : un bassin durablement tendu peut traverser une année humide, et l'inverse est vrai.",
    published: "Aucune valeur publiée — le décodage de l'indice combiné est reporté.",
    evidenceLevel: "institutional_context",
  },
  {
    id: "inondation",
    label: "Inondation",
    accent: "alert",
    question: "L'excès d'eau est-il un aléa pour ce site ?",
    body:
      "L'inondation est un aléa d'excès, sans relation de causalité avec la rareté. Les fusionner dans un indicateur unique ferait disparaître les deux : un site peut être exposé aux deux, ou à aucun.",
    published: "Aucune valeur publiée — aucune source d'aléa n'est instrumentée.",
    evidenceLevel: "institutional_context",
  },
  {
    id: "dependances",
    label: "Dépendances",
    accent: "adapt",
    question: "Quelle part de l'activité s'arrête si l'eau manque ?",
    body:
      "La dépendance est une propriété du procédé, indépendante de l'état de la ressource. Elle se mesure sur site : refroidissement, lavage, incorporation au produit et transport n'ont ni les mêmes volumes ni les mêmes substituts.",
    published: "Matrice qualitative par secteur — aucune valeur chiffrée.",
    evidenceLevel: "qualitative_consensus",
  },
  {
    id: "reglementation",
    label: "Réglementation",
    accent: "compliance",
    question: "Quelles obligations s'appliquent, et à partir de quand ?",
    body:
      "Une règle n'est pas « obligatoire » en général : elle l'est pour une entité, dans une juridiction, à une date, et parfois sous condition de matérialité. Le registre distingue ces statuts plutôt que de les réduire.",
    published: "Registre versionné des textes à instruire — aucune conclusion de conformité.",
    evidenceLevel: "institutional_context",
  },
  {
    id: "adaptation",
    label: "Adaptation",
    accent: "adapt",
    question: "Quelles marges de manœuvre existent, et à quel coût ?",
    body:
      "Une solution d'adaptation a toujours des contreparties : énergie, carbone, coût, emprise, maturité. Une famille de solutions présentée par son seul bénéfice hydrique est une promesse, pas une option.",
    published: "Matrice de familles avec leurs arbitrages — aucune performance garantie.",
    evidenceLevel: "qualitative_consensus",
  },
] as const;

/* ==========================================================================
   2 — Secteurs et dépendances
   ========================================================================== */

export const SECTOR_DIMENSIONS = [
  { id: "prelevement", label: "Prélèvement", hint: "Volume soutiré à la ressource" },
  { id: "consommation", label: "Consommation", hint: "Part non restituée au milieu" },
  { id: "rejet", label: "Rejet", hint: "Volume restitué, et sa charge" },
  { id: "qualite", label: "Qualité", hint: "Exigence de qualité en entrée" },
  { id: "dependance", label: "Dépendance locale", hint: "Substituabilité de la ressource" },
  { id: "fournisseur", label: "Exposition fournisseur", hint: "Eau incorporée en amont" },
  { id: "adaptation", label: "Adaptation", hint: "Marges techniques connues" },
] as const;

export type SectorDimensionId = (typeof SECTOR_DIMENSIONS)[number]["id"];

export interface Sector {
  readonly id: string;
  readonly label: string;
  readonly note: string;
  readonly dimensions: Readonly<Record<SectorDimensionId, Intensity>>;
  readonly evidenceLevel: EvidenceLevel;
}

/**
 * Dix secteurs, sept dimensions, aucune valeur chiffrée.
 *
 * Les intensités sont ORDINALES et nommées. Elles décrivent une nature de
 * dépendance documentée par la littérature technique, pas un rang mesuré :
 * deux secteurs « structurants » ne sont pas départagés, et la matrice ne
 * produit aucun total par ligne ni par colonne.
 */
export const SECTORS: readonly Sector[] = [
  {
    id: "agroalimentaire",
    label: "Agroalimentaire",
    note: "L'eau est à la fois ingrédient, fluide de lavage et fluide de refroidissement. Les exigences de qualité en entrée sont réglementées, ce qui limite les substitutions.",
    dimensions: {
      prelevement: "structurante",
      consommation: "significative",
      rejet: "significative",
      qualite: "structurante",
      dependance: "structurante",
      fournisseur: "structurante",
      adaptation: "variable",
    },
    evidenceLevel: "qualitative_consensus",
  },
  {
    id: "boissons",
    label: "Boissons",
    note: "L'eau est le produit. La ressource est souvent captée localement, ce qui rend la dépendance au bassin difficilement délocalisable.",
    dimensions: {
      prelevement: "structurante",
      consommation: "structurante",
      rejet: "significative",
      qualite: "structurante",
      dependance: "structurante",
      fournisseur: "significative",
      adaptation: "variable",
    },
    evidenceLevel: "qualitative_consensus",
  },
  {
    id: "textile",
    label: "Textile",
    note: "L'essentiel de l'empreinte se situe en amont — culture des fibres, teinture, apprêts — donc chez des fournisseurs, souvent dans d'autres bassins que le siège.",
    dimensions: {
      prelevement: "significative",
      consommation: "significative",
      rejet: "structurante",
      qualite: "significative",
      dependance: "variable",
      fournisseur: "structurante",
      adaptation: "variable",
    },
    evidenceLevel: "qualitative_consensus",
  },
  {
    id: "semi-conducteurs",
    label: "Semi-conducteurs",
    note: "L'exigence porte moins sur le volume que sur la pureté : l'eau ultrapure impose un traitement dont le coût énergétique est une contrepartie directe.",
    dimensions: {
      prelevement: "significative",
      consommation: "significative",
      rejet: "significative",
      qualite: "structurante",
      dependance: "structurante",
      fournisseur: "variable",
      adaptation: "significative",
    },
    evidenceLevel: "qualitative_consensus",
  },
  {
    id: "chimie-pharma",
    label: "Chimie et pharmacie",
    note: "Procédés très hétérogènes : le prélèvement, le rejet et la charge polluante varient d'un site à l'autre bien plus que d'un secteur à l'autre.",
    dimensions: {
      prelevement: "significative",
      consommation: "variable",
      rejet: "structurante",
      qualite: "structurante",
      dependance: "significative",
      fournisseur: "significative",
      adaptation: "significative",
    },
    evidenceLevel: "qualitative_consensus",
  },
  {
    id: "mines-metaux",
    label: "Mines et métaux",
    note: "Prélèvement et rejet sont tous deux structurants, et la localisation est imposée par le gisement : la ressource ne se choisit pas.",
    dimensions: {
      prelevement: "structurante",
      consommation: "significative",
      rejet: "structurante",
      qualite: "variable",
      dependance: "structurante",
      fournisseur: "significative",
      adaptation: "variable",
    },
    evidenceLevel: "qualitative_consensus",
  },
  {
    id: "energie",
    label: "Énergie",
    note: "Le refroidissement thermique prélève beaucoup et restitue l'essentiel ; l'hydroélectricité dépend du régime hydrologique sans prélever au sens réglementaire.",
    dimensions: {
      prelevement: "structurante",
      consommation: "variable",
      rejet: "structurante",
      qualite: "faible",
      dependance: "structurante",
      fournisseur: "variable",
      adaptation: "variable",
    },
    evidenceLevel: "qualitative_consensus",
  },
  {
    id: "materiaux",
    label: "Matériaux de construction",
    note: "L'eau est incorporée au produit et sert au lavage des granulats. Les sites sont nombreux et dispersés, donc exposés à des bassins très différents.",
    dimensions: {
      prelevement: "significative",
      consommation: "significative",
      rejet: "variable",
      qualite: "faible",
      dependance: "significative",
      fournisseur: "variable",
      adaptation: "significative",
    },
    evidenceLevel: "qualitative_consensus",
  },
  {
    id: "data-centers",
    label: "Data centers",
    note: "L'arbitrage eau/énergie y est explicite : le refroidissement adiabatique économise de l'électricité en consommant de l'eau, et réciproquement.",
    dimensions: {
      prelevement: "significative",
      consommation: "structurante",
      rejet: "faible",
      qualite: "significative",
      dependance: "significative",
      fournisseur: "variable",
      adaptation: "significative",
    },
    evidenceLevel: "qualitative_consensus",
  },
  {
    id: "agriculture",
    label: "Agriculture",
    note: "Premier usage consommateur : l'eau d'irrigation est en grande partie évapotranspirée, donc non restituée au bassin.",
    dimensions: {
      prelevement: "structurante",
      consommation: "structurante",
      rejet: "variable",
      qualite: "significative",
      dependance: "structurante",
      fournisseur: "structurante",
      adaptation: "variable",
    },
    evidenceLevel: "qualitative_consensus",
  },
] as const;

/* ==========================================================================
   3 — Innovations et adaptation
   ========================================================================== */

export const INNOVATION_AXES = [
  { id: "maturite", label: "Maturité" },
  { id: "eau", label: "Eau économisée" },
  { id: "cout", label: "Coût" },
  { id: "energie", label: "Énergie" },
  { id: "carbone", label: "Carbone" },
] as const;

export type InnovationAxisId = (typeof INNOVATION_AXES)[number]["id"];

export interface InnovationFamily {
  readonly id: string;
  readonly label: string;
  readonly principle: string;
  readonly tradeoff: string;
  readonly sectors: readonly string[];
  readonly axes: Readonly<Record<InnovationAxisId, Intensity>>;
  readonly evidenceLevel: EvidenceLevel;
}

/**
 * Neuf familles. Chacune porte sa CONTREPARTIE au même niveau que son
 * bénéfice : une famille présentée par son seul gain hydrique est une
 * promesse, pas une option. Aucun volume économisé n'est chiffré — il dépend
 * du procédé, du site et de la qualité requise, et ne se transpose pas.
 */
export const INNOVATION_FAMILIES: readonly InnovationFamily[] = [
  {
    id: "boucle-fermee",
    label: "Réutilisation en boucle fermée",
    principle:
      "Recirculer l'eau de procédé après traitement plutôt que de prélever et rejeter à chaque cycle.",
    tradeoff:
      "Le traitement consomme de l'énergie et concentre les polluants : le rejet devient plus petit et plus chargé, ce qui déplace la contrainte plutôt que de la supprimer.",
    sectors: ["Chimie et pharmacie", "Semi-conducteurs", "Agroalimentaire"],
    axes: {
      maturite: "structurante",
      eau: "structurante",
      cout: "significative",
      energie: "significative",
      carbone: "variable",
    },
    evidenceLevel: "qualitative_consensus",
  },
  {
    id: "fuites",
    label: "Détection de fuites",
    principle:
      "Instrumenter le réseau pour localiser les pertes entre le point de prélèvement et le point d'usage.",
    tradeoff:
      "Le gain dépend entièrement de l'état initial du réseau : sur un réseau récent, l'investissement peut ne rien économiser.",
    sectors: ["Tous secteurs à réseau étendu", "Collectivités"],
    axes: {
      maturite: "structurante",
      eau: "variable",
      cout: "faible",
      energie: "faible",
      carbone: "faible",
    },
    evidenceLevel: "qualitative_consensus",
  },
  {
    id: "compteurs",
    label: "Compteurs intelligents",
    principle:
      "Mesurer par usage et en continu, pour distinguer ce qui est prélevé de ce qui est réellement consommé.",
    tradeoff:
      "Un compteur ne réduit rien par lui-même : il rend une décision possible, il ne la prend pas.",
    sectors: ["Tous secteurs"],
    axes: {
      maturite: "structurante",
      eau: "faible",
      cout: "faible",
      energie: "faible",
      carbone: "faible",
    },
    evidenceLevel: "qualitative_consensus",
  },
  {
    id: "traitement-avance",
    label: "Traitement avancé",
    principle:
      "Membranes, oxydation ou échange d'ions pour rendre réutilisable une eau qui ne l'était pas.",
    tradeoff:
      "Coût énergétique élevé et production d'un concentrat dont l'élimination est elle-même une contrainte réglementaire.",
    sectors: ["Semi-conducteurs", "Chimie et pharmacie", "Énergie"],
    axes: {
      maturite: "significative",
      eau: "structurante",
      cout: "structurante",
      energie: "structurante",
      carbone: "significative",
    },
    evidenceLevel: "qualitative_consensus",
  },
  {
    id: "recuperation",
    label: "Récupération des eaux",
    principle:
      "Collecter les eaux pluviales ou de condensat pour les usages ne demandant pas une qualité potable.",
    tradeoff:
      "Ressource intermittente : elle réduit le prélèvement moyen sans sécuriser la pointe, c'est-à-dire précisément le moment où la ressource manque.",
    sectors: ["Matériaux de construction", "Agroalimentaire", "Data centers"],
    axes: {
      maturite: "structurante",
      eau: "variable",
      cout: "variable",
      energie: "faible",
      carbone: "faible",
    },
    evidenceLevel: "qualitative_consensus",
  },
  {
    id: "recharge-nappes",
    label: "Recharge des nappes",
    principle:
      "Infiltrer une eau excédentaire pour reconstituer un stock souterrain mobilisable plus tard.",
    tradeoff:
      "Exige une compatibilité qualité stricte avec la nappe réceptrice ; une recharge mal maîtrisée transfère une pollution vers une ressource protégée.",
    sectors: ["Agriculture", "Collectivités"],
    axes: {
      maturite: "significative",
      eau: "significative",
      cout: "significative",
      energie: "variable",
      carbone: "faible",
    },
    evidenceLevel: "institutional_context",
  },
  {
    id: "zones-humides",
    label: "Zones humides",
    principle:
      "Restaurer une capacité de rétention et d'épuration portée par le milieu lui-même.",
    tradeoff:
      "Emprise foncière importante et effet différé de plusieurs années : ce n'est pas une réponse à une crise en cours.",
    sectors: ["Agriculture", "Collectivités", "Matériaux de construction"],
    axes: {
      maturite: "significative",
      eau: "variable",
      cout: "variable",
      energie: "faible",
      carbone: "faible",
    },
    evidenceLevel: "institutional_context",
  },
  {
    id: "nature",
    label: "Solutions fondées sur la nature",
    principle:
      "Mobiliser des processus écologiques — couvert végétal, sols, ripisylves — pour réguler le cycle local.",
    tradeoff:
      "Le bénéfice hydrique dépend du contexte pédoclimatique et se mesure difficilement : il exige un suivi long, rarement disponible au moment de la décision.",
    sectors: ["Agriculture", "Matériaux de construction"],
    axes: {
      maturite: "variable",
      eau: "inconnue",
      cout: "variable",
      energie: "faible",
      carbone: "significative",
    },
    evidenceLevel: "requires_measurement",
  },
  {
    id: "adaptation-extremes",
    label: "Adaptation sécheresse et inondation",
    principle:
      "Préparer l'exploitation aux deux extrêmes : plans de délestage, stockage tampon, protection des installations.",
    tradeoff:
      "Les deux aléas appellent parfois des réponses opposées ; les traiter ensemble sans les distinguer produit des investissements qui se neutralisent.",
    sectors: ["Tous secteurs exposés"],
    axes: {
      maturite: "significative",
      eau: "inconnue",
      cout: "variable",
      energie: "variable",
      carbone: "variable",
    },
    evidenceLevel: "requires_measurement",
  },
] as const;

/* ==========================================================================
   4 — Passerelle financière
   ========================================================================== */

export interface FinancialBridgeStep {
  readonly id: string;
  readonly label: string;
  readonly question: string;
  readonly note: string;
  readonly kind: "exposition" | "cout" | "comptable";
}

/**
 * Le pont entre un événement hydrique et ses effets financiers.
 *
 * Chaque étape est une QUESTION à instruire, jamais un calcul. Le moteur de
 * scénarios existe côté authentifié et exige des hypothèses explicites ;
 * cette section décrit sa mécanique, elle n'en exécute aucune et n'affiche
 * aucun montant.
 */
export const FINANCIAL_BRIDGE: readonly FinancialBridgeStep[] = [
  {
    id: "interruption",
    label: "Interruption",
    question: "Combien de jours l'activité s'arrête-t-elle, et sur quel périmètre ?",
    note: "Une restriction d'usage n'est pas un arrêt total : la part de capacité affectée est une hypothèse à poser, jamais 100 % par défaut.",
    kind: "exposition",
  },
  {
    id: "capacite",
    label: "Perte de capacité",
    question: "Quelle fraction de la capacité reste disponible pendant l'événement ?",
    note: "Distincte de la durée : un site à 40 % pendant trente jours n'équivaut pas à un arrêt de douze jours.",
    kind: "exposition",
  },
  {
    id: "revenu",
    label: "Chiffre d'affaires exposé",
    question: "Quel revenu dépend de la capacité affectée ?",
    note: "Le revenu du site, pas celui du groupe. Une exposition calculée sur le mauvais périmètre est une exposition fausse.",
    kind: "exposition",
  },
  {
    id: "adaptation",
    label: "Coûts d'adaptation",
    question: "Que coûte la réponse — approvisionnement de substitution, transport, arrêt partiel ?",
    note: "Ces coûts existent même quand la production continue : les omettre sous-estime l'exposition d'un site qui a « tenu ».",
    kind: "cout",
  },
  {
    id: "capex",
    label: "CAPEX",
    question: "Quel investissement d'adaptation est envisagé, sur quel horizon ?",
    note: "À comparer à l'exposition évitée, avec un taux d'actualisation FOURNI — le moteur n'en a aucun par défaut.",
    kind: "cout",
  },
  {
    id: "opex",
    label: "OPEX",
    question: "Quel surcoût opératoire récurrent l'adaptation entraîne-t-elle ?",
    note: "Une solution qui économise de l'eau en consommant de l'énergie déplace une dépense ; elle ne la supprime pas.",
    kind: "cout",
  },
  {
    id: "assurance",
    label: "Assurance",
    question: "Le risque est-il couvert, et quelles exclusions s'appliquent ?",
    note: "Aucune indemnisation n'est supposée. Les exclusions liées aux événements climatiques sont à vérifier au contrat.",
    kind: "cout",
  },
  {
    id: "impairment",
    label: "Revue de dépréciation",
    question: "L'exposition constitue-t-elle un indice de perte de valeur à examiner ?",
    note: "IAS 36 — un indice appelle un test, et le test reste un acte comptable humain. Le module signale la question, il ne conclut pas.",
    kind: "comptable",
  },
  {
    id: "provisions",
    label: "Provisions",
    question: "Existe-t-il une obligation actuelle résultant d'un événement passé ?",
    note: "IAS 37 — provision ou passif éventuel : la qualification dépend du degré de certitude, qui n'est pas un paramètre technique.",
    kind: "comptable",
  },
  {
    id: "redevances",
    label: "Taxes et redevances",
    question: "Quel est le fait générateur de la redevance applicable ?",
    note: "IFRIC 21 — il peut être distinct de l'exercice de consommation. Aucun taux n'est encodé : ils dépendent du bassin et de l'usage.",
    kind: "comptable",
  },
] as const;

/* ==========================================================================
   5 — Chronologie climatique
   ========================================================================== */

export interface ClimateEvent {
  readonly id: string;
  readonly date: string;
  readonly territory: string;
  readonly kind: string;
  readonly title: string;
  readonly sourceUrl: string;
  readonly reviewedOn: string;
  readonly reviewedBy: string;
  readonly verification: "verified" | "pending";
}

/**
 * VIDE, et c'est l'état correct.
 *
 * Un événement n'est publiable qu'avec une date, un territoire, une source
 * officielle, une date de revue et un réviseur identifié. Aucun n'a été
 * instruit : la section rend donc une explication pédagogique de ce qu'elle
 * exigera, jamais un grand bloc vide, et jamais un événement plausible.
 *
 * Le tableau est typé plutôt que supprimé : le jour où un premier événement
 * est instruit, la forme qu'il doit prendre est déjà écrite ici.
 */
export const CLIMATE_EVENTS: readonly ClimateEvent[] = [] as const;

/** Ce qu'un événement doit porter pour être affiché. */
export const CLIMATE_EVENT_REQUIREMENTS: readonly string[] = [
  "une date propre à l'événement, distincte de la date de publication de sa source",
  "un territoire identifié par un code officiel",
  "une source officielle relevée, avec son URL",
  "une date de revue humaine",
  "un statut de vérification explicite",
] as const;

/** Les familles d'événements que cette chronologie accueillera. */
export const CLIMATE_EVENT_KINDS: readonly string[] = [
  "sécheresses",
  "restrictions d'usage",
  "inondations",
  "épisodes de pollution",
  "tensions sur nappes",
  "interruptions opérationnelles",
] as const;
