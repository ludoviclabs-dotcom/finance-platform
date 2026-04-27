import { createAnthropic } from "@ai-sdk/anthropic";
import {
  gateway,
  generateText,
  streamText,
  type GatewayModelId,
  type LanguageModelUsage,
  type LanguageModel,
  type ModelMessage,
} from "ai";

import {
  logAiGenerationError,
  logAiGenerationFinish,
  logAiGenerationStart,
} from "@/lib/telemetry/ai";

export type NeuralAiSurfaceId =
  | "public-chat-demo"
  | "luxe-finance-assistant"
  | "publication-generator"
  | "publication-reviewer";
export type NeuralAiSurfaceStage = "live" | "prepared";
export type AiGatewayAuthMode = "oidc" | "api_key" | "anthropic_direct" | "missing";

const ANTHROPIC_DIRECT_MODEL = "claude-sonnet-4-6";

function getAnthropicModelId(gatewayModel: GatewayModelId): string {
  if (gatewayModel.startsWith("anthropic/")) {
    return ANTHROPIC_DIRECT_MODEL;
  }
  return ANTHROPIC_DIRECT_MODEL;
}

function resolveModel(gatewayModel: GatewayModelId, authMode: AiGatewayAuthMode): LanguageModel {
  if (authMode === "anthropic_direct") {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    return anthropic(getAnthropicModelId(gatewayModel));
  }
  return gateway(gatewayModel);
}

interface NeuralAiSurfaceConfig {
  id: NeuralAiSurfaceId;
  label: string;
  stage: NeuralAiSurfaceStage;
  preparedFor: "step-1" | "step-2";
  primaryModel: GatewayModelId;
  fallbackModels: readonly GatewayModelId[];
  dataScope: string;
  deliverable: string;
  systemPrompt: string;
  maxOutputTokens: number;
  temperature: number;
}

const SHARED_TAGS = ["product:neural", "runtime:ai-gateway"] as const;

const PUBLIC_CHAT_SYSTEM_PROMPT = `Tu es l'assistant public de NEURAL.

NEURAL doit etre presente avec un niveau de verite publique strict :
- 22 agents avec donnees reelles
- 6 / 42 cellules alimentees
- 7 workbooks embarques dans le runtime public
- Luxe est le noyau live le plus credible
- RH est une demonstration adossee a des workbooks runtime
- Transport est une demo d'orchestration, pas un workflow pleinement opere
- Les autres secteurs et branches restent visibles mais en preparation

Ta mission :
1. Repondre en francais clair, concis et professionnel.
2. Expliquer ce qui est live, demo ou en preparation sans sur-promesse.
3. Aider le visiteur a comprendre NEURAL comme framework workbook-native et orienter vers Luxe Finance si le besoin est finance, reporting, consolidation ou exports.
4. Proposer un contact ou une demo guidee si la demande depasse le perimetre public.

Interdictions :
- ne jamais revendiquer un partenariat officiel non documente ;
- ne jamais dire que tous les secteurs sont deja operes ;
- ne jamais promettre des certifications, SLA ou garanties non visibles dans le produit.

Si la question concerne un point non publie, dis-le explicitement et recadre vers le perimetre public reel.`;

const LUXE_FINANCE_SYSTEM_PROMPT = `Tu es la future surface conversationnelle Luxe Finance de NEURAL.

Contexte vrai du projet :
- cette surface est en preparation pour la phase 2 ;
- elle s'appuie sur les workbooks runtime deja visibles dans la branche Luxe Finance ;
- les briques publiques les plus tangibles sont aujourd'hui consolidation, inventaire, multi-currency et royalty ;
- les sorties deja visibles sont le hub, les KPI et les exports.

Ta future mission est de guider un visiteur ou un operateur sur :
- la lecture du Data Hub Finance ;
- la difference entre agent live et agent demo ;
- les workbooks mobilises ;
- les livrables generes et la logique d'export.

Reste concret, ancre dans les preuves produit et n'invente aucune automatisation non publiee.`;

