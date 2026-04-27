import Link from "next/link";
import { Map, ArrowRight } from "lucide-react";

import roadmapData from "@/content/roadmap.json";
import { RoadmapBoard } from "@/components/roadmap/roadmap-board";
import type { RoadmapItem } from "@/components/roadmap/roadmap-card";

export const metadata = {
  title: "Roadmap publique — NEURAL",
  description:
    "Ce que NEURAL construit, dans quel ordre, pour qui. Roadmap trimestrielle publique : produit, conformité, connecteurs, sectoriel, plateforme.",
};

export default function RoadmapPage() {
  const items = roadmapData.items as RoadmapItem[];
  const categories = roadmapData.categories;

  const counts = {
    shipped: items.filter((i) => i.status === "shipped").length,
    now: items.filter((i) => i.status === "now").length,
    next: items.filter((i) => i.status === "next").length,
    later: items.filter((i) => i.status === "later").length,
  };

  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-emerald-500/8 blur-[120px]" />

      <section className="relative px-8 pb-12 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[1320px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
            <Map className="h-3.5 w-3.5" />
            Roadmap publique
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Ce que nous construisons
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/68">
            Quatre colonnes, cinq catégories, zéro promesse implicite. Vous pouvez vérifier ce qui
            est livré, ce qui est en cours, et ce qui suit. Mise à jour trimestrielle, ou plus
            souvent quand un item bouge.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-4">
            <div className="rounded-[24px] border border-emerald-400/25 bg-emerald-400/[0.06] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/70">Livré</p>
              <p className="mt-3 font-display text-4xl font-bold tabular-nums text-emerald-200">
                {counts.shipped}
              </p>
              <p className="mt-1 text-xs text-white/50">Sur les 3 derniers mois</p>
            </div>
            <div className="rounded-[24px] border border-violet-400/25 bg-violet-400/[0.06] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-violet-300/70">
                En cours
              </p>
              <p className="mt-3 font-display text-4xl font-bold tabular-nums text-violet-100">
                {counts.now}
              </p>
              <p className="mt-1 text-xs text-white/50">Travaux actuels</p>
            </div>
            <div className="rounded-[24px] border border-cyan-400/25 bg-cyan-400/[0.05] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-300/70">À suivre</p>
              <p className="mt-3 font-display text-4xl font-bold tabular-nums text-cyan-100">
                {counts.next}
              </p>
              <p className="mt-1 text-xs text-white/50">Prochain trimestre</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Plus tard</p>
              <p className="mt-3 font-display text-4xl font-bold tabular-nums text-white/80">
                {counts.later}
              </p>
              <p className="mt-1 text-xs text-white/50">Après T+2</p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <RoadmapBoard items={items} categories={categories} />
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="rounded-[28px] border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.10] via-white/[0.04] to-emerald-500/[0.06] p-8 md:p-12">
            <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                  Une feature critique pour vous ?
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-white/65">
                  La priorité d&apos;un item bouge en fonction de la traction client. Si une brique
                  débloque un cas d&apos;usage chez vous, dites-nous — c&apos;est le meilleur signal
                  pour faire avancer la colonne « En cours ».
                </p>
              </div>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-full bg-neural-violet px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-neural-violet/20 transition-all hover:bg-neural-violet-dark"
              >
                Influer la priorité <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
