"use client";
import { DataStatusBadge } from "@/components/ui/data-status-badge";

interface Props {
  date: string;
  methodologyNote: string;
  estimatedPct: number;
}

// Au-delà de ce délai, le snapshot est signalé comme potentiellement périmé.
const STALE_AFTER_DAYS = 120;

function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.floor((Date.now() - then) / 86_400_000);
}

export default function SnapshotBanner({ date, methodologyNote, estimatedPct }: Props) {
  const formatted = new Intl.DateTimeFormat("fr-FR", {
    year: "numeric", month: "long", day: "numeric",
  }).format(new Date(date));
  const isStale = daysSince(date) > STALE_AFTER_DAYS;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="text-amber-400 text-lg leading-none mt-0.5">📅</span>
          <div>
            <p className="text-sm font-semibold text-amber-300">
              Snapshot de démonstration — {formatted}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">
              Valeurs estimées à partir de repères publics (USGS, Commission Européenne
              CRMA/RMIS, LME, Trading Economics). Non destinées à un usage normatif.
              L&apos;historique local n&apos;est enrichi que lorsqu&apos;un nouveau snapshot daté est publié.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <DataStatusBadge status={isStale ? "STALE" : "ESTIMATED"} />
          <span className="hidden sm:inline text-[10px] text-zinc-500">
            {estimatedPct}% des valeurs estimées
          </span>
        </div>
      </div>
      <p className="text-[11px] leading-relaxed text-zinc-500 border-t border-amber-500/15 pt-2">
        <span className="font-semibold text-zinc-400">Méthodologie —</span> {methodologyNote}
      </p>
    </div>
  );
}
