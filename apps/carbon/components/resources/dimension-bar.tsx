/**
 * DimensionBar — barre de contribution DÉCOMPOSÉE (Module 2, PR-M2C).
 *
 * Brique anti-« jauge opaque » : chaque composante du score a SA propre barre,
 * avec sa valeur en toutes lettres à côté (jamais dépendante du visuel). La
 * transition de largeur est gardée par `motion-safe:` — donc automatiquement
 * désactivée sous `prefers-reduced-motion: reduce`, sans JavaScript.
 *
 * Purement présentationnel → testable au rendu serveur.
 */

export type BarTone = "unknown" | "low" | "moderate" | "high" | "severe" | "neutral";

const TONE_BG: Record<BarTone, string> = {
  unknown: "bg-[var(--color-muted-foreground)]/40",
  low: "bg-emerald-500",
  moderate: "bg-amber-500",
  high: "bg-orange-500",
  severe: "bg-red-500",
  neutral: "bg-sky-500",
};

const TONE_TEXT: Record<BarTone, string> = {
  unknown: "text-[var(--color-muted-foreground)]",
  low: "text-emerald-600 dark:text-emerald-400",
  moderate: "text-amber-600 dark:text-amber-400",
  high: "text-orange-600 dark:text-orange-400",
  severe: "text-red-600 dark:text-red-400",
  neutral: "text-sky-600 dark:text-sky-400",
};

function clampPct(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

export function DimensionBar({
  label,
  /** Largeur de la barre en % (0-100). */
  valuePct,
  /** Texte de la valeur affiché à droite (ex. « 42,0 / 100 », « HHI 6400 »). */
  valueLabel,
  tone = "neutral",
  testId,
}: {
  label: string;
  valuePct: number;
  valueLabel: string;
  tone?: BarTone;
  testId?: string;
}) {
  const width = clampPct(valuePct);
  return (
    <div data-testid={testId} className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-[var(--color-foreground)]">{label}</span>
        <span className={`font-mono font-semibold ${TONE_TEXT[tone]}`}>{valueLabel}</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-[var(--color-muted)]/40"
        aria-hidden="true"
      >
        <div
          className={`h-2 rounded-full ${TONE_BG[tone]} motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export default DimensionBar;
