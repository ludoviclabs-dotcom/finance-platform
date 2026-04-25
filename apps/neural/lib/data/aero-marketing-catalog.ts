export type AeroMktAgentSlug =
  | "aero-tech-content"
  | "defense-comms-guard"
  | "aero-event-ai"
  | "aero-sustainability-comms";

export type AeroMktVerdict = "OK" | "WARN" | "KO";

export interface AeroMktAgent {
  id: string;
  slug: AeroMktAgentSlug;
  name: string;
  owner: string;
  mission: string;
  primaryRule: string;
  workbook: string;
  kpis: string[];
}

export interface AeroMktSource {
  id: string;
  authority: string;
  domain: string;
  title: string;
  date: string;
  impact: string;
}

export interface AeroMktScenario {
  id: string;
  agentSlug: AeroMktAgentSlug;
  label: string;
  inputLine: string;
  verdict: AeroMktVerdict;
  summary: string;
  metrics: Array<{ label: string; before: string; after: string }>;
}

export interface AeroMktService {
  id: string;
  name: string;
  mission: string;
}

export const AERO_MKT_SUMMARY = {
  agents: 4,
  workbooks: 5,
  rules: 44,
  scenarios: 19,
  sourceDate: "25/04/2026",
} as const;

export const AERO_MKT_AGENTS: AeroMktAgent[] = [
  {
    id: "AM-A001",
    slug: "aero-tech-content",
    name: "AeroTechContent",
    owner: "Marketing technique / Bureau d'études",
    mission:
      "Auditer les contenus marketing aéro B2B (white papers, fiches techniques, RFP, brochures salons) avant diffusion : sources actives, chiffres validés, mention DGA, anti-greenwashing, mention cyber, flag export.",
    primaryRule: "RULE-NUM-VALIDATED",
    workbook: "AeroTechContent_NEURAL.xlsx",
    kpis: ["Score qualité > 80%", "% chiffres sourcés 100%", "Time-to-pitch < 5j"],
  },
  {
    id: "AM-A002",
    slug: "defense-comms-guard",
    name: "DefenseCommsGuard",
    owner: "Compliance Export-Control",
    mission:
      "Auditer toute communication marketing contre 12 règles export-control + sanctions consolidées : ITAR (US 22 CFR 120-130), EAR (15 CFR 730-774), EU dual-use Reg. 2021/821, France L.2335-1 LMG, OFAC SDN, EU 16e paquet sanctions, UK OFSI, AUKUS OGL, FDPR drones, AI Act art. 50, ASD Charter.",
    primaryRule: "RULE-EXPORT-AWARE",
    workbook: "DefenseCommsGuard_NEURAL.xlsx",
    kpis: ["Nb KO bloquants 0", "Score conformité > 85%", "Sanctions screening 1500/mois"],
  },
  {
    id: "AM-A003",
    slug: "aero-event-ai",
    name: "AeroEventAI",
    owner: "Événementiel / DirCom",
    mission:
      "Générer et auditer des packs événementiels (briefs presse, posts social, talking points VIP) pour les 4 salons aéro/défense majeurs Q2-Q4 2026 : ILA Berlin (juin), Eurosatory (juin), Farnborough (juillet), MEBAA (décembre). Tonalité ASD + AI Act + multi-fuseau + multi-langue.",
    primaryRule: "RULE-ASD-RESPONSIBLE",
    workbook: "AeroEventAI_NEURAL.xlsx",
    kpis: ["Score adaptation > 85%", "Couverture 8 salons/an", "Multi-langue EN/FR/DE/AR"],
  },
  {
    id: "AM-A004",
    slug: "aero-sustainability-comms",
    name: "AeroSustainabilityComms",
    owner: "ESG / Responsable RSE signataire CSRD",
    mission:
      "Auditer les claims SAF / hydrogène / électrique / eVTOL / compensation carbone vs Green Claims Directive 2024 + Loi Climat & Résilience FR + ReFuelEU Aviation + CSRD ESRS E1 + EASA Decision 2024/015. Détection greenwashing avant diffusion + cohérence reporting.",
    primaryRule: "RULE-LCA-EVIDENCE",
    workbook: "AeroSustainabilityComms_NEURAL.xlsx",
    kpis: ["% claims sans LCA 0", "Score Green Claims > 80%", "Cohérence ESRS E1 100%"],
  },
];

