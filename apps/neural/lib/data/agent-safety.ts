export type SafetyVerdict = "ALLOW" | "REVIEW" | "BLOCK";

export type AgentSafetyProfile = {
  agentId: string;
  agentName: string;
  route: string;
  owner: string;
  riskLevel: "minimal" | "limited" | "high";
  riskLabel: string;
  aiActClass: string;
  dataScope: string;
  allowedTools: string[];
  forbiddenActions: string[];
  hitlRequiredFor: string[];
  deterministicGates: string[];
  fallbackBehavior: string;
  knownLimits: string[];
  lastTestset: string;
};

export type PolicyDecision = {
  verdict: SafetyVerdict;
  label: string;
  summary: string;
  examples: string[];
  requiresApproval: boolean;
  traceEvidence: string;
};

export type SafetyScenario = {
  id: string;
  title: string;
  risk: string;
  agentAttempt: string;
  controlApplied: string;
  finalOutcome: string;
  auditEvidence: string;
  verdict: SafetyVerdict;
};

export type SafetyFlowStep = {
  id: string;
  title: string;
  description: string;
  control: string;
};

export type UsageMode = {
  id: string;
  label: string;
  description: string;
  riskChange: string;
  neuralPosition: string;
};

export type AuditTimelineItem = {
  id: string;
  title: string;
  detail: string;
  evidence: string;
};

export type SafetyDeckSlide = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
};

export const safetyFlowSteps: SafetyFlowStep[] = [
  {
    id: "input",
    title: "Input structure",
    description: "Schema serveur, longueur, role, scenario-id ou champ explicitement autorise.",
    control: "Validation Zod + rate limit",
  },
  {
    id: "pre-gates",
    title: "Gates avant LLM",
    description: "Sources, chiffres, wording, juridiction et perimetre sont controles avant generation.",
    control: "Hard-fails deterministes",
  },
  {
    id: "llm",
    title: "LLM optionnel",
    description: "Le modele aide a formuler, mais ne devient pas l'autorite finale.",
    control: "Prompt versionne + fallback",
  },
  {
    id: "post-gates",
    title: "Gates apres LLM",
    description: "La sortie est relue par les rules serveur. Une contradiction du modele est ignoree.",
    control: "Override NEURAL",
  },
  {
    id: "hitl",
    title: "Validation humaine",
    description: "Tout impact irreversible, reglemente ou sensible passe par review.",
    control: "HITL user ou superviseur",
  },
  {
    id: "output",
    title: "Sortie prouvable",
    description: "Trace, hash, verdict, sources et limites sont attaches au livrable.",
    control: "Audit trail + SHA-256",
  },
];

export const usageModes: UsageMode[] = [
  {
    id: "assisted",
    label: "Mode assiste",
    description: "L'IA propose. Un humain applique manuellement.",
    riskChange: "Risque principal : erreur de jugement ou fuite dans le prompt.",
    neuralPosition: "Autorise pour les brouillons, idees, reformulations et lectures guidees.",
  },
  {
    id: "automated",
    label: "Mode automatise",
    description: "L'IA est inseree dans un workflow borne par du code deterministe.",
    riskChange: "Risque maitrisable si les entrees, sorties et gates sont limites.",
    neuralPosition: "Mode cible des demos NEURAL : scenario-id, gates serveur, sortie structuree.",
  },
  {
    id: "agentic",
    label: "Mode agentique",
    description: "L'agent planifie, choisit des outils et enchaine des actions.",
    riskChange: "Changement de classe de risque : vitesse, autonomie, blast radius.",
    neuralPosition: "Autorise uniquement via gateway, scopes outils et validation humaine.",
  },
];

