/**
 * Query expansion — turn a brief or section topic into 3-5 retrieval queries.
 *
 * Why: a single human-formulated query has a narrow vocabulary; expanding it
 * via Claude Haiku increases recall on the multilingual vector index by
 * covering definition, figures, examples, controversies, perspectives.
 *
 * Output contract: `{ queries: string[] }` — always returns the original
 * query as the first element so downstream RRF includes it in the fusion.
 *
 * Failure mode: if Haiku is misconfigured or returns malformed JSON, we
 * fall back to `[originalQuery]` so the retrieval pipeline keeps working
 * (just with lower recall).
 */

import { generateArticleStudioSurface } from "@/lib/ai/router";

export interface ExpandQueryInput {
  query: string;
  /** Free-form context: brief angle, audience, section summary, etc. */
  context?: string;
  /** How many variants to ask for (the original is always included). */
  variants?: number;
  /** User identifier for Langfuse traces. */
  userId?: string;
}

export interface ExpandedQuery {
  original: string;
  variants: string[];
  /** All queries: [original, ...variants]. Use this as the search loop input. */
  all: string[];
}

const MAX_VARIANTS = 6;

export async function expandQuery(input: ExpandQueryInput): Promise<ExpandedQuery> {
  const variants = Math.min(Math.max(input.variants ?? 4, 0), MAX_VARIANTS);
  const original = input.query.trim();

  if (!original) {
    return { original: "", variants: [], all: [] };
  }
  if (variants === 0) {
    return { original, variants: [], all: [original] };
  }

  const userPrompt = buildUserPrompt(original, variants, input.context);

  try {
    const result = await generateArticleStudioSurface({
      surfaceId: "query-expander",
      userId: input.userId ?? "anonymous",
      messages: [{ role: "user", content: userPrompt }],
    });
    const parsed = parseExpandedQueries(result.text);
    const cleaned = parsed
      .map((q) => q.trim())
      .filter((q) => q.length > 0 && q.toLowerCase() !== original.toLowerCase())
      .slice(0, variants);
    return { original, variants: cleaned, all: [original, ...cleaned] };
  } catch {
    // Graceful degrade — caller keeps moving with the original query only.
    return { original, variants: [], all: [original] };
  }
}

function buildUserPrompt(query: string, count: number, context?: string): string {
  const contextLine = context?.trim()
    ? `Contexte éditorial :\n${context.trim()}\n\n`
    : "";
  return (
    `${contextLine}Sujet à reformuler en ${count} requêtes complémentaires :\n` +
    `« ${query} »\n\n` +
    `Réponds en JSON strict { "queries": ["…", "…"] }.`
  );
}

/**
 * Tolerant JSON extraction — Haiku sometimes wraps JSON in code fences or
 * adds a leading sentence. We strip those and parse the largest JSON block.
 */
export function parseExpandedQueries(text: string): string[] {
  const stripped = text.replace(/```(?:json)?/gi, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return [];
  const block = stripped.slice(start, end + 1);
  try {
    const obj = JSON.parse(block) as { queries?: unknown };
    if (!Array.isArray(obj.queries)) return [];
    return obj.queries.filter((q): q is string => typeof q === "string");
  } catch {
    return [];
  }
}
