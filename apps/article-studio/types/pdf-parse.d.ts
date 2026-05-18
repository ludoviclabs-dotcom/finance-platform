/**
 * Type declaration for pdf-parse/lib/pdf-parse.js — the bare implementation
 * imported directly to bypass index.js's top-level test code that breaks under
 * ESM (module.parent is null).
 */
declare module "pdf-parse/lib/pdf-parse.js" {
  export interface PdfData {
    text: string;
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    version: string;
  }
  const pdfParse: (
    dataBuffer: Buffer | Uint8Array,
    options?: Record<string, unknown>,
  ) => Promise<PdfData>;
  export default pdfParse;
}
