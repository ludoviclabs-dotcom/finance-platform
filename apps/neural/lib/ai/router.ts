import {
  gateway,
  streamText,
  type GatewayModelId,
  type LanguageModelUsage,
  type ModelMessage,
} from "ai";

import {
  logAiGenerationError,
  logAiGenerationFinish,
  logAiGenerationStart,
} from "@/lib/telemetry/ai";

export type NeuralAiSurfaceId = "public-chat-demo" | "luxe-finance-assistant";
export type NeuralAiSurfaceStage = "live" | "prepared";
export type AiGatewayAuthMode = "oidc" | "api_key" | "missing";

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
};

function getSurfaceConfig(surfaceId: NeuralAiSurfaceId) {
  return AI_SURFACE_CONFIGS[surfaceId];
}

export function getAiGatewayAuthMode(): AiGatewayAuthMode {
  if (process.env.AI_GATEWAY_API_KEY) {
    return "api_key";
  }

  if (process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL === "1") {
    return "oidc";
  }

  return "missing";
}

export function getAiGatewayAuthLabel(authMode: AiGatewayAuthMode) {
  switch (authMode) {
    case "api_key":
      return "API key AI Gateway detectee";
    case "oidc":
      return "OIDC Vercel / env pull";
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
    model: gateway(surface.primaryModel),
    system: surface.systemPrompt,
    messages,
    maxOutputTokens: surface.maxOutputTokens,
    temperature: surface.temperature,
    maxRetries: 2,
    providerOptions: buildGatewayProviderOptions(surface, userId),
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