export const AERO_MKT_SOURCES: AeroMktSource[] = [
  {
    id: "AM-S001",
    authority: "US",
    domain: "Export Control",
    title: "ITAR — International Traffic in Arms Regulations",
    date: "Révision 22 CFR janv 2026",
    impact:
      "Cat. VIII (aircraft military), Cat. XV (spacecraft) — licences DDTC obligatoires, AUKUS Pillar II OGL pour US/UK/AU.",
  },
  {
    id: "AM-S002",
    authority: "US",
    domain: "Export Control",
    title: "EAR — Export Administration Regulations + Entity List + FDPR drones",
    date: "Update mars 2026",
    impact:
      "ECCN 9A610/9A619 aéronefs militaires, FDPR étendue drones 2025, Entity List ajouts mars 2026 (37 entités chinoises).",
  },
  {
    id: "AM-S003",
    authority: "UE",
    domain: "Dual-use",
    title: "Règlement UE 2021/821 — contrôles dual-use",
    date: "01/09/2021",
    impact:
      "Annexe I : radars, optronique, propulsion, cyber. Licence EU export obligatoire avant transfert hors UE.",
  },
  {
    id: "AM-S004",
    authority: "France",
    domain: "Code défense",
    title: "Code de la défense L.2335-1 LMG + LPM 2024-2030",
    date: "Loi 2023-703",
    impact:
      "Matériels de guerre (LMG) : agréments AT/IDP/AGI obligatoires. LPM 413 Md EUR programmation. Décret 2024-1167 simplifie licences globales.",
  },
  {
    id: "AM-S005",
    authority: "UE",
    domain: "Sanctions",
    title: "EU sanctions packages — Russie 16e paquet, Iran, Belarus, NK",
    date: "fév 2026",
    impact:
      "Reg. 833/2014 + 16e paquet Russie fév 2026 + Reg. 2023/1529 Iran. Annexe XXIII = produits aéronautiques restreints.",
  },
  {
    id: "AM-S006",
    authority: "UE",
    domain: "Intelligence artificielle",
    title: "EU AI Act — UE 2024/1689 art. 50",
    date: "Applicable 02/08/2026",
    impact:
      "Disclosure obligatoire de tout contenu marketing IA-généré. Sanctions jusqu'à 15 M EUR / 3% CA mondial. Concerne les 4 agents Aéro/Marketing.",
  },
  {
    id: "AM-S007",
    authority: "UE",
    domain: "Greenwashing",
    title: "EU Green Claims Directive 2024 + Loi Climat & Résilience FR",
    date: "Adoptée mars 2024 — transposition 2026",
    impact:
      "Claims « neutre carbone », « vert », « propre » INTERDITS sans LCA + compensation registre certifié. Sanctions DGCCRF jusqu'à 4% CA.",
  },
  {
    id: "AM-S008",
    authority: "UE",
    domain: "Aviation durable",
    title: "ReFuelEU Aviation — Reg. UE 2023/2405",
    date: "13/10/2023",
    impact:
      "Trajectoire SAF : 2% en 2025, 6% en 2030, 70% en 2050. Type SAF (HEFA/ATJ/PtL) + fournisseur ISCC EU obligatoire dans claims.",
  },
  {
    id: "AM-S009",
    authority: "UE",
    domain: "CSRD",
    title: "Directive CSRD UE 2022/2464 + ESRS E1 Climate change",
    date: "Obligatoire 2025 grandes entreprises aéro",
    impact:
      "Reporting climat ESRS E1 obligatoire pour Airbus, Safran, Thales, Dassault. Cohérence claim marketing ↔ rapport CSRD requise.",
  },
  {
    id: "AM-S010",
    authority: "ASD Europe",
    domain: "Tonalité défense",
    title: "ASD Europe — Charter on Responsible Defence Communications",
    date: "mars 2025",
    impact:
      "Pas de glorification, pas de visuel choquant, contexte stratégique sourcé, pas de mention spécifique opérations en cours. Volontaire mais critique réputationnel post-Ukraine.",
  },
  {
    id: "AM-S011",
    authority: "UE",
    domain: "Cybersécurité",
    title: "NIS2 (Décret FR 2024-1308) + DORA Reg. UE 2022/2554",
    date: "DORA applicable 17/01/2025",
    impact:
      "Mention NIS2/DORA obligatoire pour systèmes embarqués critiques + sous-traitants ICT aéro/défense. Certification CC EAL ou SecNumCloud requise.",
  },
  {
    id: "AM-S012",
    authority: "UE",
    domain: "Financement défense",
    title: "EDIP + EDF + EDIRPA + ASAP — EU Defence Industrial Strategy",
    date: "EDIP Reg. UE 2025/588 (mars 2025)",
    impact:
      "Si projet financé EU : mention obligatoire programme + % cofinancement. EDIP 1.5 Md EUR, EDF 8 Md EUR, ASAP étendu 2026.",
  },
];

