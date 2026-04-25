export type InsuranceMktAgentSlug =
  | "insur-simplifier"
  | "dda-marketing-guard"
  | "multi-channel-insur"
  | "prevention-content";

export type InsuranceMktVerdict = "OK" | "WARN" | "KO";

export interface InsuranceMktAgent {
  id: string;
  slug: InsuranceMktAgentSlug;
  name: string;
  owner: string;
  mission: string;
  primaryRule: string;
  workbook: string;
  kpis: string[];
}

export interface InsuranceMktSource {
  id: string;
  authority: string;
  domain: string;
  title: string;
  date: string;
  impact: string;
}

export interface InsuranceMktScenario {
  id: string;
  agentSlug: InsuranceMktAgentSlug;
  label: string;
  inputLine: string;
  verdict: InsuranceMktVerdict;
  summary: string;
  metrics: Array<{ label: string; before: string; after: string }>;
}

export interface InsuranceMktService {
  id: string;
  name: string;
  mission: string;
}

export const INSURANCE_MKT_SUMMARY = {
  agents: 4,
  workbooks: 5,
  rules: 12,
  scenarios: 18,
  sourceDate: "25/04/2026",
} as const;

export const INSURANCE_MKT_AGENTS: InsuranceMktAgent[] = [
  {
    id: "IM-A001",
    slug: "insur-simplifier",
    name: "InsurSimplifier",
    owner: "Lecture client / Juridique",
    mission:
      "Vulgariser les clauses CGV, CGU et IPID au niveau B1-B2, calculer le score Flesch FR et générer un glossaire des termes techniques.",
    primaryRule: "RULE-CLARTE-FLESCH",
    workbook: "InsurSimplifier_NEURAL.xlsx",
    kpis: ["Flesch FR > 50", "% glossaire > 90%", "Réduction longueur"],
  },
  {
    id: "IM-A002",
    slug: "dda-marketing-guard",
    name: "DDA_MarketingGuard",
    owner: "Compliance / Marketing",
    mission:
      "Auditer les communications marketing contre 12 points DDA + Acte délégué clarté + ACPR + AI Act art. 50, et délivrer un verdict DIFFUSION OK / RELECTURE / BLOQUÉ.",
    primaryRule: "RULE-DDA-12POINTS",
    workbook: "DDA_MarketingGuard_NEURAL.xlsx",
    kpis: ["Score conformité", "Nb KO bloquants", "% diffusion 1er passage"],
  },
  {
    id: "IM-A003",
    slug: "multi-channel-insur",
    name: "MultiChannelInsur",
    owner: "Marketing canal",
    mission:
      "Décliner un brief commercial sur 4 canaux — agent général, courtier, direct/digital, comparateur — avec mentions légales adaptées et compliance DSA/DMA pour les comparateurs.",
    primaryRule: "RULE-CANAL-COHERENCE",
    workbook: "MultiChannelInsur_NEURAL.xlsx",
    kpis: ["Score adaptation canal", "Conformité DSA", "Cohérence brand voice"],
  },
  {
    id: "IM-A004",
    slug: "prevention-content",
    name: "PreventionContent",
    owner: "Prévention / DPO",
    mission:
      "Détecter les patterns claim avoidance + auditer la collecte de données sensibles (RGPD art. 9), et reformuler les contenus prévention pour les rendre conformes.",
    primaryRule: "RULE-CLAIMGUARD-RGPD",
    workbook: "PreventionContent_NEURAL.xlsx",
    kpis: ["Score ClaimGuard", "Score RGPD art. 9", "DPIA findings"],
  },
];

