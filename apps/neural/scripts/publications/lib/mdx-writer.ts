/**
 * NEURAL — Construction du frontmatter MDX a partir du brief, validation
 * via le schema Zod existant des publications, puis serialisation finale
 * du fichier <slug>.mdx (frontmatter YAML + body MDX).
 *
 * Pourquoi cote script et pas cote LLM : les LLMs sont mauvais en YAML
 * strict (guillemets, indentation, dates ISO). On construit un objet
 * typescript, on valide via Zod, on serialise — garantit que le build
 * Next ne casse jamais sur un frontmatter mal forme.
 */

import { stringify as stringifyYaml } from "yaml";

import { publicationFrontmatterSchema } from "@/lib/publications-contract";

import type { Brief } from "./brief-schema";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildExcerpt(brief: Brief): string {
  if (brief.excerpt && brief.excerpt.length > 0) return brief.excerpt;
  // Fallback : recompose un excerpt court a partir du subtitle.
  return brief.subtitle.length <= 220
    ? brief.subtitle
    : `${brief.subtitle.slice(0, 217)}...`;
}

export function buildFrontmatter(brief: Brief) {
  const date = brief.date ?? todayIso();
  const updatedAt = brief.updatedAt ?? date;

  const candidate = {
    slug: brief.slug,
    title: brief.title,
    subtitle: brief.subtitle,
    excerpt: buildExcerpt(brief),
    category: brief.category,
    audience: brief.audience,
    date,
    updatedAt,
    readingTime: brief.readingTime,
    featured: brief.featured,
    author: brief.author,
    tags: brief.tags,
    coverImage: brief.coverImage,
    coverAlt: brief.coverAlt,
    tldr: brief.tldr,
    relatedSlugs: brief.relatedSlugs,
    seoTitle: brief.seoTitle,
    seoDescription: brief.seoDescription,
  };

  // Valide contre le schema Publications — exception bloquante si non conforme.
  return publicationFrontmatterSchema.parse(candidate);
}

export function serializeMdxFile(brief: Brief, body: string): string {
  const frontmatter = buildFrontmatter(brief);

  // gray-matter convention : ---\n<yaml>\n---\n<body>
  const yamlBlock = stringifyYaml(frontmatter, {
    lineWidth: 0,
    defaultStringType: "QUOTE_DOUBLE",
    defaultKeyType: "PLAIN",
  }).trimEnd();

  // Ajoute une newline finale pour eviter "no newline at end of file".
  const trimmedBody = body.trim();
  return `---\n${yamlBlock}\n---\n\n${trimmedBody}\n`;
}

export interface BodyStats {
  wordCount: number;
  sectionCount: number;
  componentCounts: Record<string, number>;
}

const TRACKED_COMPONENTS = [
  "Callout",
  "Figure",
  "StatBlock",
  "PullQuote",
  "ChartBlock",
  "DataTable",
  "InlineCta",
] as const;

export function analyzeBody(body: string): BodyStats {
  const wordCount = body
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_`>\-[\]()]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;

  const sectionCount = (body.match(/^##\s+/gm) ?? []).length;

  const componentCounts: Record<string, number> = {};
  for (const name of TRACKED_COMPONENTS) {
    const re = new RegExp(`<${name}\\b`, "g");
    componentCounts[name] = (body.match(re) ?? []).length;
  }

  return { wordCount, sectionCount, componentCounts };
}
