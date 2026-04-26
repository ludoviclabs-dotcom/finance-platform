import type { ParsedSegment } from "./parsers";

export type Chunk = {
  text: string;
  page?: number;
  sheet?: string;
  index: number;
};

const APPROX_CHARS_PER_TOKEN = 4;
const DEFAULT_TARGET_TOKENS = 800;
const DEFAULT_OVERLAP_TOKENS = 120;

function splitOnBoundaries(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const paragraphs = text.split(/\n{2,}/);
  const out: string[] = [];
  let buf = "";
  for (const para of paragraphs) {
    if ((buf + "\n\n" + para).length > maxChars && buf) {
      out.push(buf);
      buf = para;
    } else {
      buf = buf ? `${buf}\n\n${para}` : para;
    }
  }
  if (buf) out.push(buf);
  return out.flatMap((c) => (c.length > maxChars ? hardSplit(c, maxChars) : [c]));
}

function hardSplit(text: string, maxChars: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    out.push(text.slice(i, i + maxChars));
  }
  return out;
}

export function chunkSegments(
  segments: ParsedSegment[],
  opts: { targetTokens?: number; overlapTokens?: number } = {},
): Chunk[] {
  const targetTokens = opts.targetTokens ?? DEFAULT_TARGET_TOKENS;
  const overlapTokens = opts.overlapTokens ?? DEFAULT_OVERLAP_TOKENS;
  const maxChars = targetTokens * APPROX_CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * APPROX_CHARS_PER_TOKEN;

  const chunks: Chunk[] = [];
  let idx = 0;

  for (const seg of segments) {
    const pieces = splitOnBoundaries(seg.text, maxChars);
    for (let i = 0; i < pieces.length; i++) {
      const prev = i > 0 ? pieces[i - 1].slice(-overlapChars) : "";
      const text = prev ? `${prev}\n${pieces[i]}` : pieces[i];
      chunks.push({
        text: text.trim(),
        page: seg.page,
        sheet: seg.sheet,
        index: idx++,
      });
    }
  }

  return chunks.filter((c) => c.text.length >= 40);
}
