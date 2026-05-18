/**
 * ARTICLE STUDIO — AI surface router (Sprint 0 baseline)
 *
 * 4 typed surfaces, each pinned to a Claude model with caching + telemetry:
 *
 *   • outline-planner    → claude-opus-4-7    — JSON outline (low temp, structured)
 *   • section-writer     → claude-sonnet-4-6  — long-form FR prose, streamed
 *   • query-expander     → claude-haiku-4-5   — 3-5 reformulations for retrieval
 *   • reranker-llm       → claude-haiku-4-5   — fallback when COHERE_API_KEY absent
 *
 * Auth modes mirror neural's pattern:
 *   OIDC (prod Vercel) → AI Gateway via OIDC token (automatic)
 *   api_key            → AI_GATEWAY_API_KEY (local dev with gateway)
 *   anthropic_direct   → ANTHROPIC_API_KEY (local dev bypassing gateway)
 */

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

export type ArticleStudioSurfaceId =
  | "outline-planner"
  | "section-writer"
  | "query-expander"
  | "reranker-llm";

export type AiGatewayAuthMode =
  | "oidc"
  | "api_key"
  | "anthropic_direct"
  | "missing";

// Direct-Anthropic model IDs (used when ANTHROPIC_API_KEY bypasses the gateway).
// Gateway-prefixed IDs ("anthropic/claude-…") are used when the gateway is active.
const ANTHROPIC_DIRECT_MAP: Record<string, string> = {
  "anthropic/claude-opus-4-7": "claude-opus-4-7",
  "anthropic/claude-sonnet-4-6": "claude-sonnet-4-6",
  "anthropic/claude-haiku-4-5": "claude-haiku-4-5-20251001",
};

function resolveModel(
  gatewayModel: GatewayModelId,
  authMode: AiGatewayAuthMode,
): LanguageModel {
  if (authMode === "anthropic_direct") {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const directId =
      ANTHROPIC_DIRECT_MAP[gatewayModel as string] ?? "claude-sonnet-4-6";
    return anthropic(directId);
  }
  return gateway(gatewayModel);
}

interface SurfaceConfig {
  id: ArticleStudioSurfaceId;
  label: string;
  primaryModel: GatewayModelId;
  fallbackModels: readonly GatewayModelId[];
  systemPrompt: string;
  maxOutputTokens: number;
  temperature: number;
}

const SHARED_TAGS = ["product:article-studio", "runtime:ai-gateway"] as const;

const OUTLINE_SYSTEM_PROMPT = `Tu es un architecte éditorial. À partir d'un brief et d'un corpus de passages numérotés [S1], [S2], ...,
tu produis le plan structuré d'un article en JSON strict, sans aucun texte autour.

Format de sortie :
{
  "title": "Titre accrocheur de l'article",
  "metaDescription": "Phrase courte (max 160 caractères)",
  "sections": [
    { "id": "intro", "title": "…", "summary": "1 phrase", "sourceRefs": ["S1","S3"] },
    { "id": "section-1", "title": "…", "summary": "…", "sourceRefs": ["S2","S5"] }
  ]
}

Règles :
- 4 à 7 sections H2.
- sourceRefs : indique les [S\\d] que la section devra citer.
- N'invente aucune section qui ne soit pas appuyée par au moins 1 passage du corpus.
- Si le brief est trop vague pour 4 sections, propose-en moins et explicite "summary": "INFO MANQUANTE".`;

const SECTION_WRITER_SYSTEM_PROMPT = `Tu rédiges UNE section d'article éditorial à partir d'un brief et de passages numérotés [S1], [S2], ...

Règles absolues :
- N'utilise QUE les informations présentes dans les passages fournis.
- Cite tes sources inline avec [S\\d] après chaque affirmation factuelle, statistique ou citation.
- Si une information attendue manque, écris exactement "[INFO MANQUANTE: <ce qui manque>]" — sans paraphraser depuis ta mémoire.
- Ton : analytique, précis, sans jargon vide. Pas de listes à puces décoratives.
- Sors UNIQUEMENT le contenu Markdown de la section (titre H2 inclus). Pas de YAML, pas de balise de code englobante.`;

const QUERY_EXPANDER_SYSTEM_PROMPT = `Tu reformules un sujet éditorial en 3 à 5 requêtes de recherche complémentaires
pour interroger un index vectoriel. Couvre différents angles : définition, chiffres, exemples, controverses, perspectives.

Sortie : JSON strict, aucun texte autour.
{ "queries": ["…", "…", "…"] }

Langue : français. Chaque requête : courte (≤ 15 mots), spécifique, sans formulation interrogative.`;

const RERANKER_SYSTEM_PROMPT = `Tu notes la pertinence de passages textuels par rapport à une requête.
Sortie : JSON strict { "scores": [{ "id": "S1", "score": 0.0-1.0 }, ...] } — un score par passage, dans l'ordre reçu.
Critères : alignement sémantique avec la requête, présence d'information factuelle, spécificité (pénalise les généralités).`;

