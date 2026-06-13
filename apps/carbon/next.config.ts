import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  async redirects() {
    return [
      // Guide renommé après l'Omnibus (T0.3.5) — préserve le SEO de l'ancienne URL.
      {
        source: "/guide-csrd-2027",
        destination: "/guide-csrd-vsme-2026",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
