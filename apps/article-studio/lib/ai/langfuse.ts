/**
 * ARTICLE STUDIO — Langfuse observability client
 *
 * Singleton Langfuse client + lightweight in-flight trace registry so
 * start → finish callbacks in the AI router share the same trace.
 *
 * Fails silently when credentials are absent (dev mode without Langfuse).
 */

import Langfuse from "langfuse";
import { env } from "@/lib/env";

let _langfuse: Langfuse | null = null;

export function getLangfuseClient(): Langfuse | null {
  if (!env.observability.ready) return null;
  if (_langfuse) return _langfuse;

  try {
    _langfuse = new Langfuse({
      publicKey: env.observability.publicKey!,
      secretKey: env.observability.secretKey!,
      baseUrl: env.observability.baseUrl,
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

type LangfuseTrace = ReturnType<Langfuse["trace"]>;

const activeTraces = new Map<string, LangfuseTrace>();

export function registerTrace(traceId: string, trace: LangfuseTrace): void {
  activeTraces.set(traceId, trace);
  setTimeout(() => activeTraces.delete(traceId), 5 * 60_000);
}

export function popTrace(traceId: string): LangfuseTrace | undefined {
  const trace = activeTraces.get(traceId);
  activeTraces.delete(traceId);
  return trace;
}

export async function flushLangfuse(): Promise<void> {
  if (_langfuse) {
    try {
      await _langfuse.flushAsync();
    } catch (err) {
      console.warn("[langfuse] Flush error:", err instanceof Error ? err.message : err);
    }
  }
}
