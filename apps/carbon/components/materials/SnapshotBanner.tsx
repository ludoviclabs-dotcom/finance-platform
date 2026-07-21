import { DataStatusBadge } from "@/components/ui/data-status-badge";

interface Props {
  date: string;
  methodologyNote: string;
  estimatedPct: number;
  // Calculé côté serveur (voir isSnapshotStale dans dataLoader) — jamais
  // recalculé côté client pour éviter un mismatch d'hydratation sur une page
  // prérendue statiquement.
  isStale: boolean;
}

export default function SnapshotBanner({ date, methodologyNote, estimatedPct, isStale }: Props) {
  const formatted = new Intl.DateTimeFormat("fr-FR", {
    year: "numeric", month: "long", day: "numeric",
  }).format(new Date(date));

  return (
    <div
      className="rounded-xl border px-4 py-3 flex flex-col gap-2"
      style={{ borderColor: "color-mix(in srgb, var(--mx-amber) 30%, transparent)", background: "color-mix(in srgb, var(--mx-amber) 5%, transparent)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="text-lg leading-none mt-0.5" style={{ color: "var(--mx-amber)" }}>📅</span>
          <div>
            <p className="m-0 text-sm font-semibold" style={{ color: "var(--mx-amber)" }}>
              Snapshot de démonstration — {formatted}
            </p>
            <p className="m-0 mt-0.5 text-xs" style={{ color: "var(--mx-muted)" }}>
              Valeurs estimées à partir de repères publics (USGS, Commission Européenne CRMA/RMIS, LME, Trading
              Economics). Non destinées à un usage normatif. L&apos;historique local n&apos;est enrichi que
              lorsqu&apos;un nouveau snapshot daté est publié.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <DataStatusBadge status={isStale ? "STALE" : "ESTIMATED"} />
          <span className="hidden sm:inline text-[10px]" style={{ color: "var(--mx-subtle)" }}>
            {estimatedPct}% des valeurs estimées
          </span>
        </div>
      </div>
      <p className="m-0 text-[11px] leading-relaxed border-t pt-2" style={{ color: "var(--mx-subtle)", borderColor: "color-mix(in srgb, var(--mx-amber) 15%, transparent)" }}>
        <span className="font-semibold" style={{ color: "var(--mx-muted)" }}>Méthodologie —</span> {methodologyNote}
      </p>
    </div>
  );
}
