/**
 * Export façade — load the article + citations from DB, dispatch to the
 * format-specific module, return bytes + content type + filename.
 */

import { db } from "@/lib/db";
import { articleBriefSchema, outlineSchema } from "@/lib/types/article";
import { chartSpecSchema } from "@/lib/infographics/chart-spec";
import { exportMarkdown } from "./markdown";
import { exportJson } from "./json";
import { exportHtml } from "./html";
import { exportDocx } from "./docx";
import { exportPdf } from "./pdf";
import type {
  ExportFormat,
  ExportPayload,
  ExportResult,
  ExportCitation,
  ExportInfographic,
} from "./types";

export type { ExportFormat, ExportResult } from "./types";
export { EXPORT_FORMATS, FORMAT_LABELS } from "./types";

export async function exportArticle(
  articleId: string,
  format: ExportFormat,
): Promise<ExportResult> {
  const payload = await loadPayload(articleId);
  switch (format) {
    case "markdown":
      return exportMarkdown(payload);
    case "json":
      return exportJson(payload);
    case "html":
      return exportHtml(payload);
    case "docx":
      return exportDocx(payload);
    case "pdf":
      return exportPdf(payload);
  }
}

async function loadPayload(articleId: string): Promise<ExportPayload> {
  const article = await db.article.findUnique({
    where: { id: articleId },
    include: {
      citations: {
        orderBy: { position: "asc" },
        include: {
          source: {
            select: { title: true, filename: true, author: true },
          },
          chunk: {
            select: { heading: true, pageNumber: true, content: true },
          },
        },
      },
      infographics: {
        orderBy: { position: "asc" },
      },
    },
  });

  if (!article) throw new Error(`Article ${articleId} introuvable.`);

  const briefResult = articleBriefSchema.safeParse(article.brief);
  const outlineResult = article.outline
    ? outlineSchema.safeParse(article.outline)
    : null;

  const citations: ExportCitation[] = article.citations.map((c) => ({
    id: `S${c.position + 1}`,
    position: c.position,
    sourceId: c.sourceId,
    sourceTitle: c.source.title ?? "",
    sourceFilename: c.source.filename,
    sourceAuthor: c.source.author,
    chunkHeading: c.chunk?.heading ?? null,
    chunkPageNumber: c.chunk?.pageNumber ?? null,
    // Quote field is populated lazily — fall back to a slice of the chunk
    // content so JSON/markdown exports still carry the verbatim passage.
    quote: c.quote || (c.chunk?.content?.slice(0, 400) ?? ""),
  }));

  const infographics: ExportInfographic[] = article.infographics
    .map((g) => {
      const spec = chartSpecSchema.safeParse(g.spec);
      if (!spec.success) return null;
      return {
        id: g.id,
        position: g.position,
        title: g.title,
        spec: spec.data,
        sourceCitationIds: g.sourceCitationIds,
      };
    })
    .filter((g): g is ExportInfographic => g !== null);

  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    status: article.status,
    metaTitle: article.metaTitle,
    metaDescription: article.metaDescription,
    bodyMd: article.bodyMd ?? "",
    brief: briefResult.success
      ? {
          angle: briefResult.data.angle,
          audience: briefResult.data.audience,
          tone: briefResult.data.tone,
          length: briefResult.data.length,
          keywords: briefResult.data.keywords,
        }
      : null,
    outline: outlineResult?.success ? outlineResult.data : null,
    citations,
    infographics,
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
  };
}
