import { db } from "@/lib/db";
import { env } from "@/lib/env";

import { verifyChain, type ChainEvent, type ChainVerification, type GatewayDecisionValue } from "./sign";

export interface GatewayAuditEntry {
  id: string;
  sequence: number;
  recordedAt: string;
  agentId: string;
  agentVersion: string;
  model: string | null;
  promptHash: string;
  decision: GatewayDecisionValue;
  outcome: string;
  trigger: string | null;
  tokens: number | null;
  latencyMs: number | null;
  costEur: number | null;
  signature: string;
  prevSignature: string;
}

export interface GatewayState {
  source: "live" | "mock";
  stats: {
    decisions24h: number;
    allowed24h: number;
    review24h: number;
    blocked24h: number;
    distinctAgents24h: number;
  };
  recentEvents: GatewayAuditEntry[];
  chain: ChainVerification;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Read live gateway state from the database. Returns null when the database
 * is unavailable or holds no events — caller falls back to mock content.
 */
export async function getLiveGatewayState(
  tenantId: string = "default",
  limit: number = 25,
): Promise<GatewayState | null> {
  if (!env.database.ready) return null;

  try {
    const since = new Date(Date.now() - ONE_DAY_MS);
    const [recent, dayStats, distinctAgents, fullChain] = await Promise.all([
      db.gatewayEvent.findMany({
        where: { tenantId },
        orderBy: { sequence: "desc" },
        take: limit,
      }),
      db.gatewayEvent.groupBy({
        by: ["decision"],
        where: { tenantId, recordedAt: { gte: since } },
        _count: { _all: true },
      }),
      db.gatewayEvent.findMany({
        where: { tenantId, recordedAt: { gte: since } },
        select: { agentId: true },
        distinct: ["agentId"],
      }),
      db.gatewayEvent.findMany({
        where: { tenantId },
        orderBy: { sequence: "asc" },
        select: {
          sequence: true,
          tenantId: true,
          agentId: true,
          agentVersion: true,
          model: true,
          promptHash: true,
          decision: true,
          recordedAt: true,
          prevSignature: true,
          signature: true,
        },
      }),
    ]);

    if (recent.length === 0) return null;

    const counts: Record<GatewayDecisionValue, number> = { ALLOW: 0, REVIEW: 0, BLOCK: 0 };
    for (const row of dayStats) {
      counts[row.decision as GatewayDecisionValue] = row._count._all;
    }
    const decisions24h = counts.ALLOW + counts.REVIEW + counts.BLOCK;

    const chainEvents: ChainEvent[] = fullChain.map((e) => ({
      sequence: e.sequence,
      tenantId: e.tenantId,
      agentId: e.agentId,
      agentVersion: e.agentVersion,
      model: e.model,
      promptHash: e.promptHash,
      decision: e.decision as GatewayDecisionValue,
      recordedAtMs: e.recordedAt.getTime(),
      prevSignature: e.prevSignature,
      signature: e.signature,
    }));
    const chain = verifyChain(chainEvents);

    return {
      source: "live",
      stats: {
        decisions24h,
        allowed24h: counts.ALLOW,
        review24h: counts.REVIEW,
        blocked24h: counts.BLOCK,
        distinctAgents24h: distinctAgents.length,
      },
      recentEvents: recent.map(toAuditEntry),
      chain,
    };
  } catch (err) {
    console.warn("gateway state read failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

function toAuditEntry(row: {
  id: string;
  sequence: number;
  recordedAt: Date;
  agentId: string;
  agentVersion: string;
  model: string | null;
  promptHash: string;
  decision: string;
  outcome: string;
  trigger: string | null;
  tokens: number | null;
  latencyMs: number | null;
  costEur: { toString: () => string } | null;
  signature: string;
  prevSignature: string;
}): GatewayAuditEntry {
  return {
    id: row.id,
    sequence: row.sequence,
    recordedAt: row.recordedAt.toISOString(),
    agentId: row.agentId,
    agentVersion: row.agentVersion,
    model: row.model,
    promptHash: row.promptHash,
    decision: row.decision as GatewayDecisionValue,
    outcome: row.outcome,
    trigger: row.trigger,
    tokens: row.tokens,
    latencyMs: row.latencyMs,
    costEur: row.costEur !== null ? Number(row.costEur.toString()) : null,
    signature: row.signature,
    prevSignature: row.prevSignature,
  };
}
