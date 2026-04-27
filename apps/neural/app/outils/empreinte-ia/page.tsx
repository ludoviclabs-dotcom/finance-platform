import Link from "next/link";
import { Leaf, ArrowLeft } from "lucide-react";

import { CarbonCalculator } from "@/components/outils/carbon-calculator";

export const metadata = {
  title: "Empreinte carbone IA — Calculateur NEURAL",
  description:
    "Estimez l'empreinte carbone de vos agents IA en fonction du modèle, du volume et de la région d'hébergement. Différenciant Green AI EU.",
};

export default function EmpreintePage() {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-emerald-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-cyan-500/8 blur-[120px]" />

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
            <Leaf className="h-3.5 w-3.5" />
            Green AI · Outil gratuit
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Empreinte carbone IA
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/68">
            Calculez l&apos;empreinte carbone de vos agents IA selon le modèle utilisé, le
            volume mensuel de décisions et la région d&apos;hébergement. Comparaison avec
            équivalents voiture et vol court-courrier.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-white/35">
            <span>~1 minute</span>
            <span>·</span>
            <span>5 régions · 4 modèles</span>
            <span>·</span>
            <span>Calcul transparent côté client</span>
          </div>
        </div>
      </section>

      <section className="relative px-8 pb-24 md:px-12">
        <div className="mx-auto max-w-[920px]">
          <CarbonCalculator />
        </div>
      </section>
    </div>
  );
}
