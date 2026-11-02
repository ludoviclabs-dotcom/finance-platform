/**
 * Glossaire ESG — termes techniques expliqués en une phrase, à utiliser via
 * le composant <TermTooltip term="ESRS">ESRS</TermTooltip>.
 *
 * État du droit au 2 novembre 2026 (PLAN_ACTION_CSRD_2026-11, annexe A).
 */

export const GLOSSARY: Record<string, { label: string; definition: string }> = {
  ESRS: {
    label: "ESRS — European Sustainability Reporting Standards",
    definition:
      "Normes européennes de reporting de durabilité, préparées par l'EFRAG et adoptées par la Commission. Les ESRS 2026 (règlement délégué (UE) 2026/1563) sont obligatoires pour les exercices ouverts à compter du 1er janvier 2027.",
  },
  CSRD: {
    label: "CSRD — Corporate Sustainability Reporting Directive",
    definition:
      "Directive européenne 2022/2464, modifiée par la directive (UE) 2026/470 (Omnibus I) : rapport de durabilité pour les entreprises de plus de 1 000 salariés et de plus de 450 M€ de chiffre d'affaires net, vérifié en assurance limitée par un CAC ou un OTI.",
  },
  Scope1: {
    label: "Scope 1 — émissions directes",
    definition:
      "Émissions de GES émises directement par l'entreprise : combustion sur site, flotte, fluides frigorigènes.",
  },
  Scope2: {
    label: "Scope 2 — énergie achetée",
    definition:
      "Émissions indirectes liées à l'électricité, à la chaleur ou à la vapeur achetée et consommée.",
  },
  Scope3: {
    label: "Scope 3 — chaîne de valeur",
    definition:
      "Émissions indirectes amont et aval : achats, transport, usage des produits vendus, fin de vie.",
  },
  OTI: {
    label: "OTI — Organisme Tiers Indépendant",
    definition:
      "Organisme accrédité par le COFRAC et inscrit à la H2A qui peut, comme un commissaire aux comptes, vérifier les informations de durabilité publiées dans le rapport CSRD.",
  },
  CAC: {
    label: "CAC — Commissaire aux comptes",
    definition:
      "Professionnel inscrit à la H2A, habilité à certifier les comptes et, en France, à vérifier les informations de durabilité (assurance limitée), au même titre qu'un OTI.",
  },
  H2A: {
    label: "H2A — Haute autorité de l'audit",
    definition:
      "Autorité française (ex-H3C) qui inscrit les commissaires aux comptes et les OTI habilités à vérifier les informations de durabilité. Elle a publié des lignes directrices en janvier 2026.",
  },
  NormeVolontaire: {
    label: "Norme volontaire (VS, ex-VSME)",
    definition:
      "Norme européenne de reporting volontaire, règlement délégué (UE) 2026/1560, en vigueur depuis le 24 septembre 2026. Chaque point y est « nécessaire », « nécessaire si applicable », « volontaire » ou « information sectorielle à considérer ».",
  },
  PlafondChaineValeur: {
    label: "Plafond de la chaîne de valeur",
    definition:
      "À partir des exercices ouverts au 1er janvier 2027, une entreprise soumise à la CSRD ne peut exiger d'une entreprise de 1 000 salariés ou moins plus que les points « nécessaires » de la norme volontaire, pour la collecte faite au titre de son reporting CSRD (banque, contrat et vigilance non couverts).",
  },
  DoubleMaterialite: {
    label: "Double matérialité",
    definition:
      "Principe ESRS qui combine matérialité d'impact (effets de l'entreprise sur l'environnement) et matérialité financière (effets sur l'entreprise).",
  },
  MixResiduel: {
    label: "Mix résiduel",
    definition:
      "Facteur d'émission de l'électricité non couverte par des garanties d'origine, appliqué au scope 2 market-based sans instrument contractuel. Il est souvent plus carboné que le mix moyen du réseau.",
  },
  CBAM: {
    label: "CBAM — Carbon Border Adjustment Mechanism",
    definition:
      "Mécanisme d'ajustement carbone aux frontières de l'UE qui taxe les importations des secteurs intensifs en carbone.",
  },
  DPP: {
    label: "DPP — Digital Product Passport",
    definition:
      "Passeport numérique de produit imposé par le règlement ESPR : composition, durabilité, recyclabilité.",
  },
  ADEME: {
    label: "ADEME — Base Empreinte®",
    definition:
      "Base de données française de référence pour les facteurs d'émission (anciennement Base Carbone®).",
  },
  AuditTrail: {
    label: "Audit trail",
    definition:
      "Journal en ajout seul de toutes les opérations sur les données (qui, quand, comment, avec quel résultat), où toute modification devient détectable (tamper-evident).",
  },
  TamperEvident: {
    label: "Tamper-evident (modification détectable)",
    definition:
      "Propriété d'un journal dont toute modification après coup devient détectable, sans être empêchée. Elle prouve l'intégrité, pas l'exactitude ni l'exhaustivité des données.",
  },
  SHA256: {
    label: "SHA-256",
    definition:
      "Algorithme de hash cryptographique. Utilisé pour calculer l'empreinte de chaque ligne de l'audit trail et rendre toute altération détectable. Une empreinte n'est pas une signature : elle n'identifie pas son auteur.",
  },
};

export type GlossaryTerm = keyof typeof GLOSSARY;

export function getDefinition(term: string): { label: string; definition: string } | null {
  return GLOSSARY[term as GlossaryTerm] ?? null;
}
