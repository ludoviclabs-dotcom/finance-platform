/**
 * Token counting via js-tiktoken (cl100k_base — proxy for Claude tokens, ±5%).
 *
 * We don't need Claude-perfect counts: chunks are budgeted to 500-800 tokens
 * with comfortable headroom, and the embedding model (Voyage voyage-3-large)
 * accepts up to 32K tokens per chunk anyway.
 */

import { Tiktoken } from "js-tiktoken/lite";
import cl100kBase from "js-tiktoken/ranks/cl100k_base";

const encoder = new Tiktoken(cl100kBase);

export function countTokens(text: string): number {
  if (!text) return 0;
  return encoder.encode(text).length;
}

/** Truncate a string to a token budget — used as a safety net before embedding. */
export function truncateToTokens(text: string, maxTokens: number): string {
  if (!text) return "";
  const ids = encoder.encode(text);
  if (ids.length <= maxTokens) return text;
  return encoder.decode(ids.slice(0, maxTokens));
}
