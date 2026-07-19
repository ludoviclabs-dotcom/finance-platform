/**
 * SupplierScoreCard — les CINQ dimensions d'un fournisseur, affichées
 * SÉPARÉMENT (PR-05B).
 *
 * Ce composant ne calcule aucune moyenne et ne doit jamais en calculer : la
 * fusion des cinq dimensions produirait le score ESG opaque que le plan
 * d'architecture interdit (§1.10). Chaque carte porte donc :
 *   - sa valeur, avec le SENS de lecture (haut = bon, ou haut = risqué) ;
 *   - sa confiance, distincte de la valeur ;
 *   - la base de calcul, en clair ;
 *   - ses avertissements.
 *
 * Une dimension sans donnée affiche « non mesurable » et non « 0 » : un trou
 * d'information n'est pas une mauvaise performance.
 */

import type { ScoreDimension, SupplierScoreCard as ScoreCard } from "@/lib/api/procurement";

function DimensionCard({ dimension }: { dimension: ScoreDimension }) {
  const riskier = dimension.direction === "higher_is_riskier";
  const hasValue = dimension.value !== null;

  // La couleur suit le SENS de la dimension, pas la valeur brute : 80 en
  // maturité de preuve est vert, 80 en concentration est rouge.
  const tone = !hasValue
    ? "text-[var(--color-foreground-muted)]"
    : riskier
      ? dimension.value! >= 60
        ? "text-red-600 dark:text-red-400"
        : dimension.value! >= 30
          ? "text-amber-600 dark:text-amber-400"
          : "text-emerald-600 dark:text-emerald-400"
      : dimension.value! >= 70
        ? "text-emerald-600 dark:text-emerald-400"
        : dimension.value! >= 40
          ? "text-amber-600 dark:text-amber-400"
          : "text-red-600 dark:text-red-400";

  return (
    <article
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
      data-testid={`score-dimension-${dimension.code}`}
    >
      <header className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--color-foreground)]">{dimension.label}</h3>
        <span
          className="shrink-0 rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--color-foreground-muted)]"
          title={
            riskier
              ? "Une valeur élevée signale une exposition forte."
              : "Une valeur élevée est favorable."
          }
        >
          {riskier ? "↑ = risque" : "↑ = favorable"}
        </span>
      </header>

      <p className={`mt-3 text-3xl font-semibold tabular-nums ${tone}`}>
        {hasValue ? (
          <>
            {new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(dimension.value!)}
            <span className="ml-1 text-sm font-normal text-[var(--color-foreground-muted)]">
              / 100
            </span>
          </>
        ) : (
          <span className="text-base font-normal text-[var(--color-foreground-muted)]">
            Non mesurable
          </span>
        )}
      </p>

      <p className="mt-2 text-xs text-[var(--color-foreground-muted)]">{dimension.basis}</p>

      <p className="mt-2 text-[11px] text-[var(--color-foreground-subtle)]">
        Confiance :{" "}
        {dimension.confidence === null
          ? "n/d"
          : `${Math.round(dimension.confidence * 100)} / 100`}{" "}
        — distincte de la valeur mesurée
      </p>

      {dimension.warnings.length > 0 && (
        <ul className="mt-3 space-y-1" aria-label={`Avertissements — ${dimension.label}`}>
          {dimension.warnings.map((w, i) => (
            <li key={i} className="text-xs text-amber-700 dark:text-amber-300">
              ⚠ {w}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

interface Props {
  card: ScoreCard;
}

export function SupplierScoreCard({ card }: Props) {
  return (
    <section aria-labelledby="scorecard-title" data-testid="supplier-scorecard">
      <h2 id="scorecard-title" className="text-lg font-semibold text-[var(--color-foreground)]">
        Profil fournisseur — {card.supplier_name ?? `#${card.supplier_id}`}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-[var(--color-foreground-muted)]">{card.note}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {card.dimensions.map((d) => (
          <DimensionCard key={d.code} dimension={d} />
        ))}
      </div>
    </section>
  );
}

export default SupplierScoreCard;
