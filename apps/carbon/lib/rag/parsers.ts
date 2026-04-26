import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

export type ParsedSegment = {
  text: string;
  page?: number;
  sheet?: string;
};

export async function parsePdf(buffer: ArrayBuffer | Uint8Array): Promise<ParsedSegment[]> {
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];
  return pages
    .map((p, i) => ({ text: (p ?? "").trim(), page: i + 1 }))
    .filter((s) => s.text.length > 0);
}

export async function parseDocx(buffer: ArrayBuffer): Promise<ParsedSegment[]> {
  const result = await mammoth.extractRawText({
    buffer: Buffer.from(buffer),
  });
  const text = result.value.trim();
  if (!text) return [];
  return [{ text }];
}

export async function parseXlsx(buffer: ArrayBuffer): Promise<ParsedSegment[]> {
  const wb = XLSX.read(buffer, { type: "array" });
  const segments: ParsedSegment[] = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    const text = csv.trim();
    if (text.length > 0) {
      segments.push({ text, sheet: sheetName });
    }
  }
  return segments;
}

export async function parseDocument(
  filename: string,
  mimeType: string,
  buffer: ArrayBuffer,
): Promise<ParsedSegment[]> {
  const lower = filename.toLowerCase();
  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) {
    return parsePdf(buffer);
  }
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    return parseDocx(buffer);
  }
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls")
  ) {
    return parseXlsx(buffer);
  }
  throw new Error(`Type de document non supporté : ${mimeType || filename}`);
}
