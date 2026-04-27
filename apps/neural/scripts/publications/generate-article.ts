/**
 * NEURAL — Generateur d'articles MDX a partir d'un brief YAML.
 *
 * Usage :
 *   pnpm pub:gen <slug>
 *   pnpm pub:gen <slug> --force      # ecrase si _drafts/<slug>.mdx existe deja
 *
 * Lit  : apps/neural/content/_drafts/<slug>.brief.yaml
 * Ecrit: apps/neural/content/_drafts/<slug>.mdx
 *
 * Le frontmatter MDX est construit cote script (validation Zod) — le LLM
 * ne genere QUE le corps MDX. Cette separation garantit que le build Next
 * ne casse jamais sur un frontmatter mal forme.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";

import { parse as parseYaml } from "yaml";

import { generateNeuralTextSurface } from "@/lib/ai/router";

import { briefSchema } from "./lib/brief-schema";
import { buildUserPrompt } from "./lib/prompt-builder";
import { analyzeBody, serializeMdxFile } from "./lib/mdx-writer";

const ROOT = resolve(__dirname, "..", "..");
const DRAFTS_DIR = join(ROOT, "content", "_drafts");
const PUBLICATIONS_DIR = join(ROOT, "content", "publications");

const CLI_USER_ID = "cli:publication-generator";

function fail(message: string): never {
  console.error(`\n[pub:gen] ${message}\n`);
  process.exit(1);
}

function parseArgs(argv: string[]): { slug: string; force: boolean } {
  const args = argv.slice(2);
  const positional = args.filter((a) => !a.startsWith("--"));
  const flags = new Set(args.filter((a) => a.startsWith("--")));

  if (positional.length !== 1) {
    fail("Usage : pnpm pub:gen <slug> [--force]");
  }

  return { slug: positional[0], force: flags.has("--force") };
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
  // Tarifs Claude Sonnet 4.6 indicatifs (USD / 1M tokens) — a ajuster.
  const INPUT_PER_M = 3.0;
  const OUTPUT_PER_M = 15.0;
  const inUsd = ((inputTokens ?? 0) / 1_000_000) * INPUT_PER_M;
  const outUsd = ((outputTokens ?? 0) / 1_000_000) * OUTPUT_PER_M;
  return Number((inUsd + outUsd).toFixed(4));
}

async function main() {
  const { slug, force } = parseArgs(process.argv);

  const briefPath = join(DRAFTS_DIR, `${slug}.brief.yaml`);
  const outputPath = join(DRAFTS_DIR, `${slug}.mdx`);

  // 1. Verifications prealables
  if (!existsSync(briefPath)) {
    fail(`Brief introuvable : ${briefPath}`);
  }

  const existingPublicationSlugs = await listExistingPublicationSlugs();
  if (existingPublicationSlugs.has(slug)) {
    fail(
      `Un article publie existe deja avec ce slug : content/publications/${slug}.mdx. ` +
        `Choisis un autre slug ou supprime/renomme l'existant.`,
    );
  }

  if (existsSync(outputPath) && !force) {
    fail(
      `Un draft existe deja : content/_drafts/${slug}.mdx. ` +
        `Utilise --force pour ecraser.`,
    );
  }

  // 2. Charge et valide le brief
  console.info(`[pub:gen] Chargement du brief : ${briefPath}`);
  const rawBrief = parseYaml(await readFile(briefPath, "utf8")) as unknown;
  const brief = briefSchema.parse(rawBrief);

  if (brief.slug !== slug) {
    fail(
      `Le slug du fichier (${slug}) ne correspond pas au slug du brief (${brief.slug}).`,
    );
  }

  // 3. Verifie les relatedSlugs
  const missing = brief.relatedSlugs.filter(
    (s) => !existingPublicationSlugs.has(s),
  );
  if (missing.length > 0) {
    fail(
      `relatedSlugs introuvables dans content/publications/ : ${missing.join(", ")}`,
    );
  }

  // 4. Construction du user prompt
  const userPrompt = buildUserPrompt(brief);

  console.info(
    `[pub:gen] Appel AI Gateway (surface publication-generator, modele claude-sonnet-4.6)...`,
  );
  const t0 = performance.now();

  const result = await generateNeuralTextSurface({
    surfaceId: "publication-generator",
    userId: CLI_USER_ID,
    messages: [{ role: "user", content: userPrompt }],
  });

  const latencyMs = Math.round(performance.now() - t0);

  // 5. Ecriture du MDX
  await mkdir(DRAFTS_DIR, { recursive: true });
  const mdxFile = serializeMdxFile(brief, result.text);
  await writeFile(outputPath, mdxFile, "utf8");

  // 6. Stats finales
  const stats = analyzeBody(result.text);
  const usedComponents = Object.entries(stats.componentCounts)
    .filter(([, n]) => n > 0)
    .map(([name, n]) => `${name}×${n}`)
    .join(", ");

  const inputTokens = result.usage?.inputTokens;
  const outputTokens = result.usage?.outputTokens;
  const costUsd = estimateCostUsd(inputTokens, outputTokens);

  console.info(``);
  console.info(`[pub:gen] OK — Article genere : ${outputPath}`);
  console.info(`           Mots          : ${stats.wordCount} (cible ${brief.targetWordCount})`);
  console.info(`           Sections H2   : ${stats.sectionCount} (plan : ${brief.plan.length})`);
  console.info(`           Composants    : ${usedComponents || "_aucun_"}`);
  console.info(`           Latence       : ${(latencyMs / 1000).toFixed(1)}s`);
  console.info(`           Tokens in/out : ${inputTokens ?? "?"} / ${outputTokens ?? "?"}`);
  console.info(`           Cout estime   : ~${costUsd} USD`);
  console.info(`           Modele        : ${result.resolvedModel}`);
  console.info(`           Trace         : ${result.traceId}`);
  console.info(``);
  console.info(`Prochaine etape : pnpm pub:lint ${slug}  puis  pnpm pub:review ${slug}`);
}

main().catch((err) => {
  if (err && typeof err === "object" && "issues" in err) {
    console.error("\n[pub:gen] Brief invalide :");
    console.error(JSON.stringify(err.issues, null, 2));
  } else {
    console.error("\n[pub:gen] Erreur inattendue :");
    console.error(err);
  }
  process.exit(1);
});
