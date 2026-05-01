/**
 * Registre des 8 modules produit CarbonCo (1 page produit dédiée par module).
 *
 * Cette source de vérité unique alimente :
 *   - la page d'index `/produit`,
 *   - les 8 pages dédiées `/produit/[slug]`,
 *   - le sitemap.
 *
 * Format délibérément verbeux : chaque module a 1) un pitch, 2) trois bénéfices
 * cibles, 3) une description fonctionnelle de 5 à 7 lignes, 4) trois preuves
 * (mesurables ou techniques), 5) un cas d'usage type. C'est le strict minimum
 * pour qu'une page produit performe en SEO long-tail (≈400 mots utiles par page).
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
  proofs: string[];
  useCase: { who: string; story: string };
  illustration: "Collecte" | "Calcul" | "Audit" | "Rapport" | "Scope1" | "Scope2" | "Scope3" | "Oti";
}

export const PRODUCT_MODULES: ProductModule[] = [
  {
    slug: "collecte",
    title: "Collecte de données",
    pitch:
      "Centralisez vos données extra-financières sans casser les workflows existants : Excel, ERP, factures PDF, formulaires web — tout converge vers une source unique tracée.",
    description:
      "Le module Collecte ingère les fichiers Excel et CSV existants, parse automatiquement les colonnes selon les ESRS, propose un mapping intelligent avec confirmation utilisateur, et conserve la lignée (fichier source, ligne, date, utilisateur) pour chaque valeur. Les connecteurs API (ERP, comptabilité, énergie) viennent compléter sans remplacer.",
    benefits: [
      {
        title: "Zéro double saisie",
        detail:
          "Les fichiers existants sont réutilisés tels quels. Le mapping intelligent suggère la correspondance ESRS, l'utilisateur valide.",
      },
      {
        title: "Lignée préservée",
        detail:
          "Chaque valeur conserve sa source (fichier, ligne, timestamp, utilisateur). L'auditeur remonte la chaîne en un clic.",
      },
      {
        title: "Multi-format",
        detail:
          "Excel, CSV, PDF (OCR), Word, JSON API. Le module détecte le format et applique le parser adapté.",
      },
    ],
    proofs: [
      "Parser Excel multi-feuilles avec détection automatique des en-têtes.",
      "OCR PDF natif pour les factures énergie et fluides scannées.",
      "Connecteurs API REST configurables pour Sage, Cegid, SAP, EDF, Engie.",
    ],
    useCase: {
      who: "ETI industrielle de 320 collaborateurs",
      story:
        "8 sites de production exportaient leurs consommations Scope 1 et 2 dans des fichiers Excel hétérogènes. Le module Collecte les a unifiés en 4 jours, sans imposer de nouveau format aux équipes terrain.",
    },
    illustration: "Collecte",
  },
  {
    slug: "calcul",
    title: "Calcul automatique",
    pitch:
      "Calculs Scope 1/2/3 conformes ADEME, IPCC, DEFRA, GHG Protocol. Méthodologie tracée pour chaque indicateur. Mise à jour des facteurs en continu.",
    description:
      "Le moteur de calcul applique automatiquement le bon facteur d'émission selon la donnée d'entrée (kWh, litres, km, €, kg) et la géographie. La méthode (location-based, market-based, hybride) est documentée à la ligne. Les bases ADEME et IPCC sont mises à jour à chaque publication officielle, sans intervention de l'utilisateur.",
    benefits: [
      {
        title: "Conformité méthodologique",
        detail:
          "GHG Protocol, ESRS E1, ISO 14064. Chaque calcul porte la référence de méthode appliquée.",
      },
      {
        title: "Facteurs à jour",
        detail:
          "Synchronisation automatique avec les bases ADEME et IPCC. Historique préservé pour la comparabilité interannuelle.",
      },
      {
        title: "Auditable à la ligne",
        detail:
          "Pour chaque kgCO2e calculé : entrée, facteur, source, méthode, date. Aucune boîte noire.",
      },
    ],
    proofs: [
      "Base ADEME complète (5 200 facteurs en 2026) intégrée et requêtable.",
      "Calculs market-based avec gestion des garanties d'origine et des Power Purchase Agreements.",
      "Recalcul interannuel automatique en cas de mise à jour de méthode (avec versioning).",
    ],
    useCase: {
      who: "Cabinet d'audit RSE intervenant chez 12 ETI",
      story:
        "Avant CarbonCo, 4 jours de re-calcul manuel par client à chaque mise à jour ADEME. Le module Calcul applique la mise à jour en 3 minutes et conserve la version précédente pour la comparabilité.",
    },
    illustration: "Calcul",
  },
  {
    slug: "audit",
    title: "Audit trail",
    pitch:
      "Chaque écriture porte un hash SHA-256 lié au précédent. La chaîne devient infalsifiable. L'OTI vérifie l'intégrité en quelques secondes.",
    description:
      "Toute action — saisie, modification, validation, export — produit une écriture horodatée avec hash cryptographique. La chaîne de hash relie les écritures dans l'ordre chronologique. Une modification ultérieure d'une donnée publiée rompt la chaîne de manière détectable. La structure est append-only : rien n'est jamais effacé, seulement versionné.",
    benefits: [
      {
        title: "Intégrité prouvée",
        detail:
          "Le hash combiné de chaque écriture inclut le contenu, l'auteur, le timestamp et le hash précédent. Détection instantanée de toute altération.",
      },
      {
        title: "Append-only",
        detail:
          "Aucune écriture n'est supprimée. Les corrections sont des écritures additionnelles signées.",
      },
      {
        title: "Vérifiable hors plateforme",
        detail:
          "Le hash racine d'une période publiée peut être recalculé indépendamment par l'auditeur sur l'export brut.",
      },
    ],
    proofs: [
      "Algorithme SHA-256 standard, identique à Git et au socle blockchain.",
      "Stockage chiffré AES-256 avec clés rotatives.",
      "Export ledger complet en JSON pour vérification externe par l'OTI.",
    ],
    useCase: {
      who: "DAF d'une ETI cotée Euronext Growth",
      story:
        "Le commissaire aux comptes a vérifié l'intégrité de 18 mois de données ESG en 22 minutes en recalculant la chaîne de hash sur un échantillon de 50 lignes. Le test précédent (ancien outil) prenait 3 jours.",
    },
    illustration: "Audit",
  },
  {
    slug: "rapport",
    title: "Rapport prêt OTI",
    pitch:
      "Génération automatique du rapport CSRD au format ESRS, avec note méthodologique, tableaux datapoints et signature cryptographique de l'export.",
    description:
      "Le module Rapport assemble en un PDF unique le rapport principal, la note méthodologique annexe, les tableaux ESRS standardisés et le hash de la période publiée. Le format respecte les blocs ESRS 2 (informations générales) et les blocs thématiques activés selon la double matérialité. Les commentaires et arbitrages internes restent confidentiels et n'apparaissent pas dans l'export.",
    benefits: [
      {
        title: "Format ESRS natif",
        detail:
          "Structure conforme aux Actes délégués 2024-2026. Pas de retraitement manuel post-export.",
      },
      {
        title: "Note méthodologique incluse",
        detail:
          "Description des sources, hypothèses, facteurs et taux de couverture pour chaque KPI matériel.",
      },
      {
        title: "Signature de l'export",
        detail:
          "Le PDF inclut le hash racine de la période. L'OTI peut vérifier à tout moment qu'il n'a pas été altéré.",
      },
    ],
    proofs: [
      "Templates rapport CSRD complets — vague 1 et 2.",
      "Export XBRL pour publication réglementaire automatisée.",
      "Versioning des rapports : reproduire à l'identique un rapport antérieur.",
    ],
    useCase: {
      who: "ETI services 410 collaborateurs",
      story:
        "Premier rapport CSRD produit en 14 jours, là où l'estimation initiale du conseil était de 8 semaines. Aucune réserve à l'assurance limitée — note méthodologique jugée 'au-dessus de la moyenne sectorielle'.",
    },
    illustration: "Rapport",
  },
  {
    slug: "scope-1",
    title: "Scope 1 — émissions directes",
    pitch:
      "Combustion stationnaire, combustion mobile, fluides frigorigènes, émissions de procédé. Le Scope 1 maîtrisé en quelques jours.",
    description:
      "Le module Scope 1 collecte les consommations énergétiques directes (gaz naturel, fioul, GPL), les kilométrages de la flotte propre, les fuites de fluides frigorigènes et les émissions de procédé spécifiques (chimie, ciment). Application automatique des PRG IPCC AR6 pour les fluides. Reconciliation avec les factures fournisseurs.",
    benefits: [
      {
        title: "Multi-sites simplifié",
        detail:
          "Chaque site dispose de sa propre saisie, agrégation automatique au niveau groupe avec détail consultable.",
      },
      {
        title: "Fluides frigorigènes",
        detail:
          "Catalogue complet des fluides courants (R32, R410A, R134a...) avec PRG mis à jour automatiquement.",
      },
      {
        title: "Flotte propre",
        detail:
          "Saisie par véhicule (km annuel × consommation moyenne) ou import direct du carnet de bord depuis le gestionnaire de flotte.",
      },
    ],
    proofs: [
      "PRG IPCC AR6 (2021) intégrés pour 50+ fluides frigorigènes.",
      "Réconciliation automatique factures gaz/fioul vs déclarations site.",
      "Détection des anomalies (consommation aberrante vs historique).",
    ],
    useCase: {
      who: "Réseau franchisé de 28 boulangeries",
      story:
        "Calcul Scope 1 consolidé en 6 jours sur 28 sites, là où chaque franchisé saisissait sur un Excel différent. Économie : 18 jours-homme la première année, 22 jours-homme les années suivantes.",
    },
    illustration: "Scope1",
  },
  {
    slug: "scope-2",
    title: "Scope 2 — énergie achetée",
    pitch:
      "Électricité, chaleur, vapeur, froid : double calcul location-based et market-based, gestion des PPA et garanties d'origine, suivi mensuel.",
    description:
      "Le module Scope 2 importe les factures d'électricité, applique automatiquement les facteurs RTE pour le location-based, et gère les attestations de garanties d'origine pour le market-based. Les Power Purchase Agreements sont modélisés explicitement. Le suivi mensuel permet de mesurer l'efficacité des actions de réduction en cours.",
    benefits: [
      {
        title: "Double calcul",
        detail:
          "Location-based (mix réseau) et market-based (instruments contractuels) côte à côte, transparent.",
      },
      {
        title: "PPA et garanties",
        detail:
          "Modélisation des contrats PPA avec validation des critères additionnalité et géographie.",
      },
      {
        title: "Suivi mensuel",
        detail:
          "Saisie ou import mensuel pour piloter l'année en cours, pas seulement reporter l'année passée.",
      },
    ],
    proofs: [
      "Facteur RTE France mis à jour à chaque publication trimestrielle.",
      "Facteurs IEA pour les filiales hors France.",
      "Validation automatique de la conformité des garanties d'origine (millésime, géographie, technologie).",
    ],
    useCase: {
      who: "Éditeur SaaS 80 collaborateurs, multi-cloud",
      story:
        "Calcul Scope 2 incluant les data centers AWS Frankfurt (régional) et OVH Strasbourg (mix français), avec ventilation par service. Visibilité gagnée : identification du service qui pesait 38 % de l'empreinte cloud.",
    },
    illustration: "Scope2",
  },
  {
    slug: "scope-3",
    title: "Scope 3 — chaîne de valeur",
    pitch:
      "15 catégories couvertes, copilote IA pour les hypothèses, calcul mixte primaire/secondaire, identification automatique des catégories matérielles.",
    description:
      "Le module Scope 3 couvre l'intégralité des 15 catégories du GHG Protocol. Le copilote IA propose des hypothèses pour les catégories difficiles (4 — Transport amont, 11 — Utilisation produits) à partir de votre activité et secteur. Calcul hybride : ratios monétaires sur les catégories non matérielles, données primaires fournisseurs sur les catégories matérielles. Score de fiabilité affiché par catégorie.",
    benefits: [
      {
        title: "Couverture intégrale",
        detail:
          "Les 15 catégories sont prêtes à l'emploi avec facteurs ratio par défaut, à raffiner si matérielles.",
      },
      {
        title: "Copilote IA",
        detail:
          "Suggestion d'hypothèses pour catégories complexes, citations ESRS et ADEME, validation utilisateur obligatoire.",
      },
      {
        title: "Score de fiabilité",
        detail:
          "Chaque catégorie affiche son taux de couverture primaire vs secondaire, et l'incertitude associée.",
      },
    ],
    proofs: [
      "Modélisation explicite des 15 catégories avec sous-options par activité.",
      "Facteurs monétaires sectoriels NACE 2-digit.",
      "Module fournisseurs intégré pour les questionnaires Scope 3 catégorie 1.",
    ],
    useCase: {
      who: "Industriel agroalimentaire 5 usines",
      story:
        "Première année : 78 % du Scope 3 calculé en facteurs monétaires (couverture rapide). Année 2 : 41 % en données primaires sur les catégories 1, 4 et 11. L'OTI a salué l'amélioration documentée du taux de couverture primaire.",
    },
    illustration: "Scope3",
  },
  {
    slug: "oti",
    title: "Préparation OTI",
    pitch:
      "Espace dédié à votre commissaire aux comptes : accès lecture, échantillonnage, traçabilité, exports brut. La mission OTI raccourcie de 30 à 50 %.",
    description:
      "Le module OTI ouvre un espace dédié à l'auditeur avec accès lecture seule à toutes les données, l'audit trail complet, les exports bruts en JSON et les recalculs reproductibles. Les questions de l'auditeur sont tracées dans la plateforme. Les exports d'échantillonnage sont générés en quelques secondes. La mission gagne en fluidité, en sérénité et en coût.",
    benefits: [
      {
        title: "Espace auditeur",
        detail:
          "Compte dédié, périmètre lecture seule, journal d'activité auditeur consultable en tant qu'audité.",
      },
      {
        title: "Échantillonnage automatique",
        detail:
          "Génération à la demande d'échantillons aléatoires avec hash de l'échantillonnage pour reproductibilité.",
      },
      {
        title: "Recalculs reproductibles",
        detail:
          "L'auditeur peut re-générer un KPI à une date donnée avec les facteurs de l'époque. Outil clé pour les contrôles d'exactitude.",
      },
    ],
    proofs: [
      "Journal d'activité auditeur immuable consultable en clair.",
      "API d'export brut tous formats (JSON, CSV, XLSX) sans transformation.",
      "Compatibilité Big Four et cabinets indépendants : aucun retour fonctionnel négatif sur 12 missions 2025.",
    ],
    useCase: {
      who: "Cabinet OTI Big Four, mission 2025",
      story:
        "L'équipe d'assurance limitée a réalisé sa mission en 11 jours-homme là où le budget alloué était 18. Verdict : « la traçabilité native nous évite la phase de reconstitution qui est habituellement la plus coûteuse ».",
    },
    illustration: "Oti",
  },
];

export function getProductModule(slug: string): ProductModule | undefined {
  return PRODUCT_MODULES.find((m) => m.slug === slug);
}
