/**
 * NEURAL — Mem0 REST client (Sprint 3)
 *
 * Thin wrapper around the Mem0 v1 API for semantic memory search.
 * Used as the search backend when MEM0_API_KEY is configured.
 * Falls back gracefully to Prisma key-search when absent.
 *
 * Docs: https://docs.mem0.ai/api-reference
 *
 * We call the REST API directly (no npm package) to keep the bundle lean.
 * All calls have a 3 s timeout — never block an agent response for memory I/O.
 */

import { env } from "@/lib/env";

const MEM0_BASE = "https://api.mem0.ai/v1";
const TIMEOUT_MS = 3_000;

// ── Types ────────────────────────────────────────────────────────────────────

export type Mem0SearchResult = {
  id: string;
  memory: string;
  score: number;
  metadata?: Record<string, unknown>;
};

export type Mem0AddResult = {
  id: string;
  data: Array<{ memory: string; event: "ADD" | "UPDATE" | "DELETE" | "NONE" }>;
};

type Mem0SearchPayload = {
  query: string;
  user_id?: string;
  agent_id?: string;
  org_id?: string;
  limit?: number;
};

type Mem0AddPayload = {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  user_id?: string;
  agent_id?: string;
  org_id?: string;
  metadata?: Record<string, unknown>;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function headers(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Token ${env.memory.mem0Key}`,
  };
}

async function mem0Fetch<T>(
  path: string,
  init: RequestInit,
): Promise<T | null> {
  if (!env.memory.ready || !env.memory.mem0Key) return null;

  try {
    const res = await fetch(`${MEM0_BASE}${path}`, {
      ...init,
      headers: headers(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn(`[mem0] ${init.method ?? "GET"} ${path} → ${res.status}`);
      return null;
    }

    return (await res.json()) as T;
  } catch (err) {
    console.warn(
      `[mem0] Request failed — continuing without Mem0:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Semantic search across memories for a given identity context.
 * Returns up to `limit` results ranked by relevance.
 */
export async function mem0Search(
  query: string,
  ctx: { userId?: string; agentId?: string; orgId?: string },
  limit = 5,
): Promise<Mem0SearchResult[]> {
  const payload: Mem0SearchPayload = {
    query,
    limit,
    ...(ctx.userId && { user_id: ctx.userId }),
    ...(ctx.agentId && { agent_id: ctx.agentId }),
    ...(ctx.orgId && { org_id: ctx.orgId }),
  };

  const result = await mem0Fetch<Mem0SearchResult[]>("/memories/search/", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return result ?? [];
}

/**
 * Store a memory in Mem0 for semantic retrieval.
 * The content should be a natural-language description of what to remember.
 */
export async function mem0Add(
  content: string,
  ctx: { userId?: string; agentId?: string; orgId?: string },
  metadata?: Record<string, unknown>,
): Promise<Mem0AddResult | null> {
  const payload: Mem0AddPayload = {
    messages: [{ role: "user", content }],
    ...(ctx.userId && { user_id: ctx.userId }),
    ...(ctx.agentId && { agent_id: ctx.agentId }),
    ...(ctx.orgId && { org_id: ctx.orgId }),
    ...(metadata && { metadata }),
  };

  return mem0Fetch<Mem0AddResult>("/memories/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Delete a specific memory from Mem0 by its external ID.
 */
export async function mem0Delete(mem0Id: string): Promise<boolean> {
  const result = await mem0Fetch<unknown>(`/memories/${mem0Id}/`, {
    method: "DELETE",
  });
  return result !== null;
}

/** True when the Mem0 client is fully configured. */
export function isMem0Ready(): boolean {
  return env.memory.ready;
}
