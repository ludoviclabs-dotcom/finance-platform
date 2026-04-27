/**
 * NEURAL — Reviewer editorial IA.
 *
 * Usage :
 *   pnpm pub:review <slug>             # review un draft (_drafts/<slug>.mdx)
 *   pnpm pub:review <slug> --published # review un article publie
 *
 * Ecrit deux fichiers a cote du MDX :
 *   - <slug>.review.json (machine-readable, valide Zod)
 *   - <slug>.review.md   (rapport humain lisible)
 *
 * Le reviewer DIAGNOSTIQUE — il ne reformule jamais l'article.
 * Le LLM peut etre instruit de ne pas iterer en boucle (cf. system prompt).
 */

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";

import matter from "gray-matter";
import { parse as parseYaml } from "yaml";

import { generateNeuralTextSurface } from "@/lib/ai/router";

import { reviewReportSchema, type ReviewReport } from "./lib/review-schema";

const ROOT = resolve(__dirname, "..", "..");
const DRAFTS_DIR = join(ROOT, "content", "_drafts");
const PUBLICATIONS_DIR = join(ROOT, "content", "publications");

const CLI_USER_ID = "cli:publication-reviewer";

function fail(message: string): never {
  console.error(`\n[pub:review] ${message}\n`);
  process.exit(1);
}

function parseArgs(argv: string[]): { slug: string; published: boolean } {
  const args = argv.slice(2);
  const positional = args.filter((a) => !a.startsWith("--"));
  const flags = new Set(args.filter((a) => a.startsWith("--")));

  if (positional.length !== 1) {
    fail("Usage : pnpm pub:review <slug> [--published]");
  }

  return { slug: positional[0], published: flags.has("--published") };
}

function buildUserPrompt(args: {
  slug: string;
  frontmatter: Record<string, unknown>;
  body: string;
  brief?: unknown;
}): string {
  const briefBlock = args.brief
    ? `## Brief d'origine\n\n\`\`\`yaml\n${stringifyForPrompt(args.brief)}\`\`\`\n\n`
    : `## Brief d'origine\n\n_(non fourni — review sans comparaison intention/sortie)_\n\n`;

  return [
    `Tu reviewes l'article publication NEURAL ci-dessous.`,
    ``,
    briefBlock,
    `## Frontmatter`,
    ``,
    "```yaml",
    stringifyForPrompt(args.frontmatter),
    "```",
    ``,
    `## Corps MDX`,
    ``,
    "```mdx",
    args.body.trim(),
    "```",
    ``,
    `Produis le rapport JSON conforme au schema decrit dans ton system prompt. Pas de prose autour, pas de balise de code englobante : uniquement l'objet JSON.`,
  ].join("\n");
}

function stringifyForPrompt(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  // Tente le parse direct
  try {
    return JSON.parse(trimmed);
  } catch {
    // ignore
  }
  // Tente de retirer un fencing markdown
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    return JSON.parse(fenceMatch[1].trim());
  }
  // Tente de trouver le premier { ... } equilibre
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error("Reponse LLM non parseable en JSON.");
}

function renderMdReport(slug: string, report: ReviewReport, modelId: string): string {
  const lines: string[] = [];
  lines.push(`# Review editorial — ${slug}`);
  lines.push(``);
  lines.push(`**Score global : ${report.overallScore}/100**`);
  lines.push(`Modele : \`${modelId}\``);
  lines.push(``);
  lines.push(`## Top 3 corrections prioritaires`);
  lines.push(``);
  report.topPriorityFixes.forEach((fix, i) => {
    lines.push(`${i + 1}. ${fix}`);
  });
  lines.push(``);
  lines.push(`## Scores par axe`);
  lines.push(``);
  lines.push(`| Axe | Score |`);
  lines.push(`| --- | ---: |`);
  lines.push(`| Style | ${report.axes.style.score} |`);
  lines.push(`| Factuality | ${report.axes.factuality.score} |`);
  lines.push(`| Structure | ${report.axes.structure.score} |`);
  lines.push(`| SEO | ${report.axes.seo.score} |`);
  lines.push(`| Redundancy | ${report.axes.redundancy.score} |`);
  lines.push(`| Readability | ${report.axes.readability.score} (Flesch FR ≈ ${report.axes.readability.fleschFR}) |`);
  lines.push(`| Bias / Overclaim | ${report.axes.biasAndOverclaim.score} |`);
  lines.push(``);

  const renderList = (title: string, items: string[]) => {
    if (items.length === 0) return;
    lines.push(`### ${title}`);
    lines.push(``);
    for (const it of items) lines.push(`- ${it}`);
    lines.push(``);
  };

  lines.push(`## Style`);
  lines.push(``);
  renderList("Commentaires", report.axes.style.comments);
  renderList("Suggestions", report.axes.style.suggestions);

  lines.push(`## Factualite`);
  lines.push(``);
  renderList("Claims sans source", report.axes.factuality.claimsWithoutSource);
  renderList("Claims faibles", report.axes.factuality.weakClaims);

  lines.push(`## Structure`);
  lines.push(``);
  renderList("Sections trop courtes", report.axes.structure.sectionsTooShort);
  renderList("Problemes de hierarchie", report.axes.structure.hierarchyIssues);

  lines.push(`## SEO`);
  lines.push(``);
  renderList("Mots-cles manquants", report.axes.seo.missingKeywords);
  renderList("Problemes de titre", report.axes.seo.titleIssues);

  lines.push(`## Redondances`);
  lines.push(``);
  renderList("Phrases repetees", report.axes.redundancy.repeatedPhrases);
  renderList("Sections en echo", report.axes.redundancy.echoSections);

  lines.push(`## Lisibilite`);
  lines.push(``);
  renderList("Phrases trop longues", report.axes.readability.longSentences);

  lines.push(`## Biais & overclaim`);
  lines.push(``);
  renderList("Formulations problematiques", report.axes.biasAndOverclaim.overstatements);

  return lines.join("\n");
}

