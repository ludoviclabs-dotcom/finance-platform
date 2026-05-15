import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { shortHash, verifyUrl, type SignedReceipt } from "./sign";

export interface PdfSection {
  heading: string;
  /** Optional intro paragraph rendered before the items. */
  intro?: string;
  /** Bullet list — rendered as "• {text}" lines. */
  bullets?: string[];
  /** Key/value rows — rendered as "Key — Value" lines aligned. */
  rows?: Array<{ key: string; value: string }>;
}

export interface PdfBuildInput<T> {
  receipt: SignedReceipt<T>;
  title: string;
  /** Sub-title rendered under the title (e.g. headline result). */
  resultHeadline: string;
  /** Optional result lead paragraph rendered before the sections. */
  resultLead?: string;
  sections: PdfSection[];
  /** Optional disclaimer rendered at the very bottom of the last content page. */
  disclaimer?: string;
}

const PAGE = { width: 595.28, height: 841.89 } as const; // A4 in pt
const MARGIN = { top: 56, right: 56, bottom: 64, left: 56 } as const;
const COLORS = {
  violet: rgb(0.49, 0.34, 0.92),
  emerald: rgb(0.13, 0.65, 0.45),
  ink: rgb(0.11, 0.12, 0.18),
  muted: rgb(0.42, 0.43, 0.5),
  rule: rgb(0.85, 0.85, 0.88),
} as const;

/**
 * Build a NEURAL-branded signed PDF receipt for a free tool result.
 * Returns the raw PDF bytes — caller decides how to serve them.
 */
