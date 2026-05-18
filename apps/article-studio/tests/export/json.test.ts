import { describe, expect, it } from "vitest";
import { exportJson } from "@/lib/export/json";
import type { ExportPayload } from "@/lib/export/types";

const minimal: ExportPayload = {
  id: "a1",
  slug: "test-article",
  title: "Test",
  status: "DRAFT",
  metaTitle: null,
  metaDescription: null,
  bodyMd: "",
  brief: null,
  outline: null,
  citations: [],
  infographics: [],
  createdAt: "2026-05-12T10:00:00.000Z",
  updatedAt: "2026-05-12T11:00:00.000Z",
};

describe("exportJson", () => {
  it("returns valid JSON with the export schema marker", () => {
    const out = exportJson(minimal);
    const parsed = JSON.parse(out.body as string);
    expect(parsed.schema).toBe("article-studio.export.v1");
    expect(parsed.id).toBe("a1");
    expect(parsed.title).toBe("Test");
  });

  it("preserves citations and infographics arrays", () => {
    const out = exportJson({
      ...minimal,
      citations: [
        {
          id: "S1",
          position: 0,
          sourceId: "src-1",
          sourceTitle: "X",
          sourceFilename: "x.pdf",
          sourceAuthor: null,
          chunkHeading: null,
          chunkPageNumber: null,
          quote: "Q",
        },
      ],
    });
    const parsed = JSON.parse(out.body as string);
    expect(parsed.citations).toHaveLength(1);
    expect(parsed.citations[0].id).toBe("S1");
  });

  it("uses application/json content type", () => {
    expect(exportJson(minimal).contentType).toMatch(/application\/json/);
  });

  it("pretty-prints with 2-space indent", () => {
    const out = exportJson(minimal);
    expect((out.body as string)).toContain("\n  ");
  });
});
