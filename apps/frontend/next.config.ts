import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" is for Docker only — Vercel handles output automatically
  // To re-enable for Docker: output: "standalone",
  reactCompiler: true,
};

export default nextConfig;
