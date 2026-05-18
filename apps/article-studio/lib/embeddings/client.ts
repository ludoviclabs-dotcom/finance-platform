/**
 * Embedding provider abstraction.
 *
 * Two implementations are wired in this app:
 *   - Voyage (`voyage-3-large`, 1024d) — primary. Best quality FR/EN.
 *   - OpenAI (`text-embedding-3-large`, 3072d → reduced to 1024d) — fallback.
 *
 * Why 1024d everywhere: the pgvector column is `vector(1024)`, fixed at schema
 * level. OpenAI's native 3072d output is reduced via the `dimensions` parameter
 * so both providers produce vectors that share the same index.
 *
 * Selection: `getEmbeddingClient()` picks Voyage when its key is configured,
 * else OpenAI, else throws. We never silently mix providers — that would
 * corrupt the vector space (cosine distances are not comparable across models).
 */

import { env, requireEnv } from "@/lib/env";

export type EmbeddingTaskType = "document" | "query";

export interface EmbeddingClient {
  /** Stable identifier persisted with each chunk so we can detect provider drift. */
  readonly model: string;
  readonly dimensions: number;
  embed(texts: string[], taskType: EmbeddingTaskType): Promise<number[][]>;
}

export const EMBEDDING_DIMENSIONS = 1024;

let cached: EmbeddingClient | null = null;

export async function getEmbeddingClient(): Promise<EmbeddingClient> {
  if (cached) return cached;
  if (env.embeddings.voyageReady) {
    const { createVoyageClient } = await import("./voyage");
    cached = createVoyageClient();
    return cached;
  }
  if (env.embeddings.openaiReady) {
    const { createOpenAIEmbeddingClient } = await import("./openai");
    cached = createOpenAIEmbeddingClient();
    return cached;
  }
  requireEnv("embeddings", "embeddings");
  throw new Error("unreachable"); // requireEnv throws above
}

/** Reset cache — test helper only. */
export function __resetEmbeddingClient(): void {
  cached = null;
}
