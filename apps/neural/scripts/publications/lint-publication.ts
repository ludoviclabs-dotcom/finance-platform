/**
 * NEURAL — Linter editorial des publications.
 *
 * Usage :
 *   pnpm pub:lint <slug>           # lint un draft (_drafts/<slug>.mdx)
 *   pnpm pub:lint <slug> --published # lint un article publie (publications/<slug>.mdx)
 *   pnpm pub:lint --all            # lint tous les articles publies (mode regression)
 *
 * Sortie : rapport console + fichier .lint.md a cote du MDX.
 * Exit code : 0 si OK ou warnings seulement, 1 si erreur bloquante.
 */

import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import matter from "gray-matter";

import { publicationFrontmatterSchema } from "@/lib/publications-contract";

const ROOT = resolve(__dirname, "..", "..");
const DRAFTS_DIR = join(ROOT, "content", "_drafts");
const PUBLICATIONS_DIR = join(ROOT, "content", "publications");

type Severity = "ok" | "warn" | "error";

interface CheckResult {
  name: string;
  severity: Severity;
  message: string;
  details?: string[];
}

interface LintReport {
  slug: string;
  filePath: string;
  results: CheckResult[];
  hasErrors: boolean;
  hasWarnings: boolean;
}

const SEVERITY_ICON: Record<Severity, string> = {
  ok: "OK ",
  warn: "WARN",
  error: "ERR ",
};

function fail(message: string): never {
  console.error(`\n[pub:lint] ${message}\n`);
  process.exit(1);
}

function parseArgs(argv: string[]): {
  slug?: string;
  all: boolean;
  published: boolean;
} {
  const args = argv.slice(2);
  const positional = args.filter((a) => !a.startsWith("--"));
  const flags = new Set(args.filter((a) => a.startsWith("--")));

  const all = flags.has("--all");
  const published = flags.has("--published");

  if (!all && positional.length !== 1) {
    fail("Usage : pnpm pub:lint <slug> [--published]   ou   pnpm pub:lint --all");
  }

  return { slug: positional[0], all, published };
}

async function listPublishedSlugs(): Promise<string[]> {
  if (!existsSync(PUBLICATIONS_DIR)) return [];
  const files = await readdir(PUBLICATIONS_DIR);
  return files
    .filter((f) => f.endsWith(".mdx") && !f.startsWith("_"))
    .map((f) => f.replace(/\.mdx$/, ""));
}

async function gatherKnownValues(): Promise<{
  categories: Set<string>;
  audiences: Set<string>;
}> {
  const categories = new Set<string>();
  const audiences = new Set<string>();

  if (!existsSync(PUBLICATIONS_DIR)) return { categories, audiences };

  const files = await readdir(PUBLICATIONS_DIR);
  for (const file of files) {
    if (!file.endsWith(".mdx") || file.startsWith("_")) continue;
    try {
      const raw = await readFile(join(PUBLICATIONS_DIR, file), "utf8");
      const { data } = matter(raw);
      if (typeof data.category === "string") categories.add(data.category);
      if (typeof data.audience === "string") audiences.add(data.audience);
    } catch {
      // ignore lecture defaillante
    }
  }

  return { categories, audiences };
}

const TRACKED_COMPONENTS = [
  "Callout",
  "Figure",
  "StatBlock",
  "PullQuote",
  "ChartBlock",
  "DataTable",
  "InlineCta",
] as const;

