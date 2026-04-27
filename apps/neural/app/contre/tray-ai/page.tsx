import Link from "next/link";
import { ArrowRight, GitCompare, ExternalLink } from "lucide-react";

import compareData from "@/content/contre/tray-ai.json";
import { CompareTable } from "@/components/contre/compare-table";
import { WhenToChoose } from "@/components/contre/when-to-choose";

export const metadata = {
  title: "NEURAL vs Tray.ai — Opérateur IA EU vs iPaaS US",
  description:
    "Comparatif factuel d'avril 2026 entre NEURAL (opérateur agents EU, AI Act-ready) et Tray.ai (iPaaS US, 700+ connecteurs). 16 dimensions, verdict honnête.",
};

const COLOR_CARD: Record<string, string> = {
  violet: "border-violet-400/25 bg-violet-400/[0.08]",
  emerald: "border-emerald-400/25 bg-emerald-400/[0.08]",
  amber: "border-amber-400/25 bg-amber-400/[0.08]",
};

const COLOR_LABEL: Record<string, string> = {
  violet: "text-violet-200",
  emerald: "text-emerald-300",
  amber: "text-amber-200",
};

export default function CompareTrayPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-emerald-500/8 blur-[120px]" />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative px-8 pb-12 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[1320px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
            <GitCompare className="h-3.5 w-3.5" />
            Comparatif
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            NEURAL <span className="text-white/40">vs</span> {compareData.competitor.name}
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/68">
            Comparatif factuel d&apos;avril 2026 — basé sur les pages publiques des deux acteurs.
            Pas de bench fabriqué, pas de cherry-pick : 16 dimensions documentées avec un verdict
            honnête (incluant les domaines où Tray.ai gagne).
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href={compareData.competitor.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white/70 transition-colors hover:bg-white/[0.10]"
            >
              Source : {compareData.competitor.url.replace("https://", "")}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
            <span className="text-[11px] uppercase tracking-[0.18em] text-white/35">
              Mise à jour : {compareData.lastUpdated}
            </span>
          </div>
        </div>
      </section>

      {/* ── TL;DR ────────────────────────────────────────────────────────── */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <h2 className="font-display text-3xl font-bold tracking-tight">En 30 secondes</h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {compareData.tldr.map((item, i) => (
              <div
                key={item.side}
                className={`rounded-[24px] border p-6 ${
                  COLOR_CARD[item.color] || COLOR_CARD["amber"]
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${
                      COLOR_LABEL[item.color]
                    }`}
                  >
                    {item.side === "verdict" ? "Verdict" : item.side === "tray" ? "Tray.ai" : "NEURAL"}
                  </span>
                  <span className="font-display text-2xl font-bold text-white/40 tabular-nums">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-white">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-white/70">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comparison table ─────────────────────────────────────────────── */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight">
                16 dimensions, verdict assumé
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/65">
                Honnêteté : Tray gagne sur connecteurs, profondeur produit et gouvernance mature.
                NEURAL gagne sur AI Act, hosting EU, transparence pricing, verticalisation.
              </p>
            </div>
          </div>
          <div className="mt-8">
            <CompareTable
              dimensions={compareData.dimensions as Parameters<typeof CompareTable>[0]["dimensions"]}
              competitorName={compareData.competitor.name}
            />
          </div>
        </div>
      </section>

      {/* ── When to choose ───────────────────────────────────────────────── */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight">
                Quand choisir lequel
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/65">
                Les deux options ne sont pas concurrentes — elles répondent à des besoins
                différents. Voici comment trancher pour votre contexte réel.
              </p>
            </div>
          </div>
          <div className="mt-8">
            <WhenToChoose
              competitor={compareData.whenChooseTray}
              neural={compareData.whenChooseNeural}
            />
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="rounded-[28px] border border-emerald-400/20 bg-gradient-to-br from-emerald-500/[0.10] via-white/[0.04] to-violet-500/[0.06] p-8 md:p-12">
            <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                  Audit comparatif sur votre contexte
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-white/65">
                  30 minutes pour cadrer si NEURAL est le bon choix — ou si Tray.ai (ou un autre
                  acteur) ferait mieux votre job. Sortie : recommandation argumentée écrite.
                </p>
              </div>
              <Link
                href="/contact?source=compare-tray"
                className="inline-flex items-center gap-2 rounded-full bg-emerald-500/90 px-6 py-3 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400"
              >
                Réserver l&apos;audit <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
