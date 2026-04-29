import { chromium } from "playwright";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(__dirname, "neural-corporate-2026.html");
const pdfPath = resolve(__dirname, "neural-corporate-2026.pdf");

// Serve via local HTTP so fonts/assets load correctly
const html = readFileSync(htmlPath, "utf-8");

const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });

// Wait for fonts to settle
await page.waitForTimeout(1500);

await page.pdf({
  path: pdfPath,
  format: "A4",
  printBackground: true,
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
});

await browser.close();
server.close();

console.log("PDF generated:", pdfPath);
