import Link from "next/link";
import { Quote, ArrowRight, AlertTriangle } from "lucide-react";

import temoignagesData from "@/content/temoignages.json";
import { TestimonialWall } from "@/components/temoignages/testimonial-wall";

export const metadata = {
  title: "Mur de feedbacks — NEURAL",
  description:
    "Citations issues d'échanges en cadrage commercial avec des prospects en secteurs régulés EU. Anonymisées au niveau du rôle. Pas de faux logos clients.",
};

export default function TemoignagesPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-emerald-500/8 blur-[120px]" />

      <div className="relative border-b border-amber-400/15 bg-amber-400/[0.04] px-8 py-3 md:px-12">
        <div className="mx-auto flex max-w-[1320px] items-start gap-3">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-400" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-amber-100/80">
            <span className="font-semibold">Citations anonymisées</span> — issues
            d&apos;échanges en cadrage commercial avec des prospects en secteurs régulés EU.
            Anonymisées au niveau du rôle et du secteur. Aucun client signé public à date — quand
            nous publierons des cas clients réels, ils seront signalés explicitement et
            nominativement (sous accord du client).
          </p>
        </div>
      </div>

      <section className="relative px-8 pb-12 pt-20 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
            <Quote className="h-3.5 w-3.5" />
            Mur de feedbacks
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Ce que disent les prospects en cadrage
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/68">
            Citations courtes issues d&apos;échanges en cadrage commercial. Quatre catégories :
            méthodologie outcome, conformité &amp; gouvernance, transparence &amp; honnêteté,
            verticalisation EU. Pas de logos clients ni de citations attribuées — l&apos;anonymat
            est la condition du fond.
          </p>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <TestimonialWall
            items={temoignagesData.items}
            categories={temoignagesData.categories}
          />
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="rounded-[28px] border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.10] via-white/[0.04] to-emerald-500/[0.06] p-8 md:p-12">
            <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                  Vous avez votre propre feedback ?
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-white/65">
                  Si vous avez interagi avec NEURAL en cadrage, démo ou comparatif, vos retours
                  nous aident à affiner la plateforme. Anonymes ou attribuables — vous choisissez.
                </p>
              </div>
              <Link
                href="/contact?source=temoignages"
                className="inline-flex items-center gap-2 rounded-full bg-neural-violet px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-neural-violet/20 transition-all hover:bg-neural-violet-dark"
              >
                Partager un feedback <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
