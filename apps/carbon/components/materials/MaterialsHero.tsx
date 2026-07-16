import { AnimatedCounter } from "@/components/ui/animated-counter";
import { DataStatusBadge } from "@/components/ui/data-status-badge";
import type { MaterialsSummary } from "@/lib/crm/dataLoader";

interface Props {
  summary: MaterialsSummary;
  snapshotYear: number;
}

export default function MaterialsHero({ summary, snapshotYear }: Props) {
  const { total, strategic, critical, chinaConcentrated, estimatedPct, chinaThreshold } = summary;

  // Tous les indicateurs sont DÉRIVÉS du dataset — aucun chiffre en dur.
  const stats = [
    { value: critical, suffix: "", label: "Matières critiques UE", color: "text-white", badge: null, note: null },
    { value: strategic, suffix: "", label: "Dont stratégiques", color: "text-amber-400", badge: null, note: null },
    {
      value: chinaConcentrated, suffix: `/${total}`,
      label: `Production concentrée en Chine (≥ ${chinaThreshold}%)`,
      color: "text-red-400", badge: null,
      note: "Stade agrégé — extraction, raffinage et transformation non distingués",
    },
    {
      value: estimatedPct, suffix: "%",
      label: "Données estimées (snapshot de démonstration)",
      color: "text-amber-400", badge: "ESTIMATED" as const, note: null,
    },
  ];

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-950 to-black border-b border-zinc-800">
      <div className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "40px 40px" }} />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-red-500/10 border border-red-500/30 px-4 py-1.5 text-sm text-red-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Intelligence économique · Snapshot {snapshotYear}
            </div>
            <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight">
              Les{" "}
              <span className="bg-gradient-to-r from-red-400 to-amber-400 bg-clip-text text-transparent">
                métaux critiques
              </span>
              <br />au cœur de la géopolitique
            </h1>
            <p className="text-zinc-400 text-lg leading-relaxed max-w-xl">
              {total}{" "}
              matières premières critiques identifiées par l&apos;Union Européenne, dont{" "}
              <strong className="text-white">{strategic} jugées stratégiques</strong>{" "}
              pour la défense, la transition énergétique et l&apos;autonomie numérique.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <a href="#materiaux" className="rounded-xl bg-white text-zinc-900 px-6 py-3 font-semibold text-sm hover:bg-zinc-100 transition">
                Explorer les matières →
              </a>
              <a href="#carte" className="rounded-xl border border-zinc-700 text-zinc-300 px-6 py-3 font-semibold text-sm hover:border-zinc-500 transition">
                Voir la carte mondiale
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {stats.map(stat => (
              <div key={stat.label} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur p-5 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-4xl font-black ${stat.color}`}>
                    <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                  </p>
                  {stat.badge && <DataStatusBadge status={stat.badge} />}
                </div>
                <p className="text-zinc-400 text-sm mt-1 leading-snug">{stat.label}</p>
                {stat.note && <p className="text-[10px] text-zinc-600 mt-1.5 leading-tight">{stat.note}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
