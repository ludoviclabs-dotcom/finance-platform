import Link from "next/link";

import {
  COVERAGE_BRANCHES_ORDER,
  COVERAGE_SECTORS_ORDER,
  getBranchMeta,
  getCoverageCell,
  getSectorMeta,
  type CoverageCellInfo,
  type CoverageStatus,
} from "@/lib/coverage";
import type { Branch, Sector } from "@/lib/data/agents-registry";

interface CoverageGridFilteredProps {
  /** Affiche la ligne du secteur (couverture de toutes les branches pour ce secteur). */
  sector?: Sector;
  /** Affiche la colonne de la branche (couverture de tous les secteurs pour cette branche). */
  branch?: Branch;
  /** Titre rendu au-dessus de la liste. Defaults : "Couverture {label}". */
  title?: string;
  /** Description courte sous le titre. */
  description?: string;
}

const STATUS_PALETTE: Record<CoverageStatus, { container: string; chip: string; label: string }> = {
  live: {
    container: "border-emerald-400/30 bg-emerald-400/[0.08] hover:border-emerald-400/50",
    chip: "bg-emerald-400/20 text-emerald-200",
    label: "Live",
  },
  demo: {
    container: "border-violet-400/30 bg-violet-400/[0.08] hover:border-violet-400/50",
    chip: "bg-violet-400/20 text-violet-200",
    label: "Démo",
  },
  planned: {
    container: "border-white/8 bg-white/[0.02] hover:border-white/15",
    chip: "bg-white/10 text-white/55",
    label: "Prépa",
  },
};

/**
 * Variant de CoverageGrid filtré par secteur OU branche. Lit la source de
 * vérité `lib/coverage.ts` → `lib/data/agents-registry.ts`. Plus aucun
 * statut secteur/branche hardcodé dans les composants consommateurs.
 *
 * Pattern de migration des pages V1 :
 *   - Page secteur (ex: `/secteurs/luxe`) : `<CoverageGridFiltered sector="luxe" />`
 *   - Page branche (ex: `/solutions/finance`) : `<CoverageGridFiltered branch="finance" />`
 */
export function CoverageGridFiltered({
  sector,
  branch,
  title,
  description,
}: CoverageGridFilteredProps) {
  if (!sector && !branch) {
    throw new Error("CoverageGridFiltered requires either `sector` or `branch`.");
  }
  if (sector && branch) {
    throw new Error("CoverageGridFiltered accepts `sector` OR `branch`, not both.");
  }

  const cells: CoverageCellInfo[] = sector
    ? COVERAGE_BRANCHES_ORDER.map((b) => getCoverageCell(sector, b))
    : COVERAGE_SECTORS_ORDER.map((s) => getCoverageCell(s, branch!));

  const computedTitle =
    title ??
    (sector ? `Couverture ${getSectorMeta(sector).label}` : `Couverture ${getBranchMeta(branch!).label}`);

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.02] p-6 md:p-8">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-violet-300/80">
          {sector ? "Secteur" : "Branche"}
        </p>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-white">
          {computedTitle}
        </h2>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">{description}</p>
        ) : null}
      </header>

      <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {cells.map((cell) => {
          const palette = STATUS_PALETTE[cell.status];
          const targetMeta = sector ? getBranchMeta(cell.branch) : getSectorMeta(cell.sector);
          const targetHref = sector ? `/solutions/${cell.branch}` : `/secteurs/${cell.sector}`;
          const targetLabel = "label" in targetMeta ? targetMeta.label : String(targetMeta);

          return (
            <Link
              key={`${cell.sector}-${cell.branch}`}
              href={targetHref}
              className={`flex flex-col rounded-2xl border p-4 transition-all hover:-translate-y-0.5 ${palette.container}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${palette.chip}`}>
                  {palette.label}
                </span>
                {cell.agentCount > 0 ? (
                  <span className="text-[11px] uppercase tracking-[0.12em] text-white/45">
                    {cell.agentCount} agent{cell.agentCount > 1 ? "s" : ""}
                  </span>
                ) : null}
              </div>
              <h3 className="mt-3 font-display text-lg font-semibold text-white">{targetLabel}</h3>
              {cell.topAgent ? (
                <p className="mt-1 text-xs text-white/55">Top agent : {cell.topAgent}</p>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
