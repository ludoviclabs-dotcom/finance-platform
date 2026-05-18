/**
 * Section writer — streams one article section, grounded in the same
 * `<sources>` block used by the outline planner.
 *
 * Returns the streaming handle from streamArticleStudioSurface. The caller
 * (typically the SSE route) consumes `result.textStream` to emit tokens and
 * settles its own bookkeeping in onFinish.
 *
 * The same prompt-caching layout as outline.ts is used: the (heavy) sources
 * block is cached ephemerally so each subsequent section in the same article
 * pays only the (small) prompt overhead.
 */

import {
  streamArticleStudioSurface,
  type ArticleStudioSurfaceId,
} from "@/lib/ai/router";
import { LENGTH_WORD_TARGETS, type ArticleLength } from "@/lib/types/article";

export interface StreamSectionInput {
  articleTitle: string;
  section: {
    id: string;
    title: string;
    summary: string;
    sourceRefs?: string[];
  };
  brief: {
    angle: string;
    audience: string;
    tone: string;
    length: ArticleLength;
  };
  /** Total sections in the outline — used to size each section's word budget. */
  totalSections: number;
  /** Pre-built <source id="Sn">…</source> block from buildSourcesContext. */
  sourcesBlock: string;
  userId: string;
}

const SURFACE_ID: ArticleStudioSurfaceId = "section-writer";

export function streamSection(input: StreamSectionInput) {
  const wordTarget = Math.round(
    LENGTH_WORD_TARGETS[input.brief.length] / Math.max(input.totalSections, 1),
  );

  const userPrompt = buildUserPrompt(input, wordTarget);

  return streamArticleStudioSurface({
    surfaceId: SURFACE_ID,
    userId: input.userId,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `<sources>\n${input.sourcesBlock}\n</sources>`,
            providerOptions: {
              anthropic: { cacheControl: { type: "ephemeral" } },
            },
          },
          { type: "text", text: userPrompt },
        ],
      },
    ],
  });
}

function buildUserPrompt(input: StreamSectionInput, wordTarget: number): string {
  const refsLine = input.section.sourceRefs?.length
    ? `Passages prioritaires (mais cite aussi d'autres [S\\d] pertinents) : ${input.section.sourceRefs.join(", ")}`
    : `Cite tous les [S\\d] qui appuient tes affirmations.`;
  return (
    `Article : « ${input.articleTitle} »\n` +
    `Ton : ${input.brief.tone}\n` +
    `Audience : ${input.brief.audience}\n` +
    `Angle global : ${input.brief.angle}\n\n` +
    `Section à rédiger\n` +
    `Titre : ${input.section.title}\n` +
    `Résumé attendu : ${input.section.summary}\n` +
    `Longueur cible : ~${wordTarget} mots\n` +
    `${refsLine}\n\n` +
    `Réponds en Markdown : commence par "## ${input.section.title}", puis le corps.`
  );
}
