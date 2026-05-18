/**
 * pgvector setup helpers.
 *
 * Prisma 7 declares the extension via `extensions = [vector]` in
 * datasource — that handles `CREATE EXTENSION` on migrate. The HNSW
 * index on the embedding column has no first-class Prisma support,
 * so we materialize it here via raw SQL (idempotent).
 *
 * HNSW parameters (defaults are fine for our scale):
 *   m = 16              — links per node, default
 *   ef_construction = 64 — build-time exploration, default
 *
 * For 10K-100K chunks (our expected scale), cosine HNSW gives
 * sub-10ms recall@10 with negligible memory overhead.
 */

import { db } from "@/lib/db";

export const HNSW_INDEX_NAME = "chunk_embedding_idx";

export async function ensureVectorExtension(): Promise<void> {
  await db.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);
}

export async function ensureHnswIndex(): Promise<void> {
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "${HNSW_INDEX_NAME}" ON "Chunk" USING hnsw (embedding vector_cosine_ops)`,
  );
}

/** Run both — used by scripts/setup-pgvector.ts and by tests. */
export async function ensurePgvectorReady(): Promise<void> {
  await ensureVectorExtension();
  await ensureHnswIndex();
}

/** Serialize a JS number[] into the literal pgvector text format `[v1,v2,...]`. */
export function vectorToLiteral(vector: number[]): string {
  return `[${vector.map((v) => Number(v)).join(",")}]`;
}
