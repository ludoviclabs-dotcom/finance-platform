import AnimatedNumber from "./AnimatedNumber";

interface Props { total: number; strategic: number }

export default function MaterialsHero({ total, strategic }: Props) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-950 to-black border-b border-zinc-800">
      <div className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "40px 40px" }} />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-red-500/10 border border-red-500/30 px-4 py-1.5 text-sm text-red-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Intelligence économique · Snapshot {new Date().getFullYear()}
            </div>
            <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight">
              Les{" "}
              <span className="bg-gradient-to-r from-red-400 to-amber-400 bg-clip-text text-transparent">
                métaux critiques
              </span>
              <br />au cœur de la géopolitique
            </h1>
            <p className="text-zinc-400 text-lg leading-relaxed max-w-xl">
              {total} matières premières critiques identifiées par l&apos;Union Européenne,
              dont <strong className="text-white">{strategic} jugées stratégiques</strong> pour
              la défense, la transition énergétique et l&apos;autonomie numérique.
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
            {[
              { value: total, suffix: "", label: "Matières critiques UE", color: "text-white" },
              { value: strategic, suffix: "", label: "Dont stratégiques", color: "text-amber-400" },
              { value: 20, suffix: `/${total}`, label: "Dominées par la Chine", color: "text-red-400" },
              { value: 94, suffix: "%", label: "Aimants permanents chinois", color: "text-red-500" },
            ].map(stat => (
              <div key={stat.label} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur p-5">
                <p className={`text-4xl font-black ${stat.color}`}>
                  <AnimatedNumber value={stat.value} suffix={stat.suffix} />
                </p>
                <p className="text-zinc-400 text-sm mt-1 leading-snug">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
