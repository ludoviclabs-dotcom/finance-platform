/**
 * HTML export — full standalone document with embedded CSS.
 *
 * Pipeline:
 *   markdown → remark MDAST → rehype HAST → stringified HTML
 *   inline [Sn] tokens get wrapped in <cite data-citation-id="Sn"> spans
 *   final HTML is sanitized via DOMPurify before embedding in the template
 *
 * The output is a single .html file: portable, opens anywhere, prints
 * cleanly (the PDF exporter reuses this exact template).
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import DOMPurify from "isomorphic-dompurify";

import type { ExportPayload, ExportResult } from "./types";

export async function exportHtml(payload: ExportPayload): Promise<ExportResult> {
  const html = await renderArticleHtml(payload);
  return {
    body: html,
    contentType: "text/html; charset=utf-8",
    filename: `${payload.slug}.html`,
  };
}

/** Exposed for the PDF exporter, which reuses the same template. */
export async function renderArticleHtml(payload: ExportPayload): Promise<string> {
  const bodyHtml = await markdownToHtml(payload.bodyMd ?? "");
  const withCitations = wrapCitations(bodyHtml);
  const safeBody = DOMPurify.sanitize(withCitations, {
    ADD_TAGS: ["cite"],
    ADD_ATTR: ["data-citation-id"],
  });
  const citationsList = renderCitationsList(payload);
  const infographicsList = renderInfographicsList(payload);

  return wrapTemplate({
    title: payload.title,
    description: payload.metaDescription ?? "",
    bodyHtml: safeBody,
    citationsHtml: citationsList,
    infographicsHtml: infographicsList,
    updatedAt: payload.updatedAt,
  });
}

async function markdownToHtml(md: string): Promise<string> {
  if (!md.trim()) {
    return "<p><em>Article vide — lancez la génération.</em></p>";
  }
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeStringify)
    .process(md);
  return String(file);
}

const CITATION_TOKEN_RE = /\[S(\d+)\]/g;

function wrapCitations(html: string): string {
  return html.replace(
    CITATION_TOKEN_RE,
    (_match, n: string) =>
      `<cite data-citation-id="S${n}" class="citation">[S${n}]</cite>`,
  );
}

function renderCitationsList(payload: ExportPayload): string {
  if (payload.citations.length === 0) return "";
  const items = payload.citations
    .map((c) => {
      const refParts: string[] = [];
      const title = c.sourceTitle || c.sourceFilename;
      refParts.push(`<strong>${escapeHtml(title)}</strong>`);
      if (c.sourceAuthor) refParts.push(escapeHtml(c.sourceAuthor));
      if (c.chunkPageNumber) refParts.push(`p.&nbsp;${c.chunkPageNumber}`);
      if (c.chunkHeading) refParts.push(`«&nbsp;${escapeHtml(c.chunkHeading)}&nbsp;»`);
      return `<li id="cite-${c.id}"><span class="cite-id">[${c.id}]</span> ${refParts.join(" — ")}</li>`;
    })
    .join("");
  return `<section class="citations"><h2>Sources citées</h2><ol>${items}</ol></section>`;
}

function renderInfographicsList(payload: ExportPayload): string {
  if (payload.infographics.length === 0) return "";
  const items = payload.infographics
    .map(
      (g) =>
        `<li><strong>${escapeHtml(g.title)}</strong> <span class="meta">(${g.spec.kind})</span></li>`,
    )
    .join("");
  return `<section class="infographics"><h2>Infographies détectées</h2><ol>${items}</ol></section>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface TemplateArgs {
  title: string;
  description: string;
  bodyHtml: string;
  citationsHtml: string;
  infographicsHtml: string;
  updatedAt: string;
}

function wrapTemplate(args: TemplateArgs): string {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(args.title)}</title>
  ${args.description ? `<meta name="description" content="${escapeHtml(args.description)}">` : ""}
  <style>
    :root { color-scheme: light; }
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      max-width: 38rem; margin: 3rem auto; padding: 0 1.5rem;
      color: #111; line-height: 1.6;
    }
    h1 { font-size: 2rem; line-height: 1.2; margin-bottom: 0.25rem; }
    h2 { margin-top: 2.25rem; font-size: 1.35rem; }
    h3 { margin-top: 1.75rem; font-size: 1.1rem; }
    p, ul, ol { margin: 1rem 0; }
    blockquote { border-left: 3px solid #d4d4d8; padding-left: 1rem; color: #52525b; margin: 1rem 0; }
    code { background: #f4f4f5; padding: 0.1em 0.35em; border-radius: 3px; font-size: 0.92em; }
    pre code { display: block; padding: 0.75rem; overflow-x: auto; }
    table { border-collapse: collapse; margin: 1rem 0; width: 100%; }
    th, td { border: 1px solid #d4d4d8; padding: 0.5rem 0.75rem; text-align: left; }
    cite.citation {
      font-style: normal; color: #2563eb; text-decoration: none;
      font-variant-numeric: tabular-nums; font-size: 0.85em; padding: 0 0.1em;
    }
    .citations, .infographics { margin-top: 3rem; font-size: 0.95rem; }
    .citations h2, .infographics h2 { font-size: 1rem; text-transform: uppercase; letter-spacing: 0.08em; color: #71717a; }
    .citations ol { padding-left: 1.5rem; }
    .citations li { margin: 0.4rem 0; }
    .cite-id { font-variant-numeric: tabular-nums; color: #2563eb; font-weight: 600; }
    .meta { color: #71717a; font-size: 0.85em; }
    footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e4e4e7; color: #71717a; font-size: 0.85rem; }
  </style>
</head>
<body>
  <article>
    <h1>${escapeHtml(args.title)}</h1>
    ${args.description ? `<p class="meta">${escapeHtml(args.description)}</p>` : ""}
    ${args.bodyHtml}
    ${args.citationsHtml}
    ${args.infographicsHtml}
  </article>
  <footer>Article Studio · mis à jour le ${escapeHtml(args.updatedAt)}</footer>
</body>
</html>`;
}
