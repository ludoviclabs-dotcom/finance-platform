/**
 * ARTICLE STUDIO — Prisma configuration (Prisma 7+)
 *
 * Connection URLs live here (not in schema.prisma anymore).
 * At runtime, PrismaClient is instantiated with @prisma/adapter-pg in lib/db.ts.
 *
 * Docs: https://pris.ly/d/config-datasource
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config();
import type { PrismaConfig } from "prisma";

export default {
  schema: "./prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "",
    shadowDatabaseUrl: process.env.DIRECT_URL,
  },
} satisfies PrismaConfig;
