import Link from "next/link";
import { Scale, FileText, ListChecks, ArrowRight, ShieldCheck } from "lucide-react";

import aiActData from "@/content/conformite/ai-act.json";
import doraData from "@/content/conformite/dora.json";
import csrdData from "@/content/conformite/csrd.json";
import rgpdAgentsData from "@/content/conformite/rgpd-agents.json";

export const metadata = {
  title: "Conformité — NEURAL",
  description:
    "Pages conformité NEURAL : EU AI Act, DORA, CSRD, RGPD pour agents IA. Pour chaque cadre : commitments concrets, articles applicables, ce que NEURAL fait / ne fait pas.",
};

const REGS = [
  { slug: "ai-act", data: aiActData, accent: "violet", Icon: Scale },
  { slug: "dora", data: doraData, accent: "cyan", Icon: ListChecks },
  { slug: "csrd", data: csrdData, accent: "emerald", Icon: FileText },
  { slug: "rgpd-agents", data: rgpdAgentsData, accent: "amber", Icon: ShieldCheck },
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

export default function ConformiteIndexPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-emerald-500/8 blur-[120px]" />

      <section className="relative px-8 pb-12 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[1320px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
            <Scale className="h-3.5 w-3.5" />
            Conformité
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Cadres réglementaires &amp; NEURAL
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/68">
            Pour chaque cadre réglementaire structurant, NEURAL documente publiquement ses
            engagements et ses limites. Article par article, sans promesse non vérifiable.
          </p>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="grid gap-6 md:grid-cols-2">
            {REGS.map(({ slug, data, accent, Icon }) => {
              const cls = ACCENT_CLS[accent];
              return (
                <Link
                  key={slug}
                  href={`/conformite/${slug}`}
                  className={`group flex flex-col gap-4 rounded-[28px] border ${cls.border} bg-gradient-to-br ${cls.gradient} p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/30 no-underline`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${cls.border} ${cls.bg} ${cls.text}`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${cls.border} ${cls.text}`}
                    >
                      {data.regulation.applicableSince}
                    </span>
                  </div>
                  <div>
                    <h2 className="font-display text-2xl font-bold tracking-tight text-white">
                      {data.regulation.code}
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-white/55">
                      {data.regulation.fullName}
                    </p>
                  </div>
                  <p className="text-sm leading-relaxed text-white/75">{data.hero.intro}</p>
                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/8 pt-4">
                    <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-white/40">
                      <span>{data.commitments.length} engagements</span>
                      <span>·</span>
                      <span>{data.articles.length} articles</span>
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
    </div>
  );
}
