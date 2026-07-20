/**
 * MethodBadge / ConfidenceBadge — composants transverses prévus par
 * WAVE_2_INTERFACE_CONTRACTS §9 (« À INTRODUIRE »), créés par PR-05B.
 *
 * MethodBadge rend VISIBLE, sur chaque ligne, la méthode réellement employée et
 * son rang dans la hiérarchie Scope 3. La couleur suit le rang : plus on
 * descend, plus la teinte alerte. « Non résolu » est délibérément le plus
 * visible — c'est une information, pas un détail à masquer.
 *
 * ConfidenceBadge affiche la CONFIANCE (solidité du chiffre), qui n'est ni le
 * risque, ni le statut de la donnée (contrats §2). Les trois ne doivent jamais
 * être fusionnés dans un même badge.
 *
 * Thème : ces vues vivent dans le groupe `(app)`, qui supporte clair ET sombre.
 * Chaque teinte porte donc sa variante `dark:` — un badge lisible seulement en
 * sombre serait un défaut d'affichage, pas un choix.
 */

import type { CalculationMethod } from "@/lib/api/procurement";
import { METHOD_LABELS, METHOD_RANKS } from "@/lib/api/procurement";

const METHOD_CONFIG: Record<CalculationMethod, { cls: string; dot: string; help: string }> = {
  supplier_pcf_verified: {
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-500/30",
    dot: "bg-emerald-500 dark:bg-emerald-400",
    help: "Rang 1 — empreinte produit du fournisseur, vérifiée par un tiers et comparable à la ligne d'achat.",
  },
  supplier_specific_hybrid: {
    cls: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-500/30",
    dot: "bg-sky-500 dark:bg-sky-400",
    help: "Rang 2 — donnée spécifique au fournisseur (PCF auto-déclarée ou intensité GES acceptée en revue).",
  },
  average_physical: {
    cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-500/30",
    dot: "bg-amber-500 dark:bg-amber-400",
    help: "Rang 3 — facteur physique moyen appliqué à une masse ou une quantité. Précision moyenne.",
  },
  spend_based_economic: {
    cls: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-500/30",
    dot: "bg-orange-500 dark:bg-orange-400",
    help: "Rang 4 — facteur monétaire appliqué à la dépense. Précision faible : collecter une donnée fournisseur.",
  },
  unresolved: {
    cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-500/30",
    dot: "bg-red-500 dark:bg-red-400",
    help: "Rang 5 — aucune méthode applicable. Aucune émission n'est calculée pour cette ligne (ce n'est pas zéro).",
  },
};

interface MethodBadgeProps {
  method: CalculationMethod;
  /** Affiche « 3 · Facteur physique moyen » plutôt que le libellé seul. */
  showRank?: boolean;
  size?: "xs" | "sm";
  className?: string;
}

export function MethodBadge({
  method,
  showRank = true,
  size = "xs",
  className = "",
}: MethodBadgeProps) {
  const { cls, dot, help } = METHOD_CONFIG[method];
  const rank = METHOD_RANKS[method];
  const label = METHOD_LABELS[method];
  const sizeCls = size === "xs" ? "text-[10px] px-2 py-0.5 gap-1" : "text-xs px-2.5 py-1 gap-1.5";

  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold tracking-wide ${sizeCls} ${cls} ${className}`}
      title={help}
      aria-label={`Méthode de calcul : ${label} (rang ${rank} sur 5). ${help}`}
      data-testid={`method-badge-${method}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden />
      {showRank ? `${rank} · ${label}` : label}
    </span>
  );
}

interface ConfidenceBadgeProps {
  /** Confiance 0-1 (échelle backend) ou null si non mesurable. */
  confidence: number | null;
  size?: "xs" | "sm";
  className?: string;
}

export function ConfidenceBadge({
  confidence,
  size = "xs",
  className = "",
}: ConfidenceBadgeProps) {
  const sizeCls = size === "xs" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1";

  if (confidence === null) {
    return (
      <span
        className={`inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-raised)] font-semibold text-[var(--color-foreground-muted)] ${sizeCls} ${className}`}
        title="Confiance non mesurable : donnée insuffisante. Ce n'est pas une confiance nulle."
        aria-label="Confiance non mesurable, faute de données suffisantes."
        data-testid="confidence-badge-none"
      >
        Confiance n/d
      </span>
    );
  }

  const pct = Math.round(confidence * 100);
  const cls =
    pct >= 75
      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-500/30"
      : pct >= 45
        ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-500/30"
        : "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-500/30";

  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold ${sizeCls} ${cls} ${className}`}
      title="Confiance dans le chiffre — distincte du risque fournisseur et du statut de la donnée."
      aria-label={`Confiance : ${pct} sur 100. Distincte du risque et du statut de la donnée.`}
      data-testid="confidence-badge"
    >
      Confiance {pct}
    </span>
  );
}

export default MethodBadge;
