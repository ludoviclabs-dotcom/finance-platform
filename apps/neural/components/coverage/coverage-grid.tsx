"use client";

import { useState } from "react";
import Link from "next/link";

import {
  COVERAGE_BRANCHES_ORDER,
  COVERAGE_SECTORS_ORDER,
  buildCoverageGrid,
  getBranchMeta,
  getCoverageSummary,
  getSectorMeta,
  type CoverageCellInfo,
  type CoverageStatus,
} from "@/lib/coverage";

const STATUS_CLASSES: Record<CoverageStatus, string> = {
  live: "bg-emerald-400/[0.22] border-emerald-400/40 text-emerald-200 hover:bg-emerald-400/[0.32]",
  demo: "bg-violet-400/[0.22] border-violet-400/40 text-violet-200 hover:bg-violet-400/[0.32]",
  planned: "bg-white/[0.04] border-white/10 text-white/35 hover:bg-white/[0.08]",
};

const STATUS_LABELS: Record<CoverageStatus, string> = {
  live: "Live",
  demo: "Démo",
  planned: "—",
};

const STATUS_DESCRIPTIONS: Record<CoverageStatus, string> = {
  live: "Cellule alimentée par un workbook Excel (données réelles).",
  demo: "Démo publique avec scénarios figés et exports — pas de workbook source.",
  planned: "Combinaison structurellement possible mais non alimentée à ce jour.",
};

type Filter = "all" | CoverageStatus;

export function CoverageGrid() {
  const [filter, setFilter] = useState<Filter>("all");
  const [hovered, setHovered] = useState<{ sector: string; branch: string } | null>(null);
  const grid = buildCoverageGrid();
  const summary = getCoverageSummary();

  const isVisible = (status: CoverageStatus) => filter === "all" || filter === status;

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.02] p-6 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-violet-300/80">Couverture publique</p>
          <h3 className="mt-2 font-display text-2xl font-bold tracking-tight md:text-3xl">
            {summary.liveCells} cellules alimentées · {summary.demoCells} en démo · {summary.plannedCells} en préparation
          </h3>
          <p className="mt-2 text-sm text-white/55">
            42 combinaisons possibles (6 secteurs × 7 branches). Le périmètre live correspond aux
            cellules avec workbook Excel parsé ; la démo couvre les surfaces UI avec scénarios figés.
          </p>
        </div>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Filtrer la matrice par statut</legend>
          {(["all", "live", "demo", "planned"] as Filter[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${
                filter === option
                  ? "border-violet-400/60 bg-violet-400/15 text-violet-100"
                  : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              {option === "all" ? "Tous" : STATUS_LABELS[option]}
            </button>
          ))}
        </fieldset>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                Secteur \\ Branche
              </th>
              {COVERAGE_BRANCHES_ORDER.map((branch) => {
                const meta = getBranchMeta(branch);
                return (
                  <th
                    key={branch}
                    className="px-2 py-1 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55"
                  >
                    {meta.shortLabel}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {grid.map((row) => {
              const sectorMeta = getSectorMeta(row.sector);
              return (
                <tr key={row.sector}>
                  <th className="py-1 pr-2 text-left text-sm font-semibold text-white/85">
                    <span aria-hidden="true">{sectorMeta.emoji}</span> {sectorMeta.label}
                  </th>
                  {row.cells.map((cell) => (
                    <td key={`${cell.sector}-${cell.branch}`} className="p-0">
                      <CoverageCell
                        cell={cell}
                        dimmed={!isVisible(cell.status)}
                        hovered={hovered?.sector === cell.sector && hovered?.branch === cell.branch}
                        onHover={(v) =>
                          setHovered(v ? { sector: cell.sector, branch: cell.branch } : null)
                        }
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex flex-col gap-3 border-t border-white/8 pt-4 md:flex-row md:items-center md:justify-between">
        <ul className="flex flex-wrap gap-3 text-xs text-white/60">
          {(["live", "demo", "planned"] as CoverageStatus[]).map((status) => (
            <li key={status} className="flex items-center gap-2">
              <span
                className={`inline-block h-3 w-3 rounded-sm border ${STATUS_CLASSES[status]}`}
                aria-hidden="true"
              />
              <span>
                <strong className="text-white/80">{STATUS_LABELS[status]}</strong> ·{" "}
                {STATUS_DESCRIPTIONS[status]}
              </span>
            </li>
          ))}
        </ul>
        <Link
          href="/proof"
          className="inline-flex items-center gap-2 self-start rounded-full bg-neural-violet px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-neural-violet-dark md:self-auto"
        >
          Vérifier dans la console de preuve →
        </Link>
      </div>

      {COVERAGE_SECTORS_ORDER.length === 0 ? null : null}
    </div>
  );
}

function CoverageCell({
  cell,
  dimmed,
  hovered,
  onHover,
}: {
  cell: CoverageCellInfo;
  dimmed: boolean;
  hovered: boolean;
  onHover: (state: boolean) => void;
}) {
  const branchMeta = getBranchMeta(cell.branch);
  const sectorMeta = getSectorMeta(cell.sector);
  const sectorHref = `/secteurs/${cell.sector}`;
  const tooltip = `${sectorMeta.label} × ${branchMeta.label} — ${STATUS_DESCRIPTIONS[cell.status]}`;

  return (
    <Link
      href={sectorHref}
      title={tooltip}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={`flex h-12 items-center justify-center rounded-md border text-[11px] font-semibold uppercase tracking-[0.10em] transition-all ${STATUS_CLASSES[cell.status]} ${
        dimmed ? "opacity-25" : "opacity-100"
      } ${hovered ? "scale-[1.04]" : ""}`}
    >
      <span>
        {STATUS_LABELS[cell.status]}
        {cell.agentCount > 0 ? <span className="ml-1 text-[10px] opacity-80">·{cell.agentCount}</span> : null}
      </span>
    </Link>
  );
}
