import Link from "next/link";
import { Award, ArrowLeft } from "lucide-react";

import { MaturityQuizWizard } from "@/components/outils/maturity-quiz-wizard";

export const metadata = {
  title: "Audit Maturité IA — Quiz NEURAL",
  description:
    "12 questions pour mesurer la maturité IA de votre organisation sur 5 axes : cadrage, données, gouvernance, déploiement, ROI. Score, profil, plan d'action 90 jours.",
};

export default function MaturityPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-cyan-500/10 blur-[140px]" />
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
          <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
            <Award className="h-3.5 w-3.5" />
            Outil gratuit
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Audit Maturité IA
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/68">
            12 questions pour mesurer où en est votre organisation sur 5 axes : cadrage,
            données, gouvernance, déploiement, ROI. Vous recevez votre niveau (Explorateur /
            Constructeur / Opérateur / Leader) et un plan d&apos;action 90 jours.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-white/35">
            <span>~5 minutes</span>
            <span>·</span>
            <span>5 axes scorés</span>
            <span>·</span>
            <span>Plan d&apos;action personnalisé</span>
          </div>
        </div>
      </section>

      <section className="relative px-8 pb-24 md:px-12">
        <div className="mx-auto max-w-[920px]">
          <MaturityQuizWizard />
        </div>
      </section>
    </div>
  );
}
