/**
 * NEURAL - Aéronautique / Communications & Affaires publiques catalog
 *
 * Cataloque TS pour la branche corporate / gov relations aéro. Statut MVP
 * démo (ui_demo) : 4 agents documentés avec scénarios PASS/REVIEW/BLOCK
 * et sourcebook réglementaire dédié — sans pipeline runtime (pas de
 * workbook .xlsx synchronisé pour l'instant).
 *
 * Différence avec la branche Marketing :
 *  - Audience = institutionnelle (presse business, parlements, gouvernements,
 *    investisseurs ESG), pas commerciale B2B
 *  - Gates = sécurité opérationnelle (programmes classifiés, sources sourcées,
 *    impact gouvernemental traçable) + Sapin II + Transparence Lobbying UE
 *  - Ton = corporate sobre, non-glorification ASD Charter, AI Act art. 50
 */

export type AeroCommsAgentSlug =
  | "aero-defense-comms-guard"
  | "program-comms-aero"
  | "gov-relations-aero"
  | "green-aero-comms";

export type AeroCommsVerdict = "OK" | "WARN" | "KO";

export interface AeroCommsAgent {
  id: string;
  slug: AeroCommsAgentSlug;
  name: string;
  owner: string;
  mission: string;
  primaryRule: string;
  kpis: string[];
}

export interface AeroCommsSource {
  id: string;
  authority: string;
  domain: string;
  title: string;
  date: string;
  impact: string;
}

export interface AeroCommsScenario {
  id: string;
  agentSlug: AeroCommsAgentSlug;
  label: string;
  inputLine: string;
  verdict: AeroCommsVerdict;
  summary: string;
  metrics: Array<{ label: string; before: string; after: string }>;
}

export const AERO_COMMS_SUMMARY = {
  agents: 4,
  sources: 10,
  scenarios: 4,
  rules: 22,
  veilleDate: "27/05/2026",
} as const;

export const AERO_COMMS_AGENTS: AeroCommsAgent[] = [
  {
    id: "AC-A001",
    slug: "aero-defense-comms-guard",
    name: "AeroDefenseCommsGuard",
    owner: "DirCom Corporate / Compliance Export-Control",
    mission:
      "Auditer toute communication corporate impliquant des programmes défense (briefs presse CEO, communiqués sur contrats DGA/DGSE/NATO/AUKUS, publications LinkedIn dirigeants). Vérifie ITAR/EAR confidentialité programme, non-glorification ASD Charter, disclosure AI Act art. 50, anonymisation client si requis.",
    primaryRule: "RULE-PROGRAM-CLASS-AWARE",
    kpis: ["Nb KO bloquants 0", "Score conformité > 90%", "Audit packs CEO 5/sem"],
  },
  {
    id: "AC-A002",
    slug: "program-comms-aero",
    name: "ProgramCommsAero",
    owner: "Communications programme / DirCom",
    mission:
      "Générer et auditer les communications de cycle de vie programme (annonces de jalon, dérapages calendrier, sélections fournisseurs, livraisons série). Cohérence avec déclarations financières IFRS et roadmap publique investisseur — pas de wording optimiste sans preuve.",
    primaryRule: "RULE-MILESTONE-EVIDENCED",
    kpis: ["Cohérence avec doc IFRS 100%", "Délai annonce vs réalité < 7j", "Score qualité > 85%"],
  },
  {
    id: "AC-A003",
    slug: "gov-relations-aero",
    name: "GovRelationsAero",
    owner: "Relations institutionnelles / Affaires publiques",
    mission:
      "Auditer les contributions à la régulation aéro/défense (consultations EASA, EU Parliament, FAA NPRM, DGA réponses à appel d'offres) au regard du registre Transparence UE, du code de conduite parlementaire FR/EU et de l'AI Act art. 50. Trace les mentions de lobbying et les remises de documents officiels.",
    primaryRule: "RULE-LOBBY-REGISTER",
    kpis: ["Inscription transparence UE 100%", "Mentions lobbying tracées 100%", "Délai réponse NPRM < 30j"],
  },
  {
    id: "AC-A004",
    slug: "green-aero-comms",
    name: "GreenAeroComms",
    owner: "ESG Corporate / Direction RSE signataire CSRD",
    mission:
      "Auditer les communications ESG corporate aéro (rapport intégré, présentations investisseur, communiqués trajectoire Net Zero 2050, claims SBTi) contre ESRS E1 climat, ESRS S1 social, EU Green Claims Directive et Loi Climat & Résilience FR. Détection greenwashing au niveau corporate (différent de marketing produit).",
    primaryRule: "RULE-CORPORATE-LCA",
    kpis: ["% claims sans LCA 0", "Cohérence ESRS E1 100%", "Score SBTi alignement > 80%"],
  },
];

