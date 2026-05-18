/**
 * PDF parser — pdf-parse + heading heuristics.
 *
 * pdf-parse gives us plain text concatenated across pages. We split on
 * blank lines into raw blocks, then apply heuristics to detect headings:
 *   • Lines starting with "Chapter|Section|Partie N" or numbered sections
 *     (e.g. "1.", "1.1", "2.3.4 ")
 *   • Short isolated lines (< 80 chars, no trailing punctuation) following
 *     a paragraph and preceding another paragraph
 *   • Lines in ALL CAPS short enough to be a title
 *
 * Limitations (V1):
 *   • Page numbers are best-effort: derived from form-feed (\f) separators
 *     when present; otherwise undefined.
 *   • Tables are flattened into paragraphs (TODO V2: structured table extract).
 *   • Scanned/OCR PDFs return empty text — the route handler should mark the
 *     Source as FAILED with a clear errorMessage.
 */

// Import from lib directly to avoid pdf-parse@1.1.1's top-level debug code
// (index.js reads a test file when module.parent is null, which breaks ESM/Vitest).
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import type { Block, ParsedDoc } from "@/lib/types/source";

const HEADING_LIKE = /^(?:chapter|chapitre|section|partie|part)\s+[0-9ivxlcdm]+/i;
const NUMBERED_HEADING = /^\d+(?:\.\d+){0,3}\.?\s+\S/;
const ALL_CAPS = /^[\p{Lu}\d\s\-:,.'"&()]+$/u;

function isLikelyHeading(line: string, prev?: string, next?: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 120) return false;

  if (HEADING_LIKE.test(trimmed)) return true;
  if (NUMBERED_HEADING.test(trimmed)) return true;

  // ALL CAPS, short, no trailing punctuation, surrounded by blank lines.
  if (
    trimmed.length <= 80 &&
    !/[.!?:;,]$/.test(trimmed) &&
    ALL_CAPS.test(trimmed) &&
    trimmed.length > 3
  ) {
    return true;
  }

  // Short, no trailing punctuation, sandwich-detected (paragraph above/below).
  if (
    trimmed.length <= 80 &&
    !/[.!?:;,]$/.test(trimmed) &&
    /^[\p{Lu}]/u.test(trimmed) &&
    prev !== undefined &&
    next !== undefined &&
    prev.length > 40 &&
    next.length > 40
  ) {
    return true;
  }

  return false;
}

function detectHeadingLevel(line: string): number {
  const m = line.trim().match(/^(\d+(?:\.\d+){0,3})\.?\s/);
  if (m) {
    const depth = m[1].split(".").length;
    return Math.min(depth + 1, 6); // "1." → H2, "1.1" → H3, ...
  }
  if (HEADING_LIKE.test(line.trim())) return 2;
  return 2; // default H2 for surface-detected headings
}

function blocksFromPageText(
  pageText: string,
  pageNumber: number | undefined,
): Block[] {
  // Normalize whitespace within paragraphs but preserve paragraph breaks.
  const paragraphs = pageText
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n+/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const blocks: Block[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const line = paragraphs[i];
    if (isLikelyHeading(line, paragraphs[i - 1], paragraphs[i + 1])) {
      blocks.push({
        kind: "heading",
        text: line,
        level: detectHeadingLevel(line),
        page: pageNumber,
      });
    } else {
      blocks.push({ kind: "paragraph", text: line, page: pageNumber });
    }
  }
  return blocks;
}

function splitPages(text: string): { page: number; text: string }[] {
  if (text.includes("\f")) {
    return text.split("\f").map((t, i) => ({ page: i + 1, text: t }));
  }
  return [{ page: 1, text }];
}

interface PdfInfo {
  Title?: string;
  Author?: string;
  CreationDate?: string;
  ModDate?: string;
}

function parsePdfDate(raw: string | undefined): Date | undefined {
  if (!raw) return undefined;
  const m = raw.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
  if (!m) return undefined;
  const [, y, mo, d, h = "00", mi = "00", s = "00"] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function parsePdf(
  buffer: Buffer,
  filename: string,
): Promise<ParsedDoc> {
  const data = await pdfParse(buffer);
  const info = (data.info ?? {}) as PdfInfo;

  const pages = splitPages(data.text ?? "");
  const blocks = pages.flatMap((p) => blocksFromPageText(p.text, p.page));

  return {
    filename,
    mimeType: "application/pdf",
    language: "fr",
    title: info.Title?.trim() || undefined,
    author: info.Author?.trim() || undefined,
    publishedAt: parsePdfDate(info.CreationDate ?? info.ModDate),
    blocks,
    metadata: {
      pageCount: data.numpages,
      pdfInfo: info,
      pdfMetadata: data.metadata ?? null,
    },
  };
}
