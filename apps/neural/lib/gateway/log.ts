import { db } from "@/lib/db";
import { env } from "@/lib/env";

import { signEvent, type GatewayDecisionValue } from "./sign";

export interface LogGatewayEventInput {
  tenantId?: string;
  runId?: string | null;
  agentId: string;
  agentVersion: string;
  model?: string | null;
  promptHash: string;
  decision: GatewayDecisionValue;
  outcome: string;
  trigger?: string | null;
  tokens?: number | null;
  latencyMs?: number | null;
  costEur?: number | null;
}

export interface LogResult {
  persisted: boolean;
  sequence: number | null;
  signature: string | null;
  prevSignature: string | null;
  reason?: string;
}

/**
 * Persist one gateway enforcement event with a chained SHA-256 signature.
 * Self-gates on env.database.ready so the build / dev mode stays green
 * without a database. Uses a serializable transaction with a per-tenant
 * advisory lock to keep the sequence + signature chain monotonic under
 * concurrent writes.
 */
export async function logGatewayEvent(input: LogGatewayEventInput): Promise<LogResult> {
  if (!env.database.ready) {
    return { persisted: false, sequence: null, signature: null, prevSignature: null, reason: "no-db-url" };
  }

  const tenantId = input.tenantId ?? "default";

  try {
    return await db.$transaction(async (tx) => {
      // Advisory lock keyed on the tenantId hash to serialize writes per
      // tenant without blocking other tenants.
      const lockKey = tenantHash(tenantId);
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${lockKey})`);

      const last = await tx.gatewayEvent.findFirst({
        where: { tenantId },
        orderBy: { sequence: "desc" },
        select: { sequence: true, signature: true },
      });

      const sequence = (last?.sequence ?? 0) + 1;
      const prevSignature = last?.signature ?? "";
      const recordedAt = new Date();

      const signature = signEvent(prevSignature, {
        sequence,
        tenantId,
        agentId: input.agentId,
        agentVersion: input.agentVersion,
        model: input.model ?? null,
        promptHash: input.promptHash,
        decision: input.decision,
        recordedAtMs: recordedAt.getTime(),
      });

      await tx.gatewayEvent.create({
        data: {
          sequence,
          tenantId,
          runId: input.runId ?? null,
          agentId: input.agentId,
          agentVersion: input.agentVersion,
          model: input.model ?? null,
          promptHash: input.promptHash,
          decision: input.decision,
          outcome: input.outcome,
          trigger: input.trigger ?? null,
          tokens: input.tokens ?? null,
          latencyMs: input.latencyMs ?? null,
          costEur: input.costEur ?? null,
          prevSignature,
          signature,
          recordedAt,
        },
      });

      return { persisted: true, sequence, signature, prevSignature };
    });
  } catch (err) {
    console.warn("gateway event log failed", {
      err: err instanceof Error ? err.message : String(err),
      agentId: input.agentId,
    });
    return {
      persisted: false,
      sequence: null,
      signature: null,
      prevSignature: null,
      reason: err instanceof Error ? err.name : "error",
    };
  }
}

/**
 * Cheap deterministic 32-bit advisory-lock key from a tenant id. Postgres
 * pg_advisory_xact_lock accepts a bigint, but a 32-bit value is enough to
 * avoid collisions for any realistic tenant cardinality.
 */
function tenantHash(tenantId: string): number {
  let h = 0;
  for (let i = 0; i < tenantId.length; i += 1) {
    h = ((h << 5) - h + tenantId.charCodeAt(i)) | 0;
  }
  return h;
}
