/**
 * NEURAL — Extraction de texte depuis md / docx / pdf.
 *
 * Renvoie un objet { text, sourceFormat, warnings } pour alimenter
 * le rewriter MDX (cf. import-article.ts).
 *
 * Pour docx : utilise mammoth.extractRawText (texte brut, le LLM se charge
 * de re-structurer en MDX). Plus simple et plus robuste que de produire
 * un Markdown intermediaire qui pourrait reintroduire du bruit Word.
 *
 * Pour pdf : utilise pdf-parse v2 (classe PDFParse + getText).
 */

import { readFile } from "node:fs/promises";
import { extname } from "node:path";

export type SourceFormat = "md" | "mdx" | "docx" | "pdf" | "txt";

export interface ExtractedDocument {
  text: string;
  sourceFormat: SourceFormat;
  warnings: string[];
  charCount: number;
}

function detectFormat(filePath: string): SourceFormat {
  const ext = extname(filePath).toLowerCase().slice(1);
  if (ext === "md" || ext === "mdx" || ext === "docx" || ext === "pdf" || ext === "txt") {
    return ext as SourceFormat;
  }
  throw new Error(
    `Format non supporte : "${ext}". Formats acceptes : md, mdx, docx, pdf, txt.`,
  );
}

async function extractMarkdown(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}

async function extractDocx(filePath: string): Promise<{ text: string; warnings: string[] }> {
  const mammoth = await import("mammoth");
  const buffer = await readFile(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return {
    text: result.value,
    warnings: result.messages.map((m) => `[mammoth/${m.type}] ${m.message}`),
  };
}

async function extractPdf(filePath: string): Promise<{ text: string; warnings: string[] }> {
  const { PDFParse } = await import("pdf-parse");
  const buffer = await readFile(filePath);
  // Conversion explicite vers Uint8Array pour eviter les ambiguites Buffer/Uint8Array
  const data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    const warnings: string[] = [];
    if (result.pages.length > 30) {
      warnings.push(
        `PDF de ${result.pages.length} pages — l'extraction risque d'etre bruitee, verifie le rendu.`,
      );
    }
    return { text: result.text, warnings };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

export async function extractDocument(filePath: string): Promise<ExtractedDocument> {
  const sourceFormat = detectFormat(filePath);
  const warnings: string[] = [];
  let text: string;

  switch (sourceFormat) {
    case "md":
    case "mdx":
    case "txt":
      text = await extractMarkdown(filePath);
      break;
    case "docx": {
      const r = await extractDocx(filePath);
      text = r.text;
      warnings.push(...r.warnings);
      break;
    }
    case "pdf": {
      const r = await extractPdf(filePath);
      text = r.text;
      warnings.push(...r.warnings);
      break;
    }
  }

  if (text.trim().length === 0) {
    throw new Error(`Extraction vide depuis ${filePath}.`);
  }

  return {
    text,
    sourceFormat,
    warnings,
    charCount: text.length,
  };
}
