/**
 * Registre des 8 modules produit CarbonCo (1 page produit dédiée par module).
 *
 * Cette source de vérité unique alimente :
 *   - la page d'index `/produit`,
 *   - les 8 pages dédiées `/produit/[slug]`,
 *   - le sitemap.
 *
 * Format délibérément verbeux : chaque module a 1) un pitch, 2) trois bénéfices
 * cibles, 3) une description fonctionnelle de 5 à 7 lignes, 4) ce qui existe
 * aujourd'hui (`proofs`), 5) ce qui est en feuille de route (`roadmap`), 6) un
 * scénario illustratif. C'est le strict minimum pour qu'une page produit
 * performe en SEO long-tail (≈400 mots utiles par page).
 *
 * Règles (PLAN_ACTION_CSRD_2026-11, T8.3) :
 *   - `proofs` ne liste que ce que le code fait aujourd'hui (registre
 *     data/feature-status.json) ; ce qui est planifié va dans `roadmap` ;
 *   - le produit n'est pas commercialisé : `useCase` est un scénario
 *     illustratif, jamais un résultat client ni un verdict d'auditeur ;
 *   - lexique : « selon » et « conçu pour » ; le lexique interdit est tenu par
 *     tests/regulatory-claims-guard.test.ts.
 */

export type ProductSlug =
  | "collecte"
  | "calcul"
  | "audit"
  | "rapport"
  | "scope-1"
  | "scope-2"
  | "scope-3"
  | "oti";

export interface ProductModule {
  slug: ProductSlug;
  title: string;
  pitch: string;
  description: string;
  benefits: { title: string; detail: string }[];
  /** Ce qui existe aujourd'hui dans le code (statut live, vérification ou bêta au registre). */
  proofs: string[];
  /** Ce qui est planifié : affiché comme tel, jamais comme disponible. */
  roadmap: string[];
  /** Scénario illustratif : profil fictif, aucun résultat chiffré revendiqué. */
  useCase: { who: string; story: string };
  illustration: "Collecte" | "Calcul" | "Audit" | "Rapport" | "Scope1" | "Scope2" | "Scope3" | "Oti";
}