function lintBody(body: string, results: CheckResult[]): void {
  // Densite Hn
  const h2Matches = body.match(/^##\s+/gm) ?? [];
  if (h2Matches.length < 3) {
    results.push({
      name: "Densite H2",
      severity: "warn",
      message: `Seulement ${h2Matches.length} sections H2 (recommande : >=3).`,
    });
  } else {
    results.push({
      name: "Densite H2",
      severity: "ok",
      message: `${h2Matches.length} sections H2.`,
    });
  }

  // H3 orphelins (sans H2 parent dans le bloc precedent)
  const lines = body.split(/\r?\n/);
  let lastHeadingDepth = 0;
  const orphanH3: string[] = [];
  for (const line of lines) {
    const m = line.match(/^(#{2,3})\s+(.*)$/);
    if (!m) continue;
    const depth = m[1].length;
    const title = m[2].trim();
    if (depth === 3 && lastHeadingDepth < 2) orphanH3.push(title);
    lastHeadingDepth = depth;
  }
  if (orphanH3.length > 0) {
    results.push({
      name: "Hierarchie Hn",
      severity: "warn",
      message: `H3 sans H2 parent : ${orphanH3.length}`,
      details: orphanH3,
    });
  } else {
    results.push({
      name: "Hierarchie Hn",
      severity: "ok",
      message: "Hierarchie Hn coherente.",
    });
  }

  // Composants MDX
  const componentCounts: Record<string, number> = {};
  for (const name of TRACKED_COMPONENTS) {
    const re = new RegExp(`<${name}\\b`, "g");
    componentCounts[name] = (body.match(re) ?? []).length;
  }
  const totalComponents = Object.values(componentCounts).reduce(
    (a, b) => a + b,
    0,
  );
  if (totalComponents === 0) {
    results.push({
      name: "Composants MDX",
      severity: "warn",
      message:
        "Aucun composant MDX (Callout/Figure/StatBlock/PullQuote) — article tres plat.",
    });
  } else {
    const used = Object.entries(componentCounts)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${k}×${n}`)
      .join(", ");
    results.push({
      name: "Composants MDX",
      severity: "ok",
      message: `${totalComponents} composants utilises (${used}).`,
    });
  }

  // Liens externes : protocole
  const externalLinks = [...body.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map(
    (m) => m[1],
  );
  const httpLinks = externalLinks.filter((l) => l.startsWith("http://"));
  if (httpLinks.length > 0) {
    results.push({
      name: "Liens externes",
      severity: "warn",
      message: `${httpLinks.length} lien(s) en http:// (https recommande).`,
      details: httpLinks,
    });
  } else if (externalLinks.length > 0) {
    results.push({
      name: "Liens externes",
      severity: "ok",
      message: `${externalLinks.length} lien(s) externes, tous en https.`,
    });
  } else {
    results.push({
      name: "Liens externes",
      severity: "warn",
      message: "Aucun lien externe — article peu source.",
    });
  }

  // Lien interne vers /publications/
  const internalLinks = [...body.matchAll(/\]\((\/publications\/[^)]+)\)/g)];
  if (internalLinks.length === 0) {
    results.push({
      name: "Liens internes",
      severity: "warn",
      message: "Aucun lien vers un autre article /publications/...",
    });
  } else {
    results.push({
      name: "Liens internes",
      severity: "ok",
      message: `${internalLinks.length} lien(s) vers d'autres publications.`,
    });
  }
}

