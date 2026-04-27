import { notFound } from "next/navigation";
import Link from "next/link";
import { Scale, ArrowRight, FileText, ListChecks, ArrowLeft } from "lucide-react";

import aiActData from "@/content/conformite/ai-act.json";
import doraData from "@/content/conformite/dora.json";
import csrdData from "@/content/conformite/csrd.json";
import rgpdAgentsData from "@/content/conformite/rgpd-agents.json";
import { RiskMatrix } from "@/components/conformite/risk-matrix";
import { ArticleAccordion } from "@/components/conformite/article-accordion";
import { DoesDoesntList } from "@/components/conformite/does-doesnt-list";

type RegulationData = typeof aiActData;

// Note: dora/csrd/rgpd-agents don't have riskClassification (AI Act-specific).
// We use a permissive cast — TS handles missing optional fields via the dynamic
// `riskClassification` access below.
const REGULATIONS: Record<string, RegulationData> = {
  "ai-act": aiActData,
  dora: doraData as unknown as RegulationData,
  csrd: csrdData as unknown as RegulationData,
  "rgpd-agents": rgpdAgentsData as unknown as RegulationData,
};

const ICON_BY_SLUG: Record<string, typeof Scale> = {
  "ai-act": Scale,
  dora: ListChecks,
  csrd: FileText,
  "rgpd-agents": Scale,
};

export function generateStaticParams() {
  return Object.keys(REGULATIONS).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = REGULATIONS[slug];
  if (!data) return { title: "Conformité — NEURAL" };
  return {
    title: `${data.regulation.code} — Conformité NEURAL`,
    description: data.hero.intro.slice(0, 160),
  };
}

export default async function CompliancePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = REGULATIONS[slug];
  if (!data) notFound();

  const Icon = ICON_BY_SLUG[slug] || Scale;
  // Optional risk matrix only for AI Act
  const hasRiskMatrix =
    "riskClassification" in data &&
    typeof (data as { riskClassification?: unknown }).riskClassification === "object";

  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-emerald-500/8 blur-[120px]" />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative px-8 pb-12 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[1320px]">
          <Link
            href="/conformite"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200 hover:text-violet-100"
          >
            <ArrowLeft className="h-3 w-3" />
            Toutes les pages conformité
          </Link>
          <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
            <Icon className="h-3.5 w-3.5" />
            Conformité · {data.regulation.code}
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            {data.hero.title}
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/68">{data.hero.intro}</p>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Référence</p>
              <p className="mt-1.5 text-sm text-white/85">{data.regulation.reference}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                Applicable depuis
              </p>
              <p className="mt-1.5 text-sm text-white/85">{data.regulation.applicableSince}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Périmètre</p>
              <p className="mt-1.5 text-sm text-white/85">{data.regulation.scope}</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-white/35">
            Mise à jour : {data.lastUpdated}
          </p>
        </div>
      </section>

      {/* ── Commitments ──────────────────────────────────────────────────── */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                Engagements
              </span>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
                {data.commitments.length} engagements concrets
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/65">
                Pas des principes flous : pratiques tracées, datées, vérifiables côté client.
              </p>
            </div>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {data.commitments.map((c, i) => (
              <div
                key={c.id}
                className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6"
              >
                <p className="font-display text-3xl font-bold text-violet-300 tabular-nums">
                  0{i + 1}
                </p>
                <h3 className="mt-3 font-display text-lg font-bold tracking-tight text-white">
                  {c.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/65">{c.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Risk classification (AI Act only) ────────────────────────────── */}
      {hasRiskMatrix ? (
        <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
          <div className="mx-auto max-w-[1320px]">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                  <ListChecks className="h-3 w-3" />
                  Classification
                </span>
                <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
                  Classification des 168 agents
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/65">
                  Chaque agent passe une grille de classification. Cliquez sur un niveau pour voir
                  les agents concernés.
                </p>
              </div>
            </div>
            <div className="mt-8">
              <RiskMatrix
                classification={
                  (data as { riskClassification: Parameters<typeof RiskMatrix>[0]["classification"] })
                    .riskClassification
                }
              />
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Articles applicables ─────────────────────────────────────────── */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-400/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200">
                <FileText className="h-3 w-3" />
                Articles
              </span>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
                Articles applicables et notre réponse
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/65">
                Pour chaque article structurant, ce que NEURAL fait et ce qu&apos;il ne fait pas.
              </p>
            </div>
          </div>
          <div className="mt-8">
            <ArticleAccordion articles={data.articles} />
          </div>
        </div>
      </section>

      {/* ── Does / Doesn't ───────────────────────────────────────────────── */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight">Vue synthétique</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/65">
              Si vous ne lisez qu&apos;une chose sur cette page, c&apos;est ce qui suit.
            </p>
          </div>
          <div className="mt-8">
            <DoesDoesntList doesList={data.doesList} doesNotList={data.doesNotList} />
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="rounded-[28px] border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.10] via-white/[0.04] to-emerald-500/[0.06] p-8 md:p-12">
            <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                  Voir la roadmap conformité
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-white/65">
                  Model Cards publiques, audit trail signé, certifications ISO :
                  tout est tracé sur la roadmap publique avec dates cibles trimestrielles.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link
                  href="/roadmap"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-neural-violet px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-neural-violet/20 transition-all hover:bg-neural-violet-dark"
                >
                  Roadmap publique <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href={`/contact?source=conformite-${slug}`}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/[0.08]"
                >
                  Consultation conformité
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
