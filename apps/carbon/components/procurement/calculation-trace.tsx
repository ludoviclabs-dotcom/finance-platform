/**
 * CalculationTrace — composant transverse prévu par WAVE_2_INTERFACE_CONTRACTS
 * §9 (« À INTRODUIRE »), créé par PR-05B.
 *
 * Affiche le drill-down complet d'une ligne : achat → fournisseur → produit →
 * BOM → matière → facteur → preuve, ET la hiérarchie de méthode réellement
 * parcourue (pourquoi chaque niveau supérieur a été écarté).
 *
 * Le second bloc est le cœur de la promesse « aucun repli silencieux » : il ne
 * suffit pas de dire quelle méthode a servi, il faut montrer pourquoi les
 * meilleures n'étaient pas applicables.
 */

import type { CalculationTrace as TraceData } from "@/lib/api/procurement";
import { METHOD_LABELS } from "@/lib/api/procurement";
import { DataStatusBadge, dataStatusToBadge } from "@/components/ui/data-status-badge";
import { MethodBadge } from "./method-badge";

const LEVEL_LABELS: Record<string, string> = {
  purchase_line: "Ligne d'achat",
  supplier: "Fournisseur",
  supplier_product: "Produit fournisseur",
  bom_item: "Composant (BOM)",
  material: "Matière",
  factor: "Facteur d'émission",
  evidence: "Pièce justificative",
};

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return new Intl.NumberFormat("fr-FR").format(value);
  return String(value);
}

interface Props {
  trace: TraceData;
}

export function CalculationTrace({ trace }: Props) {
  return (
    <div className="space-y-6" data-testid="calculation-trace">
      {/* En-tête : méthode retenue et, s'il y a lieu, la raison du repli. */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <MethodBadge method={trace.calculation_method} size="sm" />
          <span className="text-sm text-[var(--color-foreground)]">
            {trace.result_tco2e === null ? (
              <span className="text-red-600 dark:text-red-400">
                Aucune émission calculée — donnée manquante, pas une valeur nulle.
              </span>
            ) : (
              <>
                {new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 4 }).format(
                  trace.result_tco2e,
                )}{" "}
                tCO₂e
              </>
            )}
          </span>
        </div>

        {trace.fallback_reason && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-900/10">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Raison du repli
            </p>
            <p className="mt-1 text-sm text-[var(--color-foreground)]">{trace.fallback_reason}</p>
          </div>
        )}

        {trace.warnings.length > 0 && (
          <ul className="mt-3 space-y-1" aria-label="Avertissements de la ligne">
            {trace.warnings.map((w, i) => (
              <li key={i} className="text-xs text-amber-700 dark:text-amber-300">
                ⚠ {w}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Hiérarchie parcourue : chaque niveau essayé, retenu ou écarté. */}
      <section aria-labelledby="trace-hierarchy-title">
        <h3
          id="trace-hierarchy-title"
          className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-foreground-muted)]"
        >
          Hiérarchie de méthode parcourue
        </h3>
        <ol className="mt-2 space-y-1.5">
          {trace.method_trace.map((step) => (
            <li
              key={step.rank}
              className={`flex gap-3 rounded-lg border px-3 py-2 text-sm ${
                step.outcome === "selected"
                  ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-900/10"
                  : "border-[var(--color-border)] bg-[var(--color-surface-raised)]"
              }`}
              data-testid={`method-step-${step.rank}`}
            >
              <span className="font-mono text-xs text-[var(--color-foreground-subtle)]">
                {step.rank}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[var(--color-foreground)]">
                  {METHOD_LABELS[step.method as keyof typeof METHOD_LABELS] ?? step.method}
                  <span
                    className={`ml-2 text-[10px] font-semibold uppercase ${
                      step.outcome === "selected"
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-[var(--color-foreground-subtle)]"
                    }`}
                  >
                    {step.outcome === "selected" ? "retenue" : "écartée"}
                  </span>
                </p>
                <p className="mt-0.5 break-words text-xs text-[var(--color-foreground-muted)]">
                  {step.reason}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Drill-down des maillons de données. */}
      <section aria-labelledby="trace-steps-title">
        <h3
          id="trace-steps-title"
          className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-foreground-muted)]"
        >
          Chaîne de données
        </h3>
        <ol className="mt-2 space-y-2">
          {trace.steps.map((step, i) => (
            <li
              key={`${step.level}-${step.reference ?? i}`}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2"
              data-testid={`trace-step-${step.level}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-foreground-subtle)]">
                  {LEVEL_LABELS[step.level] ?? step.level}
                </span>
                <span className="text-sm font-medium text-[var(--color-foreground)]">
                  {step.label}
                </span>
                {step.data_status && (
                  <DataStatusBadge status={dataStatusToBadge(step.data_status)} />
                )}
                {step.observed_at && (
                  <span className="text-xs text-[var(--color-foreground-muted)]">
                    {step.observed_at}
                  </span>
                )}
              </div>

              {Object.keys(step.detail).length > 0 && (
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                  {Object.entries(step.detail).map(([key, value]) => (
                    <div key={key} className="min-w-0">
                      <dt className="truncate text-[10px] uppercase tracking-wide text-[var(--color-foreground-subtle)]">
                        {key}
                      </dt>
                      <dd
                        className="truncate text-xs text-[var(--color-foreground)]"
                        title={formatDetailValue(value)}
                      >
                        {formatDetailValue(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}

              {step.evidence_artifact_id && (
                <p className="mt-2 text-xs text-sky-700 dark:text-sky-300">
                  Pièce #{step.evidence_artifact_id}
                  {step.source_release_id ? ` · release #${step.source_release_id}` : ""}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export default CalculationTrace;
