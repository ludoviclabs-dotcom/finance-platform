import { describe, expect, it } from "vitest";
import { checkGrounding } from "@/lib/rag/grounding-guard";

describe("checkGrounding", () => {
  it("returns 1.0 when every paragraph cites a source", () => {
    const md = [
      "## Intro",
      "Paragraphe un avec citation [S1].",
      "Paragraphe deux qui mentionne [S2] et [S3].",
    ].join("\n\n");
    const result = checkGrounding(md);
    expect(result.score).toBe(1);
    expect(result.paragraphCount).toBe(2);
    expect(result.citedCount).toBe(2);
    expect(result.citedSources).toEqual(["S1", "S2", "S3"]);
    expect(result.unsupportedParagraphs).toEqual([]);
  });

  it("counts INFO MANQUANTE markers as covered", () => {
    const md = "Phrase sans source [INFO MANQUANTE: chiffre exact].";
    const result = checkGrounding(md);
    expect(result.score).toBe(1);
    expect(result.missingMarkers).toBe(1);
    expect(result.citedCount).toBe(1);
  });

  it("flags paragraphs without citations as unsupported", () => {
    const md = [
      "Premier paragraphe non sourcé.",
      "Deuxième paragraphe avec [S1].",
      "Troisième sans rien.",
    ].join("\n\n");
    const result = checkGrounding(md);
    expect(result.paragraphCount).toBe(3);
    expect(result.citedCount).toBe(1);
    expect(result.score).toBeCloseTo(1 / 3, 5);
    expect(result.unsupportedParagraphs).toHaveLength(2);
  });

  it("ignores headings, code fences, and empty blocks", () => {
    const md = [
      "# Titre",
      "## Sous-titre",
      "```ts\nconst x = 1;\n```",
      "Paragraphe cité [S1].",
    ].join("\n\n");
    const result = checkGrounding(md);
    expect(result.paragraphCount).toBe(1);
    expect(result.score).toBe(1);
  });

  it("returns zero for empty input", () => {
    const result = checkGrounding("");
    expect(result.score).toBe(0);
    expect(result.paragraphCount).toBe(0);
  });

  it("deduplicates cited source ids", () => {
    const md = "Premier [S1] et de nouveau [S1].\n\nSecond [S2] [S2] [S1].";
    const result = checkGrounding(md);
    expect(result.citedSources).toEqual(["S1", "S2"]);
  });
});
