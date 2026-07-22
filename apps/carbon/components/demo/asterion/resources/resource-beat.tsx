"use client";

/**
 * resource-beat.tsx — corps des 10 beats de la séquence « Dépendances
 * industrielles étendues » (MODULE 2, PR-M2D).
 *
 * Rend les VRAIS composants du cockpit /resources (ResourceIndexCard,
 * AssessmentDimensionsPanel, StageConcentrationPanel, ExposureLinksTable,
 * ModuleLinks…) alimentés par des données 100 % fictives. Le shell délègue ici
 * via `renderStepBody`. Les composants du cockpit sont thémés par variables CSS ;
 * la scène démo est sombre et NE pose PAS ces variables — on force donc des
 * valeurs sombres lisibles sur `#070909` via `DemoResourceSurface`.
 */

import { useState, type CSSProperties, type ReactNode } from "react";

import { AssessmentDimensionsPanel } from "@/components/resources/assessment-dimensions-panel";
import { DimensionBar } from "@/components/resources/dimension-bar";
import { ExposureLinksTable } from "@/components/resources/exposure-links-table";
import { MethodologyDisclaimer } from "@/components/resources/methodology-disclaimer";
import { ModuleLinks } from "@/components/resources/module-links";
import { ProvenanceRefs } from "@/components/resources/provenance";
import { RegulatoryStatusPanel } from "@/components/resources/regulatory-status-panel";
import { ResourceDataStatus } from "@/components/resources/resource-data-status";
import { ResourceIndexCard } from "@/components/resources/resource-index-card";
import { StageConcentrationPanel } from "@/components/resources/stage-concentration-panel";
import { StalenessWarning } from "@/components/intelligence/staleness-warning";
import {
  DIMENSION_LABEL,
  FAMILY_LABEL,
  SEVERITY_TONE,
  confidenceBand,
  formatPct,
} from "@/lib/api/resources";
import type { TourStep } from "@/lib/demo/asterion-motion-tour";
import {
  EXPOSURES,
  HUMAN_DECISION,
  RESOURCE_CATALOG,
  SILICON,
  SILICON_ALERT,
  SILICON_ASSESSMENT,
  SILICON_REGULATORY,
  SILICON_STAGES,
  SILICON_USES,
  SUGGESTED_ACTIONS,
} from "@/lib/demo/asterion-resources-data";

/** Force des variables `--color-*` sombres pour que les composants thémés du
 *  cockpit restent lisibles sur le fond `#070909` de la scène démo. */
function DemoResourceSurface({ children }: { children: ReactNode }) {
  const surface = {
    "--color-foreground": "#f4f4f5",
    "--color-muted-foreground": "#a1a1aa",
    "--color-border": "rgba(255,255,255,0.14)",
    "--color-muted": "rgba(255,255,255,0.10)",
    "--color-background": "transparent",
  } as CSSProperties;
  return (
    <div style={surface} className="rounded-xl">
      {children}
    </div>
  );
}

function DecisionBeat() {
  const [choice, setChoice] = useState<string | null>(null);
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4" data-testid="res-beat-decision">
      <p className="text-sm font-semibold text-white">{HUMAN_DECISION.question}</p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Décision humaine">
        {HUMAN_DECISION.options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setChoice(opt)}
            aria-pressed={choice === opt}
            data-testid={`res-decision-${opt.startsWith("Retenir") ? "keep" : opt.startsWith("Écarter") ? "drop" : "defer"}`}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              choice === opt
                ? "border-carbon-emerald bg-carbon-emerald/15 text-carbon-emerald-light"
                : "border-white/15 text-white/80 hover:bg-white/5"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-amber-200/90" data-testid="res-decision-note">
        {choice ? `Décision « ${choice} » — ` : ""}
        {HUMAN_DECISION.note}
      </p>
    </div>
  );
}

