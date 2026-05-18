/**
 * Semantic chunker.
 *
 * Input: ordered Block[] from a parser (heading/paragraph/list-item/code/table/quote).
 * Output: ordered PreparedChunk[] ready for embedding + pgvector upsert.
 *
 * Strategy:
 *  1. Walk blocks in order; maintain a "current heading path" (last H1/H2/H3 seen).
 *  2. Greedily append block text to the current chunk.
 *  3. Headings act as soft boundaries — when we encounter one and the
 *     current chunk has reached MIN_TOKENS, we flush.
 *  4. When MAX_TOKENS is exceeded mid-paragraph, flush and prepend an
 *     overlap from the tail of the previous chunk (~15% of MAX_TOKENS).
 *  5. Code blocks and tables are kept atomic (never split mid-block);
 *     a code block larger than MAX_TOKENS produces its own oversized chunk
 *     (we trust the embedding model to handle it — Voyage allows 32K).
 *
 * Why these numbers:
 *  • 500-800 tokens ≈ 2-3 paragraphs of French text — small enough that
 *    retrieved chunks carry one tight topic, big enough for context.
 *  • 15% overlap reduces edge-of-chunk recall misses without inflating
 *    storage too much (~17% extra rows vs hard splits).
 */

import { countTokens } from "./tokens";
import { normalizeText } from "./normalize";
import type { Block } from "@/lib/types/source";

export interface SplitOptions {
  minTokens?: number;
  maxTokens?: number;
  /** Overlap fraction of maxTokens. 0.15 → 15% prefix from previous chunk. */
  overlapRatio?: number;
}

export interface PreparedChunk {
  orderIndex: number;
  content: string;
  tokenCount: number;
  charStart: number;
  charEnd: number;
  heading?: string;
  pageNumber?: number;
}

const DEFAULTS: Required<SplitOptions> = {
  minTokens: 500,
  maxTokens: 800,
  overlapRatio: 0.15,
};

/** Tail of `text` carrying approximately `tokenBudget` tokens. */
function tailByTokens(text: string, tokenBudget: number): string {
  if (tokenBudget <= 0 || !text) return "";
  // Approximate via sentences: take the last N sentences until budget is met.
  const sentences = text.split(/(?<=[.!?])\s+/);
  const acc: string[] = [];
  let tokens = 0;
  for (let i = sentences.length - 1; i >= 0; i--) {
    const s = sentences[i];
    const t = countTokens(s);
    if (tokens + t > tokenBudget && acc.length > 0) break;
    acc.unshift(s);
    tokens += t;
  }
  return acc.join(" ");
}

/** Format a block's text with semantic markers preserved for the LLM context. */
function renderBlock(block: Block): string {
  switch (block.kind) {
    case "heading": {
      const hashes = "#".repeat(Math.min(Math.max(block.level ?? 2, 1), 6));
      return `${hashes} ${block.text}`;
    }
    case "list-item":
      return `- ${block.text}`;
    case "code":
      return `\`\`\`\n${block.text}\n\`\`\``;
    case "quote":
      return `> ${block.text}`;
    default:
      return block.text;
  }
}

export function splitBlocks(
  blocks: Block[],
  options: SplitOptions = {},
): PreparedChunk[] {
  const opts = { ...DEFAULTS, ...options };
  const overlapTokens = Math.floor(opts.maxTokens * opts.overlapRatio);

  // Build normalized doc text + per-block offsets so we can carry char ranges.
  const renderedBlocks = blocks.map(renderBlock);
  const fullText = normalizeText(renderedBlocks.join("\n\n"));
  const blockOffsets: Array<{ start: number; end: number }> = [];
  {
    let cursor = 0;
    for (let i = 0; i < renderedBlocks.length; i++) {
      const idx = fullText.indexOf(renderedBlocks[i], cursor);
      const start = idx === -1 ? cursor : idx;
      const end = start + renderedBlocks[i].length;
      blockOffsets.push({ start, end });
      cursor = end;
    }
  }

  type Pending = {
    parts: string[];
    tokens: number;
    startBlockIndex: number;
    endBlockIndex: number;
    heading?: string;
    pageNumber?: number;
  };

  const chunks: PreparedChunk[] = [];
  let pending: Pending | null = null;
  let currentHeading: string | undefined;
  let orderIndex = 0;

  const flush = () => {
    if (!pending || pending.parts.length === 0) return;
    const content = normalizeText(pending.parts.join("\n\n"));
    const tokenCount = countTokens(content);
    const charStart = blockOffsets[pending.startBlockIndex]?.start ?? 0;
    const charEnd =
      blockOffsets[pending.endBlockIndex]?.end ?? charStart + content.length;
    chunks.push({
      orderIndex: orderIndex++,
      content,
      tokenCount,
      charStart,
      charEnd,
      heading: pending.heading,
      pageNumber: pending.pageNumber,
    });
    // Prepare overlap seed for next chunk. The new chunk inherits the
    // *current* heading context (not the one frozen on the flushed chunk).
    const seed = tailByTokens(content, overlapTokens);
    pending = seed
      ? {
          parts: [seed],
          tokens: countTokens(seed),
          startBlockIndex: pending.endBlockIndex,
          endBlockIndex: pending.endBlockIndex,
          heading: currentHeading,
          pageNumber: pending.pageNumber,
        }
      : null;
  };

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const rendered = renderedBlocks[i];
    const blockTokens = countTokens(rendered);

    // Update heading path (H1/H2 only — H3+ is too granular for citation labels).
    if (block.kind === "heading" && (block.level ?? 99) <= 2) {
      // Update currentHeading *before* flushing so the overlap seed for the
      // next chunk inherits the new heading context, not the previous one.
      currentHeading = block.text;
      if (pending && pending.tokens >= opts.minTokens) {
        flush();
      }
    }

    // If adding this block would blow the budget *and* we already have content,
    // flush first (the overlap seed kicks in to preserve context continuity).
    if (
      pending &&
      pending.tokens + blockTokens > opts.maxTokens &&
      pending.tokens >= opts.minTokens
    ) {
      flush();
    }

    if (!pending) {
      pending = {
        parts: [rendered],
        tokens: blockTokens,
        startBlockIndex: i,
        endBlockIndex: i,
        heading: currentHeading,
        pageNumber: block.page,
      };
    } else {
      pending.parts.push(rendered);
      pending.tokens += blockTokens;
      pending.endBlockIndex = i;
      pending.heading ??= currentHeading;
      pending.pageNumber ??= block.page;
    }
  }

  flush();
  return chunks;
}
