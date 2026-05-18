/**
 * Shared types for export modules.
 *
 * The pipeline shape:
 *   Article (DB row) → ExportPayload (denormalized + citations resolved)
 *                    → format-specific module → bytes/string + content-type
 */

import type { ChartSpec } from "@/lib/infographics/chart-spec";

export interface ExportCitation {
  id: string;
  position: number;
  sourceId: string;
  sourceTitle: string;
  sourceFilename: string;
  sourceAuthor: string | null;
  chunkHeading: string | null;
  chunkPageNumber: number | null;
  quote: string;
}

export interface ExportInfographic {
  id: string;
  position: number;
  title: string;
  spec: ChartSpec;
  sourceCitationIds: string[];
}

export interface ExportPayload {
  id: string;
  slug: string;
  title: string;
  status: string;
  metaTitle: string | null;
  metaDescription: string | null;
  bodyMd: string;
  brief: {
    angle: string;
    audience: string;
    tone: string;
    length: string;
    keywords: string[];
  } | null;
  outline: {
    title: string;
    metaDescription?: string;
    sections: Array<{ id: string; title: string; summary: string }>;
  } | null;
  citations: ExportCitation[];
  infographics: ExportInfographic[];
  createdAt: string;
  updatedAt: string;
}

export interface ExportResult {
  body: Buffer | string;
  contentType: string;
  /** Suggested download filename (caller injects into Content-Disposition). */
  filename: string;
}

export const EXPORT_FORMATS = ["markdown", "json", "html", "docx", "pdf"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const FORMAT_LABELS: Record<ExportFormat, string> = {
  markdown: "Markdown (.md)",
  json: "JSON (.json)",
  html: "HTML (.html)",
  docx: "Word (.docx)",
  pdf: "PDF (.pdf)",
};