export const policyDecisions: PolicyDecision[] = [
  {
    verdict: "ALLOW",
    label: "Autoriser",
    summary: "Action reversible, sourcee, dans le scope agent et sans effet reglemente.",
    examples: [
      "Reformuler un draft deja public",
      "Calculer un score brand",
      "Exporter un pack de preuve scenario-id",
    ],
    requiresApproval: false,
    traceEvidence: "traceId + gate pass + hash export",
  },
  {
    verdict: "REVIEW",
    label: "Envoyer en revue",
    summary: "Action utile, mais avec impact metier, legal, reputationnel ou client.",
    examples: [
      "Communication client sensible",
      "Claim ESG qualifie mais preuve ancienne",
      "Message crise pret a valider",
    ],
    requiresApproval: true,
    traceEvidence: "approvalId + reviewer + raison",
  },
  {
    verdict: "BLOCK",
    label: "Bloquer",
    summary: "Action hors perimetre, destructive, non sourcee, non approuvee ou tenant-cross.",
    examples: [
      "Autopublication sans approbateur",
      "Source manquante ou stale",
      "Export massif non justifie",
    ],
    requiresApproval: false,
    traceEvidence: "policy block + gate fail + horodatage",
  },
];

export const safetyScenarios: SafetyScenario[] = [
  {
    id: "autopub-crisis",
    title: "Autopublication de crise",
    risk: "Diffusion externe d'un message non valide par DirCom/Juridique.",
    agentAttempt: "BankCrisisComms prepare un message et tente de le publier directement.",
    controlApplied: "GATE-CRISIS-APPROVED-MESSAGE + HITL obligatoire.",
    finalOutcome: "Publication bloquee, draft envoye en revue cellule crise.",
    auditEvidence: "Trace ID, gates crise, approver attendu, statut WAITING_APPROVAL.",
    verdict: "BLOCK",
  },
  {
    id: "missing-source",
    title: "Source manquante",
    risk: "Affirmation bancaire ou ESG sans preuve active.",
    agentAttempt: "RegBankComms produit une phrase chiffrée non mappee a une source ACTIVE.",
    controlApplied: "BankEvidenceGuard rejette le paquet evidence avant sortie.",
    finalOutcome: "Sortie refusee et pack de preuve non genere.",
    auditEvidence: "GATE-SOURCE-ACTIVE fail + liste des sources candidates.",
    verdict: "BLOCK",
  },
  {
    id: "green-claim",
    title: "Claim ESG risque",
    risk: "Greenwashing, claim absolu ou preuve insuffisante selon juridiction.",
    agentAttempt: "GreenClaimChecker detecte une promesse environnementale absolue.",
    controlApplied: "Classification ABSOLUTE + matrice juridictionnelle + evidence matching.",
    finalOutcome: "Claim bloque ou reformule avec revue Legal + ESG Lead.",
    auditEvidence: "Claim pattern, juridiction, preuve associee, verdict risque.",
    verdict: "REVIEW",
  },
  {
    id: "bulk-export",
    title: "Export massif",
    risk: "Exfiltration accidentelle ou demande hors finalite.",
    agentAttempt: "Un agent demande un export complet de donnees tenant.",
    controlApplied: "RBAC tenant, seuil volumetrie, finalite et approval superviseur.",
    finalOutcome: "Export refuse si finalite absente, sinon revue superviseur.",
    auditEvidence: "Tenant, volume, policy decision, reviewer requis.",
    verdict: "BLOCK",
  },
];

export const auditTimeline: AuditTimelineItem[] = [
  {
    id: "trace",
    title: "Trace ID cree",
    detail: "Chaque run obtient un identifiant suivi dans les headers et la reponse.",
    evidence: "x-neural-*-trace",
  },
  {
    id: "hashes",
    title: "Prompts et packs hashes",
    detail: "Les exports Markdown exposent un SHA-256 pour detecter toute modification.",
    evidence: "x-neural-pack-hash",
  },
  {
    id: "gates",
    title: "Gates declenches",
    detail: "Les decisions listent les gates pass, review ou block appliquees par le serveur.",
    evidence: "GATE-*",
  },
  {
    id: "review",
    title: "Reviewer attache",
    detail: "Les decisions sensibles creent une approbation horodatee avec raison.",
    evidence: "approvalId + reviewerId",
  },
  {
    id: "export",
    title: "Preuve exportable",
    detail: "Le client peut conserver le pack de preuve et le rapprocher de la decision.",
    evidence: "Markdown + SHA-256",
  },
];

