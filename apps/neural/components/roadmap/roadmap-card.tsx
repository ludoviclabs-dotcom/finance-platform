/**
 * RoadmapCard — card individuelle dans une colonne roadmap.
 */

import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock } from "lucide-react";

import { CategoryChip } from "./category-chip";

export interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  category: string;
  status: "shipped" | "now" | "next" | "later";
  shippedDate?: string;
  expectedDate?: string;
  progress?: number;
  href?: string;
}

interface RoadmapCardProps {
  item: RoadmapItem;
  categoryLabel: string;
  categoryColor: string;
}

export function RoadmapCard({ item, categoryLabel, categoryColor }: RoadmapCardProps) {
  const dateLabel =
    item.status === "shipped" && item.shippedDate
      ? `Livré ${item.shippedDate}`
      : item.expectedDate
      ? item.status === "now"
        ? `En cours · ${item.expectedDate}`
        : `Prévu ${item.expectedDate}`
      : null;

  const inner = (
    <article className="group flex flex-col gap-3 rounded-[20px] border border-white/8 bg-white/[0.03] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/16 hover:bg-white/[0.06]">
      <div className="flex items-start justify-between gap-2">
        <CategoryChip label={categoryLabel} color={categoryColor} />
        {item.status === "shipped" ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden="true" />
        ) : item.status === "now" ? (
          <Clock className="h-4 w-4 text-violet-300 animate-pulse" aria-hidden="true" />
        ) : null}
      </div>
      <p className="font-display text-sm font-semibold leading-snug tracking-tight text-white">
        {item.title}
      </p>
      <p className="text-xs leading-relaxed text-white/55">{item.description}</p>
      {item.status === "now" && typeof item.progress === "number" ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-white/40">
            <span>Progression</span>
            <span className="text-white/70">{item.progress}%</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-400 to-emerald-400 transition-all"
              style={{ width: `${item.progress}%` }}
            />
          </div>
        </div>
      ) : null}
      {dateLabel ? (
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">{dateLabel}</p>
      ) : null}
      {item.href ? (
        <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-violet-200 opacity-70 group-hover:opacity-100">
          Voir <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </span>
      ) : null}
    </article>
  );

  return item.href ? (
    <Link href={item.href} className="no-underline">
      {inner}
    </Link>
  ) : (
    inner
  );
}
