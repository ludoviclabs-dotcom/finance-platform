"use client";

import { useMemo, useState } from "react";
import { Quote as QuoteIcon } from "lucide-react";

interface Testimonial {
  id: string;
  category: string;
  quote: string;
  role: string;
  context: string;
}

interface Category {
  id: string;
  label: string;
}

interface Props {
  items: Testimonial[];
  categories: Category[];
}

const CATEGORY_CLS: Record<string, string> = {
  methodologie: "border-violet-400/30 bg-violet-400/[0.10] text-violet-200",
  conformite: "border-emerald-400/30 bg-emerald-400/[0.10] text-emerald-300",
  transparence: "border-cyan-400/30 bg-cyan-400/[0.10] text-cyan-200",
  verticalisation: "border-amber-400/25 bg-amber-400/[0.10] text-amber-200",
};

export function TestimonialWall({ items, categories }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!activeCategory) return items;
    return items.filter((i) => i.category === activeCategory);
  }, [items, activeCategory]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-[0.18em] text-white/40">Filtrer</span>
        <button
          type="button"
          onClick={() => setActiveCategory(null)}
          className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] transition-all ${
            activeCategory === null
              ? "border-white/30 bg-white/[0.10] text-white"
              : "border-white/10 bg-white/[0.04] text-white/55 hover:border-white/20 hover:text-white/80"
          }`}
        >
          Tous ({items.length})
        </button>
        {categories.map((cat) => {
          const count = items.filter((i) => i.category === cat.id).length;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
              className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] transition-all ${
                activeCategory === cat.id
                  ? "border-violet-400/50 bg-violet-400/[0.16] text-violet-100"
                  : "border-white/10 bg-white/[0.04] text-white/55 hover:border-white/20 hover:text-white/80"
              }`}
            >
              {cat.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {filtered.map((t) => {
          const catLabel = categories.find((c) => c.id === t.category)?.label || t.category;
          const cls = CATEGORY_CLS[t.category] || CATEGORY_CLS["methodologie"];
          return (
            <div
              key={t.id}
              className="flex flex-col gap-4 rounded-[24px] border border-white/10 bg-white/[0.04] p-6 transition-colors hover:border-white/20"
            >
              <div className="flex items-start justify-between gap-3">
                <QuoteIcon className="h-5 w-5 flex-shrink-0 text-violet-300" />
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${cls}`}
                >
                  {catLabel}
                </span>
              </div>
              <p className="font-display text-base leading-relaxed text-white/85 md:text-lg">
                « {t.quote} »
              </p>
              <div className="mt-auto border-t border-white/8 pt-3">
                <p className="text-sm font-semibold text-violet-200">{t.role}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-white/45">{t.context}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
