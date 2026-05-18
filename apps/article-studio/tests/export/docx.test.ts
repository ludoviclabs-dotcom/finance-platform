import { describe, expect, it } from "vitest";
import { exportDocx } from "@/lib/export/docx";
import type { ExportPayload } from "@/lib/export/types";

const payload: ExportPayload = {
  id: "a1",
  slug: "test-doc",
  title: "Test DOCX",
  status: "READY",
  metaTitle: null,
  metaDescription: "Description courte.",
  bodyMd: [
    "## Intro",
    "Un paragraphe cité [S1] avec du texte.",
    "## Données",
    "| A | B |",
    "|---|---|",
    "| 1 | 2 |",
    "## Liste",
    "- Premier élément",
    "- Deuxième élément",
  ].join("\n\n"),
  brief: null,
  outline: null,
  citations: [
    {
      id: "S1",
      position: 0,
      sourceId: "src-1",
      sourceTitle: "Source",
      sourceFilename: "src.pdf",
      sourceAuthor: "Auteur",
      chunkHeading: "H1",
      chunkPageNumber: 7,
      quote: "Q",
    },
  ],
  infographics: [],
  createdAt: "2026-05-12T10:00:00.000Z",
  updatedAt: "2026-05-12T11:00:00.000Z",
};

describe("exportDocx", () => {
  it("produces a valid DOCX (zip-based OOXML)", async () => {
    const result = await exportDocx(payload);
    const buf = result.body as Buffer;
    expect(Buffer.isBuffer(buf)).toBe(true);
    // DOCX is a ZIP — first bytes "PK"
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    expect(buf.length).toBeGreaterThan(2000);
    expect(result.contentType).toContain("wordprocessingml.document");
    expect(result.filename).toBe("test-doc.docx");
  });

  it("survives empty body without throwing", async () => {
    const result = await exportDocx({ ...payload, bodyMd: "" });
    expect((result.body as Buffer).length).toBeGreaterThan(1500);
  });

  it("survives no citations", async () => {
    const result = await exportDocx({ ...payload, citations: [] });
    expect((result.body as Buffer).length).toBeGreaterThan(1500);
  });
});