function lintFrontmatter(
  data: Record<string, unknown>,
  fileSlug: string,
  knownPublishedSlugs: Set<string>,
  knownCategories: Set<string>,
  knownAudiences: Set<string>,
  results: CheckResult[],
): void {
  // Validation Zod
  const parsed = publicationFrontmatterSchema.safeParse({
    ...data,
    slug:
      typeof data.slug === "string" && data.slug.length > 0 ? data.slug : fileSlug,
  });

  if (!parsed.success) {
    results.push({
      name: "Frontmatter Zod",
      severity: "error",
      message: "Frontmatter non conforme au schema publicationFrontmatterSchema.",
      details: parsed.error.issues.map(
        (i) => `${i.path.join(".")}: ${i.message}`,
      ),
    });
    return;
  }

  results.push({
    name: "Frontmatter Zod",
    severity: "ok",
    message: "Frontmatter conforme au schema.",
  });

  const fm = parsed.data;

  // Slug ↔ filename
  if (fm.slug !== fileSlug) {
    results.push({
      name: "Slug ↔ filename",
      severity: "error",
      message: `Slug du frontmatter "${fm.slug}" != nom de fichier "${fileSlug}".`,
    });
  } else {
    results.push({
      name: "Slug ↔ filename",
      severity: "ok",
      message: "Slug coherent avec le filename.",
    });
  }

  // Categorie / audience connues
  if (knownCategories.size > 0 && !knownCategories.has(fm.category)) {
    results.push({
      name: "Categorie",
      severity: "warn",
      message: `Categorie "${fm.category}" non utilisee dans les autres articles.`,
      details: [`Connues : ${[...knownCategories].join(", ")}`],
    });
  } else {
    results.push({
      name: "Categorie",
      severity: "ok",
      message: `Categorie "${fm.category}".`,
    });
  }

  if (knownAudiences.size > 0 && !knownAudiences.has(fm.audience)) {
    results.push({
      name: "Audience",
      severity: "warn",
      message: `Audience "${fm.audience}" non utilisee dans les autres articles.`,
      details: [`Connues : ${[...knownAudiences].join(", ")}`],
    });
  } else {
    results.push({
      name: "Audience",
      severity: "ok",
      message: `Audience "${fm.audience}".`,
    });
  }

  // relatedSlugs existent
  const missingRelated = fm.relatedSlugs.filter(
    (s) => !knownPublishedSlugs.has(s),
  );
  if (missingRelated.length > 0) {
    results.push({
      name: "relatedSlugs",
      severity: "error",
      message: `relatedSlugs introuvables dans publications/ : ${missingRelated.length}`,
      details: missingRelated,
    });
  } else if (fm.relatedSlugs.length > 0) {
    results.push({
      name: "relatedSlugs",
      severity: "ok",
      message: `${fm.relatedSlugs.length} relatedSlugs valides.`,
    });
  } else {
    results.push({
      name: "relatedSlugs",
      severity: "warn",
      message: "Aucun relatedSlug — pas de lien editorial avec le corpus.",
    });
  }

  // tldr : 3-5 items, <= 140 chars chacun
  if (fm.tldr.length < 3 || fm.tldr.length > 5) {
    results.push({
      name: "TLDR longueur",
      severity: "warn",
      message: `${fm.tldr.length} items (recommande : 3-5).`,
    });
  } else {
    results.push({
      name: "TLDR longueur",
      severity: "ok",
      message: `${fm.tldr.length} items.`,
    });
  }
  const tooLong = fm.tldr.filter((t) => t.length > 140);
  if (tooLong.length > 0) {
    results.push({
      name: "TLDR taille items",
      severity: "warn",
      message: `${tooLong.length} item(s) > 140 chars.`,
      details: tooLong.map((t) => `${t.slice(0, 60)}... (${t.length} chars)`),
    });
  }

  // SEO
  if (fm.seoTitle.length > 60) {
    results.push({
      name: "seoTitle",
      severity: "warn",
      message: `seoTitle ${fm.seoTitle.length} chars (max 60).`,
    });
  } else {
    results.push({
      name: "seoTitle",
      severity: "ok",
      message: `seoTitle ${fm.seoTitle.length} chars.`,
    });
  }
  if (fm.seoDescription.length > 160) {
    results.push({
      name: "seoDescription",
      severity: "warn",
      message: `seoDescription ${fm.seoDescription.length} chars (max 160).`,
    });
  } else {
    results.push({
      name: "seoDescription",
      severity: "ok",
      message: `seoDescription ${fm.seoDescription.length} chars.`,
    });
  }

  // updatedAt >= date
  if (fm.updatedAt < fm.date) {
    results.push({
      name: "Dates",
      severity: "warn",
      message: `updatedAt (${fm.updatedAt}) anterieur a date (${fm.date}).`,
    });
  } else {
    results.push({
      name: "Dates",
      severity: "ok",
      message: `date=${fm.date}, updatedAt=${fm.updatedAt}.`,
    });
  }
}

