/**
 * Format retrieved chunks into a `<sources>` block for the system prompt,
 * with each chunk labelled `[S1]..[Sn]` so the model's inline citations map
 * back unambiguously to Source + Chunk rows.
 *
 * Token budget: we trim the lowest-ranked chunks if the total exceeds
 * `maxContextTokens`. This is deliberately a soft guard, not a hard one —
 * Voyage embeddings already capped each chunk to ~800 tokens, so the budget
 * primarily protects against absurdly large retrievals (e.g. all chunks from
 * a single huge source).
 */

import { countTokens } from "@/lib/chunking/tokens";
import type { RerankedChunk } from "./rerank";

export interface CitationRef {
  /** Display ID — "S1", "S2", ... — used in inline citations [S1]. */
  id: string;
  chunkId: string;
  sourceId: string;
  heading: string | null;
  pageNumber: number | null;
}

export interface BuiltContext {
  /** Pre-formatted block ready to drop into a system prompt's `<sources>` tag. */
  sourcesBlock: string;
  /** Citation registry — caller persists these alongside the Generation row. */
  citations: CitationRef[];
  /** Token count of `sourcesBlock` — used for the context-size budget. */
  tokenCount: number;
  /** How many chunks were trimmed to fit the budget. */
  trimmed: number;
}

export interface BuildContextOptions {
  /** Token ceiling for the assembled sources block. Default 4000. */
  maxContextTokens?: number;
  /** Per-chunk character cap before formatting (default 1500). */
  perChunkCharCap?: number;
}

export function buildSourcesContext(
  chunks: RerankedChunk[],
  options: BuildContextOptions = {},
): BuiltContext {
  const maxContextTokens = options.maxContextTokens ?? 4000;
  const perChunkCharCap = options.perChunkCharCap ?? 1500;

  const citations: CitationRef[] = [];
  const blocks: string[] = [];
  let runningTokens = 0;
  let trimmed = 0;

  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const id = `S${i + 1}`;
    const formatted = formatChunk(id, c, perChunkCharCap);
    const tokens = countTokens(formatted);
    if (runningTokens + tokens > maxContextTokens && blocks.length > 0) {
      trimmed = chunks.length - blocks.length;
      break;
    }
    blocks.push(formatted);
    runningTokens += tokens;
    citations.push({
      id,
      chunkId: c.id,
      sourceId: c.sourceId,
      heading: c.heading,
      pageNumber: c.pageNumber,
    });
  }

  const sourcesBlock = blocks.join("\n\n");
  return {
    sourcesBlock,
    citations,
    tokenCount: runningTokens,
    trimmed,
  };
}

function formatChunk(id: string, chunk: RerankedChunk, charCap: number): string {
  const provenance = [
    chunk.heading ? `heading="${escapeAttr(chunk.heading)}"` : null,
    chunk.pageNumber ? `page="${chunk.pageNumber}"` : null,
    chunk.sourceId ? `source="${chunk.sourceId}"` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const content = chunk.content.length > charCap
    ? `${chunk.content.slice(0, charCap).trimEnd()}…`
    : chunk.content;
  const open = provenance ? `<source id="${id}" ${provenance}>` : `<source id="${id}">`;
  return `${open}\n${content}\n</source>`;
}

function escapeAttr(value: string): string {
  return value.replace(/"/g, "&quot;").replace(/\n/g, " ");
}
