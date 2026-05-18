/**
 * Shared types for the ingestion pipeline.
 *
 * A parser produces a `ParsedDoc` — an ordered sequence of `Block`s with
 * provenance metadata. Downstream:
 *   • lib/chunking/splitter.ts consumes blocks and produces PreparedChunks
 *   • app/(studio)/sources/[id]/page.tsx renders blocks for human review
 */

export type BlockKind =
  | "heading"
  | "paragraph"
  | "list"
  | "list-item"
  | "table"
  | "code"
  | "quote";

export interface Block {
  kind: BlockKind;
  text: string;
  /** Heading level (1-6). Defined only when kind === "heading". */
  level?: number;
  /** PDF page number (1-indexed). Optional — not all parsers can resolve pages. */
  page?: number;
  /** Free-form metadata (table rows, code language, list ordered/unordered, etc.). */
  metadata?: Record<string, unknown>;
}

export interface ParsedDoc {
  filename: string;
  mimeType: string;
  /** ISO 639-1 language code when detectable (default: "fr"). */
  language?: string;
  /** Title from frontmatter / PDF info / DOCX core properties. */
  title?: string;
  /** Author from frontmatter / PDF info / DOCX core properties. */
  author?: string;
  /** Publication date from frontmatter / PDF info. */
  publishedAt?: Date;
  /** Sequential blocks — order preserved from source. */
  blocks: Block[];
  /** Parser-specific raw metadata (frontmatter, info dict, properties). */
  metadata: Record<string, unknown>;
}

/** Supported MIME types — single source of truth for dispatch. */
export const SUPPORTED_MIME_TYPES = {
  markdown: ["text/markdown", "text/x-markdown"],
  pdf: ["application/pdf"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
} as const;

export type SupportedFormat = keyof typeof SUPPORTED_MIME_TYPES;

/** Resolves a format from a MIME type or filename. Returns null if unsupported. */
export function detectFormat(
  mimeType: string | undefined | null,
  filename: string | undefined | null,
): SupportedFormat | null {
  const mt = (mimeType ?? "").toLowerCase();
  for (const [format, mimes] of Object.entries(SUPPORTED_MIME_TYPES)) {
    if ((mimes as readonly string[]).includes(mt)) return format as SupportedFormat;
  }
  const ext = (filename ?? "").toLowerCase().split(".").pop();
  if (ext === "md" || ext === "markdown") return "markdown";
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  return null;
}
