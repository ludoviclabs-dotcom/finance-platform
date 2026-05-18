/**
 * Text normalization shared by chunking + embedding paths.
 *
 * Goals:
 *  • Stable sha256 for dedup (Source.sha256) — same content → same hash
 *    regardless of trailing whitespace, line endings, soft hyphens.
 *  • Predictable token counts (no double spaces, no exotic whitespace).
 *  • Preserve paragraph structure (double newlines) so the splitter can
 *    still split on logical boundaries.
 */

export function normalizeText(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/­/g, "") // soft hyphen
    .replace(/[​-‍﻿]/g, "") // zero-width / BOM
    .replace(/[ \t]+\n/g, "\n") // trailing spaces on lines
    .replace(/\n{3,}/g, "\n\n") // collapse runs of blank lines
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Serialize parser blocks into a flat normalized document — feeds the hasher. */
export function blocksToNormalizedText(
  blocks: Array<{ text: string; kind: string }>,
): string {
  const parts: string[] = [];
  for (const b of blocks) {
    parts.push(b.text);
  }
  return normalizeText(parts.join("\n\n"));
}
