"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { Material } from "@/lib/crm/dataLoader";
import { getChinaShare, getChinaTier, isChinaConcentrated, hasRenderableHistory } from "@/lib/crm/dataLoader";
import { CHINA_TIER_META } from "@/lib/crm/chinaTier";
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
    <section id="matieres" className="mx-anchor space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="m-0 mb-1.5 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ fontFamily: "var(--mx-font-mono)", color: "var(--mx-blue)" }}>
            <span className="w-[22px] h-px" style={{ background: "var(--mx-blue)" }} />
            Référentiel complet
          </p>
          <h2 className="m-0 font-bold text-2xl tracking-tight" style={{ fontFamily: "var(--mx-font-display)", color: "var(--mx-fg)" }}>
            Toutes les matières critiques{" "}
            <span className="text-[15px] font-medium" style={{ color: "var(--mx-subtle)" }}>({filtered.length}/{materials.length})</span>
          </h2>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher une matière ou un usage…"
          className="flex-1 min-w-[260px] rounded-[10px] border px-4 py-2.5 text-[13px] focus:outline-none"
          style={{ background: "var(--mx-card)", borderColor: "var(--mx-border)", color: "var(--mx-fg)" }}
        />
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f} type="button" onClick={() => setFilter(f)}
              className="px-4 py-2.5 rounded-[10px] text-[12.5px] font-semibold border cursor-pointer transition-colors"
              style={filter === f
                ? { background: "var(--mx-fg)", color: "var(--mx-bg)", borderColor: "var(--mx-fg)" }
                : { background: "var(--mx-card)", color: "var(--mx-muted)", borderColor: "var(--mx-border)" }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(252px, 1fr))" }}>
        {filtered.map((m, i) => {
          const china = getChinaShare(m);
          const tierColor = CHINA_TIER_META[getChinaTier(china)].colorVar;
          const stColor = m.is_strategic_eu ? "var(--mx-amber)" : "var(--mx-blue)";
          const isOpen = expanded === m.id;
          return (
            <motion.div
              key={m.id} onClick={() => setExpanded(isOpen ? null : m.id)}
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, delay: (i % 4) * 0.06, ease: "easeOut" }}
              whileHover={reduceMotion ? undefined : { y: -2, transition: { duration: 0.15 } }}
              className="rounded-[14px] border p-4 cursor-pointer transition-colors flex flex-col gap-3"
              style={{ borderColor: "var(--mx-border)", background: "var(--mx-card)", boxShadow: "var(--mx-shadow)" }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="m-0 font-bold text-[13.5px] leading-tight" style={{ color: "var(--mx-fg)" }}>{m.name_fr}</h3>
                  <p className="m-0 mt-0.5 text-[11px] overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: "var(--mx-subtle)" }}>{m.category}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="font-semibold text-[10px] px-2 py-0.5 rounded-full" style={{ color: stColor, background: `color-mix(in srgb, ${stColor} 14%, transparent)` }}>
                    {m.is_strategic_eu ? "Stra." : "Crit."}
                  </span>
                  <span className="font-bold text-sm" style={{ fontFamily: "var(--mx-font-mono)", color: "var(--mx-amber)" }} title="Score CarbonCo de risque d'approvisionnement (estimé)">
                    {m.carbonco_supply_risk_score ?? "—"}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1" style={{ color: "var(--mx-subtle)" }}>
                  <span>Part Chine</span><span style={{ fontFamily: "var(--mx-font-mono)", color: "var(--mx-muted)" }}>{china}%</span>
                </div>
                <div className="w-full h-[5px] rounded-full overflow-hidden" style={{ background: "var(--mx-chip)" }}>
                  <motion.div
                    className="h-full rounded-full" style={{ background: tierColor }}
                    initial={reduceMotion ? false : { width: 0 }}
                    whileInView={{ width: `${china}%` }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
                  />
                </div>
              </div>

              {m.price_snapshot && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px]" style={{ color: "var(--mx-subtle)" }}>{m.price_snapshot.unit}</span>
                    <span className="flex items-baseline gap-2">
                      <span className="font-semibold text-[13px]" style={{ fontFamily: "var(--mx-font-mono)", color: "var(--mx-fg)" }}>{m.price_snapshot.value.toLocaleString("fr-FR")}</span>
                      <span
                        className="font-bold text-[11.5px]"
                        style={{ fontFamily: "var(--mx-font-mono)", color: m.price_snapshot.trend_3m_pct > 0 ? "var(--mx-red)" : "var(--mx-em)" }}
                        title="Tendance 3 mois déclarée par le snapshot — estimation, pas une série observée"
                      >
                        {m.price_snapshot.trend_3m_pct > 0 ? "+" : ""}{m.price_snapshot.trend_3m_pct}%
                      </span>
                    </span>
                  </div>
                  {hasRenderableHistory(m.price_history) ? (
                    <Sparkline points={m.price_history} width={200} height={28} className="w-full" />
                  ) : (
                    <DataStatusBadge status="ESTIMATED" label="Estimation snapshot" />
                  )}
                </div>
              )}

              {isOpen && (
                <div className="pt-3 border-t flex flex-col gap-2" style={{ borderColor: "var(--mx-border)" }}>
                  <p className="m-0 font-semibold text-[10px] uppercase tracking-[0.14em]" style={{ fontFamily: "var(--mx-font-mono)", color: "var(--mx-subtle)" }}>Usages clés</p>
                  {m.main_uses.map(u => (
                    <p key={u} className="m-0 flex gap-1.5 text-xs" style={{ color: "var(--mx-muted)" }}><span style={{ color: stColor }}>›</span>{u}</p>
                  ))}
                  <p className="m-0 pt-2 font-semibold text-[10px] uppercase tracking-[0.14em]" style={{ fontFamily: "var(--mx-font-mono)", color: "var(--mx-subtle)" }}>Top producteurs</p>
                  {m.top_producers.slice(0, 3).map(p => (
                    <div key={p.country} className="flex justify-between text-xs">
                      <span style={{ color: "var(--mx-muted)" }}>{p.country}</span>
                      <span style={{ fontFamily: "var(--mx-font-mono)", color: "var(--mx-subtle)" }}>{p.share_pct}%</span>
                    </div>
                  ))}
                  <Link
                    href={`/materials/${m.id}`} onClick={e => e.stopPropagation()}
                    className="inline-block pt-2 text-xs font-semibold transition-colors"
                    style={{ color: "var(--mx-amber)" }}
                  >
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