async function lintFile(
  filePath: string,
  fileSlug: string,
  knownPublishedSlugs: Set<string>,
  knownCategories: Set<string>,
  knownAudiences: Set<string>,
): Promise<LintReport> {
  const raw = await readFile(filePath, "utf8");
  const { data, content } = matter(raw);
  const results: CheckResult[] = [];

  lintFrontmatter(
    data,
    fileSlug,
    knownPublishedSlugs,
    knownCategories,
    knownAudiences,
    results,
  );
  lintBody(content, results);

  const hasErrors = results.some((r) => r.severity === "error");
  const hasWarnings = results.some((r) => r.severity === "warn");

  return { slug: fileSlug, filePath, results, hasErrors, hasWarnings };
}

function renderConsole(report: LintReport): void {
  const errorCount = report.results.filter((r) => r.severity === "error").length;
  const warnCount = report.results.filter((r) => r.severity === "warn").length;
  const okCount = report.results.filter((r) => r.severity === "ok").length;

  console.info(``);
  console.info(`[pub:lint] ${report.slug}`);
  console.info(`           ${report.filePath}`);
  console.info(``);
  for (const r of report.results) {
    console.info(`  [${SEVERITY_ICON[r.severity]}] ${r.name.padEnd(22)} ${r.message}`);
    if (r.details) {
      for (const d of r.details) {
        console.info(`         ${d}`);
      }
    }
  }
  console.info(``);
  console.info(
    `Resume : ${okCount} OK, ${warnCount} warnings, ${errorCount} erreurs`,
  );
}

async function writeReport(report: LintReport): Promise<void> {
  const reportPath = report.filePath.replace(/\.mdx$/, ".lint.md");
  const lines: string[] = [];
  lines.push(`# Lint report — ${report.slug}`);
  lines.push(``);
  lines.push(`Source : \`${report.filePath}\``);
  lines.push(``);
  lines.push(`| Severite | Check | Message |`);
  lines.push(`| --- | --- | --- |`);
  for (const r of report.results) {
    lines.push(`| ${r.severity.toUpperCase()} | ${r.name} | ${r.message} |`);
  }
  lines.push(``);
  for (const r of report.results) {
    if (r.details && r.details.length > 0) {
      lines.push(`## ${r.name} — details`);
      lines.push(``);
      for (const d of r.details) {
        lines.push(`- ${d}`);
      }
      lines.push(``);
    }
  }
  await writeFile(reportPath, lines.join("\n"), "utf8");
}

async function main() {
  const { slug, all, published } = parseArgs(process.argv);

  const knownPublishedSlugs = new Set(await listPublishedSlugs());
  const { categories, audiences } = await gatherKnownValues();

  let reports: LintReport[] = [];

  if (all) {
    for (const s of knownPublishedSlugs) {
      const file = join(PUBLICATIONS_DIR, `${s}.mdx`);
      reports.push(
        await lintFile(file, s, knownPublishedSlugs, categories, audiences),
      );
    }
  } else {
    const dir = published ? PUBLICATIONS_DIR : DRAFTS_DIR;
    const file = join(dir, `${slug}.mdx`);
    if (!existsSync(file)) {
      fail(`Fichier introuvable : ${file}`);
    }
    reports.push(
      await lintFile(
        file,
        slug as string,
        knownPublishedSlugs,
        categories,
        audiences,
      ),
    );
  }

  let totalErrors = 0;
  let totalWarnings = 0;
  for (const report of reports) {
    renderConsole(report);
    if (!all) {
      await writeReport(report);
    }
    if (report.hasErrors) totalErrors++;
    if (report.hasWarnings) totalWarnings++;
  }

  if (all) {
    console.info(``);
    console.info(
      `[pub:lint] --all : ${reports.length} articles, ${totalErrors} avec erreurs, ${totalWarnings} avec warnings.`,
    );
  }

  process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("\n[pub:lint] Erreur inattendue :");
  console.error(err);
  process.exit(1);
});
