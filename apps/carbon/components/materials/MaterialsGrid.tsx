"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { Material } from "@/lib/crm/dataLoader";
import { getChinaShare, isChinaConcentrated, hasRenderableHistory } from "@/lib/crm/dataLoader";
import { DataStatusBadge } from "@/components/ui/data-status-badge";
import Sparkline from "./Sparkline";

interface Props { materials: Material[] }

// Filtres NON exclusifs : « Critique » couvre les 34 (toute matière est
// critique), « Stratégique » son sous-ensemble — une matière stratégique passe
// donc les deux filtres.
const FILTERS = ["Toutes", "Stratégique", "Critique", "Chine ≥ 50%"] as const;
type Filter = (typeof FILTERS)[number];

function matchesFilter(m: Material, filter: Filter): boolean {
  switch (filter) {
    case "Toutes": return true;
    case "Stratégique": return m.is_strategic_eu;
    case "Critique": return m.is_critical_eu;
    case "Chine ≥ 50%": return isChinaConcentrated(m);
  }
}

export default function MaterialsGrid({ materials }: Props) {
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState<Filter>("Toutes");
  const [expanded, setExpanded] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const filtered = useMemo(() => materials.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q || m.name_fr.toLowerCase().includes(q) || m.main_uses.some(u => u.toLowerCase().includes(q));
    return matchSearch && matchesFilter(m, filter);
  }), [materials, search, filter]);

  return (
    <section id="materiaux" className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-white">
          Toutes les matières critiques{" "}
          <span className="ml-2 text-zinc-500 font-normal text-base">({filtered.length}/{materials.length})</span>
        </h2>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher une matière ou un usage…"
          className="flex-1 rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600" />
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2.5 rounded-xl text-sm font-medium transition border ${
                filter === f ? "bg-white text-zinc-900 border-white" : "border-zinc-800 text-zinc-400 hover:border-zinc-600"
              }`}>{f}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((m, i) => {
          const china = getChinaShare(m);
          const isOpen = expanded === m.id;
          return (
            <motion.div key={m.id} onClick={() => setExpanded(isOpen ? null : m.id)}
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, delay: (i % 4) * 0.06, ease: "easeOut" }}
              whileHover={reduceMotion ? undefined : { scale: 1.02, transition: { duration: 0.15 } }}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 cursor-pointer hover:border-zinc-700 transition-colors space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm leading-tight">{m.name_fr}</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">{m.category}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    m.is_strategic_eu ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"
                  }`}>{m.is_strategic_eu ? "Stra." : "Crit."}</span>
                  <span className="font-mono text-amber-400 text-sm font-bold" title="Score CarbonCo de risque d'approvisionnement (estimé)">{m.carbonco_supply_risk_score ?? "—"}</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-zinc-500 mb-1">
                  <span>Part Chine</span><span className="font-mono text-zinc-300">{china}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-zinc-800">
                  <motion.div className={`h-full rounded-full ${ china >= 50 ? "bg-red-500" : china >= 20 ? "bg-amber-400" : "bg-emerald-500" }`}
                    initial={reduceMotion ? false : { width: 0 }}
                    whileInView={{ width: `${china}%` }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
                    style={reduceMotion ? { width: `${china}%` } : undefined} />
                </div>
              </div>
              {m.price_snapshot && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">{m.price_snapshot.unit}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-white text-sm">{m.price_snapshot.value}</span>
                      <span className={`text-xs font-bold ${ m.price_snapshot.trend_3m_pct > 0 ? "text-red-400" : "text-emerald-400" }`}
                        title="Tendance 3 mois déclarée par le snapshot — estimation, pas une série observée">
                        {m.price_snapshot.trend_3m_pct > 0 ? "+" : ""}{m.price_snapshot.trend_3m_pct}%
                      </span>
                    </div>
                  </div>
                  {hasRenderableHistory(m.price_history) ? (
                    <Sparkline points={m.price_history} width={200} height={28} className="w-full" />
                  ) : (
                    <DataStatusBadge status="ESTIMATED" label="Estimation snapshot" />
                  )}
                </div>
              )}
              {isOpen && (
                <div className="pt-3 border-t border-zinc-800 space-y-2">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Usages clés</p>
                  {m.main_uses.map(u => (
                    <p key={u} className="text-xs text-zinc-300 flex gap-1.5"><span className="text-zinc-600">›</span>{u}</p>
                  ))}
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider pt-2">Top producteurs</p>
                  {m.top_producers.slice(0,3).map(p => (
                    <div key={p.country} className="flex justify-between text-xs">
                      <span className="text-zinc-300">{p.country}</span>
                      <span className="font-mono text-zinc-400">{p.share_pct}%</span>
                    </div>
                  ))}
                  <Link href={`/materials/${m.id}`} onClick={e => e.stopPropagation()}
                    className="inline-block pt-2 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors">
                    Fiche complète →
                  </Link>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
