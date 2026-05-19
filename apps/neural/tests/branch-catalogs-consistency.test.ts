/**
 * Tests de cohérence inter-catalogues spécialisés (refonte V2, PR 4).
 *
 * Les catalogues `lib/data/*-catalog.ts` (bank-comms, luxe-comms, bank-marketing,
 * insurance-marketing, insurance-supply-chain, aero-marketing) contiennent des
 * données métier détaillées (scénarios, sources, vocabulaire) référençant des
 * agents via `slug`. Ce test garantit que chaque slug catalogue mappe à un agent
 * connu (présent dans `agents-registry.ts` MATRIX ou dans `public-catalog.ts`
 * AGENT_ENTRIES), pour éviter typos et fantômes de référence.
 *
 * Quand un agent existe en catalogue mais pas encore publiquement, il est
 * documenté dans `KNOWN_CATALOG_ONLY_AGENTS` ci-dessous. Ces exceptions
 * doivent être résorbées au fil des PR ultérieures (ajout dans AGENT_ENTRIES
 * ou dans MATRIX selon la maturité).
 */

import { describe, expect, it } from "vitest";

import { MATRIX } from "@/lib/data/agents-registry";
import { AGENT_ENTRIES } from "@/lib/public-catalog";
import { AERO_MKT_AGENTS } from "@/lib/data/aero-marketing-catalog";
import { BANK_MKT_AGENTS } from "@/lib/data/bank-marketing-catalog";
import { INSURANCE_MKT_AGENTS } from "@/lib/data/insurance-marketing-catalog";
import { INSURANCE_SC_AGENTS } from "@/lib/data/insurance-supply-chain-catalog";

/**
 * Agents présents dans un catalogue spécialisé mais pas encore exposés dans
 * AGENT_ENTRIES. Liste à résorber au fil des PR (chaque agent doit finir par
 * avoir une page publique et une entrée AGENT_ENTRIES, ou être marqué comme
 * service transverse non vitrine).
 */
const KNOWN_CATALOG_ONLY_AGENTS = new Set<string>([
  // aero-marketing-catalog : pas encore d'AGENT_ENTRIES correspondantes.
  "aero-tech-content",
  "defense-comms-guard",
  "aero-event-ai",
  "aero-sustainability-comms",
  // bank-marketing-catalog : pas encore d'AGENT_ENTRIES correspondantes.
  "bank-marketing-compliance-guard",
  "fin-literacy-content",
  "segmented-bank-marketing",
  "mifid-product-marketing-guard",
  // insurance-marketing-catalog : pas encore d'AGENT_ENTRIES correspondantes.
  "insur-simplifier",
  "dda-marketing-guard",
  "multi-channel-insur",
  "prevention-content",
]);

function collectKnownAgentIds(): Set<string> {
  const out = new Set<string>();
  for (const cell of MATRIX) {
    for (const agent of cell.agents) {
      out.add(agent.id);
    }
  }
  for (const entry of AGENT_ENTRIES) {
    if (entry.kind === "agent") out.add(entry.slug);
  }
  return out;
}

interface CatalogProbe {
  name: string;
  slugs: string[];
}

const CATALOGS: CatalogProbe[] = [
  { name: "aero-marketing-catalog",        slugs: AERO_MKT_AGENTS.map((a) => a.slug) },
  { name: "bank-marketing-catalog",        slugs: BANK_MKT_AGENTS.map((a) => a.slug) },
  { name: "insurance-marketing-catalog",   slugs: INSURANCE_MKT_AGENTS.map((a) => a.slug) },
  { name: "insurance-supply-chain-catalog", slugs: INSURANCE_SC_AGENTS.map((a) => a.slug) },
];

describe("Catalog ↔ registry/public-catalog consistency", () => {
  it("every specialty catalog slug is either known publicly OR explicitly documented", () => {
    const known = collectKnownAgentIds();
    const undocumentedGhosts: string[] = [];

    for (const catalog of CATALOGS) {
      for (const slug of catalog.slugs) {
        if (known.has(slug)) continue;
        if (KNOWN_CATALOG_ONLY_AGENTS.has(slug)) continue;
        undocumentedGhosts.push(`${catalog.name} → "${slug}" (ni dans MATRIX, ni dans AGENT_ENTRIES, ni dans KNOWN_CATALOG_ONLY_AGENTS)`);
      }
    }

    expect(
      undocumentedGhosts,
      `Slugs catalogue inconnus :\n${undocumentedGhosts.join("\n")}`,
    ).toEqual([]);
  });

  it("KNOWN_CATALOG_ONLY_AGENTS list stays minimal (each entry must still be catalog-only)", () => {
    const known = collectKnownAgentIds();
    const staleExceptions: string[] = [];
    for (const slug of KNOWN_CATALOG_ONLY_AGENTS) {
      if (known.has(slug)) {
        staleExceptions.push(`"${slug}" est désormais publiquement référencé — retirer de KNOWN_CATALOG_ONLY_AGENTS`);
      }
    }

    expect(staleExceptions, staleExceptions.join("\n")).toEqual([]);
  });

  it("each catalog declares at least one agent", () => {
    for (const catalog of CATALOGS) {
      expect(catalog.slugs.length, `${catalog.name} expose 0 agent`).toBeGreaterThan(0);
    }
  });
});
