import Link from "next/link";
import { Briefcase, ArrowRight, AlertTriangle } from "lucide-react";

import banqueDora from "@/content/cas-types/banque-dora.json";
import luxeCsrd from "@/content/cas-types/luxe-csrd.json";
import aeroEasa from "@/content/cas-types/aero-easa.json";

export const metadata = {
  title: "Cas-types sectoriels — NEURAL",
  description:
    "Cas-types méthodologiques NEURAL : Banque DORA, Luxe CSRD, Aéronautique EASA. Illustration de la démarche, pas des clients signés. Méthodologie chiffrée et calendriers réalistes.",
};

const CAS_LIST = [
  { slug: "banque-dora", data: banqueDora, accent: "cyan" },
  { slug: "luxe-csrd", data: luxeCsrd, accent: "violet" },
  { slug: "aero-easa", data: aeroEasa, accent: "amber" },
];

const ACCENT_CLS: Record<string, { border: string; bg: string; text: string; gradient: string }> = {
  cyan: {
    border: "border-cyan-400/25",
    bg: "bg-cyan-400/[0.08]",
    text: "text-cyan-200",
    gradient: "from-cyan-500/[0.10] via-white/[0.04] to-cyan-500/[0.04]",
  },
  violet: {
    border: "border-violet-400/25",
    bg: "bg-violet-400/[0.08]",
    text: "text-violet-200",
    gradient: "from-violet-500/[0.10] via-white/[0.04] to-violet-500/[0.04]",
  },
  amber: {
    border: "border-amber-400/25",
    bg: "bg-amber-400/[0.08]",
    text: "text-amber-200",
    gradient: "from-amber-500/[0.10] via-white/[0.04] to-amber-500/[0.04]",
  },
};

export default function CasTypesIndexPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-emerald-500/8 blur-[120px]" />

      <div className="relative border-b border-amber-400/15 bg-amber-400/[0.04] px-8 py-3 md:px-12">
        <div className="mx-auto flex max-w-[1320px] items-start gap-3">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-400" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-amber-100/80">
            <span className="font-semibold">Cas-types méthodologiques</span> — illustrations de la
            démarche NEURAL appliquée à des contextes sectoriels types. Pas des clients signés.
            Quand nous publierons des cas clients réels, ils seront signalés explicitement.
          </p>
        </div>
      </div>

      <section className="relative px-8 pb-12 pt-20 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
            <Briefcase className="h-3.5 w-3.5" />
            Cas-types
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Méthodologie illustrée
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/68">
            Trois contextes sectoriels types, trois démarches NEURAL chiffrées. Chaque cas-type
            détaille le défi initial, la méthodologie en 4 phases, les agents mobilisés, les
            métriques cibles et le calendrier 30/60/90 jours.
          </p>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {CAS_LIST.map(({ slug, data, accent }) => {
              const cls = ACCENT_CLS[accent];
              return (
                <Link
                  key={slug}
                  href={`/cas-types/${slug}`}
                  className={`group flex flex-col gap-4 rounded-[28px] border ${cls.border} bg-gradient-to-br ${cls.gradient} p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/30 no-underline`}
                >
                  <span
                    className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${cls.border} ${cls.text}`}
                  >
                    {data.hero.icon} · {data.regulation}
                  </span>
                  <h2 className="font-display text-2xl font-bold tracking-tight text-white">
                    {data.hero.title}
                  </h2>
                  <p className="text-sm leading-relaxed text-white/60">{data.hero.subtitle}</p>
                  <div className="mt-auto space-y-2 border-t border-white/8 pt-4">
                    <div className="flex items-baseline justify-between text-[11px] uppercase tracking-[0.16em]">
                      <span className="text-white/40">Agents mobilisés</span>
                      <span className="text-white/70">{data.agentsUsed.length}</span>
                    </div>
                    <div className="flex items-baseline justify-between text-[11px] uppercase tracking-[0.16em]">
                      <span className="text-white/40">Phases méthodo</span>
                      <span className="text-white/70">{data.methodology.phases.length}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-violet-200 opacity-80 group-hover:opacity-100">
                    <span>Voir le cas-type</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
