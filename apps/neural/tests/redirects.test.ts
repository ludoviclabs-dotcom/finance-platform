/**
 * Tests structurels des redirects publics (refonte V2, PR 3).
 *
 * Garantit que :
 *   - aucune destination de redirect n'est aussi listée comme source (cycle)
 *   - chaque source pointe vers une destination unique
 *   - les sources ne se chevauchent pas (pas de doublon)
 *   - le format est cohérent (commence par /, pas de query string)
 */

import { describe, expect, it } from "vitest";

import { REDIRECTS } from "@/next.config";

// `as const` côté next.config produit des types littéraux ; on widen vers
// `string` ici pour que les tests structurels (Set/Map cross-check) compilent
// sans devoir relacher le typage du config lui-même.
type RedirectEntry = { source: string; destination: string; permanent: boolean };
const REDIRECTS_T: ReadonlyArray<RedirectEntry> = REDIRECTS;

describe("Public redirects", () => {
  it("does not create a cycle (no destination listed as a source)", () => {
    const sources = new Set<string>(REDIRECTS_T.map((r) => r.source));
    const cycles: string[] = [];
    for (const entry of REDIRECTS_T) {
      if (sources.has(entry.destination)) {
        cycles.push(`${entry.source} → ${entry.destination} (destination also a source)`);
      }
    }
    expect(cycles, `Cycles détectés :\n${cycles.join("\n")}`).toEqual([]);
  });

  it("does not declare a source twice", () => {
    const counts = new Map<string, number>();
    for (const entry of REDIRECTS_T) {
      counts.set(entry.source, (counts.get(entry.source) ?? 0) + 1);
    }
    const duplicates = [...counts.entries()].filter(([, n]) => n > 1).map(([s]) => s);
    expect(duplicates, `Sources dupliquées : ${duplicates.join(", ")}`).toEqual([]);
  });

  it("uses absolute paths for both source and destination", () => {
    const invalid: string[] = [];
    for (const entry of REDIRECTS_T) {
      if (!entry.source.startsWith("/")) invalid.push(`source non absolue: ${entry.source}`);
      if (!entry.destination.startsWith("/")) {
        invalid.push(`destination non absolue: ${entry.destination}`);
      }
      if (entry.source.includes("?") || entry.destination.includes("?")) {
        invalid.push(`query string interdite: ${entry.source} → ${entry.destination}`);
      }
    }
    expect(invalid, invalid.join("\n")).toEqual([]);
  });

  it("documents the /resources → /ressources migration (PR 3 V2 refonte)", () => {
    const found = REDIRECTS_T.find((r) => r.source === "/resources");
    expect(found).toBeDefined();
    expect(found?.destination).toBe("/ressources");
    expect(found?.permanent).toBe(true);
  });
});
