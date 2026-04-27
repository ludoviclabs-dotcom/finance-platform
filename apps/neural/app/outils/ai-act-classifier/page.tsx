import Link from "next/link";
import { Scale, ArrowLeft } from "lucide-react";

import { AiActClassifierWizard } from "@/components/outils/ai-act-classifier-wizard";

export const metadata = {
  title: "AI Act Classifier — Outil gratuit NEURAL",
  description:
    "Classifiez votre cas d'usage IA selon l'EU AI Act en 8 questions. Résultat immédiat avec obligations applicables et plan d'action. Gratuit, sans inscription.",
};

export default function AiActClassifierPage() {
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
            <Scale className="h-3.5 w-3.5" />
            Outil gratuit
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            AI Act Classifier
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/68">
            8 questions pour classer votre cas d&apos;usage IA selon le règlement (UE) 2024/1689.
            Résultat immédiat avec les obligations applicables. Pas d&apos;inscription, pas
            d&apos;email demandé pour le résultat.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-white/35">
            <span>~2 minutes</span>
            <span>·</span>
            <span>4 niveaux possibles</span>
            <span>·</span>
            <span>Sortie : obligations + agent suggéré</span>
          </div>
        </div>
      </section>

      <section className="relative px-8 pb-24 md:px-12">
        <div className="mx-auto max-w-[920px]">
          <AiActClassifierWizard />
        </div>
      </section>
    </div>
  );
}
