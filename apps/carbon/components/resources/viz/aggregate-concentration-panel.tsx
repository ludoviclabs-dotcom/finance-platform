"use client";

/**
 * AggregateConcentrationPanel — « Concentration d'approvisionnement », vue
 * portefeuille : principaux pays fournisseurs cumulés sur l'étape déterminante
 * de chaque ressource suivie. Complète (ne remplace pas) le choroplèthe par
 * ressource de la fiche détail — celui-ci reste la vue de référence par étape.
 *
 * Couleur = rang (pas de fausse teinte de statut ici : c'est une magnitude
 * cumulée, pas un risque). Barres classées, HHI moyen réel affiché à titre
 * indicatif (moyenne honnête via `meanOrNull`, jamais si aucune donnée).
 */

import { motion } from "framer-motion";
import type { AggregatedCountryShare } from "@/lib/resources-viz";

const RANK_COLOR = ["#FB923C", "#FBBF24", "#A3E635", "#A3E635", "#5C6B82", "#5C6B82"];

export function AggregateConcentrationPanel({
  shares,
  avgHhi,
  testId,
}: {
  shares: AggregatedCountryShare[];
  avgHhi: number | null;
  testId?: string;
}) {
  if (shares.length === 0) return null;
  const max = Math.max(...shares.map((s) => s.sharePct));

  return (
    <div data-testid={testId}>
      <ul className="flex flex-col gap-2.5">
        {shares.map((s, i) => (
          <li key={s.countryCode} className="flex items-center gap-2.5" data-testid={`agg-country-${s.countryCode}`}>
            <span className="w-20 flex-shrink-0 truncate text-sm font-medium text-[var(--color-foreground)]">
              {s.countryCode}
            </span>
            <div
              className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-raised)]"
              role="img"
              aria-label={`${s.countryCode} : ${s.sharePct.toFixed(1)} % de la concentration cumulée`}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: RANK_COLOR[Math.min(i, RANK_COLOR.length - 1)] }}
                initial={{ width: 0 }}
                animate={{ width: `${(s.sharePct / max) * 100}%` }}
                transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.04 }}
              />
            </div>
            <span className="w-11 flex-shrink-0 text-right text-xs font-semibold tabular-nums text-[var(--color-muted-foreground)]">
              {s.sharePct.toFixed(0)} %
            </span>
          </li>
        ))}
      </ul>
      {avgHhi !== null && (
        <p className="mt-4 text-[11px] leading-relaxed text-[var(--color-foreground-subtle)]">
          HHI moyen (étape déterminante par ressource) <strong style={{ color: "#FBBF24" }}>{Math.round(avgHhi)}</strong> —
          cumul indicatif entre ressources, jamais une moyenne inter-étapes d&apos;une même ressource.
        </p>
      )}
    </div>
  );
}