export const AERO_COMMS_SOURCES: AeroCommsSource[] = [
  {
    id: "AC-S001",
    authority: "US",
    domain: "Export Control",
    title: "ITAR — restrictions communication programmes Cat. VIII / XV",
    date: "Révision 22 CFR janv 2026",
    impact:
      "Toute communication mentionnant capacités techniques précises (charge utile, signature radar, autonomie effective) sur programme défense US doit avoir clearance DDTC.",
  },
  {
    id: "AC-S002",
    authority: "UE",
    domain: "Transparence Lobbying",
    title: "Registre de Transparence UE — Décret 2021/119 + accord interinstitutionnel",
    date: "Mai 2021 — révisé 2025",
    impact:
      "Inscription obligatoire pour rencontrer Commissaires, Députés EP, hauts fonctionnaires. Déclaration des rdv, dépenses, sujets. Sanction = exclusion du registre + perte accès institutions.",
  },
  {
    id: "AC-S003",
    authority: "France",
    domain: "Transparence Lobbying",
    title: "HATVP — Loi Sapin II + déclarations représentants d'intérêts",
    date: "Loi 2016-1691 + Décret 2017-867",
    impact:
      "Tout lobbyiste auprès du Gouvernement français doit déclarer ses activités à la HATVP. Sanctions pénales jusqu'à 15 K€ + 1 an de prison.",
  },
  {
    id: "AC-S004",
    authority: "ASD Europe",
    domain: "Tonalité défense",
    title: "ASD Charter on Responsible Defence Communications",
    date: "mars 2025",
    impact:
      "Pas de glorification armes, contexte stratégique sourcé, séparation claire usage civil/militaire, pas de visuels choquants. Particulièrement strict pour communications corporate (impact long-terme sur acceptabilité sociale).",
  },
  {
    id: "AC-S005",
    authority: "UE",
    domain: "Intelligence artificielle",
    title: "EU AI Act art. 50 — Disclosure IA dans contenus diffusés",
    date: "Applicable 02/08/2026",
    impact:
      "Tout contenu marketing ou corporate IA-généré doit être étiqueté. Sanctions jusqu'à 15 M EUR / 3% CA mondial.",
  },
  {
    id: "AC-S006",
    authority: "UE",
    domain: "CSRD / ESRS E1",
    title: "CSRD ESRS E1 Climate change — corporate reporting",
    date: "Obligatoire 2025 pour grandes entreprises aéro",
    impact:
      "Reporting climat doit être cohérent entre rapport intégré, présentations investisseurs et communications presse. Toute divergence = risque IFRS / litige actionnaire.",
  },
  {
    id: "AC-S007",
    authority: "UE",
    domain: "Greenwashing",
    title: "EU Green Claims Directive 2024 (corporate scope)",
    date: "Adoptée mars 2024",
    impact:
      "Pour les communications corporate : claims « neutre carbone 2050 » sans plan de transition + compensation registre = interdit. Sanctions DGCCRF jusqu'à 4% CA.",
  },
  {
    id: "AC-S008",
    authority: "SBTi",
    domain: "Trajectoire climat",
    title: "Science Based Targets initiative — Aviation sector guidance v1",
    date: "Octobre 2024",
    impact:
      "Validation publique des trajectoires Net Zero aéro. Référence pour audit cohérence claims corporate avec engagements scientifiques.",
  },
  {
    id: "AC-S009",
    authority: "UE",
    domain: "AUKUS / OGL",
    title: "UK OFSI + Open General Licence AUKUS Pillar II",
    date: "Mai 2024",
    impact:
      "Communications corporate sur collaborations US/UK/AU autorisées sans licence dédiée, sous réserve de respecter les exigences de la OGL (audit annuel, non-divulgation tech sensible).",
  },
  {
    id: "AC-S010",
    authority: "France",
    domain: "Codes de conduite Parlement",
    title: "Assemblée nationale + Sénat — Code de conduite + Bureau",
    date: "Révisions 2024",
    impact:
      "Auditions parlementaires, contributions écrites aux commissions et notes de position doivent être inscrites au registre. Sanctions pour défaut d'inscription.",
  },
];

