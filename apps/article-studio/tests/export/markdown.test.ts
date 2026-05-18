import { describe, expect, it } from "vitest";
import { exportMarkdown } from "@/lib/export/markdown";
import type { ExportPayload } from "@/lib/export/types";

function payload(over: Partial<ExportPayload> = {}): ExportPayload {
  return {
    id: "art-1",
    slug: "mon-article",
    title: "Mon article",
    status: "READY",
    metaTitle: null,
    metaDescription: null,
    bodyMd: "## Intro\n\nUn paragraphe [S1].\n\n## Conclusion\n\nFin [S2].",
    brief: null,
    outline: null,
    citations: [],
    infographics: [],
    createdAt: "2026-05-12T10:00:00.000Z",
    updatedAt: "2026-05-12T11:00:00.000Z",
    ...over,
  };
}

describe("exportMarkdown", () => {
  it("renders YAML frontmatter with title, slug, and timestamps", () => {
    const out = exportMarkdown(payload());
    const text = out.body as string;
    expect(text.startsWith("---\n")).toBe(true);
    expect(text).toContain("title: Mon article");
    expect(text).toContain("slug: mon-article");
    expect(text).toContain("createdAt: 2026-05-12T10:00:00.000Z");
  });

  it("quotes YAML strings that contain colons", () => {
    const out = exportMarkdown(payload({ title: "Titre: avec deux-points" }));
    expect((out.body as string)).toContain('title: "Titre: avec deux-points"');
  });

  it("includes the body and citation footer", () => {
    const out = exportMarkdown(
      payload({
        citations: [
          {
            id: "S1",
            position: 0,
            sourceId: "doc-a",
            sourceTitle: "Rapport AI",
            sourceFilename: "rapport.pdf",
            sourceAuthor: "L. Labs",
            chunkHeading: "Régulation",
            chunkPageNumber: 4,
            quote: "Texte cité.",
          },
        ],
      }),
    );
    const text = out.body as string;
    expect(text).toContain("# Mon article");
    expect(text).toContain("[S1]");
    expect(text).toContain("## Sources citées");
    expect(text).toContain("**[S1]**");
    expect(text).toContain("Rapport AI");
    expect(text).toContain("p. 4");
  });

  it("falls back when body is empty", () => {
    const out = exportMarkdown(payload({ bodyMd: "" }));
    expect((out.body as string)).toContain("*[Article vide");
  });

  it("uses the slug for the filename", () => {
    expect(exportMarkdown(payload()).filename).toBe("mon-article.md");
  });
});
