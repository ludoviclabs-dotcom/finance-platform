/**
 * NEURAL — Vercel project configuration
 *
 * Replaces the legacy vercel.json with a typed, versionable TS config.
 * Docs: https://vercel.com/docs/project-configuration/vercel-ts
 *
 * This file is read by Vercel at build time. Keep it deterministic and free
 * of secret lookups at module scope — use `deploymentEnv` helpers when needed.
 */

import type { VercelConfig } from "@vercel/config/v1";

const config: VercelConfig = {
  framework: "nextjs",
  installCommand: "npm install --legacy-peer-deps",
  buildCommand: "npx next build",
  outputDirectory: ".next",

  // All /api routes must ship the /data Excel workbooks with the function bundle
  // so runtime parsers (parse-consolidation, parse-inventaire, …) can read them.
  functions: {
    "app/api/**/*.ts": {
      includeFiles: "data/**",
    },
  },

  // Scheduled jobs
  crons: [
    // Sprint 7 — daily EUR-Lex / BOFiP / EBA / IFRS regulatory scan at 07:00 UTC
    { path: "/api/cron/regulatory-watch", schedule: "0 7 * * *" },
    // Sprint 3 (future) — weekly Braintrust eval regression check
    // { path: "/api/cron/eval-drift", schedule: "0 2 * * 1" },
  ],
};

export { config };
export default config;
