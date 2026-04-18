/**
 * NEURAL — PrismaClient singleton (Prisma 7+)
 *
 * Avoids creating multiple PrismaClient instances during Next.js HMR in
 * development. Uses the Postgres driver adapter so the runtime matches what
 * prisma.config.ts uses for migrations.
 *
 * Import as:  import { db } from "@/lib/db";
 *
 * Do not call `db.$connect()` eagerly — Prisma connects lazily on first query.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "./env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  // Prisma 7 requires either `url` in schema.prisma OR an adapter.
  // Since we removed the URL from schema (prisma.config.ts pattern), we always
  // pass an adapter. At build time, DATABASE_URL may be absent — we use a
  // placeholder URL so the module loads cleanly; queries will throw at runtime
  // with a clear PostgreSQL connection error rather than a Prisma init error.
  const connectionString =
    env.database.url ?? "postgresql://build-placeholder:5432/neural";
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const db: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (env.runtime.nodeEnv !== "production") {
  globalForPrisma.prisma = db;
}

export type { PrismaClient } from "@prisma/client";
