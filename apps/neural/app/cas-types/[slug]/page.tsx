import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  ArrowLeft,
  Briefcase,
  Quote as QuoteIcon,
  AlertTriangle,
  Calendar,
  Bot,
  TrendingUp,
} from "lucide-react";

import banqueDora from "@/content/cas-types/banque-dora.json";
import luxeCsrd from "@/content/cas-types/luxe-csrd.json";
import aeroEasa from "@/content/cas-types/aero-easa.json";

type CasTypeData = typeof banqueDora;

const CAS_TYPES: Record<string, CasTypeData> = {
  "banque-dora": banqueDora,
  "luxe-csrd": luxeCsrd as unknown as CasTypeData,
  "aero-easa": aeroEasa as unknown as CasTypeData,
};

const SECTOR_ACCENT: Record<string, { border: string; bg: string; text: string }> = {
  banque: {
    border: "border-cyan-400/25",
    bg: "bg-cyan-400/[0.08]",
    text: "text-cyan-200",
  },
  luxe: {
    border: "border-violet-400/25",
    bg: "bg-violet-400/[0.08]",
    text: "text-violet-200",
  },
  aeronautique: {
    border: "border-amber-400/25",
    bg: "bg-amber-400/[0.08]",
    text: "text-amber-200",
  },
};

export function generateStaticParams() {
  return Object.keys(CAS_TYPES).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = CAS_TYPES[slug];
  if (!data) return { title: "Cas-type — NEURAL" };
  return {
    title: `${data.hero.title} — Cas-type NEURAL`,
    description: data.hero.context.slice(0, 160),
  };
}

