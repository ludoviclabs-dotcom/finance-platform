/**
 * Bulk-ingest the corpus under content/fixtures/ into the database.
 *
 * Usage:
 *   npx tsx --env-file-if-exists=.env.local scripts/seed-corpus.ts
 *
 * Skips files already in DB (sha256 dedup). Indexes new Sources synchronously
 * so the script's exit code reflects success/failure of the whole pipeline.
 */

import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { env } from "@/lib/env";
import { parseSource } from "@/lib/parsers";
import { indexSource } from "@/lib/vector-store/pipeline";
import type { ParsedDoc } from "@/lib/types/source";

const FIXTURE_DIR = join(process.cwd(), "content", "fixtures");

function sha256OfParsed(parsed: ParsedDoc): string {
  const canonical = parsed.blocks
    .map((b) => `${b.kind}|${b.level ?? ""}|${b.text}`)
    .join("\n");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

function mimeFromName(name: string): string {
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "md" || ext === "markdown") return "text/markdown";
  if (ext === "pdf") return "application/pdf";
  if (ext === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/octet-stream";
}

async function main(): Promise<void> {
  if (!env.database.ready) {
    console.error("DATABASE_URL is not set. Populate .env.local first.");
    process.exit(1);
  }
  if (!env.embeddings.ready) {
    console.error(
      "No embeddings provider configured (set VOYAGE_API_KEY or OPENAI_API_KEY).",
    );
    process.exit(1);
  }

  let entries: string[];
  try {
    entries = await readdir(FIXTURE_DIR);
  } catch {
    console.error(`Fixture directory missing: ${FIXTURE_DIR}`);
    process.exit(1);
  }
  const files = entries.filter((f) => /\.(md|pdf|docx)$/i.test(f));
  if (files.length === 0) {
    console.warn("No .md/.pdf/.docx files found under content/fixtures/.");
    return;
  }

  console.log(`Found ${files.length} fixture files.`);
  let ingested = 0;
  let skipped = 0;
  let failed = 0;

  for (const filename of files) {
    const path = join(FIXTURE_DIR, filename);
    const buffer = await readFile(path);
    const mimeType = mimeFromName(filename);

    try {
      const parsed = await parseSource({ buffer, filename, mimeType });
      const sha256 = sha256OfParsed(parsed);

      const existing = await db.source.findUnique({ where: { sha256 } });
      if (existing) {
        console.log(`  ↷ ${filename}  (skip: dedup, sha=${sha256.slice(0, 8)})`);
        skipped++;
        continue;
      }

      const source = await db.source.create({
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
      });

      const result = await indexSource(source.id);
      console.log(
        `  ✓ ${filename}  (${result.chunkCount} chunks, ${result.tookMs} ms, ${result.embeddingModel})`,
      );
      ingested++;
    } catch (err) {
      console.error(`  ✗ ${filename}  — ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  console.log(`\nDone — ingested: ${ingested}, skipped: ${skipped}, failed: ${failed}.`);
  await db.$disconnect();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
