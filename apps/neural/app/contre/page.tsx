import Link from "next/link";
import { GitCompare, ArrowRight, ExternalLink } from "lucide-react";

import trayData from "@/content/contre/tray-ai.json";
import workatoData from "@/content/contre/workato.json";
import n8nData from "@/content/contre/n8n.json";
import makeData from "@/content/contre/make.json";

export const metadata = {
  title: "Comparatifs — NEURAL vs concurrents",
  description:
    "Comparatifs honnêtes de NEURAL face aux acteurs iPaaS et workflow automation : Tray.ai, Workato, n8n, Make. 16 dimensions par comparatif, verdict assumé.",
};

const COMPARATORS = [
  {
    slug: "tray-ai",
    data: trayData,
    accent: "violet",
  },
  {
    slug: "workato",
    data: workatoData,
    accent: "cyan",
  },
  {
    slug: "n8n",
    data: n8nData,
    accent: "emerald",
  },
  {
    slug: "make",
    data: makeData,
    accent: "amber",
  },
];

const ACCENT_CLS: Record<string, { border: string; bg: string; text: string; gradient: string }> = {
  violet: {
    border: "border-violet-400/25",
    bg: "bg-violet-400/[0.08]",
    text: "text-violet-200",
    gradient: "from-violet-500/[0.10] via-white/[0.04] to-violet-500/[0.04]",
  },
  cyan: {
    border: "border-cyan-400/25",
    bg: "bg-cyan-400/[0.08]",
    text: "text-cyan-200",
    gradient: "from-cyan-500/[0.10] via-white/[0.04] to-cyan-500/[0.04]",
  },
  emerald: {
    border: "border-emerald-400/25",
    bg: "bg-emerald-400/[0.08]",
    text: "text-emerald-200",
    gradient: "from-emerald-500/[0.10] via-white/[0.04] to-emerald-500/[0.04]",
  },
  amber: {
    border: "border-amber-400/25",
    bg: "bg-amber-400/[0.08]",
    text: "text-amber-200",
    gradient: "from-amber-500/[0.10] via-white/[0.04] to-amber-500/[0.04]",
  },
};

export default function ComparatorsIndexPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-emerald-500/8 blur-[120px]" />

      <section className="relative px-8 pb-12 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[1320px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
            <GitCompare className="h-3.5 w-3.5" />
            Comparatifs
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            NEURAL face aux concurrents
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/68">
            Comparatifs honnêtes face aux principaux acteurs iPaaS et workflow automation. 16
            dimensions par comparatif, sans cherry-pick : nous reconnaissons quand le concurrent
            gagne.
          </p>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="grid gap-6 md:grid-cols-2">
            {COMPARATORS.map(({ slug, data, accent }) => {
              const cls = ACCENT_CLS[accent];
              return (
                <Link
                  key={slug}
                  href={`/contre/${slug}`}
                  className={`group flex flex-col gap-4 rounded-[28px] border ${cls.border} bg-gradient-to-br ${cls.gradient} p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/30 no-underline`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${cls.border} ${cls.text}`}
                    >
                      {data.competitor.category}
                    </span>
                    <a
                      href={data.competitor.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-white/35 hover:text-white/60"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  <div>
                    <h2 className="font-display text-3xl font-bold tracking-tight text-white">
                      vs {data.competitor.name}
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-white/60">
                      {data.competitor.tagline}
                    </p>
                  </div>
                  <p className="text-sm leading-relaxed text-white/75">{data.verdict}</p>
                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/8 pt-4">
                    <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-white/40">
                      <span>{data.dimensions.length} dimensions</span>
                      <span>·</span>
                      <span>Mise à jour {data.lastUpdated}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-violet-200 opacity-80 group-hover:opacity-100">
                      <span>Voir</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-8 md:p-12">
            <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
              Méthodologie
            </h2>
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-violet-200">
                  Source publique
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  Chaque comparatif s&apos;appuie sur les pages publiques du concurrent. Aucune
                  information interne ou non vérifiable.
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">
                  Verdict assumé
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  Nous reconnaissons les domaines où le concurrent gagne. Pas de bench fabriqué.
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-200">
                  Mise à jour
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  Comparatifs revus trimestriellement ou plus tôt si le concurrent évolue
                  significativement.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
