/**
 * ARTICLE STUDIO — AI telemetry layer
 *
 * Two-channel telemetry for every LLM call:
 *   • Structured console logs — always active
 *   • Langfuse traces — activated when LANGFUSE_* keys are set
 *
 * Called by lib/ai/router.ts at three lifecycle points:
 *   logAiGenerationStart  → returns { traceId }
 *   logAiGenerationFinish → closes Langfuse generation with tokens + latency
 *   logAiGenerationError  → closes generation at ERROR level
 *
 * Privacy: message content is NOT sent to Langfuse — only metadata.
 */

import type { LanguageModelUsage } from "ai";

import type { ArticleStudioSurfaceId } from "@/lib/ai/router";
import {
  getLangfuseClient,
  registerTrace,
  popTrace,
  flushLangfuse,
} from "@/lib/ai/langfuse";

export const AI_TELEMETRY_FIELDS = [
  "traceId",
  "surface",
  "requestedModel",
  "resolvedModel",
  "fallbackModels",
  "gatewayAuthMode",
  "userId",
  "latencyMs",
  "finishReason",
  "inputTokens",
  "outputTokens",
  "totalTokens",
] as const;

type AiTelemetryPhase = "start" | "finish" | "error";

interface BaseAiTelemetryPayload {
  surfaceId: ArticleStudioSurfaceId;
  requestedModel: string;
  fallbackModels: readonly string[];
  gatewayAuthMode: "oidc" | "api_key" | "anthropic_direct" | "missing";
  userId: string;
  tags: readonly string[];
}

interface AiGenerationFinishPayload extends BaseAiTelemetryPayload {
  traceId: string;
  resolvedModel: string;
  latencyMs: number;
  finishReason: string;
  usage?: LanguageModelUsage;
}

interface AiGenerationErrorPayload extends BaseAiTelemetryPayload {
  traceId: string;
  resolvedModel?: string;
  latencyMs: number;
  error: unknown;
}

function emitTelemetry(
  phase: AiTelemetryPhase,
  payload: Record<string, unknown>,
  level: "info" | "error" = "info",
) {
  const event = JSON.stringify({
    scope: "article-studio.ai.telemetry",
    phase,
    timestamp: new Date().toISOString(),
    ...payload,
  });

  if (level === "error") {
    console.error(event);
    return;
  }

  console.info(event);
}

export function logAiGenerationStart(payload: BaseAiTelemetryPayload): {
  traceId: string;
} {
  const traceId = crypto.randomUUID();

  emitTelemetry("start", { traceId, ...payload });

  const lf = getLangfuseClient();
  if (lf) {
    try {
      const trace = lf.trace({
        id: traceId,
        name: `article-studio.${payload.surfaceId}`,
        userId: payload.userId,
        tags: [...payload.tags],
        metadata: {
          requestedModel: payload.requestedModel,
          fallbackModels: [...payload.fallbackModels],
          gatewayAuthMode: payload.gatewayAuthMode,
        },
      });
      registerTrace(traceId, trace);
    } catch (err) {
      console.warn("[telemetry] Langfuse trace creation failed:", err);
    }
  }

  return { traceId };
}

export function logAiGenerationFinish(payload: AiGenerationFinishPayload): void {
  emitTelemetry("finish", {
    ...payload,
    inputTokens: payload.usage?.inputTokens,
    outputTokens: payload.usage?.outputTokens,
    totalTokens: payload.usage?.totalTokens,
  });

  const trace = popTrace(payload.traceId);
  if (trace) {
    try {
      const startTime = new Date(Date.now() - payload.latencyMs);

      const generation = trace.generation({
        name: "gateway-llm",
        model: payload.resolvedModel,
        startTime,
        endTime: new Date(),
        metadata: {
          requestedModel: payload.requestedModel,
          finishReason: payload.finishReason,
          gatewayAuthMode: payload.gatewayAuthMode,
        },
        usage: {
          input: payload.usage?.inputTokens,
          output: payload.usage?.outputTokens,
          total: payload.usage?.totalTokens,
          unit: "TOKENS",
        },
        level: "DEFAULT",
        statusMessage: payload.finishReason,
      });

      generation.end({});
      void flushLangfuse();
    } catch (err) {
      console.warn("[telemetry] Langfuse generation.end failed:", err);
    }
  }
}

export function logAiGenerationError(payload: AiGenerationErrorPayload): void {
  emitTelemetry(
    "error",
    {
      ...payload,
      error:
        payload.error instanceof Error
          ? { name: payload.error.name, message: payload.error.message }
          : String(payload.error),
    },
    "error",
  );

  const trace = popTrace(payload.traceId);
  if (trace) {
    try {
      const startTime = new Date(Date.now() - payload.latencyMs);
      const errMessage =
        payload.error instanceof Error ? payload.error.message : String(payload.error);

      const generation = trace.generation({
        name: "gateway-llm",
        model: payload.resolvedModel ?? payload.requestedModel,
        startTime,
        endTime: new Date(),
        level: "ERROR",
        statusMessage: errMessage,
        metadata: {
          requestedModel: payload.requestedModel,
          gatewayAuthMode: payload.gatewayAuthMode,
        },
      });

      generation.end({});
      void flushLangfuse();
    } catch (err) {
      console.warn("[telemetry] Langfuse error generation failed:", err);
    }
  }
}

export function getAiTelemetryReadiness() {
  const lf = getLangfuseClient();
  return {
    status: lf ? ("active" as const) : ("console-only" as const),
    langfuseEnabled: Boolean(lf),
    trackedFields: AI_TELEMETRY_FIELDS,
  };
}