export const agentSafetyProfiles: AgentSafetyProfile[] = [
  {
    agentId: "AG-B001",
    agentName: "RegBankComms",
    route: "/agents/reg-bank-comms",
    owner: "DirCom + Compliance",
    riskLevel: "high",
    riskLabel: "Communication regulee",
    aiActClass: "Risque limite a haut selon contexte de deploiement",
    dataScope: "Scenarios figes, sources ACPR/AMF/EBA/ECB/ESMA, chiffres validated.",
    allowedTools: ["BankEvidenceGuard", "RegWatchBank digest", "Export Markdown signe"],
    forbiddenActions: [
      "Publier une communication externe",
      "Inventer une source ou un chiffre",
      "Lire des donnees tenant hors perimetre",
    ],
    hitlRequiredFor: [
      "Tout message externe regulatoire",
      "Mention de performance ou information privilegiee",
      "Correction manuelle d'un blocker",
    ],
    deterministicGates: [
      "GATE-PRIV",
      "GATE-NUM-VALIDATED",
      "GATE-SOURCE-ACTIVE",
      "GATE-WORDING",
    ],
    fallbackBehavior: "Template deterministe et meme verdict serveur si AI Gateway indisponible.",
    knownLimits: [
      "Demo publique scenario-id only",
      "Pas de veille live automatisee ACPR/AMF en production publique",
    ],
    lastTestset: "5 scenarios figes avec verdict attendu.",
  },
  {
    agentId: "AG-B002",
    agentName: "BankCrisisComms",
    route: "/agents/bank-crisis-comms",
    owner: "Cellule crise + CISO",
    riskLevel: "high",
    riskLabel: "Crise et reputation",
    aiActClass: "Risque limite a haut selon usage client",
    dataScope: "Catalogue incidents, holding statements pre-approuves, SLA par severite.",
    allowedTools: ["Bibliotheque statements", "Timers crise", "Export pack crise"],
    forbiddenActions: [
      "Autopublication externe",
      "Affirmer une cause racine non confirmee",
      "Promettre une remediation non validee",
    ],
    hitlRequiredFor: [
      "Message de crise externe",
      "Incident cyber ou fuite de donnees",
      "Coordination regulateur",
    ],
    deterministicGates: [
      "GATE-CRISIS-ROOT-CAUSE",
      "GATE-CRISIS-APPROVED-MESSAGE",
      "GATE-CRISIS-REMEDIATION",
      "GATE-CRISIS-SLA",
    ],
    fallbackBehavior: "Holding statement pre-approuve, sans invention de details.",
    knownLimits: [
      "Ne remplace pas la cellule crise",
      "Ne notifie pas ACPR/AMF a la place du client",
    ],
    lastTestset: "4 scenarios crise figes.",
  },
  {
    agentId: "AG-001",
    agentName: "MaisonVoiceGuard",
    route: "/agents/maison-voice-guard",
    owner: "Brand lead + Communication",
    riskLevel: "limited",
    riskLabel: "Brand voice",
    aiActClass: "Risque limite",
    dataScope: "Texte soumis, dictionnaire hard-fail, regles de charte maison.",
    allowedTools: ["Voice scorer", "Brand vocab", "Suggestion de reecriture"],
    forbiddenActions: [
      "Publier sur un canal social",
      "Modifier la charte source",
      "Stocker le texte utilisateur en clair",
    ],
    hitlRequiredFor: [
      "Score sous seuil",
      "Hard-fail brand",
      "Campagne sensible ou crise",
    ],
    deterministicGates: ["Score brand", "Hard-fail dictionnaire", "Seuil langue"],
    fallbackBehavior: "Score deterministe local et explication sans appel modele.",
    knownLimits: [
      "Ne valide pas les droits image ou media buying",
      "Le score reste un outil de revue, pas une validation finale",
    ],
    lastTestset: "12 cas live scorer + vocabulaire FR/EN.",
  },
  {
    agentId: "AG-005",
    agentName: "GreenClaimChecker",
    route: "/agents/green-claim-checker",
    owner: "ESG Lead + Legal",
    riskLevel: "high",
    riskLabel: "Claims ESG",
    aiActClass: "Risque limite avec enjeux conformite sectoriels",
    dataScope: "Claim soumis, juridiction, registre preuves, matrice Green Claims.",
    allowedTools: ["Claim library", "Evidence registry", "Jurisdiction matrix"],
    forbiddenActions: [
      "Approuver un claim absolu sans preuve",
      "Inventer une certification",
      "Publier une promesse environnementale",
    ],
    hitlRequiredFor: [
      "Risque HIGH ou CRITICAL",
      "Preuve ancienne ou contestable",
      "Claim comparatif ou absolu",
    ],
    deterministicGates: ["Claim pattern", "Evidence match", "Jurisdiction risk"],
    fallbackBehavior: "Verdict conservateur et reformulation qualifiee.",
    knownLimits: [
      "Pas de base jurisprudence externe connectee",
      "Ne remplace pas une validation juridique finale",
    ],
    lastTestset: "10 cas Claim Checker + 5 juridictions.",
  },
  {
    agentId: "AG-B006",
    agentName: "BankEvidenceGuard",
    route: "/agents/bank-evidence-guard",
    owner: "Compliance",
    riskLevel: "minimal",
    riskLabel: "Service zero-LLM",
    aiActClass: "Risque minimal comme service de resolution interne",
    dataScope: "Registre ferme de sources, subjects, policies de fraicheur.",
    allowedTools: ["Source registry", "Freshness policy", "Evidence scoring"],
    forbiddenActions: [
      "Generer du texte libre",
      "Appeler le LLM",
      "Ajouter une source non cataloguee",
    ],
    hitlRequiredFor: [
      "Override manuel d'une source stale",
      "Ajout d'une nouvelle autorite",
      "Changement de policy fraicheur",
    ],
    deterministicGates: ["Source active", "Subject match", "Freshness policy", "Priority score"],
    fallbackBehavior: "Aucun fallback LLM : resolution purement deterministe.",
    knownLimits: [
      "Depend de la qualite du registre source",
      "La veille live reste en roadmap",
    ],
    lastTestset: "4 queries auditees executees au build.",
  },
];

