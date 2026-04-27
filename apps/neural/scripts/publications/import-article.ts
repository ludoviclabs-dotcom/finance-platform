/**
 * NEURAL — Import d'un draft d'article (md / docx / pdf) → MDX enrichi.
 *
 * Usage :
 *   pnpm pub:import <slug>
 *   pnpm pub:import <slug> --force
 *
 * Lit obligatoirement :
 *   apps/neural/content/_drafts/<slug>.brief.yaml   (metadonnees)
 *   apps/neural/content/_drafts/<slug>.{md,docx,pdf,mdx,txt}  (draft source)
 *
 * Lit optionnellement :
 *   apps/neural/content/_drafts/<slug>-assets/      (images, *.chart.json, *.table.json, *.stat.json)
 *
 * Ecrit :
 *   apps/neural/content/_drafts/<slug>.mdx          (article reecrit en MDX)
 *   apps/neural/public/publications/<slug>/         (assets copies si presents)
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";

import { parse as parseYaml } from "yaml";

import { generateNeuralTextSurface } from "@/lib/ai/router";

import { briefSchema, type Brief } from "./lib/brief-schema";
import { extractDocument } from "./lib/extractor";
import {
  expandAssetBlocks,
  loadAssetManifest,
} from "./lib/asset-manager";
import { buildRewriteUserPrompt } from "./lib/rewrite-prompt";
import { analyzeBody, serializeMdxFile } from "./lib/mdx-writer";

const ROOT = resolve(__dirname, "..", "..");
const DRAFTS_DIR = join(ROOT, "content", "_drafts");
const PUBLICATIONS_DIR = join(ROOT, "content", "publications");
const PUBLIC_PUBLICATIONS_DIR = join(ROOT, "public", "publications");

const CLI_USER_ID = "cli:publication-importer";
const SOURCE_EXTS = ["md", "mdx", "docx", "pdf", "txt"] as const;

function fail(message: string): never {
  console.error(`\n[pub:import] ${message}\n`);
  process.exit(1);
}

function parseArgs(argv: string[]): { slug: string; force: boolean } {
  const args = argv.slice(2);
  const positional = args.filter((a) => !a.startsWith("--"));
  const flags = new Set(args.filter((a) => a.startsWith("--")));

  if (positional.length !== 1) {
    fail("Usage : pnpm pub:import <slug> [--force]");
  }

  return { slug: positional[0], force: flags.has("--force") };
}

async function locateDraftSource(slug: string): Promise<string> {
  for (const ext of SOURCE_EXTS) {
    const candidate = join(DRAFTS_DIR, `${slug}.${ext}`);
    if (existsSync(candidate)) return candidate;
  }
  fail(
    `Aucun draft trouve. Attendu : content/_drafts/${slug}.{${SOURCE_EXTS.join(",")}}`,
  );
}

async function listExistingPublicationSlugs(): Promise<Set<string>> {
  if (!existsSync(PUBLICATIONS_DIR)) return new Set();
  const files = await readdir(PUBLICATIONS_DIR);
  return new Set(
    files
      .filter((f) => f.endsWith(".mdx") && !f.startsWith("_"))
      .map((f) => f.replace(/\.mdx$/, "")),
  );
}

function estimateCostUsd(inputTokens?: number, outputTokens?: number): number {
  const INPUT_PER_M = 3.0;
  const OUTPUT_PER_M = 15.0;
  const inUsd = ((inputTokens ?? 0) / 1_000_000) * INPUT_PER_M;
  const outUsd = ((outputTokens ?? 0) / 1_000_000) * OUTPUT_PER_M;
  return Number((inUsd + outUsd).toFixed(4));
}

function maybeApplyCoverImage(brief: Brief, manifestCover?: string): Brief {
  if (manifestCover && !brief.coverImage) {
    return { ...brief, coverImage: manifestCover };
  }
  return brief;
}

async function main() {
  const { slug, force } = parseArgs(process.argv);

  const briefPath = join(DRAFTS_DIR, `${slug}.brief.yaml`);
  const outputPath = join(DRAFTS_DIR, `${slug}.mdx`);

  if (!existsSync(briefPath)) {
    fail(`Brief introuvable : ${briefPath}`);
  }

  const existingSlugs = await listExistingPublicationSlugs();
  if (existingSlugs.has(slug)) {
    fail(
      `Un article publie existe deja : content/publications/${slug}.mdx. Choisis un autre slug.`,
    );
  }
  if (existsSync(outputPath) && !force) {
    fail(
      `Un draft MDX existe deja : ${outputPath}. Utilise --force pour ecraser.`,
    );
  }

  // 1. Brief
  console.info(`[pub:import] Brief : ${briefPath}`);
  const rawBrief = parseYaml(await readFile(briefPath, "utf8")) as unknown;
  let brief = briefSchema.parse(rawBrief);
  if (brief.slug !== slug) {
    fail(`Slug fichier (${slug}) != slug brief (${brief.slug}).`);
  }

  // 2. Verification relatedSlugs
  const missingRelated = brief.relatedSlugs.filter((s) => !existingSlugs.has(s));
  if (missingRelated.length > 0) {
    fail(`relatedSlugs introuvables : ${missingRelated.join(", ")}`);
  }

  // 3. Localisation et extraction du draft source
  const draftPath = await locateDraftSource(slug);
  console.info(`[pub:import] Draft source : ${draftPath}`);
  const extracted = await extractDocument(draftPath);
  console.info(
    `[pub:import] Extrait ${extracted.charCount} caracteres (${extracted.sourceFormat}).`,
  );
  for (const w of extracted.warnings) {
    console.warn(`[pub:import] WARN : ${w}`);
  }

  // 4. Manifeste d'assets (copie images vers public/publications/<slug>/)
  await mkdir(PUBLIC_PUBLICATIONS_DIR, { recursive: true });
  const manifest = await loadAssetManifest({
    slug,
    draftsDir: DRAFTS_DIR,
    publicPublicationsDir: PUBLIC_PUBLICATIONS_DIR,
  });

  if (manifest.hasAssetsDir) {
    console.info(
      `[pub:import] Assets : ${manifest.images.length} image(s), ${manifest.charts.length} chart(s), ${manifest.tables.length} table(s), ${manifest.stats.length} stat(s).`,
    );
    if (manifest.coverImage) {
      console.info(`[pub:import] Cover detectee : ${manifest.coverImage}`);
    }
  } else {
    console.info(`[pub:import] Assets : (aucun dossier _drafts/${slug}-assets/)`);
  }

  brief = maybeApplyCoverImage(brief, manifest.coverImage);

  // 5. Construction du user prompt rewrite
  const userPrompt = buildRewriteUserPrompt({
    brief,
    draftText: extracted.text,
    sourceFormat: extracted.sourceFormat,
    manifest,
  });

  console.info(
    `[pub:import] Appel AI Gateway (publication-generator, mode rewrite)...`,
  );
  const t0 = performance.now();

  const result = await generateNeuralTextSurface({
    surfaceId: "publication-generator",
    userId: CLI_USER_ID,
    messages: [{ role: "user", content: userPrompt }],
  });

  const latencyMs = Math.round(performance.now() - t0);

  // 6. Substitution des asset blocks {chartKey, tableKey, statKey} → composants complets
  const expansionWarnings: string[] = [];
  const expandedBody = expandAssetBlocks(result.text, manifest, expansionWarnings);
  for (const w of expansionWarnings) {
    console.warn(`[pub:import] WARN : ${w}`);
  }

  // 7. Ecriture du MDX final
  await mkdir(DRAFTS_DIR, { recursive: true });
  const mdxFile = serializeMdxFile(brief, expandedBody);
  await writeFile(outputPath, mdxFile, "utf8");

  // 8. Stats
  const stats = analyzeBody(expandedBody);
  const usedComponents = Object.entries(stats.componentCounts)
    .filter(([, n]) => n > 0)
    .map(([name, n]) => `${name}×${n}`)
    .join(", ");

  const inputTokens = result.usage?.inputTokens;
  const outputTokens = result.usage?.outputTokens;
  const costUsd = estimateCostUsd(inputTokens, outputTokens);

  console.info(``);
  console.info(`[pub:import] OK — Article importe : ${outputPath}`);
  console.info(`             Mots          : ${stats.wordCount} (cible ${brief.targetWordCount})`);
  console.info(`             Sections H2   : ${stats.sectionCount}`);
  console.info(`             Composants    : ${usedComponents || "_aucun_"}`);
  console.info(`             Latence       : ${(latencyMs / 1000).toFixed(1)}s`);
  console.info(`             Tokens in/out : ${inputTokens ?? "?"} / ${outputTokens ?? "?"}`);
  console.info(`             Cout estime   : ~${costUsd} USD`);
  console.info(`             Modele        : ${result.resolvedModel}`);
  console.info(`             Trace         : ${result.traceId}`);
  console.info(``);
  console.info(`Prochaine etape : pnpm pub:lint ${slug}  puis  pnpm pub:review ${slug}`);
}

main().catch((err) => {
  if (err && typeof err === "object" && "issues" in err) {
    console.error("\n[pub:import] Donnees invalides :");
    console.error(JSON.stringify(err.issues, null, 2));
  } else {
    console.error("\n[pub:import] Erreur inattendue :");
    console.error(err);
  }
  process.exit(1);
});
