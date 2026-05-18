/**
 * Batching helper for embedding requests.
 *
 * Voyage limits: 128 inputs per request, 320K total tokens.
 * OpenAI limits: 2048 inputs per request, 300K total tokens per request.
 *
 * We pick a conservative batch size (64) and cap concurrency at 4 to stay
 * well within rate limits while keeping ingestion latency tolerable on
 * a 50-chunk document (~1-2s end-to-end with Voyage).
 */

import pLimit from "p-limit";
import type { EmbeddingClient, EmbeddingTaskType } from "./client";

export interface BatchOptions {
  batchSize?: number;
  concurrency?: number;
}

const DEFAULTS: Required<BatchOptions> = {
  batchSize: 64,
  concurrency: 4,
};

export async function embedBatched(
  client: EmbeddingClient,
  texts: string[],
  taskType: EmbeddingTaskType,
  options: BatchOptions = {},
): Promise<number[][]> {
  const { batchSize, concurrency } = { ...DEFAULTS, ...options };
  if (texts.length === 0) return [];

  const batches: Array<{ start: number; texts: string[] }> = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    batches.push({ start: i, texts: texts.slice(i, i + batchSize) });
  }

  const limit = pLimit(concurrency);
  const results = new Array<number[]>(texts.length);

  await Promise.all(
    batches.map((b) =>
      limit(async () => {
        const vectors = await client.embed(b.texts, taskType);
        if (vectors.length !== b.texts.length) {
          throw new Error(
            `Embedding count mismatch: expected ${b.texts.length}, got ${vectors.length}`,
          );
        }
        for (let j = 0; j < vectors.length; j++) {
          results[b.start + j] = vectors[j];
        }
      }),
    ),
  );

  return results;
}