export const AERO_MKT_SCENARIOS: AeroMktScenario[] = [
  {
    id: "SCN-AM-001",
    agentSlug: "aero-tech-content",
    label: "White paper drone surveillance — claims marketing greenwashing",
    inputLine:
      "« Notre famille de mini-drones surveillance offre une autonomie révolutionnaire de 6 heures, charge utile 2,5 kg, signature radar quasi-nulle. La technologie de propulsion électrique 100% verte garantit zéro émission de CO2. »",
    verdict: "KO",
    summary:
      "Score qualité initial 55%. 3 KO : (1) « 100% verte » + « zéro émission cycle complet » = greenwashing (Green Claims Directive), (2) chiffres « révolutionnaire 6h » non sourcés (R02), (3) absence disclosure IA art. 50. 5 redlines proposées.",
    metrics: [
      { label: "Score qualité", before: "55%", after: "92%" },
      { label: "KO bloquants", before: "3", after: "0" },
      { label: "Redlines", before: "—", after: "5" },
    ],
  },
  {
    id: "SCN-AM-002",
    agentSlug: "defense-comms-guard",
    label: "Email B2B prospection drone tactique vers Iran",
    inputLine:
      "« Cher prospect, suite à vos échanges au salon Dubai Airshow, nous proposons notre drone tactique mini (autonomie 6h, charge 2,5 kg). Notre commercial Téhéran peut planifier une démo. Tarif 85 K€, exempt de TVA pour export. »",
    verdict: "KO",
    summary:
      "Score conformité 46%. 4 KO bloquants : (1) Iran sous sanctions OFAC SDN + EU Reg. 2023/1529 — envoi interdit, (2) drone tactique = ECCN 9A619 sous EAR, (3) caméra EO/IR = annexe I Reg. 2021/821, (4) cohérent licences DGA absente. Décision : BLOQUÉ.",
    metrics: [
      { label: "Conformité export", before: "46%", after: "—" },
      { label: "KO bloquants", before: "4", after: "0" },
      { label: "Décision", before: "—", after: "BLOQUÉ" },
    ],
  },
  {
    id: "SCN-AM-003",
    agentSlug: "aero-event-ai",
    label: "Pack événementiel Farnborough 2026 — propulsion hybride régionale",
    inputLine:
      "Brief : annoncer démonstrateur hybride-électrique régional. EMBARGO 20/07/2026 06:00 BST. Vol démonstration 21 juillet. Premier client UK identifié.",
    verdict: "OK",
    summary:
      "Pack généré pour Farnborough 2026 (20-24 juillet) : 1 brief presse EN + 5 posts LinkedIn EN/FR/DE + talking points VIP. Score adaptation 75% en v1 (BLOQUÉ AI Act manquant). Après redlines : disclosure IA ajoutée + précision LCA + version FR/DE = 92%.",
    metrics: [
      { label: "Score adaptation", before: "75%", after: "92%" },
      { label: "Variantes langues", before: "1 (EN)", after: "3 (EN/FR/DE)" },
      { label: "Décision", before: "BLOQUÉ", after: "DIFFUSION OK" },
    ],
  },
  {
    id: "SCN-AM-004",
    agentSlug: "aero-sustainability-comms",
    label: "Campagne SAF 50% blend long-courrier — claims ESG",
    inputLine:
      "« Notre nouveau service Paris-Singapour est désormais opéré avec carburant durable d'aviation 50% (SAF blend). Engagement neutralité carbone d'ici 2030. »",
    verdict: "KO",
    summary:
      "Score 41%. 4 KO bloquants : (1) « neutralité carbone 2030 » sans plan + compensation registre = interdit (Green Claims Directive art. 5), (2) « SAF blend 50% » sans type ni fournisseur ISCC EU, (3) périmètre LCA absent (WtT/TtW/WtW), (4) « plus propre » terme vague. Risque sanction DGCCRF jusqu'à 4% CA.",
    metrics: [
      { label: "Score Green Claims", before: "41%", after: "85%" },
      { label: "KO bloquants", before: "4", after: "0" },
      { label: "Risque DGCCRF", before: "ÉLEVÉ", after: "FAIBLE" },
    ],
  },
];

