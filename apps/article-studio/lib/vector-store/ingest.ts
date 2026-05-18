/**
 * Chunk ingestion into Postgres + pgvector.
 *
 * Replace-semantics: re-ingesting a Source deletes all its existing chunks
 * (Cascade on the FK) and inserts the new set. This makes re-runs safe and
 * keeps `orderIndex` contiguous from 0.
 *
 * We INSERT via raw SQL because Prisma does not yet bind the `vector` type;
 * we serialize the embedding as a pgvector literal and cast in SQL.
 */

import { db } from "@/lib/db";
import type { PreparedChunk } from "@/lib/chunking/splitter";
import { vectorToLiteral } from "./pgvector";

export interface SaveChunksParams {
  sourceId: string;
  chunks: PreparedChunk[];
  vectors: number[][];
}

export async function saveChunksWithEmbeddings(
  params: SaveChunksParams,
): Promise<number> {
  const { sourceId, chunks, vectors } = params;
  if (chunks.length !== vectors.length) {
    throw new Error(
      `saveChunksWithEmbeddings: chunks/vectors length mismatch (${chunks.length} vs ${vectors.length})`,
    );
  }
  if (chunks.length === 0) return 0;

  await db.$transaction(async (tx) => {
    await tx.chunk.deleteMany({ where: { sourceId } });

    // Batch INSERT — single query with multi-row VALUES is far faster than
    // N round-trips. Each placeholder is positional; the embedding column
    // is built as a string literal then cast to ::vector inline.
    const cols = [
      `"id"`,
      `"sourceId"`,
      `"orderIndex"`,
      `"content"`,
      `"tokenCount"`,
      `"charStart"`,
      `"charEnd"`,
      `"heading"`,
      `"pageNumber"`,
      `"embedding"`,
    ].join(", ");

    // Prisma 7 raw query: build $1, $2, ... placeholders manually.
    const valueRows: string[] = [];
    const values: unknown[] = [];
    let p = 1;
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const v = vectors[i];
      values.push(
        cuid(),
        sourceId,
        c.orderIndex,
        c.content,
        c.tokenCount,
        c.charStart,
        c.charEnd,
        c.heading ?? null,
        c.pageNumber ?? null,
        vectorToLiteral(v),
      );
      valueRows.push(
        `($${p}, $${p + 1}, $${p + 2}, $${p + 3}, $${p + 4}, $${p + 5}, $${p + 6}, $${p + 7}, $${p + 8}, $${p + 9}::vector)`,
      );
      p += 10;
    }

    const sql = `INSERT INTO "Chunk" (${cols}) VALUES ${valueRows.join(", ")}`;
    await tx.$executeRawUnsafe(sql, ...values);
  });

  return chunks.length;
}

/**
 * Minimal cuid-like generator — avoids pulling the @paralleldrive/cuid2
 * dep just to feed an id column. The collision space is more than enough
 * for chunk rows (we never address chunks externally).
 */
function cuid(): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 10);
  return `c${ts}${rnd}`;
}
