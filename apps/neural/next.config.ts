import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ['xlsx'],
  turbopack: {
    root: __dirname,
  },
  outputFileTracingIncludes: {
    '/api/*': ['./data/**/*'],
  },
};

export default nextConfig;
