/**
 * End-to-end article generation.
 *
 * Pipeline (single request lifecycle):
 *   1. Load Article + brief from DB.
 *   2. Run RAG retrieval (query expansion + multi-query + RRF + rerank)
 *      against the article's selected sources.
 *   3. Build the cached `<sources>` context.
 *   4. Plan outline (Opus, blocking — we need the structure before streaming).
 *   5. For each section, stream the section writer; aggregate text.
 *   6. After each section, write Generation rows (SECTION) with usage.
 *   7. After all sections, compute grounding score, persist body, run
 *      infographic candidate scan, and create Citation rows.
 *
 * The orchestrator yields events via an AsyncGenerator so the SSE route
 * can forward them to the client without ever buffering the whole article.
 *
 * Errors during a section don't abort the whole article: the section is
 * marked FAILED on its Generation row, but the orchestrator emits an
 * `event: "section-error"` and proceeds to the next section. The article
 * status only flips to FAILED if outline planning itself failed.
 */

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

import { articleBriefSchema, type ArticleBrief } from "@/lib/types/article";
import { expandQuery } from "@/lib/rag/query-expansion";
import { retrieveChunks } from "@/lib/rag/retrieval";
import { rerankChunks } from "@/lib/rag/rerank";
import { buildSourcesContext, type CitationRef } from "@/lib/rag/context-builder";
import { checkGrounding } from "@/lib/rag/grounding-guard";
import { planOutline } from "./outline";
import { streamSection } from "./section-writer";
import {
  findInfographicCandidates,
  confirmInfographicCandidate,
} from "@/lib/infographics/extractor";

export type GenerationEvent =
  | { type: "phase"; phase: GenerationPhase; message?: string }
  | { type: "retrieval"; queryCount: number; chunkCount: number; contextTokens: number }
  | { type: "outline"; outline: OutlineEvent }
  | { type: "section-start"; sectionId: string; title: string; index: number; total: number }
  | { type: "section-token"; sectionId: string; delta: string }
  | { type: "section-end"; sectionId: string; markdown: string }
  | { type: "section-error"; sectionId: string; message: string }
  | { type: "infographics"; count: number }
  | {
      type: "done";
      grounding: { score: number; paragraphCount: number; citedCount: number };
      totalCostUsd: number | null;
    }
  | { type: "error"; message: string };

export type GenerationPhase =
  | "retrieve"
  | "plan"
  | "write"
  | "finalize";

interface OutlineEvent {
  title: string;
  metaDescription?: string;
  sections: Array<{ id: string; title: string; summary: string }>;
}

export interface OrchestratorInput {
  articleId: string;
  /** Override the query used for retrieval; default is brief-derived. */
  queryOverride?: string;
}

