/**
 * ResourceIndexCard — l'indice global, mais SECONDAIRE et DÉCOMPOSABLE
 * (Module 2, PR-M2C).
 *
 * Le brief l'exige : « Ne pas créer une unique jauge opaque. Un éventuel indice
 * global doit être secondaire, décomposable et qualifié de méthodologie CarbonCo
 * non officielle. » Cette carte respecte les trois points :
 *   1. secondaire — libellé « indice secondaire », renvoi explicite vers le détail ;
 *   2. décomposable — n'affiche JAMAIS un seul chiffre : risque ET confiance
 *      côte à côte, HHI, couverture, part manquante ;
 *   3. non officielle — `MethodologyDisclaimer` intégré.
 *
 * Le risque peut être « Non calculé » (données obligatoires manquantes) — jamais
 * un nombre inventé — pendant que la confiance reste affichée.
 *
 * Purement présentationnel → testable au rendu serveur.
 */

import {
  confidenceBand,
  formatPct,
  hhiBand,
  riskBand,
} from "@/lib/api/resources";
import { MethodologyDisclaimer } from "./methodology-disclaimer";

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

export function ResourceIndexCard({
  riskScore,
  confidence,
  observedHhi,
  coveragePct,
  missingSharePct,
  methodologyCode,
  methodologyVersion,
  assessmentYear,
  calculatedAt,
  disclaimer,
  detailHref,
}: {
  riskScore: number | null;
  confidence: number | null;
  observedHhi?: number | null;
  coveragePct?: number | null;
  missingSharePct?: number | null;
  methodologyCode: string;
  methodologyVersion: string;
  assessmentYear?: number;
  calculatedAt?: string | null;
  disclaimer?: string;
  detailHref?: string;
}) {
  const risk = riskBand(riskScore);
  const conf = confidence == null ? null : confidenceBand(confidence);
  const hhi = hhiBand(observedHhi ?? null);

  return (
    <div
      className="rounded-xl border border-[var(--color-border)] p-4"
      data-testid="resource-index-card"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          Indice secondaire · décomposable
        </span>
        <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
          {methodologyCode} {methodologyVersion}
        </span>
        {assessmentYear != null && (
          <span className="text-[10px] text-[var(--color-muted-foreground)]">
            Année {assessmentYear}
          </span>
        )}
      </div>

      {/* Risque ET confiance CÔTE À CÔTE — jamais un chiffre unique. */}
      <div className="grid grid-cols-2 gap-4">
        <div data-testid="index-risk">
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Risque (intensité)
          </p>
          <p className={`font-mono text-3xl font-bold ${RISK_TONE[risk.tone]}`}>
            {riskScore == null ? "—" : riskScore.toFixed(0)}
            {riskScore != null && (
              <span className="text-base font-normal text-[var(--color-muted-foreground)]">/100</span>
            )}
          </p>
          <p className={`text-xs font-semibold ${RISK_TONE[risk.tone]}`}>{risk.label}</p>
        </div>
        <div data-testid="index-confidence">
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Confiance (documentation)
          </p>
          <p
            className={`font-mono text-3xl font-bold ${conf ? CONF_TONE[conf.tone] : "text-[var(--color-muted-foreground)]"}`}
          >
            {confidence == null ? "—" : confidence.toFixed(0)}
            {confidence != null && (
              <span className="text-base font-normal text-[var(--color-muted-foreground)]">/100</span>
            )}
          </p>
          <p
            className={`text-xs font-semibold ${conf ? CONF_TONE[conf.tone] : "text-[var(--color-muted-foreground)]"}`}
          >
            {conf ? conf.label : "n. d."}
          </p>
        </div>
      </div>

      {/* Grandeurs qui interdisent la lecture « une seule note » */}
      <dl className="mt-3 grid grid-cols-3 gap-3 border-t border-[var(--color-border)] pt-3 text-xs">
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
            HHI (étape retenue)
          </dt>
          <dd className="font-mono text-[var(--color-foreground)]">
            {observedHhi == null ? "n. d." : `${observedHhi} · ${hhi.label}`}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Couverture marché
          </dt>
          <dd className="font-mono text-[var(--color-foreground)]">{formatPct(coveragePct)}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Part manquante
          </dt>
          <dd className="font-mono text-[var(--color-foreground)]">{formatPct(missingSharePct)}</dd>
        </div>
      </dl>

      {riskScore == null && (
        <p
          className="mt-3 rounded border border-[var(--color-border)] bg-[var(--color-muted)]/20 p-2 text-xs text-[var(--color-muted-foreground)]"
          data-testid="index-risk-uncomputed"
        >
          Indice de risque <span className="font-semibold">non calculé</span> : aucune donnée
          obligatoire de concentration disponible. Un indice inventé serait pire qu'une absence
          d'indice — la confiance reste néanmoins mesurée.
        </p>
      )}

      {detailHref && (
        <p className="mt-3 text-xs text-[var(--color-muted-foreground)]" data-testid="index-decompose-hint">
          Indice décomposable — voir le détail par composante ci-dessous.
        </p>
      )}

      <MethodologyDisclaimer text={disclaimer} className="mt-3" />

      {calculatedAt && (
        <p className="mt-2 text-[10px] text-[var(--color-muted-foreground)]">
          Run immuable calculé le {new Date(calculatedAt).toLocaleString("fr-FR")}.
        </p>
      )}
    </div>
  );
}

export default ResourceIndexCard;
