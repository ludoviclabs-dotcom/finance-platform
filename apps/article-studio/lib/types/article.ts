/**
 * Article studio — domain types for the brief, outline, and citations.
 *
 * `brief` is persisted as Json on Article — we always validate via Zod at the
 * API boundary so the database doesn't accumulate ill-formed shapes.
 */

import { z } from "zod";

export const ARTICLE_LENGTHS = ["short", "medium", "long"] as const;
export type ArticleLength = (typeof ARTICLE_LENGTHS)[number];

export const articleBriefSchema = z.object({
  /** Working title — used as the slug seed and the SEO meta-title default. */
  title: z.string().min(3).max(160),
  /** What the article should *do* — its angle / promise. */
  angle: z.string().min(10).max(500),
  /** Who the article addresses (1-2 lines). */
  audience: z.string().min(3).max(300),
  /** Approximate word target. short ≈ 600, medium ≈ 1200, long ≈ 2500. */
  length: z.enum(ARTICLE_LENGTHS).default("medium"),
  /** Editorial register — analytique, pédagogique, etc. */
  tone: z.string().min(3).max(120).default("analytique"),
  /** Source.id values to use as the RAG corpus for this article. */
  selectedSourceIds: z.array(z.string()).default([]),
  /** SEO keywords — also seed query expansion. */
  keywords: z.array(z.string()).default([]),
});

export type ArticleBrief = z.infer<typeof articleBriefSchema>;

export const outlineSchema = z.object({
  title: z.string(),
  metaDescription: z.string().optional(),
  sections: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      summary: z.string(),
      sourceRefs: z.array(z.string()).default([]),
    }),
  ),
});

export type ArticleOutline = z.infer<typeof outlineSchema>;

/** Approximate word-count target per length tier (used to size sections). */
export const LENGTH_WORD_TARGETS: Record<ArticleLength, number> = {
  short: 600,
  medium: 1200,
  long: 2500,
};

/** Slugify — lowercase, ASCII, hyphen-separated. */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
