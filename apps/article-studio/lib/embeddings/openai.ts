/**
 * OpenAI embeddings — fallback when Voyage is not configured.
 *
 * `text-embedding-3-large` is natively 3072d. We pass `dimensions: 1024` to
 * truncate via Matryoshka representation learning (lossy but quality-preserving
 * for the top-K retrieval task we run).
 *
 * NOTE: switching providers between ingests would corrupt the vector space.
 * If you ever change provider in production, re-embed all chunks from scratch
 * (the `chunkEmbeddingModel` column tracks the model in use).
 */

import { env } from "@/lib/env";
import {
  EMBEDDING_DIMENSIONS,
  type EmbeddingClient,
  type EmbeddingTaskType,
} from "./client";

const ENDPOINT = "https://api.openai.com/v1/embeddings";
const MODEL = "text-embedding-3-large";

interface OpenAIResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage: { prompt_tokens: number; total_tokens: number };
}

export function createOpenAIEmbeddingClient(): EmbeddingClient {
  const apiKey = env.embeddings.openaiKey;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");

  return {
    model: MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    async embed(texts: string[], _taskType: EmbeddingTaskType): Promise<number[][]> {
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
          dimensions: EMBEDDING_DIMENSIONS,
          encoding_format: "float",
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `OpenAI embeddings failed: ${res.status} ${res.statusText} — ${body.slice(0, 200)}`,
        );
      }
      const data = (await res.json()) as OpenAIResponse;
      const sorted = [...data.data].sort((a, b) => a.index - b.index);
      return sorted.map((d) => d.embedding);
    },
  };
}
