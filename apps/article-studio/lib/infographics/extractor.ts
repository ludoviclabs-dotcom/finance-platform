/**
 * Infographic candidate extraction.
 *
 * Two-phase design:
 *   1. Local heuristic scan of the generated markdown — picks candidate
 *      paragraphs that "look like" they contain quantitative data: tables,
 *      lists with percentages or amounts, multi-figure comparisons. Cheap,
 *      deterministic, runs without an LLM call.
 *   2. Optional LLM confirmation (Haiku) — for each candidate, asks the
 *      model to propose a ChartSpec or skip. Validated against the Zod
 *      schema before persistence.
 *
 * Phase 2 is wired through the existing query-expander surface for V1
 * (low temperature, JSON output). A dedicated "infographic-detector"
 * surface can be added in the router if quality demands it.
 */

import {
  generateArticleStudioSurface,
  type ArticleStudioSurfaceId,
} from "@/lib/ai/router";
import { chartSpecSchema, type ChartSpec } from "./chart-spec";

export interface InfographicCandidate {
  /** Section/paragraph index for traceability. */
  position: number;
  /** Source paragraph that triggered the candidate. */
  excerpt: string;
  /** Citation IDs ([S1]..[Sn]) found in the excerpt. */
  citationIds: string[];
}

export interface InfographicProposal extends InfographicCandidate {
  spec: ChartSpec;
}

const TABLE_RE = /^\|[^\n]*\|[\s]*$\n^\|[\s\-:|]+\|/m;
const MULTIPLE_NUMBERS_RE = /(\d+[\d.,]*)\s*(%|€|\$|x|×|points?|p\.|pts)/gi;
const LIST_WITH_NUMBERS_RE = /^[-*+]\s+.*\d+[\d.,]*/m;

/**
 * Heuristic scan — returns paragraphs that probably contain chart-worthy data.
 * Strips fenced code blocks and headings before scanning.
 */
export function findInfographicCandidates(markdown: string): InfographicCandidate[] {
  const stripped = markdown.replace(/```[\s\S]*?```/g, "");
  const paragraphs = stripped
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const candidates: InfographicCandidate[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    if (para.startsWith("#")) continue;
    if (looksDataDense(para)) {
      candidates.push({
        position: i,
        excerpt: para.slice(0, 800),
        citationIds: extractCitationIds(para),
      });
    }
  }
  return candidates;
}

function looksDataDense(para: string): boolean {
  if (TABLE_RE.test(para)) return true;
  if (LIST_WITH_NUMBERS_RE.test(para) && countMatches(para, MULTIPLE_NUMBERS_RE) >= 3) {
    return true;
  }
  return countMatches(para, MULTIPLE_NUMBERS_RE) >= 3;
}

function countMatches(text: string, re: RegExp): number {
  return [...text.matchAll(re)].length;
}

function extractCitationIds(text: string): string[] {
  const ids = new Set<string>();
  for (const m of text.matchAll(/\[S(\d+)\]/g)) ids.add(`S${m[1]}`);
  return [...ids].sort();
}

/** LLM confirmation prompt — asks for one ChartSpec or `null`. */
const SYSTEM_PROMPT_NOTE = `Tu transformes un paragraphe d'article en spécification de graphique JSON
(ou décides que ce n'est pas pertinent).

Sortie : JSON strict, aucun texte autour.
- Si le paragraphe contient un comparatif quantitatif clair (tableau, listes de chiffres) :
  retourne un objet conforme au schéma. Exemples :
  { "kind": "bar",   "title": "...", "categories": ["A","B"], "datasets": [{"label":"...", "values":[1,2]}] }
  { "kind": "line",  "title": "...", "categories": ["2023","2024","2025"], "datasets": [{"label":"...", "values":[10,15,18]}] }
  { "kind": "pie",   "title": "...", "slices": [{"label":"...", "value":40}, ...] }
  { "kind": "table", "title": "...", "headers": ["Col1","Col2"], "rows": [["a","b"], ...] }
  { "kind": "stat",  "title": "...", "value": "75 %", "caption": "..." }
- Sinon : retourne exactement null.

Règles :
- N'invente aucune valeur absente du paragraphe.
- Préfère "table" si tu hésites — un tableau est toujours valide.
- Réponds par UN seul objet ou null, jamais un tableau ou plusieurs objets.`;

const SURFACE_FOR_CONFIRMATION: ArticleStudioSurfaceId = "query-expander";

export async function confirmInfographicCandidate(
  candidate: InfographicCandidate,
  userId: string,
): Promise<InfographicProposal | null> {
  const result = await generateArticleStudioSurface({
    surfaceId: SURFACE_FOR_CONFIRMATION,
    userId,
    messages: [
      { role: "user", content: `${SYSTEM_PROMPT_NOTE}\n\nParagraphe :\n${candidate.excerpt}` },
    ],
    temperatureOverride: 0,
    maxOutputTokensOverride: 800,
  });

  const spec = parseChartSpec(result.text);
  if (!spec) return null;
  return { ...candidate, spec };
}

export function parseChartSpec(text: string): ChartSpec | null {
  const stripped = text.replace(/```(?:json)?/gi, "").trim();
  if (stripped === "null") return null;
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    const json = JSON.parse(stripped.slice(start, end + 1));
    const result = chartSpecSchema.safeParse(json);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