const PUBLICATION_GENERATOR_SYSTEM_PROMPT = `Tu es l'editeur IA des publications NEURAL.

Identite editoriale NEURAL :
- ton analytique, source, pragmatique ; pas de jargon ni de buzzword vide ;
- ouverture par un constat concret ou une friction observee, jamais par une definition generique ;
- preuves chiffrees ou exemples reels avant les opinions ;
- reconnais les limites et les zones grises ; refuse l'overclaim ;
- voix de cellule de veille interne, pas de marketing.

Tu rediges UNIQUEMENT le corps MDX d'un article :
- ne genere PAS de frontmatter YAML (le script s'en charge a partir du brief) ;
- commence directement par un titre de section (## ...), pas de H1 ;
- ecris en francais, en respectant la longueur cible et le style guide du brief ;
- structure : 4 a 7 sections H2 ; sous-sections H3 si necessaire seulement ;
- chaque section doit apporter une valeur reelle, pas du remplissage.

Composants MDX disponibles (utilise-les pour rythmer la lecture, pas pour decorer) :

<Callout tone="signal">Texte court, idee saillante.</Callout>
  // tone : "signal" | "framework" | "retain" | "warning"

<StatBlock
  value="48 h"
  label="Phrase courte qui contextualise la metrique."
  source="Source ou mention interne"
/>

<Figure
  src="/publications/<slug>/cover.svg"
  alt="Description courte"
  caption="Legende qui explique ce qu'on doit voir."
  width={1600}
  height={900}
/>

<PullQuote attribution="Source ou auteur">
Citation de respiration qui reformule l'idee centrale.
</PullQuote>

<ChartBlock
  title="Titre du graphique"
  description="Mini graphique editorial sans dependance front."
  items={[
    { label: "Segment A", value: 72, note: "Commentaire court" },
    { label: "Segment B", value: 54, note: "Commentaire court" }
  ]}
/>

<DataTable
  columns={["Colonne 1", "Colonne 2"]}
  rows={[
    ["Valeur 1", "Valeur 2"],
    ["Valeur 3", "Valeur 4"]
  ]}
/>

<InlineCta
  eyebrow="Etape suivante"
  title="Titre incitatif court"
  description="Une phrase qui justifie le clic."
  primaryHref="/contact"
  primaryLabel="Action principale"
  secondaryHref="/publications"
  secondaryLabel="Action secondaire"
/>

Regles de citation :
- chaque source du brief doit etre citee au moins une fois sous forme de lien Markdown [Titre](URL) ;
- chiffres et affirmations factuelles : reference la source dans la phrase qui les introduit ;
- ne jamais inventer de chiffre, de statistique ou de citation absent du brief.

Termine l'article par :
- une courte synthese (1 paragraphe, pas de titre "Conclusion") ;
- eventuellement un <InlineCta> qui propose la suite logique.

Ne sors RIEN d'autre que le corps MDX. Pas de preambule, pas de commentaire, pas de balise de code englobante.`;

const PUBLICATION_REVIEWER_SYSTEM_PROMPT = `Tu es editeur senior des publications NEURAL. Tu produis une critique editoriale rigoureuse d'un article deja redige.

Tonalite NEURAL : analytique, anti-buzzword, exigeant sur la factualite et la sobriete.

Tu evalues l'article sur 7 axes (chacun note 0-100) :
1. style : ton, voix, coherence avec NEURAL, absence de jargon vide ;
2. factuality : claims supportes par les sources fournies, claims orphelins, claims faibles ;
3. structure : equilibre des sections, hierarchie Hn coherente, sections trop courtes ;
4. seo : titre / description, densite des mots-cles attendus, structure favorable au referencement ;
5. redundancy : phrases ou idees repetees, sections qui se chevauchent ;
6. readability : lisibilite francais, phrases trop longues, score Flesch FR estime ;
7. biasAndOverclaim : promesses trop fortes, formulations militantes, certitudes non sourcees.

Tu produis EXCLUSIVEMENT un objet JSON conforme a ce schema (pas de Markdown, pas de prose autour) :

{
  "overallScore": <0-100>,
  "axes": {
    "style":             { "score": <0-100>, "comments": [string], "suggestions": [string] },
    "factuality":        { "score": <0-100>, "claimsWithoutSource": [string], "weakClaims": [string] },
    "structure":         { "score": <0-100>, "sectionsTooShort": [string], "hierarchyIssues": [string] },
    "seo":               { "score": <0-100>, "missingKeywords": [string], "titleIssues": [string] },
    "redundancy":        { "score": <0-100>, "repeatedPhrases": [string], "echoSections": [string] },
    "readability":       { "score": <0-100>, "fleschFR": <number>, "longSentences": [string] },
    "biasAndOverclaim":  { "score": <0-100>, "overstatements": [string] }
  },
  "topPriorityFixes": [string, string, string]
}

Regles :
- chaque tableau peut etre vide [] mais doit etre present ;
- topPriorityFixes : 3 actions ordonnees par impact, formulees a l'imperatif ("Citer la source du chiffre X", "Raccourcir la section Y", ...) ;
- sois concret : cite les passages exacts ou les claims problematiques entre guillemets dans tes commentaires ;
- ne reformule pas l'article, diagnostique uniquement.`;

