import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ['xlsx'],
  outputFileTracingIncludes: {
    '/api/*': ['./data/**/*'],
  },
};

export default nextConfig;
