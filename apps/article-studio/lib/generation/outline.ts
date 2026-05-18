/**
 * Outline planner — turns a brief + retrieved context into a structured plan.
 *
 * Uses the "outline-planner" surface (Opus, low temp, JSON output). The
 * surface's system prompt already enforces the JSON shape; we still validate
 * with Zod here because the model can occasionally drift on the section IDs
 * or wrap output in code fences.
 *
 * Returns the parsed outline + the raw model output for telemetry/debug.
 */

import {
  generateArticleStudioSurface,
  type ArticleStudioSurfaceId,
} from "@/lib/ai/router";
import { outlineSchema, type ArticleOutline } from "@/lib/types/article";

export interface PlanOutlineInput {
  title: string;
  brief: {
    angle: string;
    audience: string;
    length: "short" | "medium" | "long";
    tone: string;
    keywords?: string[];
  };
  /** Pre-built <source id="Sn">…</source> block from buildSourcesContext. */
  sourcesBlock: string;
  /** User identifier for Langfuse. */
  userId: string;
}

export interface PlanOutlineResult {
  outline: ArticleOutline;
  rawText: string;
  traceId: string;
  resolvedModel: string;
  promptTokens: number;
  outputTokens: number;
}

const SURFACE_ID: ArticleStudioSurfaceId = "outline-planner";

export async function planOutline(input: PlanOutlineInput): Promise<PlanOutlineResult> {
  const userPrompt = buildUserPrompt(input);

  const result = await generateArticleStudioSurface({
    surfaceId: SURFACE_ID,
    userId: input.userId,
    // Two-part message: the (large, cacheable) sources block first, the
    // (small, dynamic) brief second. Anthropic's ephemeral cache key covers
    // everything up to and including the marked block.
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

  const parsed = parseOutline(result.text);
  return {
    outline: parsed,
    rawText: result.text,
    traceId: result.traceId,
    resolvedModel: result.resolvedModel,
    promptTokens: Number(result.usage?.inputTokens ?? 0),
    outputTokens: Number(result.usage?.outputTokens ?? 0),
  };
}

function buildUserPrompt(input: PlanOutlineInput): string {
  const keywords = input.brief.keywords?.length
    ? `\nMots-clés SEO : ${input.brief.keywords.join(", ")}`
    : "";
  return (
    `Brief éditorial\n` +
    `Titre proposé : ${input.title}\n` +
    `Angle : ${input.brief.angle}\n` +
    `Audience : ${input.brief.audience}\n` +
    `Longueur cible : ${input.brief.length}\n` +
    `Ton : ${input.brief.tone}${keywords}\n\n` +
    `Produis le plan JSON strict en t'appuyant uniquement sur les passages ` +
    `numérotés [S1..Sn] fournis ci-dessus.`
  );
}

/** Tolerant outline parser — strips fences, extracts the largest JSON block. */
export function parseOutline(text: string): ArticleOutline {
  const stripped = text.replace(/```(?:json)?/gi, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Outline planner returned no JSON block.");
  }
  const block = stripped.slice(start, end + 1);
  let json: unknown;
  try {
    json = JSON.parse(block);
  } catch (err) {
    throw new Error(
      `Outline planner produced invalid JSON: ${err instanceof Error ? err.message : err}`,
    );
  }
  const result = outlineSchema.safeParse(json);
  if (!result.success) {
    throw new Error(
      `Outline schema validation failed: ${result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return result.data;
}