export async function buildOutilsPdf<T>(
  input: PdfBuildInput<T>,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${input.title} — NEURAL`);
  doc.setAuthor("NEURAL AI Consulting");
  doc.setSubject(input.receipt.toolLabel);
  doc.setProducer("NEURAL pdf-lib pipeline");
  doc.setCreator("NEURAL pdf-lib pipeline");
  doc.setCreationDate(new Date(input.receipt.generatedAt));

  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const ctx: RenderContext = {
    doc,
    fontRegular,
    fontBold,
    page: doc.addPage([PAGE.width, PAGE.height]),
    y: PAGE.height - MARGIN.top,
    pageNumber: 1,
  };

  drawHeader(ctx, input.title);
  drawResultHeadline(ctx, input.receipt.toolLabel, input.resultHeadline, input.resultLead);

  for (const section of input.sections) {
    drawSection(ctx, section);
  }

  if (input.disclaimer) {
    drawDisclaimer(ctx, input.disclaimer);
  }

  // Footer with signed receipt info is drawn on every page once all content is laid out.
  drawFootersOnAllPages(ctx, input.receipt);

  return doc.save();
}

interface RenderContext {
  doc: PDFDocument;
  fontRegular: PDFFont;
  fontBold: PDFFont;
  page: PDFPage;
  y: number;
  pageNumber: number;
}

function ensureSpace(ctx: RenderContext, needed: number): void {
  if (ctx.y - needed < MARGIN.bottom) {
    ctx.page = ctx.doc.addPage([PAGE.width, PAGE.height]);
    ctx.y = PAGE.height - MARGIN.top;
    ctx.pageNumber += 1;
  }
}

function drawHeader(ctx: RenderContext, title: string): void {
  ctx.page.drawText("NEURAL", {
    x: MARGIN.left,
    y: ctx.y,
    size: 16,
    font: ctx.fontBold,
    color: COLORS.violet,
  });
  ctx.page.drawText("AI Consulting · Trust-first", {
    x: MARGIN.left + 60,
    y: ctx.y + 3,
    size: 8,
    font: ctx.fontRegular,
    color: COLORS.muted,
  });
  ctx.y -= 30;

  ctx.page.drawText(title, {
    x: MARGIN.left,
    y: ctx.y,
    size: 22,
    font: ctx.fontBold,
    color: COLORS.ink,
  });
  ctx.y -= 18;

  ctx.page.drawLine({
    start: { x: MARGIN.left, y: ctx.y },
    end: { x: PAGE.width - MARGIN.right, y: ctx.y },
    thickness: 0.6,
    color: COLORS.rule,
  });
  ctx.y -= 22;
}

function drawResultHeadline(
  ctx: RenderContext,
  toolLabel: string,
  headline: string,
  lead?: string,
): void {
  ctx.page.drawText(toolLabel.toUpperCase(), {
    x: MARGIN.left,
    y: ctx.y,
    size: 8,
    font: ctx.fontBold,
    color: COLORS.violet,
  });
  ctx.y -= 14;

  for (const line of wrapText(headline, ctx.fontBold, 18, contentWidth())) {
    ensureSpace(ctx, 22);
    ctx.page.drawText(line, {
      x: MARGIN.left,
      y: ctx.y,
      size: 18,
      font: ctx.fontBold,
      color: COLORS.ink,
    });
    ctx.y -= 22;
  }

  if (lead) {
    ctx.y -= 4;
    for (const line of wrapText(lead, ctx.fontRegular, 10.5, contentWidth())) {
      ensureSpace(ctx, 14);
      ctx.page.drawText(line, {
        x: MARGIN.left,
        y: ctx.y,
        size: 10.5,
        font: ctx.fontRegular,
        color: COLORS.muted,
      });
      ctx.y -= 14;
    }
  }
  ctx.y -= 12;
}

function drawSection(ctx: RenderContext, section: PdfSection): void {
  ensureSpace(ctx, 36);
  ctx.page.drawText(section.heading.toUpperCase(), {
    x: MARGIN.left,
    y: ctx.y,
    size: 9,
    font: ctx.fontBold,
    color: COLORS.emerald,
  });
  ctx.y -= 8;
  ctx.page.drawLine({
    start: { x: MARGIN.left, y: ctx.y },
    end: { x: MARGIN.left + 40, y: ctx.y },
    thickness: 1.2,
    color: COLORS.emerald,
  });
  ctx.y -= 14;

  if (section.intro) {
    for (const line of wrapText(section.intro, ctx.fontRegular, 10, contentWidth())) {
      ensureSpace(ctx, 14);
      ctx.page.drawText(line, {
        x: MARGIN.left,
        y: ctx.y,
        size: 10,
        font: ctx.fontRegular,
        color: COLORS.ink,
      });
      ctx.y -= 13;
    }
    ctx.y -= 4;
  }

  if (section.bullets?.length) {
    for (const bullet of section.bullets) {
      const lines = wrapText(bullet, ctx.fontRegular, 10, contentWidth() - 12);
      for (let i = 0; i < lines.length; i += 1) {
        ensureSpace(ctx, 14);
        if (i === 0) {
          ctx.page.drawText("•", {
            x: MARGIN.left,
            y: ctx.y,
            size: 10,
            font: ctx.fontBold,
            color: COLORS.violet,
          });
        }
        ctx.page.drawText(lines[i], {
          x: MARGIN.left + 12,
          y: ctx.y,
          size: 10,
          font: ctx.fontRegular,
          color: COLORS.ink,
        });
        ctx.y -= 13;
      }
      ctx.y -= 2;
    }
  }

  if (section.rows?.length) {
    const keyWidth = 180;
    for (const row of section.rows) {
      const valueLines = wrapText(row.value, ctx.fontRegular, 10, contentWidth() - keyWidth - 8);
      const blockHeight = Math.max(13, valueLines.length * 13);
      ensureSpace(ctx, blockHeight + 2);
      ctx.page.drawText(row.key, {
        x: MARGIN.left,
        y: ctx.y,
        size: 10,
        font: ctx.fontBold,
        color: COLORS.muted,
      });
      for (let i = 0; i < valueLines.length; i += 1) {
        ctx.page.drawText(valueLines[i], {
          x: MARGIN.left + keyWidth,
          y: ctx.y - i * 13,
          size: 10,
          font: ctx.fontRegular,
          color: COLORS.ink,
        });
      }
      ctx.y -= blockHeight + 2;
    }
  }

  ctx.y -= 10;
}

function drawDisclaimer(ctx: RenderContext, text: string): void {
  ensureSpace(ctx, 40);
  ctx.y -= 6;
  ctx.page.drawLine({
    start: { x: MARGIN.left, y: ctx.y },
    end: { x: PAGE.width - MARGIN.right, y: ctx.y },
    thickness: 0.4,
    color: COLORS.rule,
  });
  ctx.y -= 12;
  for (const line of wrapText(text, ctx.fontRegular, 8.5, contentWidth())) {
    ensureSpace(ctx, 12);
    ctx.page.drawText(line, {
      x: MARGIN.left,
      y: ctx.y,
      size: 8.5,
      font: ctx.fontRegular,
      color: COLORS.muted,
    });
    ctx.y -= 11;
  }
}

function drawFootersOnAllPages(ctx: RenderContext, receipt: SignedReceipt<unknown>): void {
  const pages = ctx.doc.getPages();
  const generatedLabel = formatTimestamp(receipt.generatedAt);
  const verify = verifyUrl(receipt.hash);
  const left = `${receipt.toolLabel} · ${generatedLabel}`;
  const middle = `Hash · ${shortHash(receipt.hash)}`;
  const right = verify;

  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i];
    const y = MARGIN.bottom - 28;
    page.drawLine({
      start: { x: MARGIN.left, y: y + 18 },
      end: { x: PAGE.width - MARGIN.right, y: y + 18 },
      thickness: 0.4,
      color: COLORS.rule,
    });
    page.drawText(left, {
      x: MARGIN.left,
      y: y + 6,
      size: 7.5,
      font: ctx.fontRegular,
      color: COLORS.muted,
    });
    const middleWidth = ctx.fontRegular.widthOfTextAtSize(middle, 7.5);
    page.drawText(middle, {
      x: (PAGE.width - middleWidth) / 2,
      y: y + 6,
      size: 7.5,
      font: ctx.fontRegular,
      color: COLORS.muted,
    });
    const rightWidth = ctx.fontRegular.widthOfTextAtSize(right, 7.5);
    page.drawText(right, {
      x: PAGE.width - MARGIN.right - rightWidth,
      y: y + 6,
      size: 7.5,
      font: ctx.fontRegular,
      color: COLORS.violet,
    });
    page.drawText(`Page ${i + 1} / ${pages.length}`, {
      x: MARGIN.left,
      y: y - 6,
      size: 6.5,
      font: ctx.fontRegular,
      color: COLORS.muted,
    });
  }
}

function contentWidth(): number {
  return PAGE.width - MARGIN.left - MARGIN.right;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (!text) return [];
  const normalized = text.replace(/\s+/g, " ").trim();
  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      // Hard-break very long single tokens that exceed maxWidth on their own.
      if (font.widthOfTextAtSize(word, size) > maxWidth) {
        let chunk = "";
        for (const char of word) {
          if (font.widthOfTextAtSize(chunk + char, size) > maxWidth) {
            lines.push(chunk);
            chunk = char;
          } else {
            chunk += char;
          }
        }
        current = chunk;
      } else {
        current = word;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const date = d.toISOString().slice(0, 10);
  const time = d.toISOString().slice(11, 16);
  return `${date} ${time} UTC`;
}
