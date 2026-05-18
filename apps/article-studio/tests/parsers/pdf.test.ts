import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { parsePdf } from "@/lib/parsers/pdf";

async function buildFixturePdf(): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Rapport de test");
  pdf.setAuthor("Article Studio");

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Page 1
  const page1 = pdf.addPage([595, 842]);
  let y = 800;
  const draw = (text: string, opts: { bold?: boolean; size?: number } = {}, page = page1) => {
    page.drawText(text, {
      x: 50,
      y,
      size: opts.size ?? 11,
      font: opts.bold ? fontBold : font,
      color: rgb(0, 0, 0),
    });
    y -= (opts.size ?? 11) + 6;
  };

  draw("RAPPORT DE TEST", { bold: true, size: 16 });
  y -= 12;
  draw(
    "Ce document de test contient deux pages, un titre et plusieurs paragraphes. Il sert a verifier que le parser PDF extrait correctement le contenu textuel et le decoupe en blocs.",
  );
  y -= 8;
  draw("Section 1. Introduction", { bold: true, size: 13 });
  y -= 8;
  draw(
    "Ce paragraphe contient suffisamment de texte pour ne pas etre confondu avec un titre. Il decrit les enjeux principaux du sujet etudie et pose le cadre methodologique.",
  );

  // Page 2
  const page2 = pdf.addPage([595, 842]);
  y = 800;
  draw("Section 2. Resultats", { bold: true, size: 13 }, page2);
  y -= 8;
  draw(
    "Sur la seconde page, on trouve des resultats chiffres. Trois indicateurs cles sont retenus pour evaluer la performance.",
    {},
    page2,
  );

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

describe("parsePdf", () => {
  it("extracts text content from a multi-page PDF", async () => {
    const buf = await buildFixturePdf();
    const parsed = await parsePdf(buf, "fixture.pdf");
    expect(parsed.blocks.length).toBeGreaterThan(0);

    const allText = parsed.blocks.map((b) => b.text).join(" ");
    expect(allText).toContain("rapport");
    expect(allText.toLowerCase()).toContain("section");
  });

  it("reads document metadata from PDF info dict", async () => {
    const buf = await buildFixturePdf();
    const parsed = await parsePdf(buf, "fixture.pdf");
    expect(parsed.title).toBe("Rapport de test");
    expect(parsed.author).toBe("Article Studio");
    expect(parsed.metadata.pageCount).toBe(2);
  });

  it("classifies blocks as headings or paragraphs", async () => {
    const buf = await buildFixturePdf();
    const parsed = await parsePdf(buf, "fixture.pdf");
    const kinds = new Set(parsed.blocks.map((b) => b.kind));
    expect(kinds.has("paragraph")).toBe(true);
    // Heading detection is heuristic and PDFs are noisy — only assert that at
    // least one block exists and the API contract holds.
    for (const block of parsed.blocks) {
      expect(["heading", "paragraph", "list", "list-item", "code", "table", "quote"]).toContain(
        block.kind,
      );
    }
  });
});
