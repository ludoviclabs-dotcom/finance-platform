/**
 * Tests du sitemap (refonte V2, PR 6).
 *
 * Garantit que le sitemap :
 *   - ne liste jamais une route redirigée (cohérence avec next.config REDIRECTS)
 *   - inclut les hubs de navigation V2 (/produit, /ressources)
 *   - ne produit pas d'URL en double
 */

import { describe, expect, it } from "vitest";

import sitemap from "@/app/sitemap";
import { REDIRECTS } from "@/next.config";

describe("Sitemap", () => {
  it("never lists a redirected route as a canonical URL", async () => {
    const entries = await sitemap();
    const redirectSources = new Set<string>(REDIRECTS.map((r) => r.source));
    const offenders: string[] = [];
    for (const entry of entries) {
      const pathname = new URL(entry.url).pathname;
      if (redirectSources.has(pathname)) offenders.push(entry.url);
    }
    expect(
      offenders,
      `Routes redirigées présentes dans le sitemap :\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("lists the V2 nav hubs /produit and /ressources", async () => {
    const entries = await sitemap();
    const pathnames = entries.map((e) => new URL(e.url).pathname);
    expect(pathnames).toContain("/produit");
    expect(pathnames).toContain("/ressources");
  });

  it("produces unique URLs (no duplicates)", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    const seen = new Map<string, number>();
    for (const url of urls) seen.set(url, (seen.get(url) ?? 0) + 1);
    const duplicates = [...seen.entries()].filter(([, n]) => n > 1).map(([u]) => u);
    expect(duplicates, `URLs en double :\n${duplicates.join("\n")}`).toEqual([]);
  });
});
