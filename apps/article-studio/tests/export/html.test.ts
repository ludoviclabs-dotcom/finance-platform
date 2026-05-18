import { describe, expect, it } from "vitest";
import { renderArticleHtml } from "@/lib/export/html";
import type { ExportPayload } from "@/lib/export/types";

function payload(over: Partial<ExportPayload> = {}): ExportPayload {
  return {
    id: "a1",
    slug: "test-article",
    title: "Test article",
    status: "READY",
    metaTitle: null,
    metaDescription: "Une description courte.",
    bodyMd: "## Intro\n\nUn paragraphe cité [S1].",
    brief: null,
    outline: null,
    citations: [],
    infographics: [],
    createdAt: "2026-05-12T10:00:00.000Z",
    updatedAt: "2026-05-12T11:00:00.000Z",
    ...over,
  };
}

describe("renderArticleHtml", () => {
  it("renders a complete standalone HTML document", async () => {
    const html = await renderArticleHtml(payload());
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<title>Test article</title>");
    expect(html).toContain('<meta name="description"');
    expect(html).toContain("</html>");
  });

  it("converts markdown headings and paragraphs", async () => {
    const html = await renderArticleHtml(payload());
    expect(html).toContain("<h2>Intro</h2>");
    expect(html).toMatch(/<p>Un paragraphe cité/);
  });

  it("wraps [Sn] tokens in <cite data-citation-id> spans", async () => {
    const html = await renderArticleHtml(payload());
    expect(html).toContain('<cite data-citation-id="S1"');
  });

  it("strips raw <script> tags so embedded scripts cannot execute", async () => {
    const html = await renderArticleHtml(
      payload({ bodyMd: "Texte <script>alert('xss')</script> piégé." }),
    );
    // The <script> tag itself must be gone from the body — remark-rehype with
    // allowDangerousHtml:false drops it, DOMPurify is a second line of defense.
    // Inert text fragments inside <p> are fine; only executable HTML matters.
    expect(html).not.toMatch(/<script\b/i);
    expect(html).toMatch(/<p>Texte\b/);
  });

  it("emits the citations footer when citations are present", async () => {
    const html = await renderArticleHtml(
      payload({
        citations: [
          {
            id: "S1",
            position: 0,
            sourceId: "doc",
            sourceTitle: "Rapport",
            sourceFilename: "rapport.pdf",
            sourceAuthor: "Auteur",
            chunkHeading: "Section",
            chunkPageNumber: 3,
            quote: "Q",
          },
        ],
      }),
    );
    expect(html).toContain("Sources citées");
    expect(html).toContain("Rapport");
    expect(html).toContain("p.&nbsp;3");
  });

  it("falls back to a placeholder when bodyMd is empty", async () => {
    const html = await renderArticleHtml(payload({ bodyMd: "" }));
    expect(html).toContain("Article vide");
  });
});
