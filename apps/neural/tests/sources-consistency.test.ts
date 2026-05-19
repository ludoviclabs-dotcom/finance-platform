/**
 * Test pivot de cohérence inter-sources (refonte V2, PR 1).
 *
 * Croise les 3 sources de vérité du système de preuve NEURAL :
 *   - `lib/data/agents-registry.ts` (source technique : MATRIX, agents avec status)
 *   - `lib/public-catalog.ts`       (source commerciale : AGENT_ENTRIES avec status/proofLevel)
 *   - `lib/proof-catalog.ts`        (source preuve : EXPORT_OR_AUDIT_AGENT_SLUGS, PROOF_OVERRIDES)
 *
 * Ce test empêche toute divergence statut/preuve introduite par les PR 2-5
 * (refonte homepage, hubs, branches & secteurs) de passer en main sans
 * détection. Il documente également les divergences connues, intentionnelles,
 * reportées à PR 5 (modélisation propre via `lib/proof-status.ts`).
 */

import { describe, expect, it } from "vitest";

import { MATRIX } from "@/lib/data/agents-registry";
import { AGENT_ENTRIES } from "@/lib/public-catalog";

/**
 * Divergences connues au moment de PR 1 (sprint hygiène V2).
 *
 * Toutes concernent la cellule Banque × Communication : registry les marque
 * `planned` parce que `excelSource: null` (pas de workbook source), mais
 * `public-catalog` les expose `live` parce qu'une démo publique avec 5
 * scénarios figés + export Markdown signé SHA-256 existe réellement, et
 * `proof-catalog` les inclut dans `EXPORT_OR_AUDIT_AGENT_SLUGS` à juste titre.
 *
 * Ces 3 statuts ne désignent PAS la même chose : data source / démo publique
 * / preuve d'export. PR 5 introduira `lib/proof-status.ts` pour modéliser
 * ces 3 dimensions distinctes. D'ici là, la liste ci-dessous documente les
 * exceptions tolérées sans en cacher l'existence.
 */
const KNOWN_STATUS_DIVERGENCES = new Set<string>([
  "reg-bank-comms",
  "bank-evidence-guard",
  "bank-crisis-comms",
  "esg-bank-comms",
  "client-bank-comms",
]);

function collectRegistryAgents(): Map<string, "live" | "planned"> {
  const out = new Map<string, "live" | "planned">();
  for (const cell of MATRIX) {
    for (const agent of cell.agents) {
      if (agent.type === "service") continue;
      out.set(agent.id, agent.status);
    }
  }
  return out;
}

function collectCatalogAgents(): Map<string, "live" | "demo" | "planned"> {
  const out = new Map<string, "live" | "demo" | "planned">();
  for (const entry of AGENT_ENTRIES) {
    if (entry.kind !== "agent") continue;
    out.set(entry.slug, entry.status);
  }
  return out;
}

describe("Sources consistency (registry × public-catalog)", () => {
  it("documents every divergence between registry status and public-catalog status", () => {
    const registry = collectRegistryAgents();
    const catalog = collectCatalogAgents();

    const undocumentedDivergences: string[] = [];
    for (const [slug, registryStatus] of registry) {
      const catalogStatus = catalog.get(slug);
      if (!catalogStatus) continue;

      // Equivalence :
      //   registry "live"    ↔ catalog "live" ou "demo"
      //   registry "planned" ↔ catalog "planned"
      const consistent =
        (registryStatus === "live" && (catalogStatus === "live" || catalogStatus === "demo")) ||
        (registryStatus === "planned" && catalogStatus === "planned");

      if (!consistent && !KNOWN_STATUS_DIVERGENCES.has(slug)) {
        undocumentedDivergences.push(
          `${slug}: registry=${registryStatus}, catalog=${catalogStatus}`,
        );
      }
    }

    expect(
      undocumentedDivergences,
      `Nouvelles divergences statut détectées (à documenter dans KNOWN_STATUS_DIVERGENCES ou résoudre) :\n${undocumentedDivergences.join("\n")}`,
    ).toEqual([]);
  });

  it("ensures every known divergence is still a real divergence (else clean it up)", () => {
    const registry = collectRegistryAgents();
    const catalog = collectCatalogAgents();

    const staleExceptions: string[] = [];
    for (const slug of KNOWN_STATUS_DIVERGENCES) {
      const registryStatus = registry.get(slug);
      const catalogStatus = catalog.get(slug);
      if (!registryStatus || !catalogStatus) continue;

      const stillDivergent = !(
        (registryStatus === "live" && (catalogStatus === "live" || catalogStatus === "demo")) ||
        (registryStatus === "planned" && catalogStatus === "planned")
      );

      if (!stillDivergent) {
        staleExceptions.push(`${slug}: désormais cohérent (registry=${registryStatus}, catalog=${catalogStatus}) — retirer de KNOWN_STATUS_DIVERGENCES`);
      }
    }

    expect(staleExceptions, staleExceptions.join("\n")).toEqual([]);
  });

  // Note : on ne vérifie PAS que tout agent du catalog existe dans registry.
  // Le registry MATRIX ne couvre que les cellules avec workbook Excel ; il est
  // légitime qu'AGENT_ENTRIES expose des agents publics sans cellule alimentée
  // (consolidation, multi-currency, royalty, fraud-detect-sc, etc.). Cette
  // dualité est documentée dans `agents-registry.ts:614` (`countLiveCells`) :
  // un agent peut être publié dans le catalogue commercial sans être encore
  // attaché à une donnée Excel. Le test pivot ci-dessus suffit : il garantit
  // qu'AUX agents présents dans les deux sources sont statutairement cohérents.
});