export const safetyReferences = [
  {
    label: "OWASP LLM06 Excessive Agency",
    href: "https://owasp.org/www-project-top-10-for-large-language-model-applications/assets/PDF/OWASP-Top-10-for-LLMs-v2025.pdf",
  },
  {
    label: "OWASP Agentic Top 10",
    href: "https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/",
  },
  {
    label: "NIST AI 600-1",
    href: "https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence",
  },
  {
    label: "ANSSI IA generative",
    href: "https://cyber.gouv.fr/publications/recommandations-de-securite-pour-un-systeme-dia-generative",
  },
  {
    label: "EU AI Act",
    href: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj",
  },
  {
    label: "CNIL fiches IA",
    href: "https://www.cnil.fr/fr/les-fiches-pratiques-ia",
  },
  {
    label: "DORA",
    href: "https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX%3A32022R2554",
  },
] as const;

export const safetyDeckSlides: SafetyDeckSlide[] = [
  {
    id: "problem",
    eyebrow: "01 · Probleme",
    title: "Les agents agissent plus vite que les controles humains classiques.",
    body: "Un agent avec trop de droits peut enchainer donnees, outils, fichiers et communications avant qu'un operateur ne detecte l'erreur.",
    bullets: ["Vitesse d'execution", "Outils heterogenes", "Explications plausibles apres erreur"],
  },
  {
    id: "incident",
    eyebrow: "02 · Incident",
    title: "Replit a montre le vrai risque : production accessible, garde-fous insuffisants.",
    body: "L'enseignement n'est pas que les LLM sont inutilisables. L'enseignement est qu'une instruction naturelle n'est jamais une autorisation technique.",
    bullets: ["Pas de prod directe", "Pas de privilege large", "Rollback et logs obligatoires"],
  },
  {
    id: "principle",
    eyebrow: "03 · Principe",
    title: "Le risque vient du perimetre d'action ouvert au modele.",
    body: "NEURAL traite l'agent comme un acteur a privileges : identite, scope, outils autorises, journalisation et revue.",
    bullets: ["Moindre privilege", "Defense en profondeur", "Zero Trust applique aux agents"],
  },
  {
    id: "modes",
    eyebrow: "04 · Modes",
    title: "Assiste, automatise, agentique : trois regimes, trois niveaux de risque.",
    body: "NEURAL rend le changement de mode explicite pour eviter qu'une demo de brouillon devienne une action autonome.",
    bullets: ["Assiste : suggestion", "Automatise : workflow borne", "Agentique : gateway + HITL"],
  },
  {
    id: "architecture",
    eyebrow: "05 · Architecture",
    title: "Gateway, policies, gates et humain forment la chaine de controle.",
    body: "Le LLM peut aider a formuler. Les gates deterministes gardent le dernier mot.",
    bullets: ["Pre-gates", "Post-gates", "Human-in-the-loop"],
  },
  {
    id: "demo",
    eyebrow: "06 · Demo",
    title: "Une action autorisee passe. Une action risquee part en revue. Une action hors scope est bloquee.",
    body: "La demonstration commerciale doit montrer les trois verdicts ALLOW, REVIEW et BLOCK avec trace visible.",
    bullets: ["Autopublication bloquee", "Claim ESG en revue", "Export source avec hash"],
  },
  {
    id: "audit",
    eyebrow: "07 · Audit trail",
    title: "Chaque decision doit pouvoir etre reconstruite.",
    body: "Trace ID, hash, gates, modele, sources et reviewer deviennent la preuve partagee avec le client.",
    bullets: ["Trace exportable", "Hash SHA-256", "Reviewer horodate"],
  },
  {
    id: "compliance",
    eyebrow: "08 · Conformite",
    title: "Le discours s'aligne avec AI Act, RGPD, DORA, ANSSI et OWASP.",
    body: "NEURAL ne remplace pas le DPO ou le RSSI. NEURAL leur donne une base verifiable pour cadrer l'usage.",
    bullets: ["Supervision humaine", "Journalisation", "Cybersécurite et robustesse"],
  },
  {
    id: "limits",
    eyebrow: "09 · Limites",
    title: "La confiance vient aussi des limites assumees.",
    body: "Operator Gateway MVP, SOC 2 et ISO restent en roadmap. Le site doit distinguer live, demo et prepare.",
    bullets: ["Pas de zero risque", "Pas de certification inventee", "Pas d'autonomie haut-risque"],
  },
  {
    id: "pilot",
    eyebrow: "10 · Offre pilote",
    title: "Demarrer par un agent prioritaire, un scope borne et un pack de preuve.",
    body: "Le pilote ideal montre une sortie utile, une action bloquee, une revue humaine et un export auditable.",
    bullets: ["Cadrage securite", "Agent prioritaire", "Due diligence RSSI/DPO"],
  },
];

export function getAgentSafetyProfile(slug: string) {
  return agentSafetyProfiles.find((profile) => profile.route.endsWith(`/${slug}`));
}
