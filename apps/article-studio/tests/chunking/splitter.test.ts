import { describe, expect, it } from "vitest";
import { splitBlocks } from "@/lib/chunking/splitter";
import { countTokens } from "@/lib/chunking/tokens";
import type { Block } from "@/lib/types/source";

/** Build a paragraph of approximately N tokens (using French filler). */
function paragraph(approxTokens: number): string {
  const filler =
    "L'intelligence artificielle modifie en profondeur les méthodes de travail des équipes éditoriales. ";
  let text = "";
  while (countTokens(text) < approxTokens) text += filler;
  return text.trim();
}

describe("splitBlocks", () => {
  it("returns a single chunk for short input", () => {
    const blocks: Block[] = [
      { kind: "heading", text: "Titre", level: 1 },
      { kind: "paragraph", text: "Un seul paragraphe court." },
    ];
    const chunks = splitBlocks(blocks);
    expect(chunks.length).toBe(1);
    expect(chunks[0].orderIndex).toBe(0);
    expect(chunks[0].content).toContain("Titre");
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
  });

  it("respects max token budget on long input", () => {
    const blocks: Block[] = [];
    for (let i = 0; i < 6; i++) {
      blocks.push({ kind: "paragraph", text: paragraph(200) });
    }
    const chunks = splitBlocks(blocks, { minTokens: 500, maxTokens: 800 });
    expect(chunks.length).toBeGreaterThan(1);
    // Allow small overshoot per chunk (overlap + atomic blocks) but stay reasonable.
    for (const c of chunks) {
      expect(c.tokenCount).toBeLessThanOrEqual(1200);
    }
  });

  it("produces overlap between consecutive chunks", () => {
    const blocks: Block[] = [];
    for (let i = 0; i < 6; i++) {
      blocks.push({ kind: "paragraph", text: paragraph(200) });
    }
    const chunks = splitBlocks(blocks, {
      minTokens: 400,
      maxTokens: 700,
      overlapRatio: 0.2,
    });
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // The start of chunk N+1 should share at least one sentence with the end of chunk N.
    for (let i = 1; i < chunks.length; i++) {
      const prevTail = chunks[i - 1].content.slice(-80);
      const currHead = chunks[i].content.slice(0, 200);
      const sharedFragment = prevTail.split(/\s+/).slice(-3).join(" ");
      expect(currHead.includes(sharedFragment.slice(0, 20))).toBe(true);
    }
  });

  it("carries the latest H1/H2 as chunk heading", () => {
    const blocks: Block[] = [
      { kind: "heading", text: "Première partie", level: 1 },
      { kind: "paragraph", text: paragraph(300) },
      { kind: "heading", text: "Deuxième partie", level: 2 },
      { kind: "paragraph", text: paragraph(300) },
    ];
    const chunks = splitBlocks(blocks, { minTokens: 200, maxTokens: 500 });
    const headings = chunks.map((c) => c.heading);
    expect(headings).toContain("Première partie");
    expect(headings.some((h) => h === "Deuxième partie")).toBe(true);
  });

  it("emits orderIndex monotonically from 0", () => {
    const blocks: Block[] = [];
    for (let i = 0; i < 4; i++) {
      blocks.push({ kind: "paragraph", text: paragraph(250) });
    }
    const chunks = splitBlocks(blocks, { minTokens: 300, maxTokens: 500 });
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c, i) => expect(c.orderIndex).toBe(i));
  });

  it("preserves page numbers when blocks carry them", () => {
    const blocks: Block[] = [
      { kind: "paragraph", text: paragraph(100), page: 1 },
      { kind: "paragraph", text: paragraph(100), page: 1 },
      { kind: "paragraph", text: paragraph(100), page: 2 },
    ];
    const chunks = splitBlocks(blocks, { minTokens: 100, maxTokens: 250 });
    const pages = chunks.map((c) => c.pageNumber);
    expect(pages.some((p) => p === 1)).toBe(true);
  });

  it("handles empty input gracefully", () => {
    expect(splitBlocks([])).toEqual([]);
  });
});