export const AERO_COMMS_SCENARIOS: AeroCommsScenario[] = [
  {
    id: "SCN-AC-001",
    agentSlug: "aero-defense-comms-guard",
    label: "Brief presse CEO — annonce contrat AUKUS Pillar II",
    inputLine:
      "« Nous sommes fiers d'annoncer la signature d'un contrat majeur avec la marine US dans le cadre du pilier AUKUS, portant sur la fourniture de modules anti-drones de dernière génération avec autonomie record de 18 mois sans maintenance. »",
    verdict: "KO",
    summary:
      "3 KO bloquants : (1) « majeur » sans chiffre = vague (RULE-MILESTONE-EVIDENCED), (2) « autonomie 18 mois sans maintenance » = capacité technique précise sous AUKUS OGL nécessitant clearance DDTC + UK OFSI (RULE-PROGRAM-CLASS-AWARE), (3) absence mention IA art. 50 sur la fiche produit cité. 4 redlines proposées.",
    metrics: [
      { label: "Score conformité", before: "52%", after: "91%" },
      { label: "KO bloquants", before: "3", after: "0" },
      { label: "Clearances requises", before: "—", after: "DDTC + OFSI" },
    ],
  },
  {
    id: "SCN-AC-002",
    agentSlug: "program-comms-aero",
    label: "Communiqué dérapage calendrier programme civil",
    inputLine:
      "« Notre programme régional hybride-électrique reste pleinement dans les temps et confirme une mise en service commerciale en 2027. »",
    verdict: "WARN",
    summary:
      "Cohérence requise avec annonce dérapage Q1 financier 2026 (slip de 18 mois). Message corporate contredit la note IFRS 38 de R&D capitalisée. Recommandation : reformulation « cible 2028-2029 » + ajout note investisseur.",
    metrics: [
      { label: "Cohérence IFRS", before: "62%", after: "97%" },
      { label: "Risque litige actionnaire", before: "ÉLEVÉ", after: "FAIBLE" },
      { label: "Délai annonce", before: "+90j", after: "+0j" },
    ],
  },
  {
    id: "SCN-AC-003",
    agentSlug: "gov-relations-aero",
    label: "Contribution écrite consultation EASA propulsion hybride",
    inputLine:
      "Note de position remise à la DG MOVE par notre VP Affaires publiques le 12/05/2026, recommandant ajustement des seuils de certification CS-23 pour propulsion hybride.",
    verdict: "KO",
    summary:
      "2 KO bloquants : (1) pas d'inscription préalable au Registre de Transparence UE pour cette contribution = retrait automatique du dossier consultation (AC-S002), (2) absence de déclaration HATVP pour le rdv préparatoire avec MOVE.A.3 (AC-S003). Risque légal France + UE.",
    metrics: [
      { label: "Inscriptions requises", before: "0/2", after: "2/2" },
      { label: "Risque exclusion", before: "OUI", after: "NON" },
      { label: "Délai régularisation", before: "—", after: "15j" },
    ],
  },
  {
    id: "SCN-AC-004",
    agentSlug: "green-aero-comms",
    label: "Présentation investisseur — engagement Net Zero 2050",
    inputLine:
      "« Notre groupe s'engage sur une trajectoire Net Zero 2050 alignée avec l'Accord de Paris, en s'appuyant sur les SAF, l'hydrogène et la compensation carbone de qualité pour le résidu non abattable. »",
    verdict: "WARN",
    summary:
      "Score corporate ESG 67%. 2 WARN : (1) SBTi Aviation v1 demande des jalons intermédiaires 2030/2035 absents de la présentation (AC-S008), (2) « compensation carbone de qualité » imprécis vis-à-vis EU Green Claims (AC-S007) — exiger fournisseur certifié ICVCM et type d'absorption (DAC, BECCS). Cohérence ESRS E1 OK.",
    metrics: [
      { label: "Score corporate ESG", before: "67%", after: "92%" },
      { label: "Alignement SBTi", before: "Partiel", after: "Complet" },
      { label: "Risque DGCCRF", before: "MODÉRÉ", after: "FAIBLE" },
    ],
  },
];

const PROBLEMS_DATA: Array<{
  agent: string;
  problem: string;
  solution: string;
}> = [
  {
    agent: "AC-A001",
    problem: "Comms corporate aéro/défense exposant des capacités techniques sous clearance",
    solution:
      "AeroDefenseCommsGuard audite tout contenu CEO/dirigeant contre ITAR/EAR/AUKUS OGL + ASD Charter avant publication.",
  },
  {
    agent: "AC-A002",
    problem: "Décalage entre comms programme et déclarations financières IFRS",
    solution:
      "ProgramCommsAero force la cohérence entre les annonces programme et les notes IFRS / présentations investisseur.",
  },
  {
    agent: "AC-A003",
    problem: "Risque légal en relations institutionnelles (Transparence UE, HATVP)",
    solution:
      "GovRelationsAero trace chaque rdv, contribution écrite et remise de document avec inscription au registre approprié.",
  },
  {
    agent: "AC-A004",
    problem: "Greenwashing corporate (claims Net Zero 2050 sans plan de transition)",
    solution:
      "GreenAeroComms audite la cohérence ESRS E1 / SBTi / Green Claims dans tous les supports investisseur + rapport intégré.",
  },
];

export const AERO_COMMS_PROBLEMS = PROBLEMS_DATA;
