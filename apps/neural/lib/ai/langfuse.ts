/**
 * NEURAL — Langfuse observability client (Sprint 2)
 *
 * Provides a singleton Langfuse client and a lightweight in-flight trace
 * registry so start → finish callbacks in the AI router can share the same
 * Langfuse trace object.
 *
 * Lifecycle:
 *   1. logAiGenerationStart  → getLangfuseClient() → trace created, stored in activeTraces
 *   2. logAiGenerationFinish → popTrace(traceId) → generation ended, flushLangfuse()
 *   3. logAiGenerationError  → popTrace(traceId) → generation ended with error level
 *
 * Fails silently when LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY are absent so
 * the app runs in dev without credentials.
 */

import Langfuse from "langfuse";
import { env } from "@/lib/env";

// ── Singleton ────────────────────────────────────────────────────────────────

let _langfuse: Langfuse | null = null;

export function getLangfuseClient(): Langfuse | null {
  if (!env.observability.ready) return null;
  if (_langfuse) return _langfuse;

  try {
    _langfuse = new Langfuse({
      publicKey: env.observability.publicKey!,
      secretKey: env.observability.secretKey!,
      baseUrl: env.observability.baseUrl,
      // Flush after every event — essential for serverless (function may die
      // immediately after the response is sent).
      flushAt: 1,
      flushInterval: 0,
    });
    return _langfuse;
  } catch (err) {
    console.warn(
      "[langfuse] Failed to initialise client — observability disabled:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

// ── In-flight trace registry ─────────────────────────────────────────────────
// Keyed by a random UUID generated at generation-start time.
// Entries are consumed (deleted) at generation-finish or generation-error.

type LangfuseTrace = ReturnType<Langfuse["trace"]>;

const activeTraces = new Map<string, LangfuseTrace>();

export function registerTrace(traceId: string, trace: LangfuseTrace): void {
  activeTraces.set(traceId, trace);
  // Auto-cleanup after 5 min to prevent memory leaks from abandoned streams
  setTimeout(() => activeTraces.delete(traceId), 5 * 60_000);
}

export function popTrace(traceId: string): LangfuseTrace | undefined {
  const trace = activeTraces.get(traceId);
  activeTraces.delete(traceId);
  return trace;
}

// ── Flush ────────────────────────────────────────────────────────────────────

/**
 * Flush all pending Langfuse events. Call after streaming is complete or in
 * waitUntil() for fire-and-forget patterns.
 */
export async function flushLangfuse(): Promise<void> {
  if (_langfuse) {
    try {
      await _langfuse.flushAsync();
    } catch (err) {
      console.warn("[langfuse] Flush error:", err instanceof Error ? err.message : err);
    }
  }
}
