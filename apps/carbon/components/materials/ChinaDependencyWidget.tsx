"use client";
import { motion, useReducedMotion } from "framer-motion";
import AnimatedNumber from "./AnimatedNumber";

interface Producer { country: string; share_pct: number }
interface Material { id: string; name_fr: string; top_producers: Producer[]; criticality_eu: string }
interface Props { materials: Material[] }

function getChinaShare(m: Material): number {
  return m.top_producers.find(p => p.country === "Chine")?.share_pct ?? 0;
}

const TIERS = [
  { label: "Dominance critique", min: 50, max: 100, color: "bg-red-500", textColor: "text-red-400", desc: "Part chinoise ≥ 50%" },
  { label: "Présence significative", min: 20, max: 49, color: "bg-amber-400", textColor: "text-amber-400", desc: "Part chinoise 20–49%" },
  { label: "Approvisionnement diversifié", min: 0, max: 19, color: "bg-emerald-500", textColor: "text-emerald-400", desc: "Part chinoise < 20%" },
];

export default function ChinaDependencyWidget({ materials }: Props) {
  const reduceMotion = useReducedMotion();
  const tiers = TIERS.map(t => ({
    ...t,
    items: materials.filter(m => { const s = getChinaShare(m); return s >= t.min && s <= t.max; }),
  }));

  const dominated = tiers[0].items.length;
  const pct = Math.round((dominated / materials.length) * 100);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-5 h-full">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-white">Dépendance Chine</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Sur les 34 matières critiques UE</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black text-red-400"><AnimatedNumber value={pct} suffix="%" /></p>
          <p className="text-xs text-zinc-500">sous dominance</p>
        </div>
      </div>

      {/* Barre globale */}
      <div className="w-full h-3 rounded-full bg-zinc-800 overflow-hidden flex">
        {tiers.map((t, i) => {
          const width = `${(t.items.length / materials.length) * 100}%`;
          return (
            <motion.div key={t.label}
              className={`h-full ${t.color}`}
              initial={reduceMotion ? false : { width: 0 }}
              whileInView={{ width }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.7, delay: i * 0.15, ease: "easeOut" }}
              style={reduceMotion ? { width } : undefined} />
          );
        })}
      </div>

      {/* Tiers */}
      <div className="space-y-3">
        {tiers.map(t => (
          <div key={t.label} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${t.color}`} />
                <span className="text-sm font-medium text-zinc-200">{t.label}</span>
              </div>
              <span className={`font-mono font-bold text-sm ${t.textColor}`}>
                {t.items.length} matières
              </span>
            </div>
            <p className="text-xs text-zinc-500 pl-4">{t.desc}</p>
            <div className="flex flex-wrap gap-1 pl-4">
              {t.items.slice(0, 6).map(m => (
                <span key={m.id} className="text-[10px] rounded-full bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-zinc-400">
                  {m.name_fr}
                </span>
              ))}
              {t.items.length > 6 && (
                <span className="text-[10px] text-zinc-600">+{t.items.length - 6} autres</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
