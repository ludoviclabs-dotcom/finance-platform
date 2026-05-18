/**
 * DOCX export — Word-compatible OOXML built with the `docx` package.
 *
 * Mapping:
 *   markdown heading → Heading{1..3} style
 *   paragraph        → Paragraph with TextRuns; [Sn] tokens are styled
 *                       inline (color + size) so reviewers can spot them
 *   list item        → bulleted Paragraph
 *   code fence       → preserved as a monospace paragraph (no syntax hl)
 *   table            → emitted as a DOCX Table when found in the markdown
 *
 * The mapper is intentionally simple — full markdown fidelity isn't the
 * goal; the goal is a Word document a reviewer can mark up without
 * rendering breakage.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from "docx";

import type { ExportPayload, ExportResult } from "./types";

export async function exportDocx(payload: ExportPayload): Promise<ExportResult> {
  const children: Array<Paragraph | Table> = [];

  children.push(
    new Paragraph({
      text: payload.title,
      heading: HeadingLevel.TITLE,
    }),
  );

  if (payload.metaDescription) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: payload.metaDescription, italics: true })],
        spacing: { after: 200 },
      }),
    );
  }

  for (const block of splitBlocks(payload.bodyMd ?? "")) {
    const rendered = renderBlock(block);
    if (rendered) children.push(rendered);
  }

  if (payload.citations.length > 0) {
    children.push(
      new Paragraph({
        text: "Sources citées",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      }),
    );
    for (const c of payload.citations) {
      const ref = [
        c.sourceTitle || c.sourceFilename,
        c.sourceAuthor,
        c.chunkPageNumber ? `p. ${c.chunkPageNumber}` : null,
        c.chunkHeading ? `« ${c.chunkHeading} »` : null,
      ]
        .filter(Boolean)
        .join(" — ");
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `[${c.id}] `, bold: true, color: "2563EB" }),
            new TextRun({ text: ref }),
          ],
        }),
      );
    }
  }

  const doc = new Document({
    creator: "Article Studio",
    title: payload.title,
    description: payload.metaDescription ?? undefined,
    sections: [{ children }],
  });

  const buffer = await Packer.toBuffer(doc);
  return {
    body: Buffer.from(buffer),
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    filename: `${payload.slug}.docx`,
  };
}

interface MdBlock {
  kind: "heading" | "paragraph" | "list-item" | "code" | "quote" | "table";
  text: string;
  level?: number;
}

function splitBlocks(md: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  const lines = md.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    // Fenced code block
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // closing fence
      blocks.push({ kind: "code", text: codeLines.join("\n") });
      continue;
    }
    // Markdown table — at least one row + separator
    if (line.startsWith("|") && lines[i + 1]?.match(/^\|[\s\-:|]+\|$/)) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      blocks.push({ kind: "table", text: tableLines.join("\n") });
      continue;
    }
    // Heading
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push({
        kind: "heading",
        text: heading[2].trim(),
        level: heading[1].length,
      });
      i++;
      continue;
    }
    // List item
    if (line.match(/^\s*[-*+]\s+/) || line.match(/^\s*\d+\.\s+/)) {
      blocks.push({ kind: "list-item", text: line.replace(/^\s*([-*+]|\d+\.)\s+/, "") });
      i++;
      continue;
    }
    // Quote
    if (line.startsWith("> ")) {
      blocks.push({ kind: "quote", text: line.slice(2) });
      i++;
      continue;
    }
    // Multi-line paragraph (join until blank line)
    const paraLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith("```") &&
      !lines[i].match(/^\s*([-*+]|\d+\.)\s+/) &&
      !lines[i].startsWith("> ") &&
      !lines[i].startsWith("|")
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ kind: "paragraph", text: paraLines.join(" ") });
  }
  return blocks;
}

function renderBlock(block: MdBlock): Paragraph | Table | null {
  switch (block.kind) {
    case "heading": {
      const level = Math.min(Math.max(block.level ?? 2, 1), 3);
      const headingMap = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
      };
      return new Paragraph({
        text: block.text,
        heading: headingMap[level as 1 | 2 | 3],
        spacing: { before: 320, after: 160 },
      });
    }
    case "paragraph":
      return new Paragraph({
        children: buildRuns(block.text),
        alignment: AlignmentType.JUSTIFIED,
      });
    case "list-item":
      return new Paragraph({
        children: buildRuns(block.text),
        bullet: { level: 0 },
      });
    case "quote":
      return new Paragraph({
        children: [new TextRun({ text: block.text, italics: true })],
        indent: { left: 360 },
      });
    case "code":
      return new Paragraph({
        children: [new TextRun({ text: block.text, font: "Consolas", size: 20 })],
        spacing: { before: 120, after: 120 },
      });
    case "table":
      return renderTable(block.text);
    default:
      return null;
  }
}

function buildRuns(text: string): TextRun[] {
  // Highlight [Sn] tokens inline; everything else is a plain run.
  const runs: TextRun[] = [];
  const tokenRe = /\[S\d+\]/g;
  let cursor = 0;
  for (const match of text.matchAll(tokenRe)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      runs.push(new TextRun({ text: text.slice(cursor, start) }));
    }
    runs.push(
      new TextRun({ text: match[0], color: "2563EB", size: 18 }),
    );
    cursor = start + match[0].length;
  }
  if (cursor < text.length) {
    runs.push(new TextRun({ text: text.slice(cursor) }));
  }
  return runs.length > 0 ? runs : [new TextRun({ text })];
}

function renderTable(text: string): Table {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|"))
    .filter((l) => !l.match(/^\|[\s\-:|]+\|$/)); // drop separator row

  const cellRows = rows.map((row) =>
    row
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim()),
  );

  const cols = Math.max(0, ...cellRows.map((r) => r.length));
  const tableRows = cellRows.map(
    (cells, rowIndex) =>
      new TableRow({
        children: Array.from({ length: cols }, (_, ci) =>
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: cells[ci] ?? "",
                    bold: rowIndex === 0,
                  }),
                ],
              }),
            ],
          }),
        ),
      }),
  );

  return new Table({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}
