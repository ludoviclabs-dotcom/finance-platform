"use client";
interface Props { date: string }

export default function SnapshotBanner({ date }: Props) {
  const formatted = new Intl.DateTimeFormat("fr-FR", {
    year: "numeric", month: "long", day: "numeric",
  }).format(new Date(date));

  return (
    <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-amber-400 text-lg">📅</span>
        <div>
          <p className="text-sm font-semibold text-amber-400">Données snapshot — {formatted}</p>
          <p className="text-xs text-zinc-500">
            Sources : USGS 2026 · Commission Européenne CRMA/RMIS · LME · Trading Economics.
            Mise à jour automatique chaque lundi via GitHub Actions.
          </p>
        </div>
      </div>
      <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-zinc-800 border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Snapshot statique
      </span>
    </div>
  );
}
