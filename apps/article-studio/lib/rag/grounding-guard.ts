/**
 * Post-generation grounding check.
 *
 * Walks the generated markdown, splits it into paragraphs, and computes the
 * ratio of paragraphs that carry at least one inline citation [S1]..[Sn]
 * (or the explicit "[INFO MANQUANTE: …]" sentinel — the model is instructed
 * to use that instead of inventing).
 *
 * Why a ratio rather than a presence check: the section-writer prompt asks
 * for "every factual claim cited". A drift toward unsubstantiated prose
 * shows up as a falling score over revisions; the UI surfaces a warning
 * below 0.7 so the operator can regenerate or tighten the brief.
 *
 * Pure function — no IO. Tested in isolation.
 */

export interface GroundingResult {
  /** Citation coverage in [0, 1]. 1.0 = every paragraph cites a source. */
  score: number;
  /** Total non-empty paragraphs scanned (excludes headings, code, lists). */
  paragraphCount: number;
  /** Paragraphs containing at least one [S\d] citation. */
  citedCount: number;
  /** Distinct citation tokens (e.g. "S1", "S3") referenced in the body. */
  citedSources: string[];
  /** Count of explicit "[INFO MANQUANTE …]" sentinels — counted toward "covered" */
  missingMarkers: number;
  /** Paragraphs that lack both a citation and a missing-info marker. */
  unsupportedParagraphs: string[];
}

const CITATION_RE = /\[S(\d+)\]/g;
const MISSING_RE = /\[INFO MANQUANTE[^\]]*\]/i;
const HEADING_RE = /^#{1,6}\s/;
const CODE_FENCE_RE = /^```/;
const LIST_ITEM_RE = /^[-*+]\s|^\d+\.\s/;
const QUOTE_RE = /^>\s/;

function isProseParagraph(block: string): boolean {
  const trimmed = block.trim();
  if (trimmed.length === 0) return false;
  if (HEADING_RE.test(trimmed)) return false;
  if (CODE_FENCE_RE.test(trimmed)) return false;
  // Lists and quotes still count as prose for grounding purposes — they often
  // carry factual claims that must be cited too.
  void LIST_ITEM_RE;
  void QUOTE_RE;
  return true;
}

export function checkGrounding(markdown: string): GroundingResult {
  if (!markdown.trim()) {
    return {
      score: 0,
      paragraphCount: 0,
      citedCount: 0,
      citedSources: [],
      missingMarkers: 0,
      unsupportedParagraphs: [],
    };
  }

  // Strip fenced code blocks entirely (they can contain bracket noise).
  const stripped = markdown.replace(/```[\s\S]*?```/g, "");

  const paragraphs = stripped
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(isProseParagraph);

  const citedSources = new Set<string>();
  let citedCount = 0;
  let missingMarkers = 0;
  const unsupportedParagraphs: string[] = [];

  for (const para of paragraphs) {
    const hits = [...para.matchAll(CITATION_RE)];
    for (const h of hits) citedSources.add(`S${h[1]}`);
    const hasMissing = MISSING_RE.test(para);
    if (hasMissing) missingMarkers++;
    if (hits.length > 0 || hasMissing) {
      citedCount++;
    } else {
      unsupportedParagraphs.push(para.slice(0, 160));
    }
  }

  const score = paragraphs.length === 0 ? 0 : citedCount / paragraphs.length;

  return {
    score,
    paragraphCount: paragraphs.length,
    citedCount,
    citedSources: [...citedSources].sort(),
    missingMarkers,
    unsupportedParagraphs,
  };
}

/** Threshold below which the UI shows a "low grounding" warning. */
export const GROUNDING_WARNING_THRESHOLD = 0.7;
