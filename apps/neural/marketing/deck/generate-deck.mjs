import { chromium } from "playwright";
import { readFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DECK_HTML = resolve(__dirname, "neural-pitch-deck-2026.html");
const PDF_OUT = resolve(__dirname, "neural-pitch-deck-2026.pdf");
const SLIDES_DIR = resolve(__dirname, "slides");

const MIME = { ".html": "text/html; charset=utf-8" };

const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(readFileSync(DECK_HTML));
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const url = `http://127.0.0.1:${port}/`;

const browser = await chromium.launch();

// 1) PDF (16:9, 1920×1080 each slide)
{
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.pdf({
    path: PDF_OUT,
    width: "1920px",
    height: "1080px",
    printBackground: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
    preferCSSPageSize: false,
  });
  await page.close();
  console.log("PDF generated:", PDF_OUT);
}

// 2) Per-slide PNG screenshots (for sharing individual slides)
mkdirSync(SLIDES_DIR, { recursive: true });
{
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  const slideCount = await page.$$eval(".slide", (els) => els.length);
  console.log(`Found ${slideCount} slides`);

  for (let i = 0; i < slideCount; i++) {
    const handle = (await page.$$(".slide"))[i];
    const num = String(i + 1).padStart(2, "0");
    const out = resolve(SLIDES_DIR, `slide-${num}.png`);
    await handle.screenshot({ path: out, type: "png" });
    console.log("Slide PNG:", out);
  }
  await page.close();
}

await browser.close();
server.close();
console.log("Done.");