export const INSURANCE_MKT_SOURCES: InsuranceMktSource[] = [
  {
    id: "IM-S001",
    authority: "UE",
    domain: "Distribution assurance",
    title: "Directive Distribution Assurance (DDA) — UE 2016/97",
    date: "20/01/2016",
    impact:
      "Cadre des obligations de conseil, identification du distributeur, IPID, recueil des besoins, transparence rémunération.",
  },
  {
    id: "IM-S002",
    authority: "UE",
    domain: "Clarté contractuelle",
    title: "Acte délégué clarté contractuelle — UE 2024/879",
    date: "15/03/2024",
    impact:
      "Niveau de lisibilité requis sur les CGV et IPID assurance — score Flesch FR cible et glossaire obligatoire.",
  },
  {
    id: "IM-S003",
    authority: "UE",
    domain: "Marchés numériques",
    title: "Digital Services Act (DSA) — UE 2022/2065",
    date: "27/10/2022",
    impact:
      "Mentions obligatoires comparateurs : rémunération, panel, non-exhaustivité, critères de classement, publicité identifiée (art. 22-26).",
  },
  {
    id: "IM-S004",
    authority: "UE",
    domain: "Intelligence artificielle",
    title: "EU AI Act — UE 2024/1689 art. 50",
    date: "12/07/2024",
    impact:
      "Disclosure obligatoire des systèmes IA pour les comparateurs et tout scoring automatisé — applicable août 2026.",
  },
  {
    id: "IM-S005",
    authority: "UE",
    domain: "Protection des données",
    title: "RGPD — UE 2016/679 art. 6, 9, 22, 30, 35",
    date: "27/04/2016",
    impact:
      "Données de santé (art. 9) = consentement explicite, DPIA pour traitements à risque (art. 35), registre traitements (art. 30).",
  },
  {
    id: "IM-S006",
    authority: "ACPR",
    domain: "Recommandation publicité",
    title: "ACPR Reco 2024-R-01 — Pratiques commerciales assurance",
    date: "12/04/2024",
    impact:
      "Recommandation sur les communications publicitaires assurance : clarté, non-tromperie, mentions ORIAS, équilibre des bénéfices/limites.",
  },
  {
    id: "IM-S007",
    authority: "France",
    domain: "Code des assurances",
    title: "Code des assurances L.521-2 à L.521-5",
    date: "01/10/2018",
    impact:
      "Devoir de conseil, identification du distributeur, recueil des exigences et besoins, IPID — transposition DDA.",
  },
  {
    id: "IM-S008",
    authority: "France",
    domain: "Pratiques commerciales",
    title: "Code de la consommation L.121-1 à L.121-5",
    date: "01/07/2014",
    impact:
      "Sanction des pratiques commerciales trompeuses — applicable aux clauses claim avoidance présentant des exclusions non contractuelles.",
  },
  {
    id: "IM-S009",
    authority: "France",
    domain: "Résiliation infra-annuelle",
    title: "Loi Lemoine — Loi 2022-270",
    date: "28/02/2022",
    impact:
      "Résiliation infra-annuelle des contrats santé après 1 an — mention obligatoire dans toutes les communications santé.",
  },
];

