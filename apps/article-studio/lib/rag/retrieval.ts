/**
 * Multi-query retrieval with Reciprocal Rank Fusion (RRF).
 *
 * Pipeline:
 *   1. Embed N queries (original + expansions) in one batched API call.
 *   2. For each query vector, run ANN search → top-K candidates.
 *   3. Fuse all candidate lists into a single ranking via RRF:
 *
 *          rrf_score(c) = Σ_q 1 / (RRF_K + rank_q(c))
 *
 *      where rank_q(c) is the 1-indexed position of candidate `c` in
 *      query `q`'s result list. RRF_K = 60 is the standard.
 *
 *   4. Sort by rrf_score, take top-N. Carry forward the best per-query
 *      cosine score for display in the debug panel.
 *
 * Why RRF and not weighted sums of cosine scores: scores across different
 * queries are not directly comparable (each query has its own scale).
 * RRF only uses ranks → robust to scale shifts, well-supported by research.
 */

import { embedBatched } from "@/lib/embeddings/batch";
import { getEmbeddingClient } from "@/lib/embeddings/client";
import { searchChunks, type ChunkSearchResult } from "@/lib/vector-store/search";

export interface RetrieveInput {
  queries: string[];
  /** Restrict search to a subset of Source.id. Empty/undefined = search all. */
  sourceIds?: string[];
  /** Per-query top-K (default 20). Wider net before fusion → better recall. */
  perQueryK?: number;
  /** Final top-N after fusion (default 12). */
  topN?: number;
}

export interface FusedChunk extends ChunkSearchResult {
  /** Reciprocal Rank Fusion score across all input queries. */
  rrfScore: number;
  /** Map of query → its 1-indexed rank in that query's result list. */
  rankByQuery: Record<string, number>;
}

const RRF_K = 60;

export async function retrieveChunks(input: RetrieveInput): Promise<FusedChunk[]> {
  const queries = input.queries.map((q) => q.trim()).filter(Boolean);
  if (queries.length === 0) return [];

  const perQueryK = input.perQueryK ?? 20;
  const topN = input.topN ?? 12;

  const client = await getEmbeddingClient();
  const vectors = await embedBatched(client, queries, "query");

  // Run ANN searches in parallel — DB pool handles the concurrency.
  const perQueryResults = await Promise.all(
    vectors.map((v) =>
      searchChunks(v, { k: perQueryK, sourceIds: input.sourceIds }),
    ),
  );

  return fuseRRF(queries, perQueryResults, topN);
}

/** Pure function exposed for unit testing without DB/embeddings deps. */
export function fuseRRF(
  queries: string[],
  perQueryResults: ChunkSearchResult[][],
  topN: number,
): FusedChunk[] {
  const fused = new Map<string, FusedChunk>();

  for (let qi = 0; qi < perQueryResults.length; qi++) {
    const results = perQueryResults[qi];
    const queryKey = queries[qi] ?? `q${qi}`;
    for (let rank = 0; rank < results.length; rank++) {
      const chunk = results[rank];
      const contribution = 1 / (RRF_K + (rank + 1));
      const existing = fused.get(chunk.id);
      if (existing) {
        existing.rrfScore += contribution;
        existing.rankByQuery[queryKey] = rank + 1;
        // Keep the highest per-query cosine score for display.
        if (chunk.score > existing.score) existing.score = chunk.score;
      } else {
        fused.set(chunk.id, {
          ...chunk,
          rrfScore: contribution,
          rankByQuery: { [queryKey]: rank + 1 },
        });
      }
    }
  }

  return [...fused.values()]
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, topN);
}
