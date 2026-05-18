/**
 * Markdown export — the canonical body is already markdown; we wrap it with
 * YAML frontmatter (title, slug, metadata) and append a citations footer so
 * the document remains self-contained when shared as a .md file.
 */

import type { ExportPayload, ExportResult } from "./types";

export function exportMarkdown(payload: ExportPayload): ExportResult {
  const frontmatter = renderFrontmatter(payload);
  const citationsFooter = renderCitations(payload);
  const body = payload.bodyMd?.trim() || "*[Article vide — lancez la génération]*";

  const parts = [frontmatter, `# ${payload.title}\n`, body];
  if (citationsFooter) parts.push(citationsFooter);

  return {
    body: parts.join("\n\n"),
    contentType: "text/markdown; charset=utf-8",
    filename: `${payload.slug}.md`,
  };
}

function renderFrontmatter(payload: ExportPayload): string {
  const lines = ["---"];
  lines.push(`title: ${yamlString(payload.title)}`);
  lines.push(`slug: ${yamlString(payload.slug)}`);
  if (payload.metaDescription) {
    lines.push(`description: ${yamlString(payload.metaDescription)}`);
  }
  if (payload.brief?.keywords?.length) {
    lines.push(
      `keywords: [${payload.brief.keywords.map(yamlString).join(", ")}]`,
    );
  }
  lines.push(`status: ${yamlString(payload.status)}`);
  lines.push(`createdAt: ${payload.createdAt}`);
  lines.push(`updatedAt: ${payload.updatedAt}`);
  lines.push("---");
  return lines.join("\n");
}

function renderCitations(payload: ExportPayload): string {
  if (payload.citations.length === 0) return "";
  const lines = ["---", "## Sources citées", ""];
  for (const c of payload.citations) {
    const refParts = [c.sourceTitle || c.sourceFilename];
    if (c.sourceAuthor) refParts.push(c.sourceAuthor);
    if (c.chunkPageNumber) refParts.push(`p. ${c.chunkPageNumber}`);
    if (c.chunkHeading) refParts.push(`« ${c.chunkHeading} »`);
    lines.push(`- **[${c.id}]** ${refParts.join(" — ")}`);
  }
  return lines.join("\n");
}

function yamlString(value: string): string {
  if (/[:#\n"'\\]/.test(value)) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ")}"`;
  }
  return value;
}
