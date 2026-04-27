import Link from "next/link";
import { Network, ArrowLeft } from "lucide-react";

import { OperatorScoreWizard } from "@/components/outils/operator-score-wizard";

export const metadata = {
  title: "Operator Score — quiz NEURAL",
  description:
    "12 questions sur 5 axes pour mesurer votre maturité d'opérateur d'agents IA : cadrage, données, gouvernance, orchestration MCP, ROI continu. Niveau Explorateur → Leader.",
};

export default function OperatorScorePage() {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-emerald-500/8 blur-[120px]" />

      <section className="relative px-8 pb-12 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[920px]">
          <Link
            href="/outils"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200 hover:text-violet-100"
          >
            <ArrowLeft className="h-3 w-3" />
            Tous les outils
          </Link>
          <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
            <Network className="h-3.5 w-3.5" />
            Outil gratuit · NEURAL
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Operator Score
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/68">
            12 questions sur 5 axes pour mesurer votre maturité d&apos;opérateur d&apos;agents
            IA — pas votre maturité IA générale, mais la discipline avec laquelle vous opérez vos
            agents en production. Niveau Explorateur → Leader avec plan d&apos;action 90 jours.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-white/35">
            <span>~5 minutes</span>
            <span>·</span>
            <span>5 axes · 12 questions</span>
            <span>·</span>
            <span>Plan 90 jours personnalisé</span>
          </div>
        </div>
      </section>

      <section className="relative px-8 pb-24 md:px-12">
        <div className="mx-auto max-w-[920px]">
          <OperatorScoreWizard />
        </div>
      </section>
    </div>
  );
}
