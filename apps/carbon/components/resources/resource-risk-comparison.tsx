"use client";

/**
 * ResourceRiskComparison — comparaison RANGÉE des expositions du portefeuille.
 *
 * Forme = barres classées (magnitude → barre, la lecture la plus honnête d'une
 * comparaison). Le risque porte la couleur de bande + le libellé + la valeur ;
 * la confiance est affichée SÉPARÉMENT (jamais fusionnée avec le risque). Un
 * risque non calculé s'affiche « Non calculé », jamais 0.
 *
 * `current_only=true` côté page ⇒ un run par ressource : la comparaison est donc
 * bien ressource-à-ressource.
 */

import Link from "next/link";
import { motion } from "framer-motion";

import {
  formatPct,
  riskBand,
  type ResourceAssessmentSummary,
} from "@/lib/api/resources";
import { riskToneHex } from "@/lib/resources-viz";

export function ResourceRiskComparison({ runs }: { runs: ResourceAssessmentSummary[] }) {
  const ranked = [...runs].sort((a, b) => (b.risk_score ?? -1) - (a.risk_score ?? -1));
  if (ranked.length === 0) return null;

  return (
    <section
      className="mb-6 rounded-xl border border-[var(--color-border)] p-4"
      data-testid="resource-risk-comparison"
    >
      <h2 className="mb-1 text-sm font-semibold text-[var(--color-foreground)]">
        Comparaison des expositions
      </h2>
      <p className="mb-3 text-xs text-[var(--color-muted-foreground)]">
        Score d&apos;exposition par ressource (0-100). Confiance affichée à part — jamais fusionnée
        avec le risque.
      </p>
      <ul className="space-y-2">
        {ranked.map((r) => {
          const risk = r.risk_score;
          const band = riskBand(risk);
          const color = riskToneHex(risk);
          return (
            <li
              key={r.resource_slug}
              className="flex items-center gap-3 text-xs"
              data-testid={`comparison-row-${r.resource_slug}`}
            >
              <Link
                href={`/resources/${encodeURIComponent(r.resource_slug)}`}
                className="w-28 shrink-0 truncate font-mono text-[var(--color-foreground-muted)] hover:underline"
                title={r.resource_slug}
              >
                {r.resource_slug}
              </Link>
              <div
                className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-raised)]"
                role="img"
                aria-label={`${r.resource_slug} : exposition ${risk === null ? "non calculée" : Math.round(risk)} sur 100 — ${band.label}`}
              >
                {risk !== null && (
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, risk)}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                )}
              </div>
              <span className="w-28 shrink-0 text-right tabular-nums" style={{ color }}>
                {risk === null ? "Non calculé" : `${Math.round(risk)} · ${band.label}`}
              </span>
              <span className="w-24 shrink-0 text-right tabular-nums text-[var(--color-muted-foreground)]">
                conf. {formatPct(r.confidence)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