export const PRODUCT_MODULES: ProductModule[] = [
  {
    slug: "collecte",
    title: "Collecte de données",
    pitch:
      "Centralisez vos données extra-financières sans casser les workflows existants : classeur Excel structuré, fichiers d'export et questionnaires fournisseurs convergent vers une source unique tracée.",
    description:
      "Le module Collecte importe un classeur Excel structuré (modèle téléchargeable, plages nommées contrôlées) et des fichiers d'export courants (FEC, factures cloud, relevés bancaires CSV). Chaque valeur conserve sa lignée : fichier source, onglet, cellule, date d'import et auteur. Les erreurs de format sont signalées à l'import, avant tout calcul. Les questionnaires fournisseurs se remplissent par lien partagé, sans compte.",
    benefits: [
      {
        title: "Zéro double saisie",
        detail:
          "Le classeur de référence reprend la structure de vos fichiers ; la validation stricte signale les cellules manquantes ou mal typées.",
      },
      {
        title: "Lignée préservée",
        detail:
          "Chaque valeur conserve sa source (fichier, onglet, cellule, horodatage, utilisateur). Le vérificateur remonte la chaîne en un clic.",
      },
      {
        title: "Fournisseurs sans compte",
        detail:
          "Les questionnaires scope 3 s'envoient par lien ; les réponses rejoignent le bilan avec leur origine.",
      },
    ],
    proofs: [
      "Import du classeur Excel structuré avec validation automatique.",
      "Imports de fichiers sans connecteur : FEC, exports AWS et GCP, relevés Qonto en CSV (bêta).",
      "API REST de lecture (bêta) et questionnaires fournisseurs par lien partagé (bêta).",
    ],
    roadmap: [
      "Connecteurs ERP natifs (Sage, Cegid, SAP).",
      "Lecture automatique (OCR) des factures d'énergie.",
    ],
    useCase: {
      who: "ETI industrielle fictive, 8 sites",
      story:
        "Chaque site tient ses consommations dans son propre fichier. Les équipes recopient leurs totaux dans le classeur de référence ; l'import contrôle chaque cellule et garde, pour chaque valeur, le site, le fichier et la cellule d'origine.",
    },
    illustration: "Collecte",
  },
  {
    slug: "calcul",
    title: "Calcul GES",
    pitch:
      "Calculs selon les principes du GHG Protocol, facteurs ADEME Base Empreinte® versionnés, scope 2 en location-based et market-based. Méthode tracée pour chaque indicateur.",
    description:
      "Le moteur applique à chaque donnée d'activité (kWh, litres, km, euros, kilos) un facteur d'émission identifié, dont il fige la base et la version au moment du calcul. Le scope 2 est calculé deux fois, en location-based et en market-based. Le scope 3 distingue les lignes calculées sur données fournisseur, physiques ou monétaires. Une nouvelle version de base ADEME crée un nouveau calcul : l'ancien reste consultable pour la comparabilité.",
    benefits: [
      {
        title: "Méthode explicite",
        detail:
          "GHG Protocol pour la grammaire des scopes, ESRS E1 pour la présentation. Chaque calcul porte sa méthode et son facteur.",
      },
      {
        title: "Facteurs versionnés",
        detail:
          "Les facteurs sont importés par version publiée de la Base Empreinte® ; un recalcul ne réécrit jamais un résultat déjà validé.",
      },
      {
        title: "Auditable à la ligne",
        detail:
          "Pour chaque tCO₂e calculée : donnée d'entrée, facteur, base, version, méthode, date. Aucune boîte noire.",
      },
    ],
    proofs: [
      "502 facteurs ADEME Base Empreinte® versionnés, traçables par identifiant.",
      "Moteur scope 2 en double calcul (location-based et market-based) avec garanties d'origine, PPA et offres vertes (bêta).",
      "Année de référence et journal des recalculs en cas de changement de méthode ou de périmètre (bêta).",
    ],
    roadmap: [
      "Incertitude propagée par poste et au total, à partir de l'incertitude publiée de chaque facteur.",
      "Version des pouvoirs de réchauffement global (GIEC AR6) figée et affichée par calcul.",
    ],
    useCase: {
      who: "Cabinet de conseil fictif, plusieurs clients ETI",
      story:
        "À la publication d'une nouvelle version de la Base Empreinte®, le cabinet l'importe une fois. Les calculs existants gardent leur version d'origine ; les nouveaux calculs utilisent la nouvelle, et l'écart entre les deux reste lisible.",
    },
    illustration: "Calcul",
  },
  {
    slug: "audit",
    title: "Audit trail",
    pitch:
      "Chaque écriture porte une empreinte SHA-256 liée à la précédente : toute modification après validation devient détectable, et chaque chiffre reste relié à sa source.",
    description:
      "Toute action — saisie, modification, validation, export — produit une écriture horodatée avec son empreinte. La chaîne relie les écritures dans l'ordre chronologique : une modification ultérieure d'une donnée validée rompt la chaîne de manière détectable. La structure est en ajout seul : rien n'est effacé, les corrections sont des écritures supplémentaires. L'empreinte prouve l'intégrité et l'ordre depuis la capture ; l'exactitude et l'exhaustivité se vérifient par d'autres contrôles.",
    benefits: [
      {
        title: "Intégrité vérifiable",
        detail:
          "L'empreinte de chaque écriture couvre son contenu, son auteur, son horodatage et l'empreinte précédente. Une altération casse la chaîne.",
      },
      {
        title: "En ajout seul",
        detail:
          "Aucune écriture n'est supprimée. Une correction est une nouvelle écriture, avec son auteur et sa date.",
      },
      {
        title: "Vérifiable hors plateforme",
        detail:
          "Le vérificateur recalcule les empreintes sur l'export brut, sans compte ni outil propriétaire, via /verify.",
      },
    ],
    proofs: [
      "Chaînes d'empreintes SHA-256 sur les faits et sur le journal d'audit, vérifiées chaque jour.",
      "Vérification publique d'un Evidence Pack sur /verify/{hash} (bêta).",
      "Manifeste d'export listant l'empreinte de chaque fichier du pack.",
    ],
    roadmap: [
      "Ancrage externe quotidien de la chaîne (horodatage RFC 3161), pour qu'un administrateur ne puisse pas la recalculer en silence.",
      "Signature du manifeste par une clé publiée.",
    ],
    useCase: {
      who: "DAF d'une ETI fictive",
      story:
        "Avant la mission de certification, le DAF transmet le pack d'export. Le vérificateur recalcule les empreintes d'un échantillon de lignes et constate que la chaîne est intacte depuis la validation de chaque donnée.",
    },
    illustration: "Audit",
  },
  {
    slug: "rapport",
    title: "Projet de rapport ESRS",
    pitch:
      "Génération d'un projet de rapport structuré selon les ESRS, avec note méthodologique et tableaux de datapoints, à relire et valider par vos équipes. L'export porte une empreinte vérifiable sur /verify.",
    description:
      "Le module Rapport assemble en un PDF le rapport principal, la note méthodologique et les tableaux de datapoints, accompagnés de l'empreinte de la période publiée. Les blocs thématiques suivent les sujets retenus par votre analyse de double matérialité. Les commentaires et arbitrages internes restent confidentiels et n'apparaissent pas dans l'export. Le rapport reste un projet : votre direction le relit, le valide et en porte la responsabilité.",
    benefits: [
      {
        title: "Structure ESRS",
        detail:
          "Organisation par norme et par datapoint, alignée sur le référentiel ESRS de CarbonCo ; l'alignement sur les ESRS 2026 (règlement délégué (UE) 2026/1563) est en cours.",
      },
      {
        title: "Note méthodologique incluse",
        detail:
          "Sources, hypothèses, facteurs et taux de couverture pour chaque indicateur publié.",
      },
      {
        title: "Empreinte de l'export",
        detail:
          "Le PDF porte l'empreinte de la période : le vérificateur contrôle à tout moment qu'il n'a pas été modifié.",
      },
    ],
    proofs: [
      "Export PDF du rapport et export Excel structuré avec l'audit trail.",
      "Rapport selon la norme volontaire (ex-VSME) en PDF et annexe Excel (bêta).",
      "Export iXBRL en bêta, selon la taxonomie XBRL ESRS de l'EFRAG (2024) ; aucun dépôt balisé n'est exigé à ce jour.",
    ],
    roadmap: [
      "Version ESRS appliquée (2023 ou 2026) choisie et imprimée sur chaque rapport.",
      "Migration de l'export iXBRL vers la taxonomie ESRS 2026 dès sa version définitive.",
    ],
    useCase: {
      who: "ETI de services fictive",
      story:
        "L'équipe RSE génère un premier projet à partir des datapoints validés, le complète de ses narratifs, puis le soumet à la direction. Chaque chiffre du PDF renvoie à son datapoint et à sa source.",
    },
    illustration: "Rapport",
  },
  {
    slug: "scope-1",
    title: "Scope 1 — émissions directes",
    pitch:
      "Combustion fixe, combustion mobile, fluides frigorigènes, émissions de procédé : vos émissions directes, site par site, avec leur facteur et leur source.",
    description:
      "Le module Scope 1 collecte les consommations énergétiques directes (gaz naturel, fioul, GPL), les kilométrages de la flotte propre, les fuites de fluides frigorigènes et les émissions de procédé. Chaque poste applique un facteur identifié de la Base Empreinte® et garde sa donnée d'origine. Les écarts inhabituels par rapport à l'historique déclenchent une alerte.",
    benefits: [
      {
        title: "Multi-sites",
        detail:
          "Chaque site a sa propre saisie ; l'agrégation au niveau groupe garde le détail consultable.",
      },
      {
        title: "Fluides frigorigènes",
        detail:
          "Catalogue des fluides courants (R-32, R-410A, R-134a…) avec leur pouvoir de réchauffement global.",
      },
      {
        title: "Flotte propre",
        detail:
          "Saisie par véhicule (km annuels × consommation moyenne) ou par carburant acheté.",
      },
    ],
    proofs: [
      "Facteurs de combustion et de fluides frigorigènes intégrés, avec identifiant ADEME.",
      "Alertes sur les consommations inhabituelles par rapport à l'historique.",
      "Agrégation multi-sites avec détail par site (bêta).",
    ],
    roadmap: [
      "Pouvoirs de réchauffement global des fluides alignés sur le GIEC AR6, avec la version affichée par calcul.",
      "Rapprochement automatique entre factures de gaz ou de fioul et déclarations des sites.",
    ],
    useCase: {
      who: "Réseau fictif de 28 points de vente",
      story:
        "Chaque point de vente déclare ses consommations dans le même modèle. Le groupe obtient un scope 1 consolidé, et une hausse anormale de consommation sur un site est signalée avant la clôture.",
    },
    illustration: "Scope1",
  },
  {
    slug: "scope-2",
    title: "Scope 2 — énergie achetée",
    pitch:
      "Électricité, chaleur, vapeur, froid : double calcul location-based et market-based, garanties d'origine et PPA, suivi mensuel.",
    description:
      "Le module Scope 2 calcule l'électricité et la chaleur achetées deux fois : en location-based, avec le mix moyen du réseau, et en market-based, avec vos instruments contractuels (garanties d'origine, PPA, offres vertes) et, à défaut, le mix résiduel. Sans instrument, le market-based est souvent plus élevé que le location-based : c'est attendu, et les deux chiffres sont publiés côte à côte, comme le demandent le GHG Protocol et l'ESRS E1.",
    benefits: [
      {
        title: "Double calcul",
        detail:
          "Location-based (mix réseau) et market-based (instruments contractuels, sinon mix résiduel) côte à côte, avec la trace de chaque choix de facteur.",
      },
      {
        title: "Instruments contractuels",
        detail:
          "Garanties d'origine, PPA et offres vertes modélisés dans le calcul market-based.",
      },
      {
        title: "Suivi mensuel",
        detail:
          "Saisie ou import mensuel pour piloter l'année en cours, pas seulement reporter l'année passée.",
      },
    ],
    proofs: [
      "Moteur de calcul scope 2 en double calcul, avec totaux location-based et market-based et trace par ligne (bêta).",
      "Instruments : garanties d'origine, PPA, offres vertes (bêta).",
      "Facteurs par niveau (location, market, mix résiduel) avec niveau de sélection et motif enregistrés.",
    ],
    roadmap: [
      "Source et millésime du mix résiduel affichés sur chaque écran.",
      "Suivi de la révision du GHG Protocol sur le scope 2 (méthode market-based horaire en consultation).",
    ],
    useCase: {
      who: "Éditeur SaaS fictif, 80 salariés",
      story:
        "Sans garanties d'origine, son market-based dépasse son location-based. L'outil affiche les deux chiffres, explique l'écart par le mix résiduel, et montre l'effet qu'aurait un contrat d'électricité renouvelable sur le seul market-based.",
    },
    illustration: "Scope2",
  },
  {
    slug: "scope-3",
    title: "Scope 3 — chaîne de valeur",
    pitch:
      "Les 15 catégories du GHG Protocol, une méthode déclarée par ligne (fournisseur, physique, monétaire) et des campagnes fournisseurs pour remplacer le monétaire là où il pèse.",
    description:
      "Le module Scope 3 couvre les 15 catégories du GHG Protocol. Chaque ligne d'achat porte sa méthode de calcul (donnée fournisseur, physique ou monétaire) et son rang de qualité. Le screening monétaire depuis le FEC donne une première estimation rapide ; les points chauds signalent les fournisseurs à interroger en priorité. Un service cloud ou SaaS acheté se range en catégorie 1. Le monétaire sert à dégrossir, jamais à piloter des achats.",
    benefits: [
      {
        title: "Couverture des 15 catégories",
        detail:
          "Chaque catégorie est prête à l'emploi avec des facteurs par défaut, à raffiner quand elle est significative.",
      },
      {
        title: "Méthode par ligne",
        detail:
          "Donnée fournisseur, physique ou monétaire : la méthode est visible ligne par ligne, avec son incertitude indicative.",
      },
      {
        title: "Campagnes ciblées",
        detail:
          "Les points chauds désignent les fournisseurs qui pèsent le plus ; les questionnaires partent par lien.",
      },
    ],
    proofs: [
      "Les 15 catégories GHG Protocol modélisées explicitement (bêta).",
      "Import FEC et screening monétaire du scope 3 (bêta).",
      "Moteur achats avec méthode par ligne, points chauds et campagnes fournisseurs ciblées (bêta).",
    ],
    roadmap: [
      "Part du scope 3 calculée en monétaire exprimée en tCO₂e, avec trajectoire de réduction.",
      "Questionnaires alignés sur la norme volontaire (règlement délégué (UE) 2026/1560), avec ses catégories de points.",
    ],
    useCase: {
      who: "Industriel agroalimentaire fictif, 5 usines",
      story:
        "La première année, la plupart des achats sont calculés en monétaire depuis le FEC. Les points chauds désignent les fournisseurs à interroger ; leurs réponses remplacent progressivement les ratios monétaires, catégorie par catégorie.",
    },
    illustration: "Scope3",
  },
  {
    slug: "oti",
    title: "Espace vérificateur",
    pitch:
      "Un espace en lecture seule pour votre commissaire aux comptes ou votre OTI : données, audit trail, exports bruts. Objectif : réduire le temps de vérification, mesuré avec nos pilotes 2026.",
    description:
      "L'espace vérificateur donne au CAC ou à l'OTI chargé de la mission d'assurance limitée un accès en lecture seule, par lien, aux données, à l'audit trail et aux exports. Chaque accès est journalisé. Le vérificateur remonte un chiffre jusqu'à sa source et rejoue les calculs scope 2 et scope 3 à partir de leurs données figées. Il juge seul de la suffisance des éléments : CarbonCo facilite ses travaux, il ne les remplace pas.",
    benefits: [
      {
        title: "Accès par lien",
        detail:
          "Lien d'accès en lecture seule, sans compte à créer ; chaque consultation est journalisée.",
      },
      {
        title: "Remonter à la source",
        detail:
          "Du datapoint publié à la cellule d'origine, avec la méthode et le facteur appliqués.",
      },
      {
        title: "Calculs rejouables",
        detail:
          "Les calculs scope 2 et scope 3 achats se rejouent à partir de leur instantané d'entrée et des versions de facteurs utilisées.",
      },
    ],
    proofs: [
      "Accès vérificateur invité en lecture seule, accès journalisés (bêta).",
      "Score d'audit et contrôles de cohérence (30+ règles) par datapoint (bêta).",
      "Instantanés d'entrée et empreintes des calculs scope 2 et scope 3 achats.",
    ],
    roadmap: [
      "Échantillonnage aléatoire reproductible (graine enregistrée) avec export des pièces.",
      "Rapprochements des totaux importés avec le FEC et les factures d'énergie.",
    ],
    useCase: {
      who: "Mission d'assurance limitée sur une ETI fictive",
      story:
        "Le vérificateur reçoit un lien en lecture seule. Il choisit quelques datapoints, remonte chacun jusqu'à sa cellule source, recalcule les empreintes du pack exporté et consigne ses questions dans son propre dossier de travail.",
    },
    illustration: "Oti",
  },
];

export function getProductModule(slug: string): ProductModule | undefined {
  return PRODUCT_MODULES.find((m) => m.slug === slug);
}