export default async function CasTypePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = CAS_TYPES[slug];
  if (!data) notFound();

  const accent = SECTOR_ACCENT[data.sector] || SECTOR_ACCENT["banque"];

  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-emerald-500/8 blur-[120px]" />

      {/* ── Honesty banner ──────────────────────────────────────────────── */}
      <div className="relative border-b border-amber-400/15 bg-amber-400/[0.04] px-8 py-3 md:px-12">
        <div className="mx-auto flex max-w-[1320px] items-start gap-3">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-400" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-amber-100/80">
            <span className="font-semibold">Cas-type méthodologique</span> — illustration de la
            démarche NEURAL appliquée à un contexte sectoriel type. Pas un cas client signé.
            Métriques basées sur des hypothèses méthodologiques cohérentes avec des projets
            comparables.
          </p>
        </div>
      </div>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative px-8 pb-12 pt-20 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <Link
            href="/cas-types"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200 hover:text-violet-100"
          >
            <ArrowLeft className="h-3 w-3" />
            Tous les cas-types
          </Link>
          <span
            className={`mt-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] ${accent.border} ${accent.bg} ${accent.text}`}
          >
            <Briefcase className="h-3.5 w-3.5" />
            {data.hero.icon} · {data.regulation}
          </span>
          <h1 className="mt-6 font-display text-4xl font-bold tracking-tight md:text-5xl">
            {data.hero.title}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-white/55">{data.hero.subtitle}</p>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-white/68">
            {data.hero.context}
          </p>
        </div>
      </section>

      {/* ── Challenge ────────────────────────────────────────────────────── */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <h2 className="font-display text-3xl font-bold tracking-tight">
            {data.challenge.title}
          </h2>
          <ul className="mt-6 space-y-3">
            {data.challenge.items.map((item) => (
              <li
                key={item}
                className="flex gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3 text-sm leading-relaxed text-white/75"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Methodology ──────────────────────────────────────────────────── */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <h2 className="font-display text-3xl font-bold tracking-tight">
            {data.methodology.title}
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {data.methodology.phases.map((phase, i) => (
              <div
                key={phase.id}
                className="flex flex-col gap-3 rounded-[24px] border border-white/10 bg-white/[0.04] p-6"
              >
                <div className="flex items-baseline justify-between">
                  <p className="font-display text-3xl font-bold text-violet-300 tabular-nums">
                    0{i + 1}
                  </p>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                    Phase
                  </span>
                </div>
                <h3 className="font-display text-lg font-bold tracking-tight text-white">
                  {phase.label}
                </h3>
                <p className="text-sm leading-relaxed text-white/65">{phase.description}</p>
                <div className="mt-auto rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-300/70">
                    Livrable
                  </p>
                  <p className="mt-0.5 text-xs text-white/80">{phase.deliverable}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Agents used ──────────────────────────────────────────────────── */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-400/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200">
                <Bot className="h-3 w-3" />
                Agents impliqués
              </span>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
                {data.agentsUsed.length} agents NEURAL mobilisés
              </h2>
            </div>
            <Link
              href="/agents"
              className="inline-flex items-center gap-2 text-sm font-semibold text-violet-200"
            >
              Voir le catalogue <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {data.agentsUsed.map((agent) => (
              <div
                key={agent.slug}
                className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4 transition-colors hover:border-white/16"
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-violet-400/25 bg-violet-400/[0.08]">
                  <Bot className="h-4 w-4 text-violet-200" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{agent.label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/60">{agent.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Metrics ──────────────────────────────────────────────────────── */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
            <TrendingUp className="h-3 w-3" />
            Métriques cibles
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
            {data.metrics.title}
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {data.metrics.items.map((m) => (
              <div
                key={m.label}
                className="flex flex-col gap-3 rounded-[24px] border border-white/10 bg-white/[0.04] p-5"
              >
                <p className="text-sm font-semibold text-white">{m.label}</p>
                <div className="grid grid-cols-3 items-baseline gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Avant</p>
                    <p className="mt-1 text-xs text-white/55">{m.before}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-300/70">
                      Après
                    </p>
                    <p className="mt-1 text-xs text-white/85">{m.after}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Delta</p>
                    <p className="mt-1 font-display text-lg font-bold tabular-nums text-emerald-300">
                      {m.delta}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] px-5 py-4">
            <p className="text-xs leading-relaxed text-amber-100/80">
              <span className="font-semibold">Caveat :</span> {data.metrics.caveat}
            </p>
          </div>
        </div>
      </section>

      {/* ── Quote ───────────────────────────────────────────────────────── */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[920px]">
          <div className="rounded-[28px] border border-violet-400/25 bg-violet-400/[0.06] p-8 md:p-10">
            <QuoteIcon className="h-8 w-8 text-violet-300" />
            <p className="mt-4 font-display text-xl leading-relaxed text-white md:text-2xl">
              « {data.quote.text} »
            </p>
            <div className="mt-6 border-t border-violet-400/20 pt-4">
              <p className="text-sm font-semibold text-violet-200">{data.quote.role}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/35">
                {data.quote.note}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Timeline ─────────────────────────────────────────────────────── */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
            <Calendar className="h-3 w-3" />
            Timeline
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
            {data.timeline.title}
          </h2>
          <div className="mt-8 grid gap-3 md:grid-cols-4">
            {data.timeline.items.map((item, i) => (
              <div
                key={item.day}
                className="rounded-[20px] border border-white/10 bg-white/[0.04] p-5"
              >
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                  Étape {i + 1}
                </p>
                <p className="mt-2 font-display text-2xl font-bold tabular-nums text-violet-300">
                  {item.day}
                </p>
                <p className="mt-3 text-xs leading-relaxed text-white/70">{item.label}</p>
              </div>
            ))}
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
                  Cadrage outcome 30 minutes
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-white/65">
                  Adapter cette démarche à votre contexte précis : périmètre, KPI cibles, agents
                  applicables, calendrier réaliste. Sortie : feuille de route signée.
                </p>
              </div>
              <Link
                href={`/contact?source=cas-type-${slug}`}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-500/90 px-6 py-3 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400"
              >
                Réserver le cadrage <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
