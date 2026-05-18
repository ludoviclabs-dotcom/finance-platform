/**
 * Parser dispatcher — routes a (buffer, mime, filename) to the appropriate
 * format-specific parser. Returns a uniform ParsedDoc or throws with a
 * caller-friendly error.
 */

import { parseDocx } from "./docx";
import { parseMarkdown } from "./markdown";
import { parsePdf } from "./pdf";
import { detectFormat, type ParsedDoc } from "@/lib/types/source";

export class UnsupportedFormatError extends Error {
  constructor(public readonly mimeType: string, public readonly filename: string) {
    super(`Unsupported format: mime="${mimeType}" filename="${filename}"`);
    this.name = "UnsupportedFormatError";
  }
}

export class EmptyDocumentError extends Error {
  constructor(public readonly filename: string) {
    super(
      `Document "${filename}" parsed to zero blocks. Likely a scanned PDF without OCR, or an empty file.`,
    );
    this.name = "EmptyDocumentError";
  }
}

export interface ParseInput {
  buffer: Buffer;
  filename: string;
  mimeType?: string;
}

export async function parseSource(input: ParseInput): Promise<ParsedDoc> {
  const { buffer, filename, mimeType } = input;
  const format = detectFormat(mimeType, filename);

  if (!format) {
    throw new UnsupportedFormatError(mimeType ?? "(none)", filename);
  }

  let parsed: ParsedDoc;
  switch (format) {
    case "markdown":
      parsed = await parseMarkdown(buffer, filename);
      break;
    case "pdf":
      parsed = await parsePdf(buffer, filename);
      break;
    case "docx":
      parsed = await parseDocx(buffer, filename);
      break;
  }

  if (parsed.blocks.length === 0) {
    throw new EmptyDocumentError(filename);
  }

  return parsed;
}

export { parseMarkdown } from "./markdown";
export { parsePdf } from "./pdf";
export { parseDocx } from "./docx";
