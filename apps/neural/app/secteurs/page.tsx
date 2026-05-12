import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, FlaskConical } from "lucide-react";

import { SECTOR_ENTRIES } from "@/lib/public-catalog";

export const metadata: Metadata = {
  title: "Secteurs | NEURAL",
  description:
    "Hub des verticales NEURAL avec statut de maturité, preuves disponibles et limites publiques.",
};

const statusIcon = {
  live: CheckCircle2,
  demo: FlaskConical,
  planned: Clock3,
} as const;

const statusLabel = {
  live: "Runtime public",
  demo: "Démo cadrée",
  planned: "Roadmap",
} as const;

export default function SecteursPage() {
  return (
    <main className="min-h-screen bg-gradient-neural text-white">
      <section className="mx-auto max-w-[1280px] px-6 pb-20 pt-32 md:px-10">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-200">
            Hub secteurs
          </p>
          <h1 className="mt-5 font-display text-4xl font-bold tracking-tight md:text-6xl">
            Les verticales NEURAL, classées par niveau de preuve.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-white/65">
            Cette page évite l'ambiguïté: certaines verticales ont du runtime ou
            des exports visibles, d'autres restent des démos ou des angles de
            roadmap. Elles ne sont pas toutes client-ready.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {SECTOR_ENTRIES.map((sector) => {
            const Icon = statusIcon[sector.status];
            return (
              <article
                key={sector.slug}
                className="flex min-h-[390px] flex-col rounded-[24px] border border-white/10 bg-white/[0.045] p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">
                      {sector.kind}
                    </p>
                    <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">
                      {sector.label}
                    </h2>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold text-white/65">
                    <Icon className="h-3.5 w-3.5" />
                    {statusLabel[sector.status]}
                  </span>
                </div>
                <p className="mt-5 text-sm font-semibold text-violet-200">
                  {sector.tagline}
                </p>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-white/62">
                  {sector.description}
                </p>
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
                    Preuve disponible
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-white/65">
                    {sector.readyNow}
                  </p>
                </div>
                <Link
                  href={sector.ctaHref}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white transition hover:text-violet-200"
                >
                  {sector.ctaLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
