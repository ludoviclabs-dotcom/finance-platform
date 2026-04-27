import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  ArrowLeft,
  ChefHat,
  Clock,
  Layers,
  Bot,
  Plug,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";

import recipesData from "@/content/recipes/catalog.json";

const COLOR_CLS: Record<string, { border: string; bg: string; text: string; gradient: string }> = {
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
  rose: {
    border: "border-rose-400/25",
    bg: "bg-rose-400/[0.08]",
    text: "text-rose-200",
    gradient: "from-rose-500/[0.10] via-white/[0.04] to-rose-500/[0.04]",
  },
};

export function generateStaticParams() {
  return recipesData.recipes.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const recipe = recipesData.recipes.find((r) => r.slug === slug);
  if (!recipe) return { title: "Recette — NEURAL" };
  return {
    title: `${recipe.title} — Recette NEURAL`,
    description: recipe.summary.slice(0, 160),
  };
}

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const recipe = recipesData.recipes.find((r) => r.slug === slug);
  if (!recipe) notFound();

  const cls = COLOR_CLS[recipe.color] || COLOR_CLS["violet"];

  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-emerald-500/8 blur-[120px]" />

      <section className="relative px-8 pb-12 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[1320px]">
          <Link
            href="/recipes"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200 hover:text-violet-100"
          >
            <ArrowLeft className="h-3 w-3" />
            Toutes les recettes
          </Link>
          <span
            className={`mt-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] ${cls.border} ${cls.bg} ${cls.text}`}
          >
            <ChefHat className="h-3.5 w-3.5" />
            Recette · {recipe.sector === "cross" ? "Multi-secteurs" : recipe.sector}
          </span>
          <h1 className="mt-6 font-display text-4xl font-bold tracking-tight md:text-5xl">
            {recipe.title}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-white/55">{recipe.subtitle}</p>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-white/68">
            {recipe.summary}
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
              <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-white/40">
                <Clock className="h-3 w-3" />
                Durée
              </p>
              <p className="mt-2 font-display text-lg font-bold text-white">{recipe.duration}</p>
            </div>
            <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
              <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-white/40">
                <Layers className="h-3 w-3" />
                Difficulté
              </p>
              <p className="mt-2 font-display text-lg font-bold text-white">{recipe.difficulty}</p>
            </div>
            <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
              <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-white/40">
                <Bot className="h-3 w-3" />
                Agents enchaînés
              </p>
              <p className="mt-2 font-display text-lg font-bold text-white">
                {recipe.agents.length}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Workflow ─────────────────────────────────────────────────────── */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <h2 className="font-display text-3xl font-bold tracking-tight">Workflow d&apos;agents</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/65">
            {recipe.agents.length} agents enchaînés dans un ordre déterministe avec gates
            inter-étapes.
          </p>
          <div className="mt-8 space-y-3">
            {recipe.agents.map((agent, i) => (
              <div key={agent.slug} className="relative">
                <div className="flex items-start gap-4 rounded-[20px] border border-white/8 bg-white/[0.03] p-5 transition-colors hover:border-white/16">
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border ${cls.border} ${cls.bg} font-display text-base font-bold ${cls.text}`}
                  >
                    {agent.step}
                  </div>
                  <div className="flex-1">
                    <Link
                      href={`/agents/${agent.slug}`}
                      className="font-display text-lg font-bold tracking-tight text-white hover:text-violet-200"
                    >
                      {agent.label}
                    </Link>
                    <p className="mt-1 text-sm leading-relaxed text-white/65">{agent.role}</p>
                  </div>
                </div>
                {i < recipe.agents.length - 1 ? (
                  <div className="ml-5 h-3 w-px bg-white/15" />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Connecteurs ──────────────────────────────────────────────────── */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                <Plug className="h-3 w-3" />
                Connecteurs
              </span>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
                {recipe.connectors.length} connecteurs requis
              </h2>
            </div>
            <Link
              href="/connecteurs"
              className="inline-flex items-center gap-2 text-sm font-semibold text-violet-200"
            >
              Voir le catalogue <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            {recipe.connectors.map((conn) => (
              <span
                key={conn}
                className="inline-flex items-center rounded-full border border-cyan-400/25 bg-cyan-400/[0.06] px-3 py-1.5 text-xs font-mono text-cyan-200"
              >
                {conn}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Outcomes + Compliance ────────────────────────────────────────── */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-[24px] border border-emerald-400/25 bg-emerald-400/[0.06] p-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-300" />
                <h3 className="font-display text-xl font-bold tracking-tight text-white">
                  Outcomes typiques
                </h3>
              </div>
              <ul className="mt-5 space-y-3">
                {recipe.outcomes.map((o) => (
                  <li key={o} className="flex gap-3 text-sm leading-relaxed text-white/80">
                    <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-300" />
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[24px] border border-violet-400/25 bg-violet-400/[0.06] p-6">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-violet-200" />
                <h3 className="font-display text-xl font-bold tracking-tight text-white">
                  Conformité couverte
                </h3>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {recipe.compliance.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center rounded-full border border-violet-400/30 bg-violet-400/[0.10] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-200"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {recipe.caveat ? (
            <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] px-5 py-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
                <p className="text-xs leading-relaxed text-amber-100/80">
                  <span className="font-semibold">Caveat :</span> {recipe.caveat}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="rounded-[28px] border border-emerald-400/20 bg-gradient-to-br from-emerald-500/[0.10] via-white/[0.04] to-violet-500/[0.06] p-8 md:p-12">
            <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                  Adapter cette recette à votre contexte
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-white/65">
                  Une recette prête à l&apos;emploi accélère le démarrage, mais le calibrage final
                  passe par un cadrage de 30 min sur votre stack et vos données.
                </p>
              </div>
              <Link
                href={`/contact?source=recipe-${recipe.slug}`}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-500/90 px-6 py-3 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400"
              >
                Cadrage gratuit <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