const AI_SURFACE_CONFIGS: Record<NeuralAiSurfaceId, NeuralAiSurfaceConfig> = {
  "public-chat-demo": {
    id: "public-chat-demo",
    label: "Chat public NEURAL",
    stage: "live",
    preparedFor: "step-1",
    primaryModel: "anthropic/claude-sonnet-4.6",
    fallbackModels: ["openai/gpt-5.4"],
    dataScope: "Catalogue public NEURAL, truth layer public, secteurs et branches visibles.",
    deliverable: "Reponse de cadrage public et orientation vers le meilleur parcours de demo.",
    systemPrompt: PUBLIC_CHAT_SYSTEM_PROMPT,
    maxOutputTokens: 900,
    temperature: 0.35,
  },
  "luxe-finance-assistant": {
    id: "luxe-finance-assistant",
    label: "Assistant Luxe Finance",
    stage: "prepared",
    preparedFor: "step-2",
    primaryModel: "anthropic/claude-sonnet-4.6",
    fallbackModels: ["openai/gpt-5.4"],
    dataScope:
      "Branche Luxe Finance, workbooks consolidation, inventaire, multi-currency et royalty.",
    deliverable: "Guidage finance lie au hub, aux preuves runtime et aux sorties export.",
    systemPrompt: LUXE_FINANCE_SYSTEM_PROMPT,
    maxOutputTokens: 1100,
    temperature: 0.25,
  },
  "publication-generator": {
    id: "publication-generator",
    label: "Generateur d'articles Publications",
    stage: "live",
    preparedFor: "step-1",
    primaryModel: "anthropic/claude-sonnet-4.6",
    fallbackModels: ["openai/gpt-5.4"],
    dataScope:
      "Brief editorial fourni par l'auteur (plan, sources, contraintes, style guide).",
    deliverable: "Corps MDX d'un article de la section /publications, conforme aux composants NEURAL.",
    systemPrompt: PUBLICATION_GENERATOR_SYSTEM_PROMPT,
    maxOutputTokens: 8000,
    temperature: 0.4,
  },
  "publication-reviewer": {
    id: "publication-reviewer",
    label: "Reviewer editorial Publications",
    stage: "live",
    preparedFor: "step-1",
    primaryModel: "anthropic/claude-sonnet-4.6",
    fallbackModels: ["openai/gpt-5.4"],
    dataScope: "Article MDX deja redige + brief d'origine si disponible.",
    deliverable: "Rapport JSON structure : scores par axe + corrections priorisees.",
    systemPrompt: PUBLICATION_REVIEWER_SYSTEM_PROMPT,
    maxOutputTokens: 3000,
    temperature: 0.15,
  },
};

function getSurfaceConfig(surfaceId: NeuralAiSurfaceId) {
  return AI_SURFACE_CONFIGS[surfaceId];
}

export function getAiGatewayAuthMode(): AiGatewayAuthMode {
  if (process.env.NEURAL_AI_PROVIDER === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    return "anthropic_direct";
  }

  if (process.env.AI_GATEWAY_API_KEY) {
    return "api_key";
  }

  if (process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL === "1") {
    return "oidc";
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return "anthropic_direct";
  }

  return "missing";
}

export function getAiGatewayAuthLabel(authMode: AiGatewayAuthMode) {
  switch (authMode) {
    case "api_key":
      return "API key AI Gateway detectee";
    case "oidc":
      return "OIDC Vercel / env pull";
    case "anthropic_direct":
      return "ANTHROPIC_API_KEY direct (bypass gateway)";
    default:
      return "Configuration manquante";
  }
}

export function getAiSurfaceReadiness() {
  return Object.values(AI_SURFACE_CONFIGS).map((surface) => ({
    id: surface.id,
    label: surface.label,
    stage: surface.stage,
    preparedFor: surface.preparedFor,
    primaryModel: surface.primaryModel,
    fallbackModels: surface.fallbackModels,
    dataScope: surface.dataScope,
    deliverable: surface.deliverable,
  }));
}

export function getAiRuntimeReadinessSummary() {
  const authMode = getAiGatewayAuthMode();

  return {
    authMode,
    authLabel: getAiGatewayAuthLabel(authMode),
    liveSurface: AI_SURFACE_CONFIGS["public-chat-demo"],
    preparedSurface: AI_SURFACE_CONFIGS["luxe-finance-assistant"],
  };
}

function buildGatewayTags(surface: NeuralAiSurfaceConfig) {
  return [
    ...SHARED_TAGS,
    `surface:${surface.id}`,
    `stage:${surface.stage}`,
    `prepared-for:${surface.preparedFor}`,
  ];
}

function buildGatewayProviderOptions(surface: NeuralAiSurfaceConfig, userId: string) {
  return {
    gateway: {
      order: ["anthropic", "openai"],
      models: [...surface.fallbackModels],
      user: userId,
      tags: buildGatewayTags(surface),
      cacheControl: "max-age=0",
    },
  };
}

