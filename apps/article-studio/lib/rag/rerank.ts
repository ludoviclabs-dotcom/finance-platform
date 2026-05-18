/**
 * Two-stage retrieval requires a reranker. Cross-encoder rerankers are far
 * more precise than bi-encoder embeddings on the top-K → top-N pruning step:
 * they score (query, passage) jointly instead of independently.
 *
 * Providers (in priority order):
 *   1. Cohere `rerank-multilingual-v3.0` when COHERE_API_KEY is configured.
 *   2. Claude Haiku 4.5 ("reranker-llm" surface) as a fallback.
 *
 * The fallback path keeps the studio usable without a Cohere account; quality
 * is lower but still better than raw cosine on heterogeneous corpora.
 */

import { env } from "@/lib/env";
import { generateArticleStudioSurface } from "@/lib/ai/router";
import type { FusedChunk } from "./retrieval";

export interface RerankInput {
  query: string;
  candidates: FusedChunk[];
  topN?: number;
  userId?: string;
}

export interface RerankedChunk extends FusedChunk {
  rerankScore: number;
  rerankProvider: "cohere" | "llm-haiku" | "passthrough";
}

const COHERE_URL = "https://api.cohere.com/v2/rerank";
const COHERE_MODEL = "rerank-multilingual-v3.0";

export async function rerankChunks(input: RerankInput): Promise<RerankedChunk[]> {
  const topN = input.topN ?? 8;
  if (input.candidates.length === 0) return [];
  if (input.candidates.length === 1) {
    return input.candidates.slice(0, topN).map((c) => ({
      ...c,
      rerankScore: c.rrfScore,
      rerankProvider: "passthrough",
    }));
  }

  if (env.rerank.ready) {
    try {
      return await rerankWithCohere(input.query, input.candidates, topN);
    } catch {
      // fall through to LLM fallback
    }
  }
  return rerankWithHaiku(input.query, input.candidates, topN, input.userId);
}

async function rerankWithCohere(
  query: string,
  candidates: FusedChunk[],
  topN: number,
): Promise<RerankedChunk[]> {
  const res = await fetch(COHERE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.rerank.cohereKey}`,
    },
    body: JSON.stringify({
      model: COHERE_MODEL,
      query,
      documents: candidates.map((c) => c.content),
      top_n: Math.min(topN, candidates.length),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Cohere rerank failed: ${res.status} ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    results: Array<{ index: number; relevance_score: number }>;
  };
  return data.results.map((r) => ({
    ...candidates[r.index],
    rerankScore: r.relevance_score,
    rerankProvider: "cohere" as const,
  }));
}

async function rerankWithHaiku(
  query: string,
  candidates: FusedChunk[],
  topN: number,
  userId?: string,
): Promise<RerankedChunk[]> {
  // Tag each candidate so Haiku can return a score keyed by id.
  const tagged = candidates.map((c, i) => ({ id: `S${i + 1}`, chunk: c }));

  const userPrompt =
    `Requête : ${query}\n\nPassages :\n` +
    tagged
      .map(
        (t) =>
          `[${t.id}] ${t.chunk.heading ? `(${t.chunk.heading}) ` : ""}${t.chunk.content
            .replace(/\s+/g, " ")
            .slice(0, 600)}`,
      )
      .join("\n\n");

  let scores: Record<string, number> = {};
  try {
    const result = await generateArticleStudioSurface({
      surfaceId: "reranker-llm",
      userId: userId ?? "anonymous",
      messages: [{ role: "user", content: userPrompt }],
    });
    scores = parseRerankerScores(result.text);
  } catch {
    scores = {};
  }

  const ranked = tagged.map((t) => ({
    ...t.chunk,
    rerankScore: scores[t.id] ?? t.chunk.rrfScore,
    rerankProvider: "llm-haiku" as const,
  }));
  return ranked.sort((a, b) => b.rerankScore - a.rerankScore).slice(0, topN);
}

/** Tolerant parser — handles fences, leading text, partial JSON. */
export function parseRerankerScores(text: string): Record<string, number> {
  const stripped = text.replace(/```(?:json)?/gi, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1) return {};
  const block = stripped.slice(start, end + 1);
  try {
    const obj = JSON.parse(block) as {
      scores?: Array<{ id?: unknown; score?: unknown }>;
    };
    if (!Array.isArray(obj.scores)) return {};
    const out: Record<string, number> = {};
    for (const s of obj.scores) {
      if (typeof s.id === "string" && typeof s.score === "number") {
        out[s.id] = s.score;
      }
    }
    return out;
  } catch {
    return {};
  }
}
