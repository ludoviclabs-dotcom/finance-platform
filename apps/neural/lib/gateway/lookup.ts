import { db } from "@/lib/db";
import { env } from "@/lib/env";

import { signEvent, type GatewayDecisionValue } from "./sign";

export type LookupOutcome =
  | { kind: "invalid-format" }
  | { kind: "db-unavailable" }
  | { kind: "unknown" }
  | { kind: "tampered"; row: SignatureRow; recomputed: string }
  | { kind: "verified"; row: SignatureRow };

export interface SignatureRow {
  sequence: number;
  tenantId: string;
  agentId: string;
  agentVersion: string;
  model: string | null;
  decision: GatewayDecisionValue;
  outcome: string;
  recordedAt: Date;
  signature: string;
  prevSignature: string;
  promptHash: string;
}

/**
 * Resolve a gateway signature back to its event. Recomputes the signature
 * from stored fields to detect tampering — a row whose stored signature
 * doesn't match the recomputed value is flagged as "tampered".
 */
export async function lookupSignature(rawHash: string): Promise<LookupOutcome> {
  const hash = rawHash.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) return { kind: "invalid-format" };
  if (!env.database.ready) return { kind: "db-unavailable" };

  try {
    const event = await db.gatewayEvent.findUnique({
      where: { signature: hash },
      select: {
        sequence: true,
        tenantId: true,
        agentId: true,
        agentVersion: true,
        model: true,
        promptHash: true,
        decision: true,
        outcome: true,
        recordedAt: true,
        signature: true,
        prevSignature: true,
      },
    });
    if (!event) return { kind: "unknown" };

    const recomputed = signEvent(event.prevSignature, {
      sequence: event.sequence,
      tenantId: event.tenantId,
      agentId: event.agentId,
      agentVersion: event.agentVersion,
      model: event.model,
      promptHash: event.promptHash,
      decision: event.decision as GatewayDecisionValue,
      recordedAtMs: event.recordedAt.getTime(),
    });

    if (recomputed !== event.signature) {
      return {
        kind: "tampered",
        row: { ...event, decision: event.decision as GatewayDecisionValue },
        recomputed,
      };
    }
    return {
      kind: "verified",
      row: { ...event, decision: event.decision as GatewayDecisionValue },
    };
  } catch (err) {
    console.warn("signature lookup failed", {
      err: err instanceof Error ? err.message : String(err),
      hash: hash.slice(0, 8),
    });
    return { kind: "db-unavailable" };
  }
}
