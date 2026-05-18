import { describe, expect, it } from "vitest";
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { parseDocx } from "@/lib/parsers/docx";

async function buildFixtureDocx(): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun("Introduction")],
          }),
          new Paragraph({
            children: [
              new TextRun(
                "Ce document est un fixture de test pour le parser DOCX. Il vérifie que mammoth gère correctement les titres et les paragraphes.",
              ),
            ],
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun("Section deux")],
          }),
          new Paragraph({
            children: [new TextRun("Premier élément de la section deux.")],
          }),
          new Paragraph({
            children: [new TextRun("Second paragraphe avec plus de contenu.")],
          }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

describe("parseDocx", () => {
  it("extracts headings with correct levels", async () => {
    const buf = await buildFixtureDocx();
    const parsed = await parseDocx(buf, "fixture.docx");
    const headings = parsed.blocks.filter((b) => b.kind === "heading");
    expect(headings.length).toBeGreaterThanOrEqual(2);
    expect(headings[0].level).toBe(1);
    expect(headings[0].text).toBe("Introduction");
    expect(headings[1].level).toBe(2);
    expect(headings[1].text).toBe("Section deux");
  });

  it("preserves paragraph order around headings", async () => {
    const buf = await buildFixtureDocx();
    const parsed = await parseDocx(buf, "fixture.docx");
    const sequence = parsed.blocks.map((b) => b.kind);
    expect(sequence[0]).toBe("heading");
    expect(sequence[1]).toBe("paragraph");
    expect(sequence.indexOf("heading", 1)).toBeGreaterThan(1);
  });

  it("annotates mime type for downstream dedup/dispatch", async () => {
    const buf = await buildFixtureDocx();
    const parsed = await parseDocx(buf, "fixture.docx");
    expect(parsed.mimeType).toContain("wordprocessingml.document");
  });
});
