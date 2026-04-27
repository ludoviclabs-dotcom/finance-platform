"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock, Layers, Bot } from "lucide-react";

interface Recipe {
  slug: string;
  title: string;
  subtitle: string;
  summary: string;
  sector: string;
  difficulty: string;
  color: string;
  duration: string;
  agents: Array<{ slug: string }>;
  connectors: string[];
}

const COLOR_CLS: Record<string, { border: string; text: string; gradient: string }> = {
  violet: {
    border: "border-violet-400/25",
    text: "text-violet-200",
    gradient: "from-violet-500/[0.10] via-white/[0.04] to-violet-500/[0.04]",
  },
  cyan: {
    border: "border-cyan-400/25",
    text: "text-cyan-200",
    gradient: "from-cyan-500/[0.10] via-white/[0.04] to-cyan-500/[0.04]",
  },
  emerald: {
    border: "border-emerald-400/25",
    text: "text-emerald-200",
    gradient: "from-emerald-500/[0.10] via-white/[0.04] to-emerald-500/[0.04]",
  },
  amber: {
    border: "border-amber-400/25",
    text: "text-amber-200",
    gradient: "from-amber-500/[0.10] via-white/[0.04] to-amber-500/[0.04]",
  },
  rose: {
    border: "border-rose-400/25",
    text: "text-rose-200",
    gradient: "from-rose-500/[0.10] via-white/[0.04] to-rose-500/[0.04]",
  },
};

const SECTOR_OPTIONS = [
  { id: "luxe", label: "Luxe" },
  { id: "banque", label: "Banque" },
  { id: "aeronautique", label: "Aéronautique" },
  { id: "assurance", label: "Assurance" },
  { id: "cross", label: "Multi-secteurs" },
];

export function RecipesBoard({ recipes }: { recipes: Recipe[] }) {
  const [activeSector, setActiveSector] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!activeSector) return recipes;
    return recipes.filter((r) => r.sector === activeSector);
  }, [recipes, activeSector]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-[0.18em] text-white/40">Secteur</span>
        <button
          type="button"
          onClick={() => setActiveSector(null)}
          className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] transition-all ${
            activeSector === null
              ? "border-white/30 bg-white/[0.10] text-white"
              : "border-white/10 bg-white/[0.04] text-white/55 hover:border-white/20 hover:text-white/80"
          }`}
        >
          Tout ({recipes.length})
        </button>
        {SECTOR_OPTIONS.map((s) => {
          const count = recipes.filter((r) => r.sector === s.id).length;
          if (count === 0) return null;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSector(activeSector === s.id ? null : s.id)}
              className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] transition-all ${
                activeSector === s.id
                  ? "border-violet-400/50 bg-violet-400/[0.16] text-violet-100"
                  : "border-white/10 bg-white/[0.04] text-white/55 hover:border-white/20 hover:text-white/80"
              }`}
            >
              {s.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((recipe) => {
          const cls = COLOR_CLS[recipe.color] || COLOR_CLS["violet"];
          return (
            <Link
              key={recipe.slug}
              href={`/recipes/${recipe.slug}`}
              className={`group flex flex-col gap-4 rounded-[28px] border ${cls.border} bg-gradient-to-br ${cls.gradient} p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/30 no-underline`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${cls.border} ${cls.text}`}
                >
                  {recipe.sector === "cross" ? "Multi-secteurs" : recipe.sector}
                </span>
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white/55">
                  {recipe.difficulty}
                </span>
              </div>
              <div>
                <h2 className="font-display text-lg font-bold tracking-tight text-white">
                  {recipe.title}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-white/55">{recipe.subtitle}</p>
              </div>
              <p className="text-sm leading-relaxed text-white/65 line-clamp-3">
                {recipe.summary}
              </p>
              <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-white/8 pt-3 text-[11px] uppercase tracking-[0.16em] text-white/40">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  {recipe.duration}
                </span>
                <span>·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Bot className="h-3 w-3" />
                  {recipe.agents.length} agents
                </span>
                <span>·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Layers className="h-3 w-3" />
                  {recipe.connectors.length} conn.
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-violet-200 opacity-80 group-hover:opacity-100">
                <span>Voir la recette</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
