"use client";

/**
 * DemoStepCard — contenu d'une étape : titre, narration, métrique en avant
 * (count-up + badge de statut réel), et lien « Explorer dans l'application ».
 * L'étape IA délègue son rendu à <AiActivityTrace/> (voir DemoShell).
 *
 * `onExplore` (optionnel) remplace le simple <Link> par un bouton contrôlé —
 * utilisé quand la destination est une page protégée et doit d'abord assurer
 * une session démo (cf. DemoShell `controlledExplore`). Sans `onExplore`
 * (défaut), le lien direct historique est inchangé.
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { AnimatedCounter } from "@/components/ui/animated-counter";
import { DataStatusBadge, statusFromQuality } from "@/components/ui/data-status-badge";
import type { TourStep } from "@/lib/demo/asterion-motion-tour";
import { DemoNarration } from "./demo-narration";

interface DemoStepCardProps {
  step: TourStep;
  children?: React.ReactNode;
  onExplore?: (href: string) => void;
  exploreLoading?: boolean;
  exploreError?: string | null;
}

export function DemoStepCard({
  step,
  children,
  onExplore,
  exploreLoading = false,
  exploreError = null,
}: DemoStepCardProps) {
  const m = step.metric;
  return (
    <div className="space-y-5" data-testid={`demo-step-${step.id}`}>
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-sm text-carbon-emerald-light">
          {String(step.index).padStart(2, "0")}
        </span>
        <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">{step.title}</h2>
      </div>

      <DemoNarration stepId={step.id} text={step.narration} />

      {m && (
        <div
          className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
          data-testid="demo-metric"
        >
          <span className="font-display text-4xl font-extrabold tabular-nums text-white sm:text-5xl">
            <AnimatedCounter value={m.value} decimals={m.decimals ?? 0} />
            {m.unit ? <span className="ml-1 text-2xl text-white/60">{m.unit}</span> : null}
          </span>
          <div className="mb-1 flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-white/50">{m.label}</span>
            <div className="flex items-center gap-2">
              <DataStatusBadge status={statusFromQuality(m.status)} />
              {m.hint ? <span className="text-[11px] text-white/40">{m.hint}</span> : null}
            </div>
          </div>
        </div>
      )}

      {children}

      {onExplore ? (
        <div className="flex flex-col items-start gap-1.5">
          <button
            type="button"
            onClick={() => onExplore(step.exploreHref)}
            disabled={exploreLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-carbon-emerald/40 bg-carbon-emerald/10 px-3 py-1.5 text-sm font-medium text-carbon-emerald-light transition hover:bg-carbon-emerald/20 disabled:opacity-50"
            data-testid="demo-explore-link"
          >
            {exploreLoading ? "Ouverture…" : "Explorer dans l'application"}
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </button>
          {exploreError && (
            <p className="text-xs text-rose-300" role="alert" data-testid="demo-explore-error">
              {exploreError}
            </p>
          )}
        </div>
      ) : (
        <Link
          href={step.exploreHref}
          className="inline-flex items-center gap-1.5 rounded-lg border border-carbon-emerald/40 bg-carbon-emerald/10 px-3 py-1.5 text-sm font-medium text-carbon-emerald-light transition hover:bg-carbon-emerald/20"
          data-testid="demo-explore-link"
        >
          Explorer dans l&apos;application
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}
