/**
 * pgvector ANN search.
 *
 * Cosine distance via the `<=>` operator. Lower distance = more similar.
 * We return `score = 1 - distance` so callers can treat higher = better
 * (matches Voyage's API and reranker conventions).
 *
 * Scope filter: when `sourceIds` is provided, we restrict the search to
 * that set — this is how the article studio honors per-article source
 * selection without leaking content from other corpora.
 */

import { db } from "@/lib/db";
import { vectorToLiteral } from "./pgvector";

export interface SearchOptions {
  /** Top-K to return. Default 12. */
  k?: number;
  /** Restrict to a subset of Source.id. Empty/undefined = search all. */
  sourceIds?: string[];
  /** Minimum cosine similarity (0..1) — filters at SQL level. Default 0. */
  minScore?: number;
}

export interface ChunkSearchResult {
  id: string;
  sourceId: string;
  orderIndex: number;
  content: string;
  tokenCount: number;
  heading: string | null;
  pageNumber: number | null;
  /** Cosine similarity in [0,1]. Higher = better match. */
  score: number;
}

interface RawRow {
  id: string;
  sourceId: string;
  orderIndex: number;
  content: string;
  tokenCount: number;
  heading: string | null;
  pageNumber: number | null;
  distance: string | number;
}

export async function searchChunks(
  queryVector: number[],
  options: SearchOptions = {},
): Promise<ChunkSearchResult[]> {
  const k = options.k ?? 12;
  const minScore = options.minScore ?? 0;
  const vec = vectorToLiteral(queryVector);

  const params: unknown[] = [vec];
  let where = "WHERE embedding IS NOT NULL";

  if (options.sourceIds && options.sourceIds.length > 0) {
    // ANY($N::text[]) keeps the array bind as a single parameter — clean.
    params.push(options.sourceIds);
    where += ` AND "sourceId" = ANY($${params.length}::text[])`;
  }

  params.push(k);
  const limitParam = `$${params.length}`;

  const sql = `
    SELECT "id", "sourceId", "orderIndex", "content", "tokenCount",
           "heading", "pageNumber",
           (embedding <=> $1::vector) AS distance
    FROM "Chunk"
    ${where}
    ORDER BY distance ASC
    LIMIT ${limitParam}
  `;

  const rows = await db.$queryRawUnsafe<RawRow[]>(sql, ...params);

  return rows
    .map((r) => ({
      id: r.id,
      sourceId: r.sourceId,
      orderIndex: r.orderIndex,
      content: r.content,
      tokenCount: r.tokenCount,
      heading: r.heading,
      pageNumber: r.pageNumber,
      score: 1 - Number(r.distance),
    }))
    .filter((r) => r.score >= minScore);
}
