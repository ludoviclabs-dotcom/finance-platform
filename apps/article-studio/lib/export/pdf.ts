/**
 * PDF export — renders the shared HTML template via headless Chromium.
 *
 * Environment-aware browser launcher:
 *   • Production (Vercel) → `puppeteer-core` + `@sparticuz/chromium` so the
 *     binary fits the 50 MB function size budget.
 *   • Local dev → `puppeteer` if installed (ships a full Chromium); falls
 *     back to `puppeteer-core` + system chromium when neither is present.
 *
 * The dynamic imports keep build size lean and avoid Sparticuz binaries
 * leaking into the dev bundle.
 */

import { renderArticleHtml } from "./html";
import type { ExportPayload, ExportResult } from "./types";

export async function exportPdf(payload: ExportPayload): Promise<ExportResult> {
  const html = await renderArticleHtml(payload);
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBytes = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", bottom: "20mm", left: "18mm", right: "18mm" },
    });
    return {
      body: Buffer.from(pdfBytes),
      contentType: "application/pdf",
      filename: `${payload.slug}.pdf`,
    };
  } finally {
    await browser.close();
  }
}

interface LaunchedBrowser {
  newPage: () => Promise<{
    setContent: (html: string, opts: { waitUntil: string }) => Promise<void>;
    pdf: (opts: unknown) => Promise<Uint8Array>;
  }>;
  close: () => Promise<void>;
}

async function launchBrowser(): Promise<LaunchedBrowser> {
  const isProd = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  if (isProd) {
    // Sparticuz packages a Lambda-friendly Chromium binary.
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteer = await import("puppeteer-core");
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
    }) as unknown as Promise<LaunchedBrowser> as never;
  }
  // Local dev — prefer full puppeteer for zero-config.
  try {
    const puppeteer = await import("puppeteer");
    return (await puppeteer.launch({ headless: true })) as unknown as LaunchedBrowser;
  } catch {
    const puppeteer = await import("puppeteer-core");
    return (await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/usr/bin/chromium",
    })) as unknown as LaunchedBrowser;
  }
}
