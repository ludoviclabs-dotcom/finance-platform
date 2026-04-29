import { chromium } from "playwright";
import { readFileSync, readdirSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname, join, basename } from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const SECTORS = ["banque", "luxe", "assurance", "saas", "transport", "aeronautique"];

const html = (path) => readFileSync(path, "utf-8");

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".js": "application/javascript; charset=utf-8" };

const server = createServer((req, res) => {
  const url = req.url.split("?")[0];
  const filePath = resolve(ROOT, url.slice(1));
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  const ext = "." + filePath.split(".").pop().toLowerCase();
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  res.end(readFileSync(filePath));
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;

const browser = await chromium.launch();

async function render({ url, width, height, output }) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  mkdirSync(dirname(output), { recursive: true });
  await page.screenshot({ path: output, type: "png", omitBackground: false, clip: { x: 0, y: 0, width, height } });
  await page.close();
}

// Covers (1584×396)
for (const sector of SECTORS) {
  const url = `http://127.0.0.1:${port}/covers/${sector}.html`;
  const output = resolve(ROOT, "covers", `${sector}.png`);
  console.log("Rendering cover:", sector);
  await render({ url, width: 1584, height: 396, output });
}

// Stories (1080×1920)
for (const sector of SECTORS) {
  const url = `http://127.0.0.1:${port}/stories/${sector}.html`;
  const output = resolve(ROOT, "stories", `${sector}.png`);
  console.log("Rendering story:", sector);
  await render({ url, width: 1080, height: 1920, output });
}

// Carousels (1080×1080) — 6 slides per sector, file: carousels/<sector>.html with anchors #s1..#s6
for (const sector of SECTORS) {
  for (let i = 1; i <= 6; i++) {
    const url = `http://127.0.0.1:${port}/carousels/${sector}.html?slide=${i}`;
    const output = resolve(ROOT, "carousels", sector, `slide-${i}.png`);
    console.log("Rendering carousel:", sector, "slide", i);
    await render({ url, width: 1080, height: 1080, output });
  }
}

await browser.close();
server.close();
console.log("Done.");
