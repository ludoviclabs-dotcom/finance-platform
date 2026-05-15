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
  {
    agentId: "AG-B003",
    agentName: "ESGBankComms",
    route: "/agents/esg-bank-comms",
    owner: "ESG Lead + Compliance banque",
    riskLevel: "high",
    riskLabel: "Communication ESG regulee",
    aiActClass: "Risque limite a haut selon claim et juridiction",
    dataScope: "Claim library SFDR/Taxonomie UE/EBA, registre preuves dates, matrice juridictions FR/EU.",
    allowedTools: ["Claim library ESG", "Evidence registry", "Jurisdiction verdicts", "Rewrite library"],
    forbiddenActions: [
      "Approuver un claim ESG absolu sans preuve fraiche",
      "Inventer une certification ou un alignement taxonomie",
      "Publier sans validation humaine ESG + Legal",
    ],
    hitlRequiredFor: [
      "Tout claim CRITICAL ou ABSOLUTE",
      "Communication SFDR Art. 9 ou alignement taxonomie chiffrée",
      "Preuve >12 mois sur claim quantitatif",
    ],
    deterministicGates: [
      "Claim classification (ABSOLUTE/COMPARATIVE/QUALIFIED)",
      "Evidence match (registre actif + fraicheur)",
      "Jurisdiction verdict (FR/EU)",
      "GATE-GREEN-CLAIMS-2024",
    ],
    fallbackBehavior: "Reformulation qualifiee (suppression des absolus) + escalade Legal+ESG.",
    knownLimits: [
      "MVP FR/EU uniquement, UK/US en backlog V2",
      "Pas de connexion live aux registres de certifications",
    ],
    lastTestset: "6 scenarios figes : SFDR Art. 8/9, taxonomie chiffrée, EBA GL ESG.",
  },
  {
    agentId: "AG-B004",
    agentName: "ClientBankComms",
    route: "/agents/client-bank-comms",
    owner: "DirCom + Service client + DPO",
    riskLevel: "high",
    riskLabel: "Communication client sensible",
    aiActClass: "Risque limite a haut (impact contractuel sur personne physique)",
    dataScope: "Cas d'usage cadres (hausse tarif, fermeture agence, incident, remediation), segments client, mentions obligatoires CMF.",
    allowedTools: [
      "Template library validee",
      "Segment rules engine",
      "Channel matrix (EMAIL/SMS/APP/MAIL/PUSH)",
      "Mandatory notices registry",
    ],
    forbiddenActions: [
      "Envoyer sur un canal sans consentement enregistre",
      "Omettre une mention legale obligatoire (CMF L.312-1-1)",
      "Personnaliser avec une donnee hors registre client",
    ],
    hitlRequiredFor: [
      "Toute communication a > 1 000 clients",
      "Modification de conditions contractuelles",
      "Communication post-incident",
    ],
    deterministicGates: [
      "GATE-CONSENT-CHANNEL",
      "GATE-MANDATORY-NOTICES",
      "GATE-SEGMENT-MATCH",
      "GATE-PII-MINIMIZATION",
    ],
    fallbackBehavior: "Template valide pre-approuve + envoi differe en attente de revue.",
    knownLimits: [
      "Pas de connexion live au CRM client",
      "Ne remplace pas le delai legal de prevenance",
    ],
    lastTestset: "6 scenarios figes : tarif, agence, incident, remediation, RGPD, segmentation.",
  },
  {
    agentId: "AG-B005",
    agentName: "RegWatchBank",
    route: "/agents/reg-watch-bank",
    owner: "Compliance + Direction des risques",
    riskLevel: "minimal",
    riskLabel: "Service de veille (interne)",
    aiActClass: "Risque minimal pour digest interne, limite si publication externe",
    dataScope: "Feeds ACPR/AMF/EBA/ECB/ESMA/EUR-Lex, mapping agents impactes, digests classifies.",
    allowedTools: ["Source feeds", "Classifier digest", "Impact mapping", "Task queue interne"],
    forbiddenActions: [
      "Publier un digest externe sans validation Compliance",
      "Modifier le classifier sans review",
      "Ajouter un feed non audite",
    ],
    hitlRequiredFor: [
      "Digest classe CRITICAL ou IMMEDIATE",
      "Re-routing automatique d'un task vers un nouvel owner",
      "Activation d'un feed payant ou non public",
    ],
    deterministicGates: [
      "Source whitelisted",
      "Freshness < 7j",
      "Impact score >= seuil",
      "Owner mapping resolu",
    ],
    fallbackBehavior: "Digest seed fige (5 publications reelles 2025-2026) si fetch indisponible.",
    knownLimits: [
      "Sprint 3 : seed JSON fige (non live)",
      "Pas de fetch hebdo automatise avant Sprint 4",
    ],
    lastTestset: "5 digests reels classifies + mapping owners.",
  },
  {
    agentId: "AG-002",
    agentName: "LuxePressAgent",
    route: "/agents/luxe-press-agent",
    owner: "Direction presse + Brand",
    riskLevel: "limited",
    riskLabel: "Angles presse (assistance redaction)",
    aiActClass: "Risque limite (information non reglementee)",
    dataScope: "Matrice medias luxe (titre, audience, ton), historique press pickup, voice brand.",
    allowedTools: ["Media matrix", "Press pickup history", "Angle library", "Brand voice scorer"],
    forbiddenActions: [
      "Envoyer directement a un journaliste",
      "Inventer un fait, une date ou un chiffre maison",
      "Citer une personnalite reelle sans verification",
    ],
    hitlRequiredFor: [
      "Tout angle cite par defaut un journaliste reel",
      "Tout chiffre commercial ou financier",
      "Toute mention de partenaire ou ambassadeur",
    ],
    deterministicGates: [
      "Media match (segment maison)",
      "Fact check vs registre approved",
      "Voice brand minimum score",
    ],
    fallbackBehavior: "Angle generique pre-redige sans personnalisation media.",
    knownLimits: [
      "Pas de fact-check externe live",
      "Le score brand reste indicatif, validation creative requise",
    ],
    lastTestset: "4 angles par segment media (presse business, lifestyle, mode).",
  },
  {
    agentId: "AG-003",
    agentName: "LuxeEventComms",
    route: "/agents/luxe-event-comms",
    owner: "Events + Brand",
    riskLevel: "limited",
    riskLabel: "Communication evenementielle luxe",
    aiActClass: "Risque limite",
    dataScope: "Matrice formats (intime, salon, gala, defile), audiences segmentees, guidelines maison.",
    allowedTools: ["Format matrix", "Audience segments", "Invitation drafter", "Brand voice scorer"],
    forbiddenActions: [
      "Envoyer une invitation directement",
      "Modifier la liste invites en autonomie",
      "Generer une mention de partenaire non confirme",
    ],
    hitlRequiredFor: [
      "Invitations VIP ou presse",
      "Mention de prix, dotations, cadeaux",
      "Evenements lieu sensible (palais, fondation)",
    ],
    deterministicGates: ["Format match audience", "Brand voice minimum", "Compliance dotations"],
    fallbackBehavior: "Template invitation maison generique sans personnalisation.",
    knownLimits: [
      "Pas de connexion CRM evenementiel",
      "Ne replace pas le brief verbal evenement",
    ],
    lastTestset: "3 formats x 3 segments audience.",
  },
  {
    agentId: "AG-004",
    agentName: "HeritageComms",
    route: "/agents/heritage-comms",
    owner: "Heritage + Brand",
    riskLevel: "limited",
    riskLabel: "Narratif patrimonial maison",
    aiActClass: "Risque limite (recit historique)",
    dataScope: "Faits approuves (dates, fondateurs, lieux, savoir-faire), blocs narratifs valides, lexique maison.",
    allowedTools: ["Approved facts registry", "Narrative blocks library", "Lexicon checker"],
    forbiddenActions: [
      "Inventer une date, un fondateur ou un lieu",
      "Citer une anecdote non approuvee par le Heritage Lead",
      "Modifier le registre des faits sans Heritage Lead",
    ],
    hitlRequiredFor: [
      "Toute publication externe (livre, magazine, exposition)",
      "Toute citation de descendant ou famille fondatrice",
      "Toute affirmation chronologique nouvelle",
    ],
    deterministicGates: [
      "Fact match registre approved",
      "Narrative block coherent",
      "Lexicon maison",
    ],
    fallbackBehavior: "Bloc narratif approuve ou refus si le fait n'est pas au registre.",
    knownLimits: [
      "Ne remplace pas le travail d'archives",
      "Pas de connexion live aux archives physiques",
    ],
    lastTestset: "5 faits + 5 blocs narratifs valides Heritage Lead.",
  },
  {
    agentId: "AG-F101",
    agentName: "ConsolidationAgent",
    route: "/agents/consolidation",
    owner: "Direction financiere + Audit",
    riskLevel: "minimal",
    riskLabel: "Consolidation comptable",
    aiActClass: "Risque minimal (operations internes deterministes)",
    dataScope: "Plan de comptes groupe, ecritures entites, methodes goodwill, parametres WACC, tests d'impairment.",
    allowedTools: ["Plan comptable", "Goodwill calculator", "Impairment test runner", "Currency converter"],
    forbiddenActions: [
      "Modifier le plan comptable groupe",
      "Publier des comptes externes sans Direction financiere",
      "Substituer un test d'impairment par un LLM",
    ],
    hitlRequiredFor: [
      "Hypotheses WACC modifiees",
      "Methode goodwill changee (partial -> full ou inverse)",
      "Impairment trigger d'une entite > 5% du goodwill groupe",
    ],
    deterministicGates: [
      "Plan comptable verrouille",
      "Reconciliation inter-entites",
      "Conversion devise au taux figeable",
    ],
    fallbackBehavior: "Calcul deterministe local sans appel LLM.",
    knownLimits: [
      "Pas de connexion ERP live (import manuel)",
      "Ne remplace pas l'auditeur statutaire",
    ],
    lastTestset: "8 scenarios consolidation + 3 methodes goodwill.",
  },
  {
    agentId: "AG-F102",
    agentName: "MultiCurrencyAgent",
    route: "/agents/multi-currency",
    owner: "Tresorerie + DAF",
    riskLevel: "minimal",
    riskLabel: "Tresorerie multi-devises",
    aiActClass: "Risque minimal (conversion deterministe)",
    dataScope: "Taux de change figes (date de cloture), couvertures actives, exposition par devise.",
    allowedTools: ["FX rate registry", "Hedging position tracker", "Exposure dashboard"],
    forbiddenActions: [
      "Executer une operation de couverture en autonomie",
      "Modifier un taux de change historique",
      "Publier un reporting tresorerie sans DAF",
    ],
    hitlRequiredFor: [
      "Ouverture d'une nouvelle paire de devises",
      "Override d'un taux figeable",
      "Couverture > 10% du CA",
    ],
    deterministicGates: ["Taux historique immuable", "Couverture matchee", "Exposition seuil"],
    fallbackBehavior: "Conversion au dernier taux fige stocke.",
    knownLimits: [
      "Pas de connexion broker FX live (taux importes)",
      "Ne genere pas d'instructions de couverture",
    ],
    lastTestset: "6 scenarios FX + 3 couvertures.",
  },
  {
    agentId: "AG-F103",
    agentName: "RoyaltyAgent",
    route: "/agents/royalty",
    owner: "Direction financiere + Direction juridique",
    riskLevel: "minimal",
    riskLabel: "Calcul de redevances",
    aiActClass: "Risque minimal",
    dataScope: "Contrats de licence, grilles de royalties, donnees de ventes ou usage par licencie.",
    allowedTools: ["Royalty grid", "Sales ingestor", "Statement generator"],
    forbiddenActions: [
      "Modifier un contrat de licence",
      "Verser une royaltie en autonomie",
      "Calculer sur des donnees non reconciliees",
    ],
    hitlRequiredFor: [
      "Litige royaltie avec un licencie",
      "Modification de grille",
      "Royaltie > 100 k EUR / trimestre",
    ],
    deterministicGates: ["Contrat actif", "Donnees reconciliees", "Periode close"],
    fallbackBehavior: "Statement deterministe sans appel LLM.",
    knownLimits: [
      "Pas de detection automatique d'usage non declare",
      "Ne remplace pas un audit contractuel",
    ],
    lastTestset: "5 contrats + 3 grilles de royalties.",
  },
  {
    agentId: "AG-RH201",
    agentName: "ArtisanTalentAgent",
    route: "/agents/artisan-talent",
    owner: "DRH + Direction des metiers d'art",
    riskLevel: "high",
    riskLabel: "Talent acquisition artisanat",
    aiActClass: "Haut risque (Annexe III §4 — recrutement / evaluation)",
    dataScope: "Referentiel metiers d'art, candidats anonymises, criteres techniques observables uniquement.",
    allowedTools: ["Skills referential", "Anonymized matching", "Interview guide generator"],
    forbiddenActions: [
      "Prendre une decision finale d'embauche",
      "Utiliser des criteres protegees (age, origine, genre)",
      "Decommissionner un candidat sans review humaine",
    ],
    hitlRequiredFor: [
      "Toute decision de shortlist ou de rejet",
      "Toute evaluation de candidat",
      "Modification du referentiel competences",
    ],
    deterministicGates: [
      "Critere observable uniquement",
      "Anonymisation pre-LLM",
      "Audit trail decision humaine",
    ],
    fallbackBehavior: "Score sans matching, candidat passe en revue manuelle complete.",
    knownLimits: [
      "Ne remplace pas l'entretien (presence + geste)",
      "Pas de tracking biais inter-recruteur",
    ],
    lastTestset: "6 metiers d'art x 3 niveaux de seniorite.",
  },
  {
    agentId: "AG-RH202",
    agentName: "CompBenchmarkAgent",
    route: "/agents/comp-benchmark",
    owner: "DRH + C&B",
    riskLevel: "high",
    riskLabel: "Compensation et benefits",
    aiActClass: "Haut risque (Annexe III §4 — conditions de travail)",
    dataScope: "Grilles internes anonymisees, benchmarks marche agreges, fonctions + niveaux.",
    allowedTools: ["Internal grid", "Market benchmark aggregator", "Salary band recommender"],
    forbiddenActions: [
      "Decider d'une augmentation individuelle",
      "Acceder a la paie individuelle non agregee",
      "Recommander un ecart < seuil egalite F/H",
    ],
    hitlRequiredFor: [
      "Toute revue salariale individuelle",
      "Ouverture d'une nouvelle fonction au referentiel",
      "Ajustement de bande > 5% sur une fonction",
    ],
    deterministicGates: [
      "Anonymisation > seuil k-anonymity",
      "Pas de decision individuelle",
      "Audit ecart F/H pre-publication",
    ],
    fallbackBehavior: "Benchmark interne uniquement (sans marche).",
    knownLimits: [
      "Depend de la qualite des benchmarks externes",
      "Ne remplace pas une revue par comite C&B",
    ],
    lastTestset: "5 fonctions x 3 niveaux x 6 secteurs.",
  },
  {
    agentId: "AG-RH203",
    agentName: "OnboardingAgent",
    route: "/agents/onboarding",
    owner: "DRH + Manager",
    riskLevel: "limited",
    riskLabel: "Onboarding nouveaux entrants",
    aiActClass: "Risque limite (assistance, pas de decision contractuelle)",
    dataScope: "Plans d'integration, livrables pre-arrivee, contacts manager / RH / IT.",
    allowedTools: ["Onboarding plan templates", "Checklist generator", "Email scheduler"],
    forbiddenActions: [
      "Envoyer un contrat ou un avenant",
      "Acceder aux donnees salariales du nouvel entrant",
      "Decider d'une affectation",
    ],
    hitlRequiredFor: [
      "Affectation a un manager / equipe",
      "Acces a un systeme sensible (paie, RH, finance)",
      "Communication contractuelle",
    ],
    deterministicGates: ["Template valide", "Checklist complete", "Owner identifie par etape"],
    fallbackBehavior: "Plan generique sans personnalisation.",
    knownLimits: [
      "Pas de SIRH connecte en live",
      "Ne remplace pas l'entretien manager J0",
    ],
    lastTestset: "4 templates x 3 metiers.",
  },
  {
    agentId: "AG-SC301",
    agentName: "InventaireLuxeAgent",
    route: "/agents/inventaire-luxe",
    owner: "Direction operations + Compliance",
    riskLevel: "minimal",
    riskLabel: "Inventaire pieces uniques",
    aiActClass: "Risque minimal",
    dataScope: "Catalogue pieces, statuts (atelier, boutique, transit, restauration), provenance documentee.",
    allowedTools: ["Catalogue lecture", "Status update", "Movement tracker"],
    forbiddenActions: [
      "Modifier la provenance documentee",
      "Cloturer un statut sans confirmation physique",
      "Generer une attestation d'authenticite",
    ],
    hitlRequiredFor: [
      "Sortie definitive (vente, don, destruction)",
      "Ajout d'une nouvelle piece au catalogue",
      "Anomalie inventaire physique vs systeme",
    ],
    deterministicGates: [
      "Provenance figee",
      "Statut transitions whitelisted",
      "Audit trail mouvement",
    ],
    fallbackBehavior: "Lecture seule, mise a jour bloquee.",
    knownLimits: [
      "Pas de RFID / etiquetage auto live",
      "Ne remplace pas l'expert d'authenticite",
    ],
    lastTestset: "5 statuts x 4 types de mouvement.",
  },
  {
    agentId: "AG-SC302",
    agentName: "FraudDetectScAgent",
    route: "/agents/fraud-detect-sc",
    owner: "Direction des risques + Compliance",
    riskLevel: "high",
    riskLabel: "Detection fraude chaine fournisseurs",
    aiActClass: "Haut risque (Annexe III §5 — services essentiels indirects)",
    dataScope: "Flux fournisseurs anonymises, registres sanctions, indicateurs comportementaux agreges.",
    allowedTools: ["Sanction list checker", "Anomaly scorer", "Risk dashboard"],
    forbiddenActions: [
      "Bloquer un paiement en autonomie",
      "Publier un nom de fournisseur \"suspect\"",
      "Modifier la liste de sanctions",
    ],
    hitlRequiredFor: [
      "Tout signalement positif",
      "Suspension d'un fournisseur",
      "Communication a une autorite (TRACFIN, etc.)",
    ],
    deterministicGates: [
      "Sanction match exact",
      "Anomaly score > seuil",
      "Operator review obligatoire",
    ],
    fallbackBehavior: "Score sans LLM, escalade humaine immediate.",
    knownLimits: [
      "Pas de connexion bases sanctions live (snapshot date)",
      "Faux positifs documentes a chaque release",
    ],
    lastTestset: "6 patterns fraude + 3 listes sanctions.",
  },
  {
    agentId: "AG-SC303",
    agentName: "Sapin2ComplianceAgent",
    route: "/agents/sapin2-compliance",
    owner: "Direction conformite",
    riskLevel: "high",
    riskLabel: "Conformite anti-corruption Sapin II",
    aiActClass: "Haut risque (Annexe III §5 / cadre Sapin II)",
    dataScope: "Cartographie risques corruption, tiers / intermediaires, evaluations diligence raisonnable.",
    allowedTools: [
      "Risk mapping",
      "Third-party screening",
      "Due-diligence checklist",
      "Training module library",
    ],
    forbiddenActions: [
      "Approuver un tiers \"a risque\" en autonomie",
      "Modifier la cartographie sans Compliance",
      "Generer une declaration AFA sans validation",
    ],
    hitlRequiredFor: [
      "Toute approbation tiers risque eleve",
      "Toute mise a jour de la cartographie",
      "Tout signalement interne (lanceur d'alerte)",
    ],
    deterministicGates: [
      "Tiers screening complete",
      "Diligence raisonnable proportionnee",
      "Audit trail decision approbateur",
    ],
    fallbackBehavior: "Workflow papier deterministe si automatisation indisponible.",
    knownLimits: [
      "Pas de connexion live bases de donnees sanctions",
      "Ne remplace pas le dispositif AFA + lanceur d'alerte",
    ],
    lastTestset: "8 scenarios tiers + 5 niveaux risque.",
  },
  {
    agentId: "AG-A401",
    agentName: "ExpertMgmtInsurAgent",
    route: "/agents/expert-mgmt-insur",
    owner: "Direction sinistres + Direction technique",
    riskLevel: "limited",
    riskLabel: "Gestion d'expertises assurance",
    aiActClass: "Risque limite (decisions intermediaires sur sinistre)",
    dataScope: "Dossiers sinistres anonymises, expertises historiques, baremes indemnisation.",
    allowedTools: ["Expertise registry", "Baremes consultation", "Workload balancer"],
    forbiddenActions: [
      "Cloturer un sinistre en autonomie",
      "Notifier l'assure d'une decision",
      "Modifier un bareme",
    ],
    hitlRequiredFor: [
      "Indemnisation > seuil contractuel",
      "Refus de prise en charge",
      "Affectation d'un expert externe",
    ],
    deterministicGates: ["Bareme contractuel", "Workload <= capacite", "Expert qualifie pour le risque"],
    fallbackBehavior: "Affectation manuelle par responsable sinistre.",
    knownLimits: [
      "Pas de connexion logiciels experts externes",
      "Ne remplace pas l'expertise terrain",
    ],
    lastTestset: "5 types sinistre x 3 baremes.",
  },
  {
    agentId: "AG-A402",
    agentName: "RepairNetworkInsurAgent",
    route: "/agents/repair-network-insur",
    owner: "Direction sinistres + Reseaux partenaires",
    riskLevel: "limited",
    riskLabel: "Reseau reparateurs agrees",
    aiActClass: "Risque limite",
    dataScope: "Reseau reparateurs agrees, criteres qualite, capacite, geolocalisation, retours assures.",
    allowedTools: ["Network registry", "Quality scores", "Capacity planner", "Geo router"],
    forbiddenActions: [
      "Ajouter un reparateur non audite",
      "Forcer une orientation contre la preference assure",
      "Modifier les criteres qualite",
    ],
    hitlRequiredFor: [
      "Suspension d'un reparateur",
      "Ouverture d'une zone non couverte",
      "Litige assure / reparateur",
    ],
    deterministicGates: [
      "Reparateur agree actif",
      "Capacite disponible",
      "Score qualite >= seuil",
    ],
    fallbackBehavior: "Liste statique des reparateurs zonaux sans optimisation.",
    knownLimits: [
      "Pas de capacite live (declaration manuelle)",
      "Ne replace pas l'audit terrain",
    ],
    lastTestset: "5 zones x 3 types de reparation.",
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