export function renderResourceBeat(step: TourStep): ReactNode {
  switch (step.beat) {
    case "detected":
      return (
        <DemoResourceSurface>
          <div data-testid="res-beat-detected">
            <ul className="grid gap-2 sm:grid-cols-2">
              {RESOURCE_CATALOG.map((r) => (
                <li
                  key={r.slug}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] p-3"
                >
                  <div>
                    <span className="text-sm font-semibold text-[var(--color-foreground)]">{r.name_fr}</span>
                    <span className="ml-2 rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted-foreground)]">
                      {FAMILY_LABEL[r.primary_family]}
                    </span>
                  </div>
                  <ResourceDataStatus status={r.data_status} />
                </li>
              ))}
            </ul>
          </div>
        </DemoResourceSurface>
      );

    case "use":
      return (
        <DemoResourceSurface>
          <ul className="space-y-2" data-testid="res-beat-use">
            {SILICON_USES.map((u) => (
              <li key={u.id} className="rounded-lg border border-[var(--color-border)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-[var(--color-foreground)]">{u.use_label}</span>
                  <ResourceDataStatus status={u.data_status} />
                </div>
                {u.sector_code && (
                  <span className="font-mono text-xs text-[var(--color-muted-foreground)]">{u.sector_code}</span>
                )}
              </li>
            ))}
          </ul>
        </DemoResourceSurface>
      );

    case "exposure":
      return (
        <DemoResourceSurface>
          <div className="space-y-4">
            <ExposureLinksTable links={EXPOSURES} />
            <ModuleLinks />
          </div>
        </DemoResourceSurface>
      );

    case "stage":
      return (
        <DemoResourceSurface>
          <StageConcentrationPanel stages={SILICON_STAGES} />
        </DemoResourceSurface>
      );

    case "source-quality":
      return (
        <DemoResourceSurface>
          <div className="space-y-3" data-testid="res-beat-source">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-[var(--color-foreground)]">{SILICON.name_fr}</span>
              <ResourceDataStatus status={SILICON.data_status} size="sm" />
            </div>
            <StalenessWarning isStale={false} ageDays={548} lastReleaseAt="2024-12-31T00:00:00Z" />
            <ProvenanceRefs releaseIds={[4201]} />
            <RegulatoryStatusPanel statuses={SILICON_REGULATORY} />
          </div>
        </DemoResourceSurface>
      );

    case "risk":
      return (
        <DemoResourceSurface>
          <div className="space-y-4">
            <ResourceIndexCard
              riskScore={SILICON_ASSESSMENT.risk_score}
              confidence={SILICON_ASSESSMENT.confidence}
              observedHhi={SILICON_ASSESSMENT.observed_hhi}
              coveragePct={SILICON_ASSESSMENT.coverage_pct}
              missingSharePct={SILICON_ASSESSMENT.missing_share_pct}
              methodologyCode={SILICON_ASSESSMENT.methodology_code}
              methodologyVersion={SILICON_ASSESSMENT.methodology_version}
              assessmentYear={SILICON_ASSESSMENT.assessment_year}
              calculatedAt={SILICON_ASSESSMENT.calculated_at}
              disclaimer={SILICON_ASSESSMENT.disclaimer}
              detailHref="#res-dims"
            />
            <div id="res-dims">
              <AssessmentDimensionsPanel
                dimensions={SILICON_ASSESSMENT.dimensions}
                riskScore={SILICON_ASSESSMENT.risk_score}
                confidence={SILICON_ASSESSMENT.confidence}
              />
            </div>
          </div>
        </DemoResourceSurface>
      );

    case "confidence": {
      const conf = SILICON_ASSESSMENT.dimensions.filter((d) => d.kind === "confidence");
      const band = confidenceBand(SILICON_ASSESSMENT.confidence ?? 0);
      return (
        <DemoResourceSurface>
          <div className="rounded-xl border border-[var(--color-border)] p-4" data-testid="res-beat-confidence">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold uppercase tracking-wide text-[var(--color-foreground)]">
                Confiance — qualité documentaire
              </span>
              <span className="font-mono text-2xl font-bold text-emerald-400">
                {SILICON_ASSESSMENT.confidence}
                <span className="text-sm text-[var(--color-muted-foreground)]">/100 · {band.label}</span>
              </span>
            </div>
            <ul className="space-y-2">
              {conf.map((d) => (
                <li key={d.dimension_code}>
                  <DimensionBar
                    label={DIMENSION_LABEL[d.dimension_code] ?? d.dimension_code}
                    valuePct={(d.raw_value ?? 0) * 100}
                    valueLabel={`${((d.raw_value ?? 0) * 100).toFixed(0)} / 100`}
                    tone="neutral"
                  />
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
              Axe distinct du risque (70,6) — jamais fusionné en une note unique.
            </p>
          </div>
        </DemoResourceSurface>
      );
    }

    case "missing":
      return (
        <DemoResourceSurface>
          <div
            className="rounded-xl border border-dashed border-[var(--color-border)] p-4"
            data-testid="res-beat-missing"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-[var(--color-foreground)]">Substituabilité</span>
              <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                Donnée manquante
              </span>
            </div>
            <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
              Aucun substitut recensé — absence de donnée, PAS absence de substitut. La composante
              est exclue du calcul et les poids restants renormalisés : jamais comptée comme un
              risque nul. Part de marché non documentée : {formatPct(SILICON_ASSESSMENT.missing_share_pct)}.
            </p>
          </div>
        </DemoResourceSurface>
      );

    case "action":
      return (
        <DemoResourceSurface>
          <div className="space-y-3" data-testid="res-beat-action">
            <div className="rounded-lg border border-[var(--color-border)] p-3">
              <span className={`text-[10px] font-semibold uppercase tracking-wide ${SEVERITY_TONE[SILICON_ALERT.severity]}`}>
                {SILICON_ALERT.severity}
              </span>
              <p className="mt-0.5 text-sm text-[var(--color-foreground)]">{SILICON_ALERT.message}</p>
            </div>
            <ul className="space-y-2">
              {SUGGESTED_ACTIONS.map((a) => (
                <li key={a.title} className="rounded-lg border border-[var(--color-border)] p-3">
                  <span className="text-sm font-medium text-[var(--color-foreground)]">↳ {a.title}</span>
                  <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">{a.detail}</p>
                </li>
              ))}
            </ul>
            <p className="text-xs text-amber-200/90">Suggestions proposées — jamais appliquées automatiquement.</p>
          </div>
        </DemoResourceSurface>
      );

    case "decision":
      return (
        <DemoResourceSurface>
          <DecisionBeat />
        </DemoResourceSurface>
      );

    default:
      return (
        <DemoResourceSurface>
          <MethodologyDisclaimer />
        </DemoResourceSurface>
      );
  }
}
