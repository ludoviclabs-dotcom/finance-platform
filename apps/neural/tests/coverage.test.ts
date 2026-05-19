/**
 * Coverage helpers — tests logiques (refonte V2, PR 2).
 *
 * Garantit que le helper qui alimente le `CoverageGrid` reste cohérent avec
 * la source de vérité `agents-registry.ts`. Toute future modification de
 * MATRIX se reflète automatiquement dans le rendu de la matrice.
 */

import { describe, expect, it } from "vitest";

import { countLiveCells } from "@/lib/data/agents-registry";
import {
  COVERAGE_BRANCHES_ORDER,
  COVERAGE_SECTORS_ORDER,
  buildCoverageGrid,
  getCoverageStatus,
  getCoverageSummary,
} from "@/lib/coverage";

describe("Coverage helpers", () => {
  it("builds a 6 × 7 = 42 cells grid", () => {
    const grid = buildCoverageGrid();
    expect(grid).toHaveLength(6);
    for (const row of grid) {
      expect(row.cells).toHaveLength(7);
    }
    const totalCells = grid.reduce((acc, row) => acc + row.cells.length, 0);
    expect(totalCells).toBe(42);
  });

  it("exposes the canonical sector and branch orderings", () => {
    expect(COVERAGE_SECTORS_ORDER).toEqual([
      "luxe",
      "banque",
      "assurance",
      "transport",
      "aeronautique",
      "saas",
    ]);
    expect(COVERAGE_BRANCHES_ORDER).toEqual([
      "finance",
      "comptabilite",
      "communication",
      "supply-chain",
      "rh",
      "marketing",
      "si",
    ]);
  });

  it("aligns liveCells count with the registry helper", () => {
    const summary = getCoverageSummary();
    // countLiveCells from agents-registry counts cells with excelSource !== null.
    // Our 'live' status uses the same predicate, so values must match.
    expect(summary.liveCells).toBe(countLiveCells());
  });

  it("sums live + demo + planned = 42", () => {
    const summary = getCoverageSummary();
    expect(summary.totalCells).toBe(42);
    expect(summary.liveCells + summary.demoCells + summary.plannedCells).toBe(42);
  });

  it("returns 'demo' for the Banque × Communication cell (agents listed, excelSource null)", () => {
    // Cellule documentée comme exception multidimensionnelle :
    // - registry agents: planned (excelSource: null)
    // - public-catalog: live (démo publique + export Markdown signé)
    // - coverage:       demo  (entre 'live' avec workbook et 'planned' sans surface)
    expect(getCoverageStatus("banque", "communication")).toBe("demo");
  });

  it("returns 'live' for the Luxe × Finance flagship cell", () => {
    expect(getCoverageStatus("luxe", "finance")).toBe("live");
  });

  it("returns 'planned' for an unalimented combination (e.g. SaaS × SI)", () => {
    expect(getCoverageStatus("saas", "si")).toBe("planned");
  });
});