export async function* runArticleOrchestrator(
  input: OrchestratorInput,
): AsyncGenerator<GenerationEvent, void, void> {
  const article = await db.article.findUnique({ where: { id: input.articleId } });
  if (!article) {
    yield { type: "error", message: `Article ${input.articleId} introuvable.` };
    return;
  }
  const briefResult = articleBriefSchema.safeParse(article.brief);
  if (!briefResult.success) {
    yield { type: "error", message: "Brief malformé en base." };
    return;
  }
  const brief = briefResult.data;
  const userId = article.id;

  await db.article.update({
    where: { id: article.id },
    data: { status: "GENERATING" },
  });

  // ---- Phase 1: retrieval ----------------------------------------------------
  yield { type: "phase", phase: "retrieve" };
  let citations: CitationRef[] = [];
  let sourcesBlock = "";
  try {
    const query = (input.queryOverride ?? deriveQuery(article.title, brief)).trim();
    const expansion = await expandQuery({
      query,
      context: `Brief : ${brief.angle}\nAudience : ${brief.audience}`,
      userId,
    });
    const fused = await retrieveChunks({
      queries: expansion.all,
      sourceIds: brief.selectedSourceIds.length ? brief.selectedSourceIds : undefined,
      topN: 24,
    });
    const reranked = await rerankChunks({
      query,
      candidates: fused,
      topN: 12,
      userId,
    });
    const built = buildSourcesContext(reranked, { maxContextTokens: 4000 });
    citations = built.citations;
    sourcesBlock = built.sourcesBlock;
    yield {
      type: "retrieval",
      queryCount: expansion.all.length,
      chunkCount: reranked.length,
      contextTokens: built.tokenCount,
    };
  } catch (err) {
    yield { type: "error", message: `Retrieval failed: ${errorMessage(err)}` };
    await failArticle(article.id);
    return;
  }

  // ---- Phase 2: outline ------------------------------------------------------
  yield { type: "phase", phase: "plan" };
  let outline;
  const outlineStartedAt = new Date();
  try {
    outline = await planOutline({
      title: article.title,
      brief,
      sourcesBlock,
      userId,
    });
    await db.generation.create({
      data: {
        articleId: article.id,
        kind: "OUTLINE",
        model: outline.resolvedModel,
        promptTokens: outline.promptTokens,
        outputTokens: outline.outputTokens,
        latencyMs: Date.now() - outlineStartedAt.getTime(),
        retrievedChunkIds: citations.map((c) => c.chunkId),
        status: "SUCCESS",
        startedAt: outlineStartedAt,
        finishedAt: new Date(),
      },
    });
    await db.article.update({
      where: { id: article.id },
      data: { outline: outline.outline as unknown as Prisma.InputJsonValue },
    });
    yield {
      type: "outline",
      outline: {
        title: outline.outline.title,
        metaDescription: outline.outline.metaDescription,
        sections: outline.outline.sections.map((s) => ({
          id: s.id,
          title: s.title,
          summary: s.summary,
        })),
      },
    };
  } catch (err) {
    yield { type: "error", message: `Outline failed: ${errorMessage(err)}` };
    await failArticle(article.id);
    return;
  }

  // ---- Phase 3: sections (streamed) -----------------------------------------
  yield { type: "phase", phase: "write" };
  const sectionMarkdowns: string[] = [];
  for (let i = 0; i < outline.outline.sections.length; i++) {
    const section = outline.outline.sections[i];
    yield {
      type: "section-start",
      sectionId: section.id,
      title: section.title,
      index: i,
      total: outline.outline.sections.length,
    };

    const startedAt = new Date();
    let accumulated = "";
    try {
      const { result } = await streamSection({
        articleTitle: article.title,
        section,
        brief,
        totalSections: outline.outline.sections.length,
        sourcesBlock,
        userId,
      });

      for await (const delta of result.textStream) {
        accumulated += delta;
        yield { type: "section-token", sectionId: section.id, delta };
      }

      // streamText settles its usage/finish info once the stream is consumed.
      const finishReason = await result.finishReason;
      const usage = await result.usage;
      const resolvedModel = (await result.response).modelId;

      await db.generation.create({
        data: {
          articleId: article.id,
          kind: "SECTION",
          sectionId: section.id,
          model: resolvedModel,
          promptTokens: Number(usage?.inputTokens ?? 0),
          outputTokens: Number(usage?.outputTokens ?? 0),
          latencyMs: Date.now() - startedAt.getTime(),
          retrievedChunkIds: citations.map((c) => c.chunkId),
          status: finishReason === "stop" ? "SUCCESS" : "FAILED",
          startedAt,
          finishedAt: new Date(),
        },
      });

      sectionMarkdowns.push(accumulated);
      yield { type: "section-end", sectionId: section.id, markdown: accumulated };
    } catch (err) {
      const message = errorMessage(err);
      await db.generation.create({
        data: {
          articleId: article.id,
          kind: "SECTION",
          sectionId: section.id,
          model: "unknown",
          promptTokens: 0,
          outputTokens: 0,
          latencyMs: Date.now() - startedAt.getTime(),
          retrievedChunkIds: citations.map((c) => c.chunkId),
          status: "FAILED",
          error: message.slice(0, 1000),
          startedAt,
          finishedAt: new Date(),
        },
      });
      yield { type: "section-error", sectionId: section.id, message };
      sectionMarkdowns.push(`## ${section.title}\n\n*[Section échouée: ${message}]*`);
    }
  }

  // ---- Phase 4: finalize ----------------------------------------------------
  yield { type: "phase", phase: "finalize" };
  const fullMarkdown = sectionMarkdowns.join("\n\n");
  const grounding = checkGrounding(fullMarkdown);

  // Persist body (markdown + a minimal Tiptap doc placeholder), citations.
  await db.$transaction(async (tx) => {
    await tx.citation.deleteMany({ where: { articleId: article.id } });

    for (let pos = 0; pos < citations.length; pos++) {
      const c = citations[pos];
      await tx.citation.create({
        data: {
          articleId: article.id,
          sourceId: c.sourceId,
          chunkId: c.chunkId,
          quote: "", // filled in Sprint 5 from the chunk content
          position: pos,
        },
      });
    }

    await tx.article.update({
      where: { id: article.id },
      data: {
        bodyMd: fullMarkdown,
        body: markdownToTiptapJson(fullMarkdown) as unknown as Prisma.InputJsonValue,
        outline: outline.outline as unknown as Prisma.InputJsonValue,
        status: "READY",
      },
    });
  });

  // Infographics — best-effort, never fails the article.
  let infographicCount = 0;
  try {
    const candidates = findInfographicCandidates(fullMarkdown);
    for (let pos = 0; pos < candidates.length; pos++) {
      const proposal = await confirmInfographicCandidate(candidates[pos], userId);
      if (!proposal) continue;
      const sourceCitationIds = citations
        .filter((c) => proposal.citationIds.includes(c.id))
        .map((c) => c.id);
      await db.infographic.create({
        data: {
          articleId: article.id,
          kind: proposal.spec.kind,
          title: proposal.spec.title,
          spec: proposal.spec as unknown as Prisma.InputJsonValue,
          sourceCitationIds,
          position: pos,
        },
      });
      infographicCount++;
    }
  } catch {
    // swallow — infographics are non-essential
  }
  yield { type: "infographics", count: infographicCount };

  yield {
    type: "done",
    grounding: {
      score: grounding.score,
      paragraphCount: grounding.paragraphCount,
      citedCount: grounding.citedCount,
    },
    totalCostUsd: null,
  };
}

function deriveQuery(title: string, brief: ArticleBrief): string {
  return [title, brief.angle, ...brief.keywords].filter(Boolean).join(" — ");
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function failArticle(articleId: string): Promise<void> {
  await db.article.update({
    where: { id: articleId },
    data: { status: "DRAFT" }, // keep editable; status FAILED is reserved for ingest
  });
}

/**
 * Minimal markdown → Tiptap JSON. Splits on blank lines and emits paragraphs
 * with inline `[Sn]` runs kept as plain text. Sprint 5 swaps this for a full
 * remark→Tiptap mapper that emits headings, lists, code blocks, etc.
 */
function markdownToTiptapJson(md: string): {
  type: "doc";
  content: Array<{ type: string; attrs?: Record<string, unknown>; content?: unknown[] }>;
} {
  const blocks = md.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return {
    type: "doc",
    content: blocks.map((block) => {
      const heading = block.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        return {
          type: "heading",
          attrs: { level: heading[1].length },
          content: [{ type: "text", text: heading[2] }],
        };
      }
      return {
        type: "paragraph",
        content: [{ type: "text", text: block }],
      };
    }),
  };
}
