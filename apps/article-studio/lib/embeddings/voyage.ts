/**
 * Voyage AI embeddings — primary provider.
 *
 * Why Voyage:
 *   - voyage-3-large is consistently top-tier on multilingual benchmarks (MTEB FR).
 *   - Native 1024d output → no truncation/reduction needed.
 *   - "input_type" parameter ("document" vs "query") yields measurable retrieval
 *     gains vs symmetric embedding (typical +3-5 pts P@5 on cross-lingual sets).
 *
 * The official `voyageai` SDK is wired up; we go through `fetch` directly to
 * avoid pulling its node-only dependencies into the Next.js edge runtime if
 * we ever move ingest to the edge.
 */

import { env } from "@/lib/env";
import {
  EMBEDDING_DIMENSIONS,
  type EmbeddingClient,
  type EmbeddingTaskType,
} from "./client";

const ENDPOINT = "https://api.voyageai.com/v1/embeddings";
const MODEL = "voyage-3-large";

interface VoyageResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage: { total_tokens: number };
}

export function createVoyageClient(): EmbeddingClient {
  const apiKey = env.embeddings.voyageKey;
  if (!apiKey) throw new Error("VOYAGE_API_KEY missing");

  return {
    model: MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    async embed(texts: string[], taskType: EmbeddingTaskType): Promise<number[][]> {
      if (texts.length === 0) return [];
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          input: texts,
          input_type: taskType,
          output_dimension: EMBEDDING_DIMENSIONS,
          truncation: true,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `Voyage embeddings failed: ${res.status} ${res.statusText} — ${body.slice(0, 200)}`,
        );
      }
      const data = (await res.json()) as VoyageResponse;
      // The API guarantees order matches input, but sort defensively.
      const sorted = [...data.data].sort((a, b) => a.index - b.index);
      return sorted.map((d) => d.embedding);
    },
  };
}
