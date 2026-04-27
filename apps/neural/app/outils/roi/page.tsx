import Link from "next/link";
import { TrendingUp, ArrowLeft } from "lucide-react";

import { RoiCalculatorWizard } from "@/components/outils/roi-calculator-wizard";

export const metadata = {
  title: "ROI Calculator — NEURAL",
  description:
    "Estimez le ROI de l'opération d'agents IA NEURAL en 4 étapes. Coût mensuel, heures économisées, ETP équivalents, payback. Hypothèses publiques transparentes.",
};

export default function RoiPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-emerald-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-neural-violet/8 blur-[120px]" />

      <section className="relative px-8 pb-12 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[920px]">
          <Link
            href="/outils"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200 hover:text-violet-100"
          >
            <ArrowLeft className="h-3 w-3" />
            Tous les outils
          </Link>
          <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            <TrendingUp className="h-3.5 w-3.5" />
            Outil gratuit
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            ROI Calculator
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/68">
            Estimation chiffrée du ROI de l&apos;opération d&apos;agents IA NEURAL : coût mensuel,
            heures économisées, ETP équivalents, payback. Hypothèses transparentes — vous voyez ce
            qui rentre dans le calcul.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-white/35">
            <span>~3 minutes</span>
            <span>·</span>
            <span>4 étapes</span>
            <span>·</span>
            <span>Calcul transparent côté client</span>
          </div>
        </div>
      </section>

      <section className="relative px-8 pb-24 md:px-12">
        <div className="mx-auto max-w-[920px]">
          <RoiCalculatorWizard />
        </div>
      </section>
    </div>
  );
}
