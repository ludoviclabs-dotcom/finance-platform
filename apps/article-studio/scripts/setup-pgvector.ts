/**
 * One-shot setup: enable pgvector extension + create HNSW index on Chunk.embedding.
 *
 * Usage:
 *   npx tsx --env-file-if-exists=.env.local scripts/setup-pgvector.ts
 *
 * Idempotent — safe to re-run. Run this after `prisma migrate dev` if the
 * index isn't included in your migration SQL.
 */

import { ensurePgvectorReady } from "@/lib/vector-store/pgvector";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

async function main(): Promise<void> {
  if (!env.database.ready) {
    console.error("DATABASE_URL is not set. Populate .env.local first.");
    process.exit(1);
  }
  console.log("Ensuring pgvector extension + HNSW index on Chunk.embedding…");
  await ensurePgvectorReady();
  console.log("Done.");
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
