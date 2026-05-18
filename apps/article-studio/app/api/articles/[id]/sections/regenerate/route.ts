/**
 * POST /api/articles/[id]/sections/regenerate
 *
 * Body: { sectionId: string; query?: string }
 *
 * Streams a single section regeneration as SSE:
 *   data: {"type":"section-token","delta":"…"}
 *   …
 *   data: {"type":"section-end","sectionId":"…","markdown":"…","grounding":0.82}
 *
 * Only the targeted section is regenerated. The outline + sources block is
 * reused as-is from the previous run (we hit the ephemeral prompt cache).
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
  articleBriefSchema,
  outlineSchema,
} from "@/lib/types/article";
import { expandQuery } from "@/lib/rag/query-expansion";
import { retrieveChunks } from "@/lib/rag/retrieval";
import { rerankChunks } from "@/lib/rag/rerank";
import { buildSourcesContext } from "@/lib/rag/context-builder";
import { checkGrounding } from "@/lib/rag/grounding-guard";
import { streamSection } from "@/lib/generation/section-writer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const bodySchema = z.object({
  sectionId: z.string().min(1),
  query: z.string().optional(),
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
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
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
  const outlineResult = outlineSchema.safeParse(article.outline);
  if (!briefResult.success || !outlineResult.success) {
    return NextResponse.json(
      { error: "Brief ou outline manquant — lance d'abord /generate." },
      { status: 400 },
    );
  }
  const brief = briefResult.data;
  const outline = outlineResult.data;
  const section = outline.sections.find((s) => s.id === parsed.data.sectionId);
  if (!section) {
    return NextResponse.json(
      { error: `Section "${parsed.data.sectionId}" introuvable dans l'outline.` },
      { status: 404 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const sendEvent = (event: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        const query = (parsed.data.query ?? deriveQuery(article.title, brief, section)).trim();
        const expansion = await expandQuery({
          query,
          context: `Section : ${section.title}\nRésumé : ${section.summary}`,
          userId: article.id,
        });
        const fused = await retrieveChunks({
          queries: expansion.all,
          sourceIds: brief.selectedSourceIds.length
            ? brief.selectedSourceIds
            : undefined,
          topN: 16,
        });
        const reranked = await rerankChunks({
          query,
          candidates: fused,
          topN: 10,
          userId: article.id,
        });
        const built = buildSourcesContext(reranked, { maxContextTokens: 4000 });

        sendEvent({
          type: "section-start",
          sectionId: section.id,
          title: section.title,
        });

        const startedAt = new Date();
        const { result } = await streamSection({
          articleTitle: article.title,
          section,
          brief,
          totalSections: outline.sections.length,
          sourcesBlock: built.sourcesBlock,
          userId: article.id,
        });

        let accumulated = "";
        for await (const delta of result.textStream) {
          accumulated += delta;
          sendEvent({ type: "section-token", sectionId: section.id, delta });
        }

        const finishReason = await result.finishReason;
        const usage = await result.usage;
        const resolvedModel = (await result.response).modelId;

        await db.generation.create({
          data: {
            articleId: article.id,
            kind: "REGENERATE_SECTION",
            sectionId: section.id,
            model: resolvedModel,
            promptTokens: Number(usage?.inputTokens ?? 0),
            outputTokens: Number(usage?.outputTokens ?? 0),
            latencyMs: Date.now() - startedAt.getTime(),
            retrievedChunkIds: built.citations.map((c) => c.chunkId),
            status: finishReason === "stop" ? "SUCCESS" : "FAILED",
            startedAt,
            finishedAt: new Date(),
          },
        });

        const grounding = checkGrounding(accumulated);
        sendEvent({
          type: "section-end",
          sectionId: section.id,
          markdown: accumulated,
          grounding: grounding.score,
        });
      } catch (err) {
        sendEvent({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        controller.enqueue(encoder.encode("event: end\ndata: {}\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function deriveQuery(
  title: string,
  brief: { angle: string; keywords: string[] },
  section: { title: string; summary: string },
): string {
  return [title, section.title, section.summary, brief.angle, ...brief.keywords]
    .filter(Boolean)
    .join(" — ");
}