export const AERO_MKT_SERVICES: AeroMktService[] = [
  {
    id: "AM-SR001",
    name: "AeroRegWatch_Marketing",
    mission:
      "Veille active des sources réglementaires (ITAR DDTC, EAR BIS, EU Sanctions, OFAC SDN, EASA, Green Claims Directive, ReFuelEU, CSRD ESRS E1) — mise à jour du référentiel et alertes sur évolutions impactant les 4 agents.",
  },
  {
    id: "AM-SR002",
    name: "AeroEvidenceGuard_Marketing",
    mission:
      "Conservation des preuves pour chaque verdict agent : input, output, gates franchies, sources légales mappées — pack défendable signé SHA-256 conservé pour audits ultérieurs (DGA, DGCCRF, EASA, OFAC).",
  },
];

export const AERO_MKT_WORKBOOKS = [
  "AeroTechContent_NEURAL.xlsx",
  "DefenseCommsGuard_NEURAL.xlsx",
  "AeroEventAI_NEURAL.xlsx",
  "AeroSustainabilityComms_NEURAL.xlsx",
  "Aero_Marketing_OVERVIEW_NEURAL.xlsx",
] as const;

const PROBLEMS_DATA: Array<{
  problem: string;
  solution: string;
  agent: string;
}> = [
  {
    problem: "Contenus marketing techniques non sourcés ou trompeurs",
    solution:
      "AeroTechContent audite chaque white paper, fiche, RFP contre 10 règles (sources actives, chiffres validés, AI Act, anti-greenwashing) et produit redlines + score qualité auto.",
    agent: "AM-A001",
  },
  {
    problem: "Risque ITAR/EAR sur communications marketing défense",
    solution:
      "DefenseCommsGuard audite contre 12 règles export-control + sanctions consolidées (OFAC SDN + EU 16e paquet + UK OFSI + AUKUS OGL + FDPR drones) avant chaque diffusion.",
    agent: "AM-A002",
  },
  {
    problem: "Packs salons aéro/défense incohérents (tonalité, multi-langue, AI Act)",
    solution:
      "AeroEventAI génère brief presse + 5 posts + talking points VIP par salon (Farnborough, ILA, Eurosatory, MEBAA) avec respect ASD Charter + multi-fuseau + multi-langue.",
    agent: "AM-A003",
  },
  {
    problem: "Greenwashing aéro (claims SAF/H2/électrique vagues, risque DGCCRF)",
    solution:
      "AeroSustainabilityComms audite claims contre Green Claims Directive + ReFuelEU + ESRS E1 + EASA Decision 2024/015. Reflet du contexte 2026 (ZEROe reporté 2040, Lilium liquidée).",
    agent: "AM-A004",
  },
];

export const AERO_MKT_PROBLEMS = PROBLEMS_DATA;
