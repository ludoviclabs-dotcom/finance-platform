/**
 * Catalogue des intégrations CarbonCo (ERP, comptabilité, énergie, RH).
 *
 * Source de vérité unique pour la page /integrations.
 *
 * Statut "live" = connecteur opérationnel. "beta" = en cours de validation
 * partenaire. "soon" = sur roadmap, contact commercial requis.
 */

export type IntegrationStatus = "live" | "beta" | "soon";
export type IntegrationCategory = "ERP" | "Comptabilité" | "Énergie" | "RH" | "Cloud";

export interface Integration {
  id: string;
  name: string;
  vendor: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  pitch: string;
  what: string[];
  authMethod: "OAuth 2.0" | "API Key" | "API Key + IP whitelist";
  setupTime: string;
}

export const INTEGRATIONS: Integration[] = [
  // —— ERP ——
  {
    id: "sage",
    name: "Sage 100 / X3",
    vendor: "Sage",
    category: "ERP",
    status: "live",
    pitch: "Achats, immobilisations, déplacements, factures fournisseurs énergie. Connecteur natif Sage 100 et Sage X3.",
    what: [
      "Import achats par compte général (catégorie 1, 2, 4 du Scope 3)",
      "Import factures énergie pour Scope 1 & 2",
      "Lecture des immobilisations pour catégorie 8 (actifs loués amont)",
      "Synchronisation incrémentale toutes les 6 heures",
    ],
    authMethod: "API Key + IP whitelist",
    setupTime: "30 minutes",
  },
  {
    id: "cegid",
    name: "Cegid Loop",
    vendor: "Cegid",
    category: "ERP",
    status: "live",
    pitch: "ERP français leader chez les ETI. Lecture comptabilité analytique et factures fournisseurs.",
    what: [
      "Mapping plan comptable → catégories Scope 3",
      "Import factures fournisseurs énergie validées",
      "Reconciliation avec les déclarations site terrain",
      "Webhook événementiel pour les nouvelles factures",
    ],
    authMethod: "OAuth 2.0",
    setupTime: "45 minutes",
  },
  {
    id: "sap-s4",
    name: "SAP S/4HANA",
    vendor: "SAP",
    category: "ERP",
    status: "live",
    pitch: "Pour les groupes multi-sites. Intégration native via OData et BAPI. Compatible SAP Business One.",
    what: [
      "Lecture multi-sociétés et multi-devises",
      "Import des centres de coût pour ventilation Scope par site",
      "Synchronisation bidirectionnelle des indicateurs ESG",
      "Support SAP HANA Cloud et SAP On-Premise",
    ],
    authMethod: "OAuth 2.0",
    setupTime: "2 heures",
  },
  {
    id: "dynamics-365",
    name: "Microsoft Dynamics 365",
    vendor: "Microsoft",
    category: "ERP",
    status: "beta",
    pitch: "Connecteur Dynamics 365 Finance & Operations en validation partenaire 2026 Q2.",
    what: [
      "Import achats avec ventilation par centre de profit",
      "Lecture flotte automobile et déplacements professionnels",
      "Module RH pour les indicateurs sociaux ESRS S1",
      "Compatible Dynamics 365 Business Central",
    ],
    authMethod: "OAuth 2.0",
    setupTime: "1 heure",
  },

  // —— Comptabilité ——
  {
    id: "pennylane",
    name: "Pennylane",
    vendor: "Pennylane",
    category: "Comptabilité",
    status: "live",
    pitch: "Solution de comptabilité collaborative. Connecteur idéal pour les ETI sans ERP propre.",
    what: [
      "Import factures fournisseurs énergie pré-catégorisées",
      "Mapping automatique plan comptable général",
      "OCR factures pour les justificatifs PDF",
    ],
    authMethod: "OAuth 2.0",
    setupTime: "15 minutes",
  },
  {
    id: "qonto",
    name: "Qonto",
    vendor: "Qonto",
    category: "Comptabilité",
    status: "live",
    pitch: "Néobanque pro avec API ouverte. Lecture des transactions catégorisées pour estimer les achats.",
    what: [
      "Lecture transactions par catégorie",
      "Export complémentaire pour audit",
      "Webhook nouvelles transactions",
    ],
    authMethod: "OAuth 2.0",
    setupTime: "10 minutes",
  },

  // —— Énergie ——
  {
    id: "edf",
    name: "EDF Entreprises",
    vendor: "EDF",
    category: "Énergie",
    status: "live",
    pitch: "Récupération automatique des consommations et factures électricité. Métadonnées garanties d'origine pour le market-based.",
    what: [
      "Consommations 30 minutes par PDL pour les sites avec compteur Linky pro",
      "Factures mensuelles avec TVA et coefficients PRG",
      "Attestations garanties d'origine pour le calcul market-based",
      "Multi-sites avec consolidation automatique",
    ],
    authMethod: "API Key + IP whitelist",
    setupTime: "30 minutes",
  },
  {
    id: "engie",
    name: "Engie Pro",
    vendor: "Engie",
    category: "Énergie",
    status: "live",
    pitch: "Gaz naturel, électricité verte, réseau de chaleur. Tous les usages couverts.",
    what: [
      "Consommations gaz par site",
      "Contrats électricité verte avec attestations",
      "Réseau de chaleur urbain (Scope 2 vapeur)",
    ],
    authMethod: "API Key",
    setupTime: "30 minutes",
  },
  {
    id: "totalenergies",
    name: "TotalEnergies",
    vendor: "TotalEnergies",
    category: "Énergie",
    status: "beta",
    pitch: "Cartes carburant flotte + électricité + gaz. Connecteur unifié 2026 Q2.",
    what: [
      "Cartes carburant flotte (Scope 1 mobilité)",
      "Bornes de recharge VE",
      "Stations service hydrogène (en pilote)",
    ],
    authMethod: "OAuth 2.0",
    setupTime: "45 minutes",
  },

  // —— Cloud / Tech ——
  {
    id: "aws",
    name: "AWS Carbon Footprint",
    vendor: "Amazon Web Services",
    category: "Cloud",
    status: "live",
    pitch: "Empreinte cloud par compte AWS, par région et par service. Calcul automatique du Scope 2 cloud.",
    what: [
      "Empreinte par compte/région/service",
      "Détail mensuel sur 12 mois glissants",
      "Mapping automatique vers ESRS E1",
    ],
    authMethod: "OAuth 2.0",
    setupTime: "20 minutes",
  },
  {
    id: "gcp",
    name: "Google Cloud Carbon",
    vendor: "Google Cloud",
    category: "Cloud",
    status: "live",
    pitch: "Carbon footprint API native GCP avec ventilation par projet et par service.",
    what: [
      "Empreinte par projet GCP",
      "Détail BigQuery, Compute Engine, Cloud Storage",
      "Comparaison régions pour optimisation",
    ],
    authMethod: "OAuth 2.0",
    setupTime: "20 minutes",
  },

  // —— RH ——
  {
    id: "lucca",
    name: "Lucca",
    vendor: "Lucca",
    category: "RH",
    status: "soon",
    pitch: "Suite RH SaaS française. Indicateurs sociaux ESRS S1 (effectifs, turnover, rémunération).",
    what: [
      "Effectifs CDI/CDD par site",
      "Turnover et ancienneté moyenne",
      "Pyramide des âges et parité",
      "Indicateurs ESRS S1 et S4",
    ],
    authMethod: "OAuth 2.0",
    setupTime: "1 heure",
  },
];

export function getIntegration(id: string): Integration | undefined {
  return INTEGRATIONS.find((i) => i.id === id);
}

export function getIntegrationsByCategory(): Record<IntegrationCategory, Integration[]> {
  return INTEGRATIONS.reduce(
    (acc, i) => {
      (acc[i.category] ??= []).push(i);
      return acc;
    },
    {} as Record<IntegrationCategory, Integration[]>
  );
}
