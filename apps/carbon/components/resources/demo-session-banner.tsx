"use client";

/**
 * Bandeau de contexte affiché en tête de /resources quand la session est une
 * démonstration produit (tenant Asterion). Rappelle sans ambiguïté que les
 * données sont synthétiques mais calculées par le VRAI moteur CarbonCo (aucun
 * appel IA live), et propose de rejouer le parcours guidé.
 *
 * Purement présentationnel : la décision de l'afficher (session démo) est prise
 * par la page via `useIsDemoSession()`.
 */

import Link from "next/link";
import { FlaskConical, ArrowRight } from "lucide-react";

export function DemoSessionBanner() {
  return (
    <div
      data-testid="resources-demo-banner"
      className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3"
    >
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
        <FlaskConical className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-amber-600 dark:text-amber-400">
          ENVIRONNEMENT DE DÉMONSTRATION
        </p>
        <p className="text-sm font-semibold text-[var(--color-foreground)]">Asterion Motion</p>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Données synthétiques · moteur CarbonCo réel · aucun appel IA live
        </p>
      </div>
      <Link
        href="/demo/asterion-resources"
        data-testid="resources-demo-tour-link"
        className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-500/10 dark:text-amber-300"
      >
        Revoir le parcours guidé
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
