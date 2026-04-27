"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ArrowRight } from "lucide-react";

interface Term {
  slug: string;
  term: string;
  category: string;
  shortDefinition: string;
}

interface Category {
  id: string;
  label: string;
}

export function GlossaireBoard({
  terms,
  categories,
}: {
  terms: Term[];
  categories: Category[];
}) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let result = terms;
    if (activeCategory) result = result.filter((t) => t.category === activeCategory);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (t) => t.term.toLowerCase().includes(s) || t.shortDefinition.toLowerCase().includes(s),
      );
    }
    return result.sort((a, b) => a.term.localeCompare(b.term, "fr"));
  }, [terms, activeCategory, search]);

  return (
    <div>
      {/* Search */}
      <div className="rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 transition-colors focus-within:border-violet-400/50">
        <div className="flex items-center gap-3">
          <Search className="h-4 w-4 flex-shrink-0 text-white/45" />
          <input
            type="search"
            placeholder="Chercher un terme (ex : MCP, AI Act, audit trail...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
          />
        </div>
      </div>

      {/* Category filter */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-[0.18em] text-white/40">Catégorie</span>
        <button
          type="button"
          onClick={() => setActiveCategory(null)}
          className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] transition-all ${
            activeCategory === null
              ? "border-white/30 bg-white/[0.10] text-white"
              : "border-white/10 bg-white/[0.04] text-white/55 hover:border-white/20 hover:text-white/80"
          }`}
        >
          Tout ({terms.length})
        </button>
        {categories.map((cat) => {
          const count = terms.filter((t) => t.category === cat.id).length;
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

      {/* Counter */}
      <p className="mt-6 text-xs text-white/45">
        {filtered.length} terme{filtered.length > 1 ? "s" : ""} affiché
        {filtered.length > 1 ? "s" : ""}
      </p>

      {/* Terms grid */}
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {filtered.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
            <p className="text-sm text-white/55">Aucun terme ne correspond à votre recherche.</p>
          </div>
        ) : (
          filtered.map((t) => (
            <Link
              key={t.slug}
              href={`/glossaire/${t.slug}`}
              className="group flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-all hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.06] no-underline"
            >
              <div className="min-w-0 flex-1">
                <p className="font-display text-base font-semibold text-white">{t.term}</p>
                <p className="mt-1 text-xs leading-relaxed text-white/60 line-clamp-2">
                  {t.shortDefinition}
                </p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 flex-shrink-0 text-violet-200 transition-transform group-hover:translate-x-1" />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
