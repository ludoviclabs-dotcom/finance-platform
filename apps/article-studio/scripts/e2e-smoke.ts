/**
 * End-to-end smoke test — exercises the full local pipeline.
 *
 * Usage:
 *   npx tsx --env-file-if-exists=.env.local scripts/e2e-smoke.ts
 *
 * Steps:
 *   1. Ingest one fixture from content/fixtures/ (smallest .md available).
 *   2. Wait until the Source is in status READY (background indexing).
 *   3. Create a draft Article from a minimal brief targeting that Source.
 *   4. Run the orchestrator end-to-end (without HTTP — direct in-process).
 *   5. Export the article as PDF (or HTML if Chromium is unavailable) and
 *      assert the file is at least 1 KB.
 *
 * Designed to fail fast and loudly with a clear summary at each step.
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { parseSource } from "@/lib/parsers";
import { indexSource } from "@/lib/vector-store/pipeline";
import { runArticleOrchestrator } from "@/lib/generation/article-orchestrator";
import { exportArticle } from "@/lib/export";
import type { ParsedDoc } from "@/lib/types/source";
import type { Prisma } from "@prisma/client";

const FIXTURE_DIR = join(process.cwd(), "content", "fixtures");
const TIMEOUT_MS = 60_000;

function sha256OfParsed(parsed: ParsedDoc): string {
  const canonical = parsed.blocks
    .map((b) => `${b.kind}|${b.level ?? ""}|${b.text}`)
    .join("\n");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

async function step<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  process.stdout.write(`  • ${label}…`);
  try {
    const result = await fn();
    console.log(`  ✓ (${Date.now() - t0} ms)`);
    return result;
  } catch (err) {
    console.log(`  ✗ (${Date.now() - t0} ms)`);
    throw err;
  }
}

async function main(): Promise<void> {
  if (!env.database.ready) {
    console.error("DATABASE_URL absent. Provision Neon and fill .env.local.");
    process.exit(1);
  }
  if (!env.embeddings.ready) {
    console.error("No embeddings provider (VOYAGE_API_KEY or OPENAI_API_KEY).");
    process.exit(1);
  }

  console.log("E2E smoke test — Article Studio");
  console.log("===============================");

  // 1) Pick a fixture
  const fixturePath = await step("locate fixture", async () => {
    const entries = await readdir(FIXTURE_DIR);
    const md = entries.find((f) => f.toLowerCase().endsWith(".md"));
    if (!md) throw new Error(`No .md fixture in ${FIXTURE_DIR}`);
    return join(FIXTURE_DIR, md);
  });

  // 2) Ingest + index
  const source = await step("ingest + chunk + embed", async () => {
    const buffer = await readFile(fixturePath);
    const parsed = await parseSource({
      buffer,
      filename: fixturePath.split("/").pop()!,
      mimeType: "text/markdown",
    });
    const sha256 = sha256OfParsed(parsed);

    const existing = await db.source.findUnique({ where: { sha256 } });
    if (existing && existing.status === "READY") return existing;

    const src =
      existing ??
      (await db.source.create({
        data: {
          filename: parsed.filename,
          mimeType: parsed.mimeType,
          byteSize: buffer.byteLength,
          sha256,
          title: parsed.title,
          author: parsed.author,
          publishedAt: parsed.publishedAt,
          language: parsed.language ?? "fr",
          status: "CHUNKING",
          metadata: {
            blockCount: parsed.blocks.length,
            blocks: parsed.blocks,
            parser: parsed.metadata,
          } as unknown as Prisma.InputJsonValue,
          parsedAt: new Date(),
        },
      }));

    await indexSource(src.id);
    return src;
  });

  // 3) Wait for READY (defensive — indexSource is synchronous here)
  await step("verify Source.status === READY", async () => {
    const deadline = Date.now() + TIMEOUT_MS;
    while (Date.now() < deadline) {
      const fresh = await db.source.findUnique({ where: { id: source.id } });
      if (fresh?.status === "READY") return;
      if (fresh?.status === "FAILED") {
        throw new Error(`Source FAILED: ${fresh.errorMessage}`);
      }
      await sleep(500);
    }
    throw new Error("Source did not reach READY within timeout.");
  });

  // 4) Create article with a minimal brief
  const article = await step("create draft article", async () => {
    const brief = {
      title: "Smoke test — synthèse",
      angle: "Vérifier que la chaîne ingestion → RAG → génération → export fonctionne bout en bout.",
      audience: "Mainteneur du studio",
      length: "short" as const,
      tone: "factuel",
      selectedSourceIds: [source.id],
      keywords: ["smoke", "test"],
    };
    return db.article.create({
      data: {
        title: brief.title,
        slug: `smoke-${Date.now()}`,
        brief: brief as unknown as Prisma.InputJsonValue,
        selectedSourceIds: [source.id],
        status: "DRAFT",
      },
    });
  });

  // 5) Generate end-to-end (drain the async generator)
  let outlineEmitted = false;
  let sectionTokens = 0;
  let groundingScore = 0;
  await step("orchestrate generation", async () => {
    for await (const event of runArticleOrchestrator({ articleId: article.id })) {
      switch (event.type) {
        case "outline":
          outlineEmitted = true;
          break;
        case "section-token":
          sectionTokens++;
          break;
        case "done":
          groundingScore = event.grounding.score;
          break;
        case "error":
          throw new Error(`Orchestrator error: ${event.message}`);
      }
    }
  });
  if (!outlineEmitted) throw new Error("Outline event never fired.");
  if (sectionTokens === 0) throw new Error("No section tokens streamed.");

  // 6) Export — PDF if Chromium works, else fall back to HTML
  const outPath = join(process.cwd(), `e2e-smoke-${article.slug}.pdf`);
  let exportedSize = 0;
  await step("export PDF (or HTML fallback)", async () => {
    try {
      const pdf = await exportArticle(article.id, "pdf");
      const buf = pdf.body as Buffer;
      await writeFile(outPath, buf);
      exportedSize = buf.length;
    } catch (err) {
      console.log(`    PDF unavailable (${err instanceof Error ? err.message : err}); falling back to HTML`);
      const html = await exportArticle(article.id, "html");
      const htmlPath = outPath.replace(/\.pdf$/, ".html");
      await writeFile(htmlPath, html.body as string);
      exportedSize = (html.body as string).length;
    }
  });
  if (exportedSize < 1024) {
    throw new Error(`Export too small (${exportedSize} B).`);
  }

  console.log();
  console.log("Summary");
  console.log("-------");
  console.log(`  Source id:        ${source.id}`);
  console.log(`  Article id:       ${article.id}`);
  console.log(`  Section tokens:   ${sectionTokens}`);
  console.log(`  Grounding score:  ${(groundingScore * 100).toFixed(0)} %`);
  console.log(`  Export bytes:     ${exportedSize}`);
  console.log("All steps passed.");

  await db.$disconnect();
}

main().catch((err) => {
  console.error("\nE2E smoke FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
