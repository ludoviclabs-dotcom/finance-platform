/**
 * RoadmapBoard — composant client avec filtres par catégorie.
 */

"use client";

import { useMemo, useState } from "react";

import { RoadmapCard, type RoadmapItem } from "./roadmap-card";
import { CategoryChip } from "./category-chip";

interface Category {
  id: string;
  label: string;
  color: string;
}

interface RoadmapBoardProps {
  items: RoadmapItem[];
  categories: Category[];
}

const COLUMNS: Array<{ status: RoadmapItem["status"]; label: string; subtitle: string; cls: string }> = [
  {
    status: "shipped",
    label: "Livré",
    subtitle: "Trois derniers mois",
    cls: "border-emerald-400/30 bg-emerald-400/[0.05] text-emerald-300",
  },
  {
    status: "now",
    label: "En cours",
    subtitle: "Travaux actuels",
    cls: "border-violet-400/30 bg-violet-400/[0.06] text-violet-200",
  },
  {
    status: "next",
    label: "À suivre",
    subtitle: "Prochain trimestre",
    cls: "border-cyan-400/25 bg-cyan-400/[0.05] text-cyan-200",
  },
  {
    status: "later",
    label: "Plus tard",
    subtitle: "Après T+2",
    cls: "border-white/15 bg-white/[0.03] text-white/55",
  },
];

export function RoadmapBoard({ items, categories }: RoadmapBoardProps) {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!activeFilter) return items;
    return items.filter((item) => item.category === activeFilter);
  }, [items, activeFilter]);

  const categoryById = useMemo(() => {
    const map: Record<string, Category> = {};
    categories.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [categories]);

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveFilter(null)}
          className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-all ${
            activeFilter === null
              ? "border-white/30 bg-white/[0.10] text-white"
              : "border-white/10 bg-white/[0.04] text-white/55 hover:border-white/20 hover:text-white/80"
          }`}
        >
          Tout
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveFilter(activeFilter === cat.id ? null : cat.id)}
            className="cursor-pointer transition-opacity hover:opacity-100"
          >
            <CategoryChip
              label={cat.label}
              color={cat.color}
              active={activeFilter === cat.id}
            />
          </button>
        ))}
      </div>

      {/* Kanban columns */}
      <div className="mt-8 grid gap-4 lg:grid-cols-4">
        {COLUMNS.map((col) => {
          const colItems = filtered.filter((item) => item.status === col.status);
          return (
            <div key={col.status} className="flex flex-col gap-4">
              <div
                className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${col.cls}`}
              >
                <div>
                  <p className="font-display text-sm font-bold tracking-tight">{col.label}</p>
                  <p className="text-[10px] uppercase tracking-[0.16em] opacity-70">
                    {col.subtitle}
                  </p>
                </div>
                <span className="font-display text-xl font-bold tabular-nums opacity-90">
                  {colItems.length}
                </span>
              </div>
              <div className="space-y-3">
                {colItems.length === 0 ? (
                  <div className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.02] p-4 text-center text-xs text-white/40">
                    Aucun item dans ce filtre
                  </div>
                ) : (
                  colItems.map((item) => {
                    const cat = categoryById[item.category];
                    return (
                      <RoadmapCard
                        key={item.id}
                        item={item}
                        categoryLabel={cat?.label || item.category}
                        categoryColor={cat?.color || "violet"}
                      />
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
