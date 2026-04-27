/**
 * CompareTable — tableau honnête multi-dimensions concurrent vs NEURAL.
 */

"use client";

import { useState } from "react";
import { Check, Equal, Minus } from "lucide-react";

interface Dimension {
  label: string;
  tray: string;
  neural: string;
  winner: "tray" | "neural" | "different";
  note?: string;
}

interface CompareTableProps {
  dimensions: Dimension[];
  competitorName: string;
}

const WINNER_CONFIG = {
  tray: {
    icon: Check,
    label: "Tray",
    cls: "border-violet-400/30 bg-violet-400/[0.10] text-violet-200",
  },
  neural: {
    icon: Check,
    label: "NEURAL",
    cls: "border-emerald-400/30 bg-emerald-400/[0.10] text-emerald-300",
  },
  different: {
    icon: Equal,
    label: "Différent",
    cls: "border-amber-400/25 bg-amber-400/[0.08] text-amber-200",
  },
} as const;

export function CompareTable({ dimensions, competitorName }: CompareTableProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04]">
      {/* Header (sticky on scroll could be added later) */}
      <div className="hidden grid-cols-[1.2fr_1.6fr_1.6fr_0.8fr] gap-4 border-b border-white/10 bg-white/[0.04] px-5 py-4 md:grid">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
          Dimension
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-300">
          {competitorName}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
          NEURAL
        </span>
        <span className="text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
          Verdict
        </span>
      </div>

      {dimensions.map((dim, i) => {
        const config = WINNER_CONFIG[dim.winner];
        const Icon = config.icon;
        const isHovered = hoveredIndex === i;
        return (
          <div
            key={dim.label}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
            className={`grid grid-cols-1 gap-3 border-b border-white/8 px-5 py-5 transition-colors last:border-b-0 md:grid-cols-[1.2fr_1.6fr_1.6fr_0.8fr] md:items-start ${
              isHovered ? "bg-white/[0.04]" : ""
            }`}
          >
            <div>
              <p className="text-sm font-semibold text-white">{dim.label}</p>
              {dim.note ? (
                <p className="mt-1 text-[11px] leading-relaxed text-white/45">{dim.note}</p>
              ) : null}
            </div>
            <div className="text-sm leading-relaxed text-white/65">
              <span className="md:hidden text-[10px] uppercase tracking-[0.16em] text-violet-300/80 block mb-1">
                {competitorName}
              </span>
              {dim.tray}
            </div>
            <div className="text-sm leading-relaxed text-white/85">
              <span className="md:hidden text-[10px] uppercase tracking-[0.16em] text-emerald-300/80 block mb-1">
                NEURAL
              </span>
              {dim.neural}
            </div>
            <div className="md:text-right">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${config.cls}`}
              >
                {dim.winner === "different" ? (
                  <Minus className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <Icon className="h-3 w-3" aria-hidden="true" />
                )}
                {config.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
