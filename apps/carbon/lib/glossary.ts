/**
 * Glossaire ESG — termes techniques expliqués en une phrase, à utiliser via
 * le composant <TermTooltip term="ESRS">ESRS</TermTooltip>.
 */

export const GLOSSARY: Record<string, { label: string; definition: string }> = {
  ESRS: {
    label: "ESRS — European Sustainability Reporting Standards",
    definition:
      "Standards européens de reporting de durabilité publiés par l'EFRAG. 12 normes couvrant climat, pollution, biodiversité, droits humains, gouvernance.",
  },
  CSRD: {
    label: "CSRD — Corporate Sustainability Reporting Directive",
    definition:
      "Directive européenne 2022/2464 imposant aux grandes entreprises de publier un reporting de durabilité audité par un OTI.",
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
      "Auditeur accrédité COFRAC qui vérifie les informations de durabilité publiées dans le rapport CSRD.",
  },
  DoubleMaterialite: {
    label: "Double matérialité",
    definition:
      "Principe ESRS qui combine matérialité d'impact (effets de l'entreprise sur l'environnement) et matérialité financière (effets sur l'entreprise).",
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
      "Trace immuable de toutes les opérations sur les données : qui, quand, comment, avec quel résultat.",
  },
  SHA256: {
    label: "SHA-256",
    definition:
      "Algorithme de hash cryptographique. Utilisé pour signer chaque ligne de l'audit trail et détecter toute altération.",
  },
};

export type GlossaryTerm = keyof typeof GLOSSARY;

export function getDefinition(term: string): { label: string; definition: string } | null {
  return GLOSSARY[term as GlossaryTerm] ?? null;
}
