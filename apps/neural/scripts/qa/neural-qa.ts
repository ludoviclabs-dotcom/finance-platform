import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const PROD_BASE_URL = process.env.QA_PROD_URL ?? "https://neural-five.vercel.app";
const TEXT_EXTENSIONS = new Set([".ts", ".tsx", ".json", ".md", ".css"]);
const IGNORED_DIRS = new Set([
  ".next",
  ".vercel",
  "node_modules",
  "qa-artifacts",
  "test-results",
]);

const CRITICAL_ROUTES = [
  "/",
  "/proof",
  "/simulation",
  "/trust",
  "/agents",
  "/dossier",
  "/forfaits",
  "/secteurs",
  "/secteurs/luxe/finance",
  "/secteurs/luxe/rh",
  "/secteurs/luxe/communication",
  "/secteurs/banque/communication",
  "/secteurs/banque/communication/inbox",
  "/secteurs/assurance/supply-chain",
  "/contact",
];

const PUBLIC_ASSETS = ["/favicon.ico", "/manifest.json", "/icon.png", "/apple-icon.png"];

const PROTECTED_ENDPOINTS = [
  "/api/cron/regulatory-watch",
  "/api/mcp",
  "/api/internal/bank-comms-runs",
  "/api/internal/evidence-guard/resolve",
  "/api/approvals",
];

const BANNED_CLAIMS = [
  /168\s+agents\s+actifs/i,
  /partenaire\s+anthropic/i,
  /roi\s+contractualis[ée]\s+avant\s+toute\s+ligne\s+de\s+code/i,
  /(?:garanti|garantie|promesse|assure)\s+z[ée]ro\s+risque/i,
  /conforme\s+(?:AI Act|DORA|RGPD)/i,
  /aucun\s+transit\s+hors\s+UE/i,
  /DPA\s+disponible/i,
  /opposable\s+juridiquement/i,
  // PR 0 hygiène : "Audit gratuit" contredit l'offre payante "Proof Audit" 1 500–3 500 EUR.
  // Le bon libellé est "Cadrage offert" (échange découverte sans engagement).
  /audit\s+gratuit/i,
];

const BANNED_TYPOS = [
  /\bvôtrès\b/,
  /workbooks\s+crees/i,
  /embarqué\s+un\s+dashboard/i,
  /Pas\s+le\s+périmètre\s+live\b/,
];

const MOJIBAKE_PATTERNS = [
  /\u00C3./u,
  /\u00C2[\u0080-\u00BF]/u,
  /\u00E2\u20AC./u,
  /\u00F0\u0178/u,
  /\uFFFD/u,
  /jusqu'\?/u,
  /Sc[?]nario/u,
  /D[?]cision/u,
  /d[?]mo/iu,
  /persist[?]s/iu,
  /[?]ge/u,
];

function walk(dir: string, out: string[] = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (TEXT_EXTENSIONS.has(full.slice(full.lastIndexOf(".")))) out.push(full);
  }
  return out;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function runCopyCheck() {
  const failures: string[] = [];
  const files = walk(ROOT);
  const selfPath = resolve(__filename);
  for (const file of files) {
    if (resolve(file) === selfPath) continue;
    const text = readFileSync(file, "utf8");
    const rel = relative(ROOT, file);
    for (const pattern of MOJIBAKE_PATTERNS) {
      if (pattern.test(text)) failures.push(`${rel}: mojibake ou caractère invalide (${pattern})`);
    }
    for (const pattern of BANNED_CLAIMS) {
      if (pattern.test(text)) failures.push(`${rel}: claim interdit ou trop fort (${pattern})`);
    }
    for (const pattern of BANNED_TYPOS) {
      if (pattern.test(text)) failures.push(`${rel}: typo bannie (${pattern})`);
    }
    if (/TODO:\s*replace with NextAuth/i.test(text)) {
      failures.push(`${rel}: TODO auth production encore présent`);
    }
  }

  if (failures.length) fail(`qa:copy failed\n${failures.map((f) => `- ${f}`).join("\n")}`);
  console.log(`qa:copy ok — ${files.length} fichiers scannés`);
}

function extractInternalLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const links = new Set<string>();
  for (const match of html.matchAll(/\s(?:href|src)=["']([^"']+)["']/gi)) {
    const raw = match[1];
    if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) {
      continue;
    }
    try {
      const url = new URL(raw, base);
      if (url.origin !== base.origin) continue;
      if (url.pathname.startsWith("/api/")) continue;
      if (url.pathname.startsWith("/_next/")) continue;
      links.add(url.pathname);
    } catch {
      // Route checks below handle real broken pages.
    }
  }
  return [...links];
}

async function fetchWithRetry(url: string): Promise<{ response?: Response; text?: string; error?: string }> {
  let lastFailure = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      const text = await response.text();
      return { response, text };
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
    if (attempt < 3) await new Promise((resolveRetry) => setTimeout(resolveRetry, attempt * 750));
  }
  return { error: lastFailure };
}

