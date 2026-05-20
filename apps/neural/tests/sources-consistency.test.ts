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
 * détection. Les divergences connues et intentionnelles sont modélisées par
 * `lib/proof-status.ts` (PR 5) et vérifiées via cette couche canonique.
 */

import { describe, expect, it } from "vitest";

import { MATRIX } from "@/lib/data/agents-registry";
import { AGENT_ENTRIES } from "@/lib/public-catalog";
import { getUnifiedStatus } from "@/lib/proof-status";

/**
 * Divergence registry × public-catalog assumée par convention (V2, PR 5+).
 *
 * Périmètre : la cellule Banque × Communication. Ses agents sont marqués
 * `planned` côté registry (`excelSource: null`, pas de workbook source) alors
 * que leur surface publique existe réellement — démo avec scénarios figés +
 * export Markdown signé SHA-256. Les agents de cette cellule effectivement
 * publiés dans `public-catalog` (`reg-bank-comms`, `bank-evidence-guard`) y
 * sont donc `live` : d'où une divergence registry↔catalog. Les autres ne sont
 * pas encore catalogués publiquement mais restent pré-listés ici pour que
 * leur future promotion soit déjà documentée (sinon le 1er test échouerait).
 *
 * Ces statuts ne désignent PAS la même chose — data source / démo publique /
 * preuve d'export — et ne sont pas ordonnés par précédence. PR 5 a livré
 * `lib/proof-status.ts`, source canonique qui compose ces dimensions sans les
 * aplatir. Cette liste n'est donc pas une dette à résorber mais le périmètre
 * stable du motif « démo publique sans workbook » ; le 3e test ci-dessous
 * vérifie que la couche canonique résout chaque divergence réelle.
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

  it("resolves every real divergence coherently through proof-status.ts (canonical layer)", () => {
    const registry = collectRegistryAgents();
    const catalog = collectCatalogAgents();

    let checked = 0;
    for (const slug of KNOWN_STATUS_DIVERGENCES) {
      const registryStatus = registry.get(slug);
      const catalogStatus = catalog.get(slug);
      // La divergence n'existe que pour les agents présents dans les 2
      // sources ; les autres sont pré-listés sans cas concret à vérifier.
      if (!registryStatus || !catalogStatus) continue;

      const unified = getUnifiedStatus(slug);
      expect(unified.registryStatus, `${slug}: registryStatus`).toBe(registryStatus);
      expect(unified.catalogStatus, `${slug}: catalogStatus`).toBe(catalogStatus);

      // La couche canonique ne dégrade jamais une démo publique réelle vers
      // `planned` / `unknown` : elle la résout en surface publique.
      expect(unified.displayStatus, `${slug}: displayStatus`).not.toBe("planned");
      expect(unified.displayStatus, `${slug}: displayStatus`).not.toBe("unknown");
      checked += 1;
    }

    // Garde-fou : au moins une divergence réelle doit être couverte, sinon
    // KNOWN_STATUS_DIVERGENCES n'a plus de cas concret (à nettoyer).
    expect(checked, "aucune divergence registry∩catalog vérifiée").toBeGreaterThan(0);
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
