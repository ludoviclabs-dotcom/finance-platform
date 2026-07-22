/**
 * AssessmentSummaryTable — liste des runs d'assessment (Module 2, PR-M2C).
 *
 * `risk_score` et `confidence` sont dans DEUX colonnes distinctes — jamais une
 * note nette. Un `risk_score` nul s'affiche « Non calculé », jamais « 0 ». Les
 * runs sont immuables ; `superseded` reste visible (historique), distingué du
 * run courant. Purement présentationnel → testable au rendu serveur.
 */

import Link from "next/link";
import {
  confidenceBand,
  formatPct,
  riskBand,
  type ResourceAssessmentSummary,
  type RunStatus,
} from "@/lib/api/resources";
import { EmptyNote } from "./section";

const STATUS_LABEL: Record<RunStatus, string> = {
  computed: "Calculé",
  approved: "Approuvé",
  superseded: "Remplacé",
};
const STATUS_TONE: Record<RunStatus, string> = {
  computed: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30",
  approved: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  superseded: "bg-[var(--color-muted)]/40 text-[var(--color-muted-foreground)] border-[var(--color-border)]",
};

const RISK_TONE: Record<string, string> = {
  unknown: "text-[var(--color-muted-foreground)]",
  low: "text-emerald-600 dark:text-emerald-400",
  moderate: "text-amber-600 dark:text-amber-400",
  high: "text-orange-600 dark:text-orange-400",
  severe: "text-red-600 dark:text-red-400",
};
const CONF_TONE: Record<string, string> = {
  weak: "text-red-600 dark:text-red-400",
  partial: "text-amber-600 dark:text-amber-400",
  solid: "text-emerald-600 dark:text-emerald-400",
};

export function AssessmentSummaryTable({
  runs,
  linkToResource = true,
}: {
  runs: ResourceAssessmentSummary[];
  linkToResource?: boolean;
}) {
  if (runs.length === 0) {
    return (
      <EmptyNote testId="assessments-empty">
        Aucun assessment calculé. Lancez un run depuis la fiche d&apos;une ressource.
      </EmptyNote>
    );
  }
  return (
    <div className="overflow-x-auto" data-testid="assessments-table">
      <table className="w-full min-w-[720px] text-sm">
        <caption className="sr-only">Runs d&apos;assessment d&apos;exposition ressources</caption>
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left text-[11px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
            <th scope="col" className="py-2 pr-4 font-semibold">Ressource</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Année</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Risque</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Confiance</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Couverture</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Méthode</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Statut</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => {
            const risk = riskBand(r.risk_score);
            const conf = r.confidence == null ? null : confidenceBand(r.confidence);
            return (
              <tr
                key={r.run_id}
                className="border-b border-[var(--color-border)]/60"
                data-testid={`assessment-row-${r.run_id}`}
              >
                <td className="py-2 pr-4 font-medium text-[var(--color-foreground)]">
                  {linkToResource ? (
                    <Link
                      href={`/resources/${encodeURIComponent(r.resource_slug)}`}
                      className="hover:underline"
                    >
                      {r.resource_slug}
                    </Link>
                  ) : (
                    r.resource_slug
                  )}
                </td>
                <td className="py-2 pr-4 text-[var(--color-muted-foreground)]">{r.assessment_year}</td>
                <td className={`py-2 pr-4 font-mono ${RISK_TONE[risk.tone]}`} data-testid={`assessment-risk-${r.run_id}`}>
                  {r.risk_score == null ? "Non calculé" : r.risk_score.toFixed(0)}
                </td>
                <td className={`py-2 pr-4 font-mono ${conf ? CONF_TONE[conf.tone] : "text-[var(--color-muted-foreground)]"}`} data-testid={`assessment-confidence-${r.run_id}`}>
                  {r.confidence == null ? "—" : r.confidence.toFixed(0)}
                </td>
                <td className="py-2 pr-4 font-mono text-[var(--color-foreground)]">
                  {formatPct(r.coverage_pct)}
                </td>
                <td className="py-2 pr-4 font-mono text-[11px] text-[var(--color-muted-foreground)]">
                  {r.methodology_code} {r.methodology_version}
                </td>
                <td className="py-2 pr-4">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[r.status]}`}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default AssessmentSummaryTable;
