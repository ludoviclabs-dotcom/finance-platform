"use client";

/**
 * StatTile — chiffre-clé animé (contrat « stat tile » du guide dataviz :
 * libellé + valeur, éventuellement une ligne de contexte). PAS de delta ni de
 * sparkline : aucune série temporelle n'existe, donc on ne l'invente pas.
 *
 * Le chiffre s'anime (useCountUp) ; l'`aria-label` porte la valeur EXACTE
 * (lecteur d'écran + test statique). `value=null` → « — ».
 */

import type { ReactNode } from "react";
import { useCountUp } from "@/components/cockpit/cockpit-charts";

export function StatTile({
  label,
  value,
  suffix = "",
  decimals = 0,
  icon,
  accent = "var(--color-foreground)",
  context,
  testId,
}: {
  label: string;
  value: number | null;
  suffix?: string;
  decimals?: number;
  icon?: ReactNode;
  accent?: string;
  context?: string;
  testId?: string;
}) {
  const num = typeof value === "number" && !Number.isNaN(value) ? value : null;
  const animated = useCountUp(num ?? 0, 1000, [num]);
  // Format français : séparateur de milliers + virgule décimale (12 840 / 2,4).
  const nf = (n: number) =>
    n.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const real = num === null ? "—" : `${nf(num)}${suffix}`;
  const shown = num === null ? "—" : `${nf(animated)}${suffix}`;

  return (
    <div
      data-testid={testId}
      aria-label={`${label} : ${real}`}
      className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] px-4 py-3"
    >
      {icon && (
        <span
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-raised)]"
          style={{ color: accent }}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <div className="font-bold leading-none tabular-nums" style={{ fontSize: 22, color: accent }}>
          {shown}
        </div>
        <div className="mt-1 truncate text-[11px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {label}
        </div>
        {context && (
          <div className="truncate text-[10px] text-[var(--color-foreground-subtle)]">{context}</div>
        )}
      </div>
    </div>
  );
}
