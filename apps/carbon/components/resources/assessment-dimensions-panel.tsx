/**
 * AssessmentDimensionsPanel — LA décomposition de l'indice (Module 2, PR-M2C).
 *
 * Refuse la « jauge opaque » exigée par le brief : chaque composante a sa barre,
 * sa valeur chiffrée, son poids, sa provenance et son rationnel. Le RISQUE et la
 * CONFIANCE sont dans deux colonnes SÉPARÉES (jamais fusionnés). Une composante
 * `available=false` est rendue « Donnée manquante » — jamais comme un risque nul.
 *
 * Purement présentationnel (aucun hook) → testable au rendu serveur.
 */

import {
  DIMENSION_LABEL,
  riskBand,
  type ResourceDimension,
} from "@/lib/api/resources";
import { DimensionBar } from "./dimension-bar";
import { ProvenanceRefs } from "./provenance";

function label(code: string): string {
  return DIMENSION_LABEL[code] ?? code;
}

function RiskRow({ dim }: { dim: ResourceDimension }) {
  if (!dim.available) {
    return (
      <li
        className="rounded-lg border border-dashed border-[var(--color-border)] p-3"
        data-testid={`risk-dim-${dim.dimension_code}`}
        data-available="false"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-[var(--color-foreground)]">
            {label(dim.dimension_code)}
          </span>
          <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Donnée manquante
          </span>
        </div>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Exclue du calcul, poids renormalisés — jamais comptée comme risque nul.
          {dim.rationale ? ` ${dim.rationale}` : ""}
        </p>
      </li>
    );
  }

  const value = dim.risk_value ?? 0;
  const band = riskBand(value);
  const weightPct = dim.weight != null ? Math.round(dim.weight * 100) : null;
  const contribution = dim.contribution;
  return (
    <li
      className="rounded-lg border border-[var(--color-border)] p-3"
      data-testid={`risk-dim-${dim.dimension_code}`}
      data-available="true"
    >
      <DimensionBar
        label={label(dim.dimension_code)}
        valuePct={value}
        valueLabel={`${value.toFixed(0)} / 100`}
        tone={band.tone}
        testId={`risk-bar-${dim.dimension_code}`}
      />
      <p className="mt-1.5 text-[11px] text-[var(--color-muted-foreground)]">
        {weightPct != null && <span>Poids {weightPct} %</span>}
        {contribution != null && <span> · contribue {contribution.toFixed(1)} pts</span>}
        {dim.stage_code && <span> · étape {dim.stage_code}</span>}
        {dim.raw_value != null && dim.raw_unit && (
          <span>
            {" · "}
            {dim.raw_value} {dim.raw_unit}
          </span>
        )}
      </p>
      {dim.rationale && (
        <p className="mt-1 text-xs text-[var(--color-foreground)]/80">{dim.rationale}</p>
      )}
      <div className="mt-1.5">
        <ProvenanceRefs releaseIds={dim.source_release_ids} testId={`risk-prov-${dim.dimension_code}`} />
      </div>
    </li>
  );
}

function ConfidenceRow({ dim }: { dim: ResourceDimension }) {
  // La confiance est toujours calculée ; `raw_value` est une fraction 0-1.
  const pct = (dim.raw_value ?? 0) * 100;
  const weightPct = dim.weight != null ? Math.round(dim.weight * 100) : null;
  return (
    <li
      className="rounded-lg border border-[var(--color-border)] p-3"
      data-testid={`confidence-dim-${dim.dimension_code}`}
    >
      <DimensionBar
        label={label(dim.dimension_code)}
        valuePct={pct}
        valueLabel={`${pct.toFixed(0)} / 100`}
        tone="neutral"
        testId={`confidence-bar-${dim.dimension_code}`}
      />
      <p className="mt-1.5 text-[11px] text-[var(--color-muted-foreground)]">
        {weightPct != null && <span>Poids {weightPct} % · </span>}
        {dim.rationale}
      </p>
      <div className="mt-1.5">
        <ProvenanceRefs
          releaseIds={dim.source_release_ids}
          testId={`confidence-prov-${dim.dimension_code}`}
        />
      </div>
    </li>
  );
}

export function AssessmentDimensionsPanel({
  dimensions,
  riskScore,
  confidence,
}: {
  dimensions: ResourceDimension[];
  riskScore?: number | null;
  confidence?: number | null;
}) {
  const risk = dimensions.filter((d) => d.kind === "risk");
  const conf = dimensions.filter((d) => d.kind === "confidence");
  const missing = risk.filter((d) => !d.available).map((d) => label(d.dimension_code));

  return (
    <div className="grid gap-6 lg:grid-cols-2" data-testid="assessment-dimensions">
      {/* Colonne RISQUE */}
      <div data-testid="assessment-risk-dimensions">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-foreground)]">
            Risque — intensité (0-100)
          </h3>
          <span className="font-mono text-sm text-[var(--color-foreground)]">
            {riskScore == null ? "Non calculé" : riskScore.toFixed(0)}
          </span>
        </div>
        {risk.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">Aucune composante de risque.</p>
        ) : (
          <ul className="space-y-2">
            {risk.map((d) => (
              <RiskRow key={d.dimension_code} dim={d} />
            ))}
          </ul>
        )}
      </div>

      {/* Colonne CONFIANCE — séparée, jamais fusionnée avec le risque */}
      <div data-testid="assessment-confidence-dimensions">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-foreground)]">
            Confiance — qualité documentaire (0-100)
          </h3>
          <span className="font-mono text-sm text-[var(--color-foreground)]">
            {confidence == null ? "—" : confidence.toFixed(0)}
          </span>
        </div>
        {conf.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Aucune composante de confiance.
          </p>
        ) : (
          <ul className="space-y-2">
            {conf.map((d) => (
              <ConfidenceRow key={d.dimension_code} dim={d} />
            ))}
          </ul>
        )}
      </div>

      {missing.length > 0 && (
        <p
          className="lg:col-span-2 text-xs text-[var(--color-muted-foreground)]"
          data-testid="assessment-missing-note"
        >
          <span className="font-semibold">Données manquantes :</span> {missing.join(", ")}. Ces
          composantes sont exclues et les poids restants renormalisés — une donnée absente n'est
          jamais comptée comme un risque nul.
        </p>
      )}
    </div>
  );
}

export default AssessmentDimensionsPanel;
