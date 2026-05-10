import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = resolve(__dirname, "../..");
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
  "/trust",
  "/agents",
  "/dossier",
  "/secteurs/luxe/finance",
  "/secteurs/luxe/communication",
  "/secteurs/banque/communication",
  "/secteurs/assurance/supply-chain",
  "/contact",
];

const BANNED_CLAIMS = [
  /168\s+agents\s+actifs/i,
  /partenaire\s+anthropic/i,
  /roi\s+contractualis[ée]\s+avant\s+toute\s+ligne\s+de\s+code/i,
  /(?:garanti|garantie|promesse|assure)\s+z[ée]ro\s+risque/i,
  /conforme\s+(?:AI Act|DORA|RGPD)/i,
  /aucun\s+transit\s+hors\s+UE/i,
];

const MOJIBAKE_PATTERNS = [
  /\u00C3./u,
  /\u00C2[\u0080-\u00BF]/u,
  /\u00E2\u20AC./u,
  /\u00F0\u0178/u,
  /\uFFFD/u,
  /jusqu'\?/u,
  new RegExp("Sc[?]nario", "u"),
  new RegExp("D[?]cision", "u"),
  new RegExp("[?]ge", "u"),
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
  for (const file of walk(ROOT)) {
    const text = readFileSync(file, "utf8");
    const rel = relative(ROOT, file);
    for (const pattern of MOJIBAKE_PATTERNS) {
      if (pattern.test(text)) failures.push(`${rel}: mojibake ou caractère invalide (${pattern})`);
    }
    for (const pattern of BANNED_CLAIMS) {
      if (pattern.test(text)) failures.push(`${rel}: claim interdit ou trop fort (${pattern})`);
    }
    if (/TODO:\s*replace with NextAuth/i.test(text)) {
      failures.push(`${rel}: TODO auth production encore présent`);
    }
  }

  if (failures.length) fail(`qa:copy failed\n${failures.map((f) => `- ${f}`).join("\n")}`);
  console.log(`qa:copy ok — ${walk(ROOT).length} fichiers scannés`);
}

async function runSiteCheck(baseUrl: string) {
  const failures: string[] = [];
  for (const route of CRITICAL_ROUTES) {
    const url = new URL(route, baseUrl).toString();
    let lastFailure = "";
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(url, { redirect: "manual" });
        const html = await response.text();
        if (response.status >= 200 && response.status < 400) {
          lastFailure = "";
          for (const pattern of MOJIBAKE_PATTERNS) {
            if (pattern.test(html)) failures.push(`${route}: mojibake HTML (${pattern})`);
          }
          if (!/<title>|<h1|<main|<section/i.test(html)) {
            failures.push(`${route}: contenu HTML inattendu`);
          }
          break;
        }
        lastFailure = `HTTP ${response.status}`;
      } catch (error) {
        lastFailure = error instanceof Error ? error.message : String(error);
      }
      if (attempt < 3) await new Promise((resolveRetry) => setTimeout(resolveRetry, attempt * 750));
    }
    if (lastFailure) failures.push(`${route}: ${lastFailure}`);
  }

  if (failures.length) fail(`qa:site failed for ${baseUrl}\n${failures.map((f) => `- ${f}`).join("\n")}`);
  console.log(`qa:site ok — ${CRITICAL_ROUTES.length} routes sur ${baseUrl}`);
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
  const routes = ["/", "/proof", "/trust", "/dossier"];
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
  if (mode === "prod") return runSiteCheck("https://neural-five.vercel.app");
  if (mode === "visual") return runVisualCheck(baseUrl);
  fail(`Mode inconnu: ${mode}`);
}

void main();
