import path from "node:path";
import type { NextConfig } from "next";

const repoRoot = path.join(__dirname, "../..");

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
};

export default nextConfig;
