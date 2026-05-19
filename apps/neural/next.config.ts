import path from "node:path";
import type { NextConfig } from "next";

const repoRoot = path.join(__dirname, "../..");

/**
 * Redirections publiques — refonte V2 (PR 3+).
 *
 * Politique :
 *   - 308 (permanent) quand la route est définitivement remplacée
 *   - 307 (temporary) si volume SEO non négligeable, à promouvoir 308 à J+30
 *
 * Toute entrée doit être référencée dans `docs/route-audit.md` avec sa
 * justification. Le test `tests/redirects.test.ts` vérifie l'absence
 * de cycle et l'alignement avec l'audit.
 */
export const REDIRECTS = [
  {
    source: "/resources",
    destination: "/ressources",
    permanent: true,
  },
] as const;

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["xlsx"],
  outputFileTracingRoot: repoRoot,
  turbopack: {
    root: repoRoot,
  },
  outputFileTracingIncludes: {
    "/api/*": ["./data/**/*"],
  },
  async redirects() {
    return REDIRECTS.map((entry) => ({ ...entry }));
  },
};

export default nextConfig;