export const INSURANCE_MKT_SCENARIOS: InsuranceMktScenario[] = [
  {
    id: "SCN-IM-001",
    agentSlug: "insur-simplifier",
    label: "Clause exclusion auto — niveau juridique",
    inputLine:
      "« Les dommages consécutifs à un usage non conforme au contrat ne donnent pas lieu à indemnisation, sauf si la non-conformité résulte d'un cas fortuit excluant la faute lourde. »",
    verdict: "WARN",
    summary:
      "Score Flesch initial 18/100 (niveau M2 droit). Réécriture B1-B2 : « Si vous utilisez votre voiture autrement que prévu au contrat, les dégâts ne sont pas remboursés — sauf cas particulier. » Glossaire ajouté : « cas fortuit », « faute lourde ».",
    metrics: [
      { label: "Flesch FR", before: "18", after: "62" },
      { label: "Mots", before: "32", after: "21" },
      { label: "Termes glossaire", before: "0", after: "2" },
    ],
  },
  {
    id: "SCN-IM-002",
    agentSlug: "dda-marketing-guard",
    label: "Email auto — promo bonus",
    inputLine:
      "« Profitez de votre bonus 0.50 ! Tarif imbattable garanti — souscrivez en 5 minutes sans paperasse. »",
    verdict: "KO",
    summary:
      "3 KO bloquants : (1) « tarif imbattable » = pratique trompeuse L.121-1, (2) absence ORIAS, (3) absence IPID accessible. Décision : BLOQUÉ. 5 redlines proposées avant rediffusion.",
    metrics: [
      { label: "Conformité DDA", before: "33%", after: "92%" },
      { label: "KO bloquants", before: "3", after: "0" },
      { label: "Redlines", before: "—", after: "5" },
    ],
  },
  {
    id: "SCN-IM-003",
    agentSlug: "multi-channel-insur",
    label: "Brief MRH locataire Paris × 4 canaux",
    inputLine:
      "Brief : MRH locataire T3 Paris, mobilier 35 000 €, RC locative + dégâts des eaux + vol. Premier mois offert jusqu'au 30/06.",
    verdict: "OK",
    summary:
      "4 variantes générées (Agent général, Courtier, Direct, Comparateur). Score adaptation moyen 91. Variante Comparateur enrichie des mentions DSA art. 22-26 (rémunération, panel 19 assureurs, non-exhaustivité, critères classement, label « Promotion »).",
    metrics: [
      { label: "Variantes", before: "1", after: "4" },
      { label: "Score adaptation", before: "—", after: "91" },
      { label: "Conformité DSA", before: "—", after: "97" },
    ],
  },
  {
    id: "SCN-IM-004",
    agentSlug: "prevention-content",
    label: "Newsletter santé senior — questionnaire",
    inputLine:
      "« Complétez votre questionnaire de santé annuel avant le 31 mars. Ce questionnaire est obligatoire pour le maintien de votre formule dentaire Premium. »",
    verdict: "KO",
    summary:
      "ClaimGuard : KO sur le lien questionnaire ↔ maintien garantie (illégal L.112-3). RGPD : KO sur consentement art. 9 absent + durée 10 ans non justifiée. Réécriture : questionnaire facultatif, consentement explicite séparé, durée 2 ans.",
    metrics: [
      { label: "Score ClaimGuard", before: "28", after: "91" },
      { label: "Score RGPD", before: "15", after: "78" },
      { label: "Findings KO", before: "4", after: "0" },
    ],
  },
];

export const INSURANCE_MKT_SERVICES: InsuranceMktService[] = [
  {
    id: "IM-S005",
    name: "RegWatch Marketing",
    mission:
      "Veille active DDA, Acte délégué clarté, AI Act art. 50, ACPR Reco — mise à jour du référentiel des 12 points et alertes sur évolutions.",
  },
  {
    id: "IM-S006",
    name: "EvidenceGuard Marketing",
    mission:
      "Conservation des preuves pour chaque verdict agent : input, output, gates franchies, sources légales mappées — pack défendable signé SHA-256.",
  },
];

export const INSURANCE_MKT_WORKBOOKS = [
  "InsurSimplifier_NEURAL.xlsx",
  "DDA_MarketingGuard_NEURAL.xlsx",
  "MultiChannelInsur_NEURAL.xlsx",
  "PreventionContent_NEURAL.xlsx",
  "Assurance_Marketing_OVERVIEW_NEURAL.xlsx",
] as const;

const PROBLEMS_DATA: Array<{
  problem: string;
  solution: string;
  agent: string;
}> = [
  {
    problem: "Clauses contractuelles illisibles",
    solution:
      "InsurSimplifier vulgarise CGV, CGU et IPID au niveau B1-B2 et produit un glossaire des termes techniques.",
    agent: "IM-A001",
  },
  {
    problem: "Communications marketing non conformes DDA",
    solution:
      "DDA_MarketingGuard audite chaque communication contre 12 points DDA + ACPR + AI Act et bloque les KO avant diffusion.",
    agent: "IM-A002",
  },
  {
    problem: "Discours commercial inadapté par canal",
    solution:
      "MultiChannelInsur décline un brief unique sur 4 canaux avec registres et mentions légales adaptés (DSA pour comparateurs).",
    agent: "IM-A003",
  },
  {
    problem: "Contenus prévention non RGPD ou claim avoidance",
    solution:
      "PreventionContent détecte les patterns décourageant la déclaration de sinistre et audite la collecte de données sensibles art. 9.",
    agent: "IM-A004",
  },
];

export const INSURANCE_MKT_PROBLEMS = PROBLEMS_DATA;
