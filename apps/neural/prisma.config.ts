/**
 * NEURAL — Prisma configuration (Prisma 7+)
 *
 * Connection URLs live here (not in schema.prisma anymore).
 * At runtime, PrismaClient is instantiated with @prisma/adapter-pg
 * in lib/db.ts (Sprint 0 scaffold).
 *
 * Docs: https://pris.ly/d/config-datasource
 */

import { config } from "dotenv";
// `vercel env pull` writes to .env.local — load it explicitly so
// Prisma CLI picks up DATABASE_URL during migrations.
config({ path: ".env.local" });
config(); // fallback: also load .env if present
import type { PrismaConfig } from "prisma";

export default {
  schema: "./prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "",
    shadowDatabaseUrl: process.env.DIRECT_URL,
  },
} satisfies PrismaConfig;
