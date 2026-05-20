/**
 * Coverage helpers — single source of truth pour la matrice secteur × branche.
 *
 * Remplace le hardcoding qui existait dans `section-branches.tsx` (Coverage
 * Proof Map 6×7) et `section-matrix.tsx` (Matrice 7×6) en V1. Ces deux
 * sections divergaient déjà entre elles et n'étaient pas alimentées par
 * `agents-registry.ts`, ce qui garantissait une dérive à terme.
 *
 * Convention de statut public (différent du `status` d'un agent dans MATRIX) :
 *   - "live"    : cellule présente dans MATRIX AVEC `excelSource` non nul.
 *                 Données réelles parsées depuis un workbook.
 *   - "demo"    : cellule présente dans MATRIX SANS excelSource mais avec
 *                 agents publiés (cas Banque × Communication : démo live UI
 *                 et exports signés, mais pas de workbook source).
 *   - "planned" : cellule absente de MATRIX. Combinaison structurellement
 *                 possible (6 secteurs × 7 branches = 42) mais non alimentée.
 */

import {
  BRANCHES_META,
  MATRIX,
  SECTORS_META,
  getCell,
  type Branch,
  type CellData,
  type Sector,
} from "@/lib/data/agents-registry";

export type CoverageStatus = "live" | "demo" | "planned";

export interface CoverageCellInfo {
  sector: Sector;
  branch: Branch;
  status: CoverageStatus;
  agentCount: number;
  topAgent: string | null;
  cell: CellData | undefined;
}

export interface CoverageRow {
  sector: Sector;
  cells: CoverageCellInfo[];
}

const SECTORS_ORDER: readonly Sector[] = [
  "luxe",
  "banque",
  "assurance",
  "transport",
  "aeronautique",
  "saas",
];

const BRANCHES_ORDER: readonly Branch[] = [
  "finance",
  "comptabilite",
  "communication",
  "supply-chain",
  "rh",
  "marketing",
  "si",
];

export function getCoverageStatus(sector: Sector, branch: Branch): CoverageStatus {
  const cell = getCell(sector, branch);
  if (!cell) return "planned";
  if (cell.excelSource !== null) return "live";
  return cell.agents.length > 0 ? "demo" : "planned";
}

export function getCoverageCell(sector: Sector, branch: Branch): CoverageCellInfo {
  const cell = getCell(sector, branch);
  const status = getCoverageStatus(sector, branch);
  return {
    sector,
    branch,
    status,
    agentCount: cell?.agents.filter((a) => a.status === "live").length ?? 0,
    topAgent: cell?.topAgent ?? null,
    cell,
  };
}

export function buildCoverageGrid(): CoverageRow[] {
  return SECTORS_ORDER.map((sector) => ({
    sector,
    cells: BRANCHES_ORDER.map((branch) => getCoverageCell(sector, branch)),
  }));
}

export function getSectorMeta(sector: Sector) {
  return SECTORS_META[sector];
}

export function getBranchMeta(branch: Branch) {
  return BRANCHES_META[branch];
}

export const COVERAGE_BRANCHES_ORDER = BRANCHES_ORDER;
export const COVERAGE_SECTORS_ORDER = SECTORS_ORDER;

/** Pour la legende et les compteurs visibles dans l'UI. */
export interface CoverageSummary {
  liveCells: number;
  demoCells: number;
  plannedCells: number;
  totalCells: number;
}

export function getCoverageSummary(): CoverageSummary {
  let live = 0;
  let demo = 0;
  for (const cell of MATRIX) {
    if (cell.excelSource !== null) live += 1;
    else if (cell.agents.length > 0) demo += 1;
  }
  const total = SECTORS_ORDER.length * BRANCHES_ORDER.length; // 42
  return {
    liveCells: live,
    demoCells: demo,
    plannedCells: total - live - demo,
    totalCells: total,
  };
}