function estimateCostUsd(inputTokens?: number, outputTokens?: number): number {
  const INPUT_PER_M = 3.0;
  const OUTPUT_PER_M = 15.0;
  const inUsd = ((inputTokens ?? 0) / 1_000_000) * INPUT_PER_M;
  const outUsd = ((outputTokens ?? 0) / 1_000_000) * OUTPUT_PER_M;
  return Number((inUsd + outUsd).toFixed(4));
}

async function main() {
  const { slug, published } = parseArgs(process.argv);
  const dir = published ? PUBLICATIONS_DIR : DRAFTS_DIR;
  const filePath = join(dir, `${slug}.mdx`);

  if (!existsSync(filePath)) {
    fail(`Fichier introuvable : ${filePath}`);
  }

  console.info(`[pub:review] Chargement : ${filePath}`);
  const raw = await readFile(filePath, "utf8");
  const { data: frontmatter, content: body } = matter(raw);

  // Charge le brief s'il est dispo (pour comparaison intention/sortie)
  let brief: unknown;
  const briefPath = join(DRAFTS_DIR, `${slug}.brief.yaml`);
  if (existsSync(briefPath)) {
    brief = parseYaml(await readFile(briefPath, "utf8"));
  }

  const userPrompt = buildUserPrompt({
    slug,
    frontmatter: frontmatter as Record<string, unknown>,
    body,
    brief,
  });

  console.info(
    `[pub:review] Appel AI Gateway (surface publication-reviewer)...`,
  );
  const t0 = performance.now();

  // Premier essai
  let result = await generateNeuralTextSurface({
    surfaceId: "publication-reviewer",
    userId: CLI_USER_ID,
    messages: [{ role: "user", content: userPrompt }],
  });

  let parsed: ReviewReport | undefined;
  try {
    const json = extractJsonObject(result.text);
    parsed = reviewReportSchema.parse(json);
  } catch (err) {
    console.warn(
      `[pub:review] JSON non conforme au premier essai, retry avec rappel explicite...`,
    );
    const retryPrompt =
      userPrompt +
      `\n\nIMPORTANT : ta reponse precedente n'etait pas un JSON valide ou ne respectait pas le schema. Renvoie UNIQUEMENT l'objet JSON conforme, rien d'autre.`;
    result = await generateNeuralTextSurface({
      surfaceId: "publication-reviewer",
      userId: CLI_USER_ID,
      messages: [{ role: "user", content: retryPrompt }],
    });
    const json = extractJsonObject(result.text);
    parsed = reviewReportSchema.parse(json);
    if (!parsed) {
      throw err;
    }
  }

  const latencyMs = Math.round(performance.now() - t0);

  // Ecritures
  const jsonPath = filePath.replace(/\.mdx$/, ".review.json");
  const mdPath = filePath.replace(/\.mdx$/, ".review.md");
  await writeFile(jsonPath, JSON.stringify(parsed, null, 2), "utf8");
  await writeFile(mdPath, renderMdReport(slug, parsed, result.resolvedModel), "utf8");

  // Stats
  const inputTokens = result.usage?.inputTokens;
  const outputTokens = result.usage?.outputTokens;
  const costUsd = estimateCostUsd(inputTokens, outputTokens);

  console.info(``);
  console.info(`[pub:review] OK`);
  console.info(`             Score global : ${parsed.overallScore}/100`);
  console.info(`             Top fixes :`);
  parsed.topPriorityFixes.forEach((fix, i) => {
    console.info(`               ${i + 1}. ${fix}`);
  });
  console.info(``);
  console.info(`             JSON         : ${jsonPath}`);
  console.info(`             Markdown     : ${mdPath}`);
  console.info(`             Latence      : ${(latencyMs / 1000).toFixed(1)}s`);
  console.info(`             Tokens in/out: ${inputTokens ?? "?"} / ${outputTokens ?? "?"}`);
  console.info(`             Cout estime  : ~${costUsd} USD`);
  console.info(`             Modele       : ${result.resolvedModel}`);
  console.info(`             Trace        : ${result.traceId}`);
}

main().catch((err) => {
  if (err && typeof err === "object" && "issues" in err) {
    console.error("\n[pub:review] Reponse LLM non conforme au schema review :");
    console.error(JSON.stringify(err.issues, null, 2));
  } else {
    console.error("\n[pub:review] Erreur inattendue :");
    console.error(err);
  }
  process.exit(1);
});
