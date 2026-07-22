"use client";

/**
 * RadialGauge — jauge radiale SVG sans dépendance (motif `ScoreRing` du cockpit).
 *
 * La couleur de l'arc porte la SÉVÉRITÉ (bande de risque/HHI) ; elle est toujours
 * accompagnée d'un libellé de bande dans l'appelant → jamais la couleur seule.
 * `value=null` (score non calculé) affiche « n.c. » en gris, jamais 0.
 *
 * Accessibilité + testabilité : `role="img"` + `aria-label` portent la VRAIE
 * valeur (le chiffre visible s'anime via useCountUp, mais l'aria-label reste
 * exact — donc lisible au lecteur d'écran et vérifiable en test statique).
 */

import { useCountUp } from "@/components/cockpit/cockpit-charts";

export function RadialGauge({
  value,
  max = 100,
  color,
  size = 64,
  stroke = 6,
  suffix = "",
  bandLabel,
  ariaTitle,
  testId,
}: {
  value: number | null;
  max?: number;
  color: string;
  size?: number;
  stroke?: number;
  suffix?: string;
  bandLabel?: string;
  ariaTitle: string;
  testId?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const isNull = value === null || Number.isNaN(value);
  const clamped = isNull ? 0 : Math.max(0, Math.min(max, value));
  const animated = useCountUp(clamped, 1000, [clamped]);
  const offset = circ - (max > 0 ? animated / max : 0) * circ;

  const label = isNull ? "Non calculé" : `${Math.round(clamped)}${suffix}`;

  return (
    <div
      role="img"
      aria-label={`${ariaTitle} : ${label}${bandLabel ? ` — ${bandLabel}` : ""}`}
      data-testid={testId}
      className="relative inline-flex flex-shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={stroke}
        />
        {!isNull && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: "stroke-dashoffset .4s ease" }}
          />
        )}
      </svg>
      <span
        className="absolute font-bold leading-none tabular-nums"
        style={{
          fontSize: size * 0.3,
          color: isNull ? "var(--color-muted-foreground)" : "var(--color-foreground)",
        }}
      >
        {isNull ? "n.c." : `${Math.round(animated)}`}
      </span>
    </div>
  );
}
