import Link from "next/link";
import { Sparkles, ArrowRight, Calendar } from "lucide-react";

import changelogData from "@/content/changelog.json";

export const metadata = {
  title: "Changelog — NEURAL",
  description:
    "Mises à jour produit NEURAL chronologiques : nouvelles surfaces sectorielles, agents live, outils, infrastructure. Cadence d'évolution publique et transparente.",
};

const CATEGORY_CLS: Record<string, string> = {
  Plateforme: "border-violet-400/30 bg-violet-400/[0.10] text-violet-200",
  Sectoriel: "border-emerald-400/30 bg-emerald-400/[0.10] text-emerald-300",
  Outils: "border-cyan-400/30 bg-cyan-400/[0.10] text-cyan-200",
  Conformité: "border-amber-400/25 bg-amber-400/[0.10] text-amber-200",
};

export default function ChangelogPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-emerald-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-violet-500/8 blur-[120px]" />

      <section className="relative px-8 pb-12 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[920px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            <Sparkles className="h-3.5 w-3.5" />
            Changelog
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Ce qui a changé
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/68">
            Cadence d&apos;évolution publique. Chaque entrée correspond à un livrable réel,
            daté, avec ses points-clés. Pas de marketing — la liste de ce qui est passé en
            production ou exposé publiquement.
          </p>
        </div>
      </section>

      <section className="relative px-8 pb-24 md:px-12">
        <div className="mx-auto max-w-[920px]">
          <div className="relative space-y-6 pl-8 before:absolute before:left-3 before:top-3 before:h-[calc(100%-1.5rem)] before:w-px before:bg-gradient-to-b before:from-violet-400/40 before:via-white/10 before:to-transparent">
            {changelogData.entries.map((entry) => {
              const cCls = CATEGORY_CLS[entry.category] || CATEGORY_CLS["Plateforme"];
              return (
                <article
                  key={entry.id}
                  className="relative rounded-[24px] border border-white/10 bg-white/[0.04] p-6 transition-colors hover:border-white/20"
                >
                  <span className="absolute -left-8 top-7 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-neural-midnight bg-violet-400" />
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${cCls}`}
                    >
                      {entry.category}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-white/45">
                      <Calendar className="h-3 w-3" />
                      {new Date(entry.date).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <span className="font-mono text-[10px] text-white/40">{entry.version}</span>
                  </div>
                  <h2 className="mt-3 font-display text-xl font-bold tracking-tight text-white">
                    {entry.title}
                  </h2>
                  <ul className="mt-4 space-y-2">
                    {entry.highlights.map((h) => (
                      <li key={h} className="flex gap-3 text-sm leading-relaxed text-white/70">
                        <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-violet-400" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>

          <div className="mt-12 rounded-[24px] border border-white/10 bg-white/[0.03] p-6 text-center">
            <p className="text-sm leading-relaxed text-white/60">
              Plus tôt dans l&apos;histoire ? Voir l&apos;archive Git complète sur{" "}
              <a
                href="https://github.com/ludoviclabs-dotcom/finance-platform"
                target="_blank"
                rel="noreferrer"
                className="text-violet-200 hover:text-violet-100"
              >
                GitHub
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[920px]">
          <div className="rounded-[28px] border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.10] via-white/[0.04] to-emerald-500/[0.06] p-8 md:p-12">
            <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
              <div className="max-w-xl">
                <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                  Ce qui arrive ensuite ?
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-white/65">
                  Roadmap publique trimestrielle avec les chantiers en cours, à venir, et plus
                  tard. Filtrable par catégorie.
                </p>
              </div>
              <Link
                href="/roadmap"
                className="inline-flex items-center gap-2 rounded-full bg-neural-violet px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-neural-violet/20 transition-all hover:bg-neural-violet-dark"
              >
                Voir la roadmap <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
