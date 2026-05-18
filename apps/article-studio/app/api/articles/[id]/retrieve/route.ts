/**
 * POST /api/articles/[id]/retrieve — run the full RAG pipeline for debug.
 *
 * Body: { query?: string; perQueryK?: number; topN?: number; rerankTopN?: number }
 *   - If `query` is omitted, we synthesize one from the brief
 *     (title + angle + keywords).
 *
 * Response:
 *   { query, expansion, fused, reranked, context }
 *
 * No persistence: this endpoint is purely diagnostic for the
 * RetrievalDebugPanel.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { articleBriefSchema } from "@/lib/types/article";
import { expandQuery } from "@/lib/rag/query-expansion";
import { retrieveChunks } from "@/lib/rag/retrieval";
import { rerankChunks } from "@/lib/rag/rerank";
import { buildSourcesContext } from "@/lib/rag/context-builder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  query: z.string().optional(),
  perQueryK: z.number().int().min(1).max(40).optional(),
  topN: z.number().int().min(1).max(40).optional(),
  rerankTopN: z.number().int().min(1).max(20).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;

  if (!env.database.ready) {
    return NextResponse.json({ error: "DATABASE_URL absent." }, { status: 503 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body invalide.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const article = await db.article.findUnique({ where: { id } });
  if (!article) {
    return NextResponse.json({ error: "Article inconnu." }, { status: 404 });
  }

  const briefResult = articleBriefSchema.safeParse(article.brief);
  if (!briefResult.success) {
    return NextResponse.json(
      { error: "Brief malformé en base." },
      { status: 500 },
    );
  }
  const brief = briefResult.data;

  const query = (parsed.data.query ?? deriveQuery(brief)).trim();
  if (!query) {
    return NextResponse.json(
      { error: "Aucune requête fournie et brief vide." },
      { status: 400 },
    );
  }

  // 1. Query expansion
  const expansion = await expandQuery({
    query,
    context: `Brief : ${brief.angle}\nAudience : ${brief.audience}`,
    userId: id,
  });

  // 2. Multi-query retrieval + RRF
  const fused = await retrieveChunks({
    queries: expansion.all,
    sourceIds:
      article.selectedSourceIds.length > 0 ? article.selectedSourceIds : undefined,
    perQueryK: parsed.data.perQueryK,
    topN: parsed.data.topN ?? 20,
  });

  // 3. Rerank
  const reranked = await rerankChunks({
    query,
    candidates: fused,
    topN: parsed.data.rerankTopN ?? 8,
    userId: id,
  });

  // 4. Context builder
  const context = buildSourcesContext(reranked);

  return NextResponse.json({
    query,
    expansion,
    fused: fused.map(({ rankByQuery, ...rest }) => ({
      ...rest,
      rankByQuery,
    })),
    reranked: reranked.map((r) => ({
      id: r.id,
      sourceId: r.sourceId,
      heading: r.heading,
      pageNumber: r.pageNumber,
      score: r.score,
      rrfScore: r.rrfScore,
      rerankScore: r.rerankScore,
      rerankProvider: r.rerankProvider,
      content: r.content,
    })),
    context: {
      tokenCount: context.tokenCount,
      trimmed: context.trimmed,
      citations: context.citations,
      sourcesBlock: context.sourcesBlock,
    },
  });
}

function deriveQuery(brief: { title: string; angle: string; keywords: string[] }): string {
  const parts = [brief.title, brief.angle, ...brief.keywords].filter(Boolean);
  return parts.join(" — ");
}
