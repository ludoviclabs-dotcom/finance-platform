import { createHash } from "node:crypto";

export type GatewayDecisionValue = "ALLOW" | "REVIEW" | "BLOCK";

export interface SignableEvent {
  sequence: number;
  tenantId: string;
  agentId: string;
  agentVersion: string;
  model: string | null;
  promptHash: string;
  decision: GatewayDecisionValue;
  recordedAtMs: number;
}

/**
 * SHA-256 chained signature over the event's identifying fields plus the
 * previous event's signature. Canonical ordering is enforced by the JSON
 * replacer below so any backend (Node, edge, browser) can recompute the
 * same hash from the same inputs.
 *
 * The recordedAt timestamp is encoded as epoch millis (number) rather than
 * a wall-clock string so we don't depend on local time formatting.
 */
export function signEvent(prevSignature: string, event: SignableEvent): string {
  const canonical = JSON.stringify(
    {
      sequence: event.sequence,
      tenantId: event.tenantId,
      agentId: event.agentId,
      agentVersion: event.agentVersion,
      model: event.model ?? null,
      promptHash: event.promptHash,
      decision: event.decision,
      recordedAtMs: event.recordedAtMs,
      prevSignature,
    },
    canonicalReplacer,
  );
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

function canonicalReplacer(_key: string, value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[k] = (value as Record<string, unknown>)[k];
    }
    return sorted;
  }
  return value;
}

export interface ChainEvent extends SignableEvent {
  prevSignature: string;
  signature: string;
}

export interface ChainVerification {
  valid: boolean;
  total: number;
  brokenAt: number | null;
  brokenReason: string | null;
}

/**
 * Walk a chain of events ordered by sequence and verify every signature is
 * consistent with the previous one. Returns brokenAt = the sequence number
 * of the first invalid event when the chain is broken.
 */
export function verifyChain(events: ChainEvent[]): ChainVerification {
  if (events.length === 0) {
    return { valid: true, total: 0, brokenAt: null, brokenReason: null };
  }

  const sorted = [...events].sort((a, b) => a.sequence - b.sequence);

  for (let i = 0; i < sorted.length; i += 1) {
    const ev = sorted[i];
    const expectedPrev = i === 0 ? "" : sorted[i - 1].signature;
    if (ev.prevSignature !== expectedPrev) {
      return {
        valid: false,
        total: sorted.length,
        brokenAt: ev.sequence,
        brokenReason: "prev-signature-mismatch",
      };
    }
    const recomputed = signEvent(expectedPrev, ev);
    if (recomputed !== ev.signature) {
      return {
        valid: false,
        total: sorted.length,
        brokenAt: ev.sequence,
        brokenReason: "signature-mismatch",
      };
    }
  }

  return { valid: true, total: sorted.length, brokenAt: null, brokenReason: null };
}

export function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt, "utf8").digest("hex");
}

export function shortSig(signature: string): string {
  if (signature.length < 16) return signature;
  return `${signature.slice(0, 8)}…${signature.slice(-8)}`;
}