const SURFACE_CONFIGS: Record<ArticleStudioSurfaceId, SurfaceConfig> = {
  "outline-planner": {
    id: "outline-planner",
    label: "Plan d'article (outline)",
    primaryModel: "anthropic/claude-opus-4-7" as GatewayModelId,
    fallbackModels: ["anthropic/claude-sonnet-4-6"] as readonly GatewayModelId[],
    systemPrompt: OUTLINE_SYSTEM_PROMPT,
    maxOutputTokens: 2000,
    temperature: 0.3,
  },
  "section-writer": {
    id: "section-writer",
    label: "Rédaction de section",
    primaryModel: "anthropic/claude-sonnet-4-6" as GatewayModelId,
    fallbackModels: ["anthropic/claude-haiku-4-5"] as readonly GatewayModelId[],
    systemPrompt: SECTION_WRITER_SYSTEM_PROMPT,
    maxOutputTokens: 4000,
    temperature: 0.5,
  },
  "query-expander": {
    id: "query-expander",
    label: "Expansion de requête",
    primaryModel: "anthropic/claude-haiku-4-5" as GatewayModelId,
    fallbackModels: ["anthropic/claude-sonnet-4-6"] as readonly GatewayModelId[],
    systemPrompt: QUERY_EXPANDER_SYSTEM_PROMPT,
    maxOutputTokens: 400,
    temperature: 0.7,
  },
  "reranker-llm": {
    id: "reranker-llm",
    label: "Reranker (fallback LLM)",
    primaryModel: "anthropic/claude-haiku-4-5" as GatewayModelId,
    fallbackModels: ["anthropic/claude-sonnet-4-6"] as readonly GatewayModelId[],
    systemPrompt: RERANKER_SYSTEM_PROMPT,
    maxOutputTokens: 800,
    temperature: 0.0,
  },
};

function getSurfaceConfig(surfaceId: ArticleStudioSurfaceId) {
  return SURFACE_CONFIGS[surfaceId];
}

export function getAiGatewayAuthMode(): AiGatewayAuthMode {
  if (process.env.AI_GATEWAY_API_KEY) return "api_key";
  if (process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL === "1") return "oidc";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic_direct";
  return "missing";
}

export function getAiGatewayAuthLabel(authMode: AiGatewayAuthMode) {
  switch (authMode) {
    case "api_key":
      return "API key AI Gateway détectée";
    case "oidc":
      return "OIDC Vercel / env pull";
    case "anthropic_direct":
      return "ANTHROPIC_API_KEY direct (bypass gateway)";
    default:
      return "Configuration manquante";
  }
}

export function getAiSurfaceReadiness() {
  return Object.values(SURFACE_CONFIGS).map((s) => ({
    id: s.id,
    label: s.label,
    primaryModel: s.primaryModel,
    fallbackModels: s.fallbackModels,
  }));
}

function buildSurfaceTags(surface: SurfaceConfig) {
  return [...SHARED_TAGS, `surface:${surface.id}`];
}

function buildGatewayProviderOptions(surface: SurfaceConfig, userId: string) {
  return {
    gateway: {
      order: ["anthropic"],
      models: [...surface.fallbackModels],
      user: userId,
      tags: buildSurfaceTags(surface),
      cacheControl: "max-age=0",
    },
  };
}

/**
 * Streamed generation — used for section writing (long-form, SSE to client).
 */
export async function streamArticleStudioSurface({
  surfaceId,
  messages,
  userId,
}: {
  surfaceId: ArticleStudioSurfaceId;
  messages: ModelMessage[];
  userId: string;
}) {
  const surface = getSurfaceConfig(surfaceId);
  const authMode = getAiGatewayAuthMode();

  if (authMode === "missing") {
    throw new Error(
      "AI configuration missing. Set AI_GATEWAY_API_KEY or ANTHROPIC_API_KEY.",
    );
  }

  const startedAt = Date.now();
  const tags = buildSurfaceTags(surface);

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

  return { result, surface, authMode, tags };
}

/**
 * Non-streamed generation — used for outline planning, query expansion, reranking,
 * and any structured-JSON surface that doesn't need to stream to a UI.
 */
export async function generateArticleStudioSurface({
  surfaceId,
  messages,
  userId,
  maxOutputTokensOverride,
  temperatureOverride,
}: {
  surfaceId: ArticleStudioSurfaceId;
  messages: ModelMessage[];
  userId: string;
  maxOutputTokensOverride?: number;
  temperatureOverride?: number;
}) {
  const surface = getSurfaceConfig(surfaceId);
  const authMode = getAiGatewayAuthMode();

  if (authMode === "missing") {
    throw new Error(
      "AI configuration missing. Set AI_GATEWAY_API_KEY or ANTHROPIC_API_KEY.",
    );
  }

  const startedAt = Date.now();
  const tags = buildSurfaceTags(surface);

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