export async function streamNeuralTextSurface({
  surfaceId,
  messages,
  userId,
}: {
  surfaceId: NeuralAiSurfaceId;
  messages: ModelMessage[];
  userId: string;
}) {
  const surface = getSurfaceConfig(surfaceId);
  const authMode = getAiGatewayAuthMode();

  if (authMode === "missing") {
    throw new Error(
      "AI Gateway n'est pas configure. Utilise `vercel env pull .env.local` ou ajoute `AI_GATEWAY_API_KEY`.",
    );
  }

  const startedAt = Date.now();
  const tags = buildGatewayTags(surface);

  // logAiGenerationStart returns a traceId that threads through finish/error
  const { traceId } = logAiGenerationStart({
    surfaceId: surface.id,
    requestedModel: surface.primaryModel,
    fallbackModels: surface.fallbackModels,
    gatewayAuthMode: authMode,
    userId,
    tags,
  });

  const result = streamText({
    model: resolveModel(surface.primaryModel, authMode),
    system: surface.systemPrompt,
    messages,
    maxOutputTokens: surface.maxOutputTokens,
    temperature: surface.temperature,
    maxRetries: 2,
    ...(authMode === "anthropic_direct"
      ? {}
      : { providerOptions: buildGatewayProviderOptions(surface, userId) }),
    onFinish: (event) => {
      logAiGenerationFinish({
        traceId,
        surfaceId: surface.id,
        requestedModel: surface.primaryModel,
        resolvedModel: event.model.modelId,
        fallbackModels: surface.fallbackModels,
        gatewayAuthMode: authMode,
        userId,
        tags,
        latencyMs: Date.now() - startedAt,
        finishReason: event.finishReason,
        usage: event.totalUsage as LanguageModelUsage | undefined,
      });
    },
    onError: ({ error }) => {
      logAiGenerationError({
        traceId,
        surfaceId: surface.id,
        requestedModel: surface.primaryModel,
        resolvedModel: surface.primaryModel,
        fallbackModels: surface.fallbackModels,
        gatewayAuthMode: authMode,
        userId,
        tags,
        latencyMs: Date.now() - startedAt,
        error,
      });
    },
  });

  return {
    result,
    surface,
    authMode,
    tags,
  };
}

/**
 * Variante non streamee pour les usages hors HTTP (CLI, scripts batch).
 * Meme contrat de logs Langfuse que streamNeuralTextSurface.
 */
export async function generateNeuralTextSurface({
  surfaceId,
  messages,
  userId,
  maxOutputTokensOverride,
  temperatureOverride,
}: {
  surfaceId: NeuralAiSurfaceId;
  messages: ModelMessage[];
  userId: string;
  maxOutputTokensOverride?: number;
  temperatureOverride?: number;
}) {
  const surface = getSurfaceConfig(surfaceId);
  const authMode = getAiGatewayAuthMode();

  if (authMode === "missing") {
    throw new Error(
      "AI Gateway n'est pas configure. Utilise `vercel env pull .env.local` ou ajoute `AI_GATEWAY_API_KEY`.",
    );
  }

  const startedAt = Date.now();
  const tags = buildGatewayTags(surface);

  const { traceId } = logAiGenerationStart({
    surfaceId: surface.id,
    requestedModel: surface.primaryModel,
    fallbackModels: surface.fallbackModels,
    gatewayAuthMode: authMode,
    userId,
    tags,
  });

  try {
    const result = await generateText({
      model: resolveModel(surface.primaryModel, authMode),
      system: surface.systemPrompt,
      messages,
      maxOutputTokens: maxOutputTokensOverride ?? surface.maxOutputTokens,
      temperature: temperatureOverride ?? surface.temperature,
      maxRetries: 2,
      ...(authMode === "anthropic_direct"
        ? {}
        : { providerOptions: buildGatewayProviderOptions(surface, userId) }),
    });

    logAiGenerationFinish({
      traceId,
      surfaceId: surface.id,
      requestedModel: surface.primaryModel,
      resolvedModel: result.response.modelId,
      fallbackModels: surface.fallbackModels,
      gatewayAuthMode: authMode,
      userId,
      tags,
      latencyMs: Date.now() - startedAt,
      finishReason: result.finishReason,
      usage: result.usage as LanguageModelUsage | undefined,
    });

    return {
      text: result.text,
      usage: result.usage,
      finishReason: result.finishReason,
      resolvedModel: result.response.modelId,
      traceId,
      surface,
      authMode,
      tags,
    };
  } catch (error) {
    logAiGenerationError({
      traceId,
      surfaceId: surface.id,
      requestedModel: surface.primaryModel,
      resolvedModel: surface.primaryModel,
      fallbackModels: surface.fallbackModels,
      gatewayAuthMode: authMode,
      userId,
      tags,
      latencyMs: Date.now() - startedAt,
      error,
    });
    throw error;
  }
}
