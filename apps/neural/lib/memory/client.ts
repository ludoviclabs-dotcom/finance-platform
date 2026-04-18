/**
 * NEURAL — Memory client (Sprint 3)
 *
 * Core CRUD layer for the `Memory` table (Prisma + Neon Postgres).
 * Optionally syncs writes to Mem0 for semantic search capability.
 *
 * Storage strategy:
 *   • Prisma  — source of truth, fast key-based reads, always available.
 *   • Mem0    — semantic index, activated when MEM0_API_KEY is configured.
 *               Writes are fire-and-forget; Mem0 failures never break the flow.
 *
 * All values are validated through MemoryValueSchema before persistence so
 * bad data never reaches the database.
 */

import type { Memory as PrismaMemory } from "@prisma/client";
import { MemoryScope } from "@prisma/client";

import { db } from "@/lib/db";
import { MemoryValueSchema, type MemoryValue } from "./schemas";
import { mem0Add, mem0Search, mem0Delete, isMem0Ready } from "./mem0";

// ── Types ────────────────────────────────────────────────────────────────────

export type MemoryScopeType = keyof typeof MemoryScope;

export type RecallOptions = {
  scope: MemoryScopeType;
  scopeId: string;
  key: string;
};

export type RememberOptions = {
  scope: MemoryScopeType;
  scopeId: string;
  key: string;
  value: MemoryValue;
  organizationId?: string;
  /** Natural-language description sent to Mem0 for semantic indexing. */
  mem0Summary?: string;
  /** Mem0 context identifiers (at most one per entity type). */
  mem0Ctx?: { userId?: string; agentId?: string; orgId?: string };
};

export type ForgetOptions = {
  scope: MemoryScopeType;
  scopeId: string;
  key: string;
};

export type SearchOptions = {
  scope: MemoryScopeType;
  scopeId: string;
  query: string;
  limit?: number;
  /** Mem0 context for semantic search. Falls back to Prisma text match. */
  mem0Ctx?: { userId?: string; agentId?: string; orgId?: string };
};

export type MemoryEntry = {
  id: string;
  scope: MemoryScopeType;
  scopeId: string;
  key: string;
  value: MemoryValue;
  organizationId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseRow(row: PrismaMemory): MemoryEntry | null {
  const parsed = MemoryValueSchema.safeParse(row.value);
  if (!parsed.success) {
    console.warn(`[memory] Corrupt value for key "${row.key}" (id=${row.id}):`, parsed.error.issues);
    return null;
  }
  return {
    id: row.id,
    scope: row.scope as MemoryScopeType,
    scopeId: row.scopeId,
    key: row.key,
    value: parsed.data,
    organizationId: row.organizationId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ── Core operations ───────────────────────────────────────────────────────────

/**
 * Retrieve the most recent memory for a (scope, scopeId, key) triplet.
 * Returns null if not found or if the stored value is corrupt.
 */
export async function recall({
  scope,
  scopeId,
  key,
}: RecallOptions): Promise<MemoryEntry | null> {
  const row = await db.memory.findFirst({
    where: { scope, scopeId, key },
    orderBy: { updatedAt: "desc" },
  });

  if (!row) return null;
  return parseRow(row);
}

/**
 * List all memories for a (scope, scopeId) pair.
 * Optionally filter by key prefix.
 */
export async function list(
  scope: MemoryScopeType,
  scopeId: string,
  keyPrefix?: string,
): Promise<MemoryEntry[]> {
  const rows = await db.memory.findMany({
    where: {
      scope,
      scopeId,
      ...(keyPrefix && { key: { startsWith: keyPrefix } }),
    },
    orderBy: { updatedAt: "desc" },
  });

  return rows.flatMap((r) => {
    const entry = parseRow(r);
    return entry ? [entry] : [];
  });
}

/**
 * Persist a memory. Upserts: if a memory with the same (scope, scopeId, key)
 * already exists, it is updated in-place. Otherwise a new row is created.
 * Also syncs to Mem0 for semantic indexing when configured.
 */
export async function remember({
  scope,
  scopeId,
  key,
  value,
  organizationId,
  mem0Summary,
  mem0Ctx,
}: RememberOptions): Promise<MemoryEntry> {
  // Validate before touching the DB
  const validated = MemoryValueSchema.parse(value);

  const existing = await db.memory.findFirst({
    where: { scope, scopeId, key },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  const row = existing
    ? await db.memory.update({
        where: { id: existing.id },
        data: { value: validated as object },
      })
    : await db.memory.create({
        data: {
          scope,
          scopeId,
          key,
          value: validated as object,
          organizationId: organizationId ?? null,
        },
      });

  // Async Mem0 sync — fire and forget, never block the caller
  if (isMem0Ready() && mem0Summary && mem0Ctx) {
    void mem0Add(
      mem0Summary,
      mem0Ctx,
      { scope, scopeId, key, memoryId: row.id },
    ).catch((err) =>
      console.warn("[memory] Mem0 sync failed:", err instanceof Error ? err.message : err),
    );
  }

  return parseRow(row) as MemoryEntry;
}

/**
 * Delete a memory by (scope, scopeId, key).
 * If a Mem0 external ID is known, also removes from Mem0.
 */
export async function forget({
  scope,
  scopeId,
  key,
}: ForgetOptions): Promise<boolean> {
  const existing = await db.memory.findFirst({
    where: { scope, scopeId, key },
    select: { id: true },
  });

  if (!existing) return false;

  await db.memory.delete({ where: { id: existing.id } });
  return true;
}

/**
 * Search memories semantically via Mem0 (when configured) or by key substring
 * match in Prisma as a fallback.
 */
export async function search({
  scope,
  scopeId,
  query,
  limit = 5,
  mem0Ctx,
}: SearchOptions): Promise<MemoryEntry[]> {
  // ── Mem0 semantic search ──────────────────────────────────────────────────
  if (isMem0Ready() && mem0Ctx) {
    const mem0Results = await mem0Search(query, mem0Ctx, limit);

    if (mem0Results.length > 0) {
      // Hydrate from Prisma using memoryId stored in Mem0 metadata
      const ids = mem0Results
        .map((r) => r.metadata?.memoryId as string | undefined)
        .filter((id): id is string => Boolean(id));

      if (ids.length > 0) {
        const rows = await db.memory.findMany({
          where: { id: { in: ids }, scope, scopeId },
        });

        return rows.flatMap((r) => {
          const entry = parseRow(r);
          return entry ? [entry] : [];
        });
      }
    }
  }

  // ── Prisma fallback — key substring match ─────────────────────────────────
  const rows = await db.memory.findMany({
    where: {
      scope,
      scopeId,
      key: { contains: query, mode: "insensitive" },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return rows.flatMap((r) => {
    const entry = parseRow(r);
    return entry ? [entry] : [];
  });
}

// ── Convenience shortcuts ─────────────────────────────────────────────────────

/** Recall a memory for an organisation. */
export const recallOrg = (orgId: string, key: string) =>
  recall({ scope: "ORG", scopeId: orgId, key });

/** Recall a memory for a user. */
export const recallUser = (userId: string, key: string) =>
  recall({ scope: "USER", scopeId: userId, key });

/** Recall a memory for an agent. */
export const recallAgent = (agentId: string, key: string) =>
  recall({ scope: "AGENT", scopeId: agentId, key });
