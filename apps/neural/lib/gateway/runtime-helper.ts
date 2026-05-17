/**
 * NEURAL — Operator Gateway runtime helper
 *
 * Thin wrapper around `logGatewayEvent` for agent runtimes. The underlying
 * function self-gates on `env.database.ready`, so calling this from any route
 * is safe even when no database is provisioned (dev, preview without Neon).
 *
 * Every call is wrapped in try/catch: a failed audit log must NEVER break the
 * user-facing response.
 */

import { logGatewayEvent, type LogResult } from "./log";
import { hashPrompt, type GatewayDecisionValue } from "./sign";

export interface RecordAgentRunInput {
  /** Public slug, e.g. "maison-voice-guard". Matches /agents/<slug> route. */
  agentId: string;
  /** Semver string. Default: "1.0.0". */
  agentVersion?: string;
  /** Raw user input — hashed to SHA-256 before persistence (never stored). */
  prompt: string;
  decision: GatewayDecisionValue;
  /** Free-text outcome tag, e.g. "voice-score:llm-ok" or "claim-check:deterministic". */
  outcome: string;
  model?: string | null;
  latencyMs?: number | null;
  /** What triggered the run: "sandbox", "internal-review", "cron", … */
  trigger?: string | null;
  tenantId?: string;
}

export async function recordAgentRun(input: RecordAgentRunInput): Promise<LogResult | null> {
  try {
    return await logGatewayEvent({
      tenantId: input.tenantId,
      agentId: input.agentId,
      agentVersion: input.agentVersion ?? "1.0.0",
      model: input.model ?? null,
      promptHash: hashPrompt(input.prompt),
      decision: input.decision,
      outcome: input.outcome,
      trigger: input.trigger ?? null,
      latencyMs: input.latencyMs ?? null,
    });
  } catch (err) {
    console.warn("[recordAgentRun] unexpected", {
      agentId: input.agentId,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
