import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/_next/",
          "/admin/",
          "/dashboard/",
          "/*?source=*",
        ],
      },
      {
        userAgent: ["GPTBot", "ClaudeBot", "Google-Extended", "PerplexityBot", "anthropic-ai"],
        allow: ["/", "/docs/", "/glossaire/", "/conformite/", "/contre/", "/cas-types/", "/agents/"],
        disallow: ["/api/", "/_next/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
