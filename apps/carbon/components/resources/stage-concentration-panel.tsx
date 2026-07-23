/**
 * StageConcentrationPanel — concentration géographique PAR ÉTAPE (Module 2,
 * PR-M2C).
 *
 * Chaque étape de la chaîne de valeur a sa propre carte : HHI (barème DOJ
 * 0-10000), premier pays, part hors UE, couverture de marché, année de
 * référence et parts pays (géographie). JAMAIS de moyenne inter-étapes —
 * l'agrégation vient de `buildStageConcentration()` qui refuse par construction
 * de mélanger deux étapes.
 *
 * Purement présentationnel → testable au rendu serveur.
 */

import {
  formatPct,
  hhiBand,
  type ResourceStageConcentration,
} from "@/lib/api/resources";
import { ProvenanceRefs } from "./provenance";
import { ResourceDataStatus } from "./resource-data-status";
import { EmptyNote } from "./section";
import { ConcentrationChoropleth } from "./viz/concentration-choropleth";

const HHI_TONE: Record<string, string> = {
  unknown: "text-[var(--color-muted-foreground)]",
  low: "text-emerald-600 dark:text-emerald-400",
  moderate: "text-amber-600 dark:text-amber-400",
  high: "text-orange-600 dark:text-orange-400",
  severe: "text-red-600 dark:text-red-400",
};

function StageCard({ stage }: { stage: ResourceStageConcentration }) {
  const band = hhiBand(stage.hhi);
  const shares = [...stage.country_shares].sort((a, b) => b.share_pct - a.share_pct);
  return (
    <div
      className="rounded-xl border border-[var(--color-border)] p-4"
      data-testid={`stage-${stage.stage_code}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--color-foreground)]">
          Étape&nbsp;: {stage.stage_code}
        </h3>
        <div className="flex items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
          <span>{stage.metric_code}</span>
          {stage.reference_year != null && <span>· année {stage.reference_year}</span>}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Concentration pays (HHI)
          </p>
          <p className={`font-mono font-semibold ${HHI_TONE[band.tone]}`}>
            {stage.hhi == null ? "n. d." : stage.hhi}
          </p>
          <p className={`text-[10px] ${HHI_TONE[band.tone]}`}>{band.label}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Premier pays
          </p>
          <p className="font-mono text-[var(--color-foreground)]">
            {stage.top_country_code ?? "n. d."}
            {stage.top_country_share_pct != null && (
              <span className="text-[var(--color-muted-foreground)]">
                {" "}
                ({formatPct(stage.top_country_share_pct)})
              </span>
            )}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Part hors UE
          </p>
          <p className="font-mono text-[var(--color-foreground)]">{formatPct(stage.non_eu_pct)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Couverture marché
          </p>
          <p className="font-mono text-[var(--color-foreground)]">
            {stage.coverage_pct == null ? "volume" : formatPct(stage.coverage_pct)}
          </p>
        </div>
      </div>

      {stage.coverage_pct != null && stage.coverage_pct < 50 && (
        <p
          className="mt-2 text-[11px] text-amber-600 dark:text-amber-400"
          data-testid={`stage-low-coverage-${stage.stage_code}`}
        >
          ⚠ Couverture faible ({formatPct(stage.coverage_pct)} du marché documenté) — HHI à
          interpréter avec prudence.
        </p>
      )}

      {/* Géographie : parts pays observées */}
      <div className="mt-3">
        <p className="mb-1 text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
          Géographie — {stage.country_count} pays observé(s)
        </p>
        {shares.length === 0 ? (
          <EmptyNote>Aucune part pays observée à cette étape.</EmptyNote>
        ) : (
          <ul className="space-y-1">
            {shares.map((c) => (
              <li key={c.country_code} className="flex items-center gap-2 text-xs">
                <span className="w-10 font-mono text-[var(--color-foreground)]">
                  {c.country_code}
                </span>
                <span className="w-16 font-mono text-[var(--color-muted-foreground)]">
                  {formatPct(c.share_pct)}
                </span>
                <span
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-muted)]/40"
                  aria-hidden="true"
                >
                  <span
                    className="block h-1.5 rounded-full bg-sky-500 motion-safe:transition-[width] motion-safe:duration-700"
                    style={{ width: `${Math.max(0, Math.min(100, c.share_pct))}%` }}
                  />
                </span>
                <ResourceDataStatus status={c.data_status} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-2">
        <ProvenanceRefs releaseIds={stage.source_release_ids} testId={`stage-prov-${stage.stage_code}`} />
      </div>
    </div>
  );
}

export function StageConcentrationPanel({
  stages,
}: {
  stages: ResourceStageConcentration[];
}) {
  if (stages.length === 0) {
    return (
      <EmptyNote testId="stage-concentration-empty">
        Aucune observation d&apos;offre pour cette ressource. Absence de donnée, pas absence de
        risque.
      </EmptyNote>
    );
  }
  // Étape déterminante = HHI le plus élevé (jamais une moyenne inter-étapes).
  const driving = stages.reduce((a, b) => ((b.hhi ?? 0) > (a.hhi ?? 0) ? b : a));
  const drivingShares = driving.country_shares.map((c) => ({
    country_code: c.country_code,
    share_pct: c.share_pct,
  }));
  return (
    <div className="space-y-3" data-testid="stage-concentration">
      {drivingShares.length > 0 && (
        <div className="rounded-xl border border-[var(--color-border)] p-4" data-testid="stage-choropleth">
          <p className="mb-2 text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Concentration géographique — étape déterminante&nbsp;: {driving.stage_code}
          </p>
          <ConcentrationChoropleth shares={drivingShares} testId="stage-choropleth-map" />
        </div>
      )}
      {stages.map((s) => (
        <StageCard key={`${s.stage_code}-${s.reference_year}`} stage={s} />
      ))}
    </div>
  );
}

export default StageConcentrationPanel;
