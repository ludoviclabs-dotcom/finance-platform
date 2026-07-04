"use client";
interface Producer { country: string; share_pct: number }
interface Material { top_producers: Producer[] }
interface Props { materials: Material[] }

const COORDS: Record<string, [number, number]> = {
  "Chine": [104, 35], "Australie": [133, -25], "RD Congo": [23, -4],
  "Chili": [-71, -30], "Etats-Unis": [-100, 40], "Russie": [100, 60],
  "Afrique du Sud": [25, -30], "Indonésie": [120, -5],
  "Turquie": [35, 39], "Brésil": [-51, -14], "Inde": [78, 22],
  "Kazakhstan": [68, 48], "Mozambique": [35, -18],
};

export default function GlobalMap({ materials }: Props) {
  const weight: Record<string, number> = {};
  materials.forEach(m => m.top_producers.forEach(p => {
    weight[p.country] = (weight[p.country] ?? 0) + p.share_pct;
  }));

  return (
    <section id="carte" className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Cartographie mondiale</h2>
          <p className="text-zinc-400 text-sm mt-1">
            Poids cumulé des pays producteurs sur les 34 matières critiques UE. Taille proportionnelle au poids d&apos;approvisionnement.
          </p>
        </div>
        <span className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-400 px-3 py-1.5 rounded-full shrink-0">
          Mapbox ready
        </span>
      </div>
      <div className="relative rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden h-80 lg:h-[26rem]"
        style={{ background: "radial-gradient(ellipse at 50% 60%, #1a1a2e 0%, #0a0a0f 100%)" }}>
        {/* Grid décoratif latitude/longitude */}
        <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
          {[20,40,60,80].map(p => (
            <line key={`h${p}`} x1="0" y1={`${p}%`} x2="100%" y2={`${p}%`} stroke="#fff" strokeWidth="0.5" strokeDasharray="4 8" />
          ))}
          {[20,40,60,80].map(p => (
            <line key={`v${p}`} x1={`${p}%`} y1="0" x2={`${p}%`} y2="100%" stroke="#fff" strokeWidth="0.5" strokeDasharray="4 8" />
          ))}
        </svg>
        {/* Bulles pays */}
        {Object.entries(COORDS).map(([country, [lng, lat]]) => {
          const w = weight[country] ?? 0;
          if (w === 0) return null;
          const size = Math.max(12, Math.min(72, w / 4));
          const x = ((lng + 180) / 360) * 100;
          const y = ((90 - lat) / 180) * 100;
          const isChina = country === "Chine";
          return (
            <div key={country}
              title={`${country} — poids cumulé : ${w.toFixed(0)} pts`}
              className={`absolute rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-110 hover:z-10 ${
                isChina
                  ? "bg-red-500/80 border-2 border-red-300 shadow-[0_0_20px_rgba(239,68,68,0.5)]"
                  : "bg-blue-500/50 border border-blue-400/60"
              }`}
              style={{
                left: `${x}%`, top: `${y}%`,
                width: `${size}px`, height: `${size}px`,
                transform: "translate(-50%, -50%)",
              }}>
              {size > 28 && (
                <span className="text-white font-bold" style={{ fontSize: `${Math.max(8, size / 5)}px` }}>
                  {country.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
          );
        })}
        {/* Légende */}
        <div className="absolute bottom-4 left-4 rounded-xl bg-zinc-900/90 border border-zinc-800 p-3 space-y-1.5 backdrop-blur">
          <div className="flex items-center gap-2 text-xs text-zinc-300"><span className="w-3 h-3 rounded-full bg-red-500" /> Chine (dominant)</div>
          <div className="flex items-center gap-2 text-xs text-zinc-300"><span className="w-3 h-3 rounded-full bg-blue-500/50" /> Autres producteurs</div>
          <p className="text-zinc-600 text-[10px]">Taille = poids cumulé sur 34 CRM</p>
        </div>
        {/* Badge Mapbox */}
        <div className="absolute bottom-4 right-4 rounded-lg bg-zinc-900/80 border border-zinc-700 px-3 py-2 text-xs text-zinc-500">
          Brancher <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> → carte vectorielle
        </div>
      </div>
    </section>
  );
}