async function runSiteCheck(baseUrl: string, options: { security?: boolean } = {}) {
  const failures: string[] = [];
  const routesToCheck = [...CRITICAL_ROUTES];
  const checkedRoutes = new Set<string>();

  const home = await fetchWithRetry(new URL("/", baseUrl).toString());
  if (home.response && home.text && home.response.status >= 200 && home.response.status < 400) {
    for (const link of extractInternalLinks(home.text, baseUrl)) {
      if (routesToCheck.length >= 80) break;
      if (!routesToCheck.includes(link)) routesToCheck.push(link);
    }
  }

  for (const route of routesToCheck) {
    if (checkedRoutes.has(route)) continue;
    checkedRoutes.add(route);
    const result = await fetchWithRetry(new URL(route, baseUrl).toString());
    if (!result.response) {
      failures.push(`${route}: ${result.error ?? "fetch failed"}`);
      continue;
    }
    if (result.response.status < 200 || result.response.status >= 400) {
      failures.push(`${route}: HTTP ${result.response.status}`);
      continue;
    }
    const html = result.text ?? "";
    const contentType = result.response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) continue;
    for (const pattern of MOJIBAKE_PATTERNS) {
      if (pattern.test(html)) failures.push(`${route}: mojibake HTML (${pattern})`);
    }
    if (!/<title>|<h1|<main|<section/i.test(html)) {
      failures.push(`${route}: contenu HTML inattendu`);
    }
  }

  for (const asset of PUBLIC_ASSETS) {
    const result = await fetchWithRetry(new URL(asset, baseUrl).toString());
    if (!result.response) {
      failures.push(`${asset}: ${result.error ?? "fetch failed"}`);
      continue;
    }
    if (result.response.status < 200 || result.response.status >= 400) {
      failures.push(`${asset}: HTTP ${result.response.status}`);
    }
  }

  if (options.security) {
    for (const endpoint of PROTECTED_ENDPOINTS) {
      const result = await fetchWithRetry(new URL(endpoint, baseUrl).toString());
      if (!result.response) {
        failures.push(`${endpoint}: ${result.error ?? "fetch failed"}`);
        continue;
      }
      if (result.response.status !== 401) {
        failures.push(`${endpoint}: attendu HTTP 401 sans token, reçu HTTP ${result.response.status}`);
      }
    }
  }

  if (failures.length) fail(`qa:site failed for ${baseUrl}\n${failures.map((f) => `- ${f}`).join("\n")}`);
  console.log(`qa:site ok — ${checkedRoutes.size} routes sur ${baseUrl}`);
}

function findEdge() {
  const candidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

function runVisualCheck(baseUrl: string) {
  const edge = findEdge();
  if (!edge) {
    console.warn("qa:visual skipped — Microsoft Edge headless introuvable.");
    return;
  }

  const outDir = join(ROOT, "qa-artifacts", "visual");
  mkdirSync(outDir, { recursive: true });
  const viewports = [
    { name: "mobile", size: "390,1000" },
    { name: "desktop", size: "1440,1100" },
  ];
  const routes = ["/", "/proof", "/simulation", "/trust", "/dossier", "/contact"];
  const failures: string[] = [];

  for (const route of routes) {
    for (const viewport of viewports) {
      const name = route === "/" ? "home" : route.slice(1).replace(/\//g, "-");
      const screenshot = join(outDir, `${name}-${viewport.name}.png`);
      const result = spawnSync(
        edge,
        [
          "--headless",
          "--disable-gpu",
          "--disable-gpu-sandbox",
          "--disable-software-rasterizer",
          "--no-sandbox",
          "--force-device-scale-factor=1",
          `--window-size=${viewport.size}`,
          `--screenshot=${screenshot}`,
          new URL(route, baseUrl).toString(),
        ],
        { encoding: "utf8" },
      );
      if (result.status !== 0) failures.push(`${route} ${viewport.name}: ${result.stderr || result.stdout}`);
    }
  }

  if (failures.length) fail(`qa:visual failed\n${failures.map((f) => `- ${f}`).join("\n")}`);
  console.log(`qa:visual ok — screenshots dans ${relative(ROOT, outDir)}`);
}

async function main() {
  const mode = process.argv[2] ?? "copy";
  const baseUrl = process.env.QA_BASE_URL ?? "http://127.0.0.1:3002";
  if (mode === "copy") return runCopyCheck();
  if (mode === "site") return runSiteCheck(baseUrl);
  if (mode === "prod") return runSiteCheck(PROD_BASE_URL, { security: true });
  if (mode === "visual") return runVisualCheck(baseUrl);
  fail(`Mode inconnu: ${mode}`);
}

void main();
