/**
 * MediaMatrixGrid — Server Component
 * Grille des medias references — Vogue, Harper's Bazaar, FT, BoF, etc.
 * Affiche priorite P1/P2 + vertical (Lifestyle / Business / Trade) + langue.
 */
import { Newspaper } from "lucide-react";

import { MEDIA_DIRECTORY } from "@/lib/data/luxe-comms-catalog";

const PRIORITE_CLASS: Record<string, string> = {
  P1: "border-violet-400/30 bg-violet-400/[0.08] text-violet-200",
  P2: "border-white/10 bg-white/[0.03] text-white/70",
  P3: "border-white/5 bg-white/[0.02] text-white/50",
};

const VERTICAL_CLASS: Record<string, string> = {
  Lifestyle: "bg-rose-400/10 text-rose-200",
  Business: "bg-sky-400/10 text-sky-200",
  Trade: "bg-amber-400/10 text-amber-200",
  Generaliste: "bg-emerald-400/10 text-emerald-200",
};

export function MediaMatrixGrid({ max = 15 }: { max?: number }) {
  const sorted = [...MEDIA_DIRECTORY]
    .sort((a, b) => (a.priorite > b.priorite ? 1 : -1))
    .slice(0, max);

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.02] p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-400/10">
          <Newspaper className="h-4 w-4 text-violet-200" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200">
            AG-002 Media Directory
          </p>
          <h3 className="font-display text-xl font-bold text-white">
            {MEDIA_DIRECTORY.length} medias references
          </h3>
          <p className="mt-1 text-sm text-white/55">
            Angle editorial + embargo + statut relation par outlet.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((m) => (
          <div
            key={m.media_id}
            className={`rounded-2xl border p-4 ${PRIORITE_CLASS[m.priorite] ?? PRIORITE_CLASS.P2}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-semibold text-white">{m.nom_media}</p>
                <p className="mt-0.5 text-[11px] text-white/50">
                  {m.type} · {m.pays} · {m.lang}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                  VERTICAL_CLASS[m.vertical] ?? "bg-white/10 text-white/60"
                }`}
              >
                {m.vertical}
              </span>
            </div>
            <p className="mt-3 line-clamp-2 text-xs text-white/60">{m.angle_editorial}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
