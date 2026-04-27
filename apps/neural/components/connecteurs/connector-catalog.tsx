"use client";

import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";

interface Connector {
  id: string;
  name: string;
  category: string;
  status: string;
  region: string;
  vendor: string;
  scope: string;
}

interface Category {
  id: string;
  label: string;
  description: string;
}

interface CatalogProps {
  items: Connector[];
  categories: Category[];
}

const STATUS_CLS: Record<string, { dot: string; text: string; bg: string; label: string }> = {
  live: {
    dot: "bg-emerald-400",
    text: "text-emerald-300",
    bg: "border-emerald-400/30 bg-emerald-400/[0.10]",
    label: "Live",
  },
  beta: {
    dot: "bg-violet-400",
    text: "text-violet-200",
    bg: "border-violet-400/30 bg-violet-400/[0.10]",
    label: "Beta",
  },
  roadmap: {
    dot: "bg-amber-400",
    text: "text-amber-200",
    bg: "border-amber-400/25 bg-amber-400/[0.10]",
    label: "Roadmap",
  },
};

export function ConnectorCatalog({ items, categories }: CatalogProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (activeCategory && it.category !== activeCategory) return false;
      if (activeStatus && it.status !== activeStatus) return false;
      return true;
    });
  }, [items, activeCategory, activeStatus]);

  const counts = {
    live: items.filter((i) => i.status === "live").length,
    beta: items.filter((i) => i.status === "beta").length,
    roadmap: items.filter((i) => i.status === "roadmap").length,
  };

  return (
    <div>
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Total catalogué</p>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums">{items.length}</p>
        </div>
        <div className="rounded-[20px] border border-emerald-400/25 bg-emerald-400/[0.06] p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/70">Live</p>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums text-emerald-200">
            {counts.live}
          </p>
        </div>
        <div className="rounded-[20px] border border-violet-400/25 bg-violet-400/[0.06] p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-violet-300/70">Beta</p>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums text-violet-100">
            {counts.beta}
          </p>
        </div>
        <div className="rounded-[20px] border border-amber-400/25 bg-amber-400/[0.06] p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-amber-300/70">Roadmap</p>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums text-amber-200">
            {counts.roadmap}
          </p>
        </div>
      </div>

      {/* Category filter */}
      <div className="mt-10 flex flex-wrap items-center gap-2">
        <span className="w-32 flex-shrink-0 text-[11px] uppercase tracking-[0.18em] text-white/40">
          Catégorie
        </span>
        <FilterChip
          label="Tout"
          active={activeCategory === null}
          onClick={() => setActiveCategory(null)}
        />
        {categories.map((cat) => (
          <FilterChip
            key={cat.id}
            label={cat.label}
            active={activeCategory === cat.id}
            onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
          />
        ))}
      </div>

      {/* Status filter */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="w-32 flex-shrink-0 text-[11px] uppercase tracking-[0.18em] text-white/40">
          Statut
        </span>
        <FilterChip
          label="Tout"
          active={activeStatus === null}
          onClick={() => setActiveStatus(null)}
        />
        {(["live", "beta", "roadmap"] as const).map((status) => (
          <FilterChip
            key={status}
            label={STATUS_CLS[status].label}
            active={activeStatus === status}
            onClick={() => setActiveStatus(activeStatus === status ? null : status)}
          />
        ))}
      </div>

      {/* Grid */}
      <div className="mt-10 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <div className="col-span-full rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
            <p className="text-sm text-white/55">
              Aucun connecteur ne correspond aux filtres sélectionnés.
            </p>
          </div>
        ) : (
          filtered.map((conn) => {
            const sCls = STATUS_CLS[conn.status];
            return (
              <div
                key={conn.id}
                className="flex flex-col gap-3 rounded-[20px] border border-white/8 bg-white/[0.03] p-4 transition-colors hover:border-white/16"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-sm font-semibold text-white">{conn.name}</p>
                    <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-white/40">
                      {conn.vendor}
                    </p>
                  </div>
                  <span
                    className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${sCls.bg} ${sCls.text}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${sCls.dot}`} />
                    {sCls.label}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-white/60">{conn.scope}</p>
                <div className="mt-auto flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-white/40">
                  <MapPin className="h-3 w-3" />
                  <span>Région : {conn.region}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] transition-all ${
        active
          ? "border-violet-400/50 bg-violet-400/[0.16] text-violet-100"
          : "border-white/10 bg-white/[0.04] text-white/55 hover:border-white/20 hover:text-white/80"
      }`}
    >
      {label}
    </button>
  );
}
