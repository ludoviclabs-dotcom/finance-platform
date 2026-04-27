/**
 * NEURAL — AI telemetry layer (Sprint 2 — Langfuse wired)
 *
 * Two-channel telemetry for every LLM call:
 *   • Structured console logs  — always active, zero config (Vercel Log Drains pick these up)
 *   • Langfuse traces          — activated when LANGFUSE_PUBLIC_KEY + LANGFUSE_SECRET_KEY are set
 *
 * Called by lib/ai/router.ts at three lifecycle points:
 *   logAiGenerationStart  → returns { traceId } to thread through to finish/error
 *   logAiGenerationFinish → closes the Langfuse generation with tokens + latency
 *   logAiGenerationError  → closes the generation with error level
 *
 * Privacy note: message content is NOT sent to Langfuse — only metadata
 * (model, latency, token counts, tags). This is intentional for French
 * enterprise clients subject to GDPR.
 */

import type { LanguageModelUsage } from "ai";

import type { NeuralAiSurfaceId } from "@/lib/ai/router";
import {
  getLangfuseClient,
  registerTrace,
  popTrace,
  flushLangfuse,
} from "@/lib/ai/langfuse";

// ── Field registry ───────────────────────────────────────────────────────────

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

// ── Types ────────────────────────────────────────────────────────────────────

type AiTelemetryPhase = "start" | "finish" | "error";

interface BaseAiTelemetryPayload {
  surfaceId: NeuralAiSurfaceId;
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

// ── Console emitter ──────────────────────────────────────────────────────────

function emitTelemetry(
  phase: AiTelemetryPhase,
  payload: Record<string, unknown>,
  level: "info" | "error" = "info",
) {
  const event = JSON.stringify({
    scope: "neural.ai.telemetry",
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

// ── Public hooks ─────────────────────────────────────────────────────────────

/**
 * Called when a generation starts. Returns a traceId that must be passed to
 * logAiGenerationFinish / logAiGenerationError to link the lifecycle events.
 */
export function logAiGenerationStart(payload: BaseAiTelemetryPayload): {
  traceId: string;
} {
  const traceId = crypto.randomUUID();

  emitTelemetry("start", { traceId, ...payload });

  // Langfuse — create trace and store for finish callback
  const lf = getLangfuseClient();
  if (lf) {
    try {
      const trace = lf.trace({
        id: traceId,
        name: `neural.${payload.surfaceId}`,
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

/**
 * Called when a generation completes successfully. Closes the Langfuse
 * generation with token usage and latency data.
 */
export function logAiGenerationFinish(payload: AiGenerationFinishPayload): void {
  emitTelemetry("finish", {
    ...payload,
    inputTokens: payload.usage?.inputTokens,
    outputTokens: payload.usage?.outputTokens,
    totalTokens: payload.usage?.totalTokens,
  });

  // Langfuse — end the generation
  const trace = popTrace(payload.traceId);
  if (trace) {
    try {
      const startTime = new Date(Date.now() - payload.latencyMs);

      const generation = trace.generation({
        name: "gateway-llm",
        model: payload.resolvedModel,
        startTime,
        endTime: new Date(),
        // Content intentionally omitted (GDPR / privacy)
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

/**
 * Called when a generation fails. Closes the Langfuse generation at ERROR
 * level so it appears in the Langfuse error dashboard.
 */
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

  // Langfuse — end the generation with error level
  const trace = popTrace(payload.traceId);
  if (trace) {
    try {
      const startTime = new Date(Date.now() - payload.latencyMs);
      const errMessage =
        payload.error instanceof Error
          ? payload.error.message
          : String(payload.error);

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

// ── Readiness report ─────────────────────────────────────────────────────────

export function getAiTelemetryReadiness() {
  const lf = getLangfuseClient();
  return {
    status: lf ? ("active" as const) : ("console-only" as const),
    langfuseEnabled: Boolean(lf),
    trackedFields: AI_TELEMETRY_FIELDS,
    notes: lf
      ? [
          "Les appels IA sont tracés dans Langfuse (modèle, latence, tokens).",
          "Le contenu des messages n'est pas envoyé à Langfuse (RGPD).",
        ]
      : [
          "Langfuse non configuré — journalisation console uniquement.",
          "Ajouter LANGFUSE_PUBLIC_KEY + LANGFUSE_SECRET_KEY pour activer le tracing.",
        ],
  };
}
