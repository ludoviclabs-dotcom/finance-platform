"use client";
import { useState } from "react";
import Link from "next/link";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import type { Material } from "@/lib/crm/dataLoader";
import { getChinaShare, getChinaTier } from "@/lib/crm/dataLoader";
import { CHINA_TIER_META } from "@/lib/crm/chinaTier";

interface Props { materials: Material[] }

type Node = {
  id: string;
  name: string;
  size: number;
  china: number;
  category: string;
  strategic: boolean;
  fill: string;
};

function fillFor(china: number): string {
  return CHINA_TIER_META[getChinaTier(china)].colorVar;
}

function TreemapCell(props: {
  x?: number; y?: number; width?: number; height?: number;
  name?: string; size?: number; fill?: string;
}) {
  const { x = 0, y = 0, width = 0, height = 0, name, size, fill } = props;
  const showName = width > 68 && height > 34;
  const showScore = width > 68 && height > 52;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={4} fill={fill} fillOpacity={0.86} stroke="var(--mx-card)" strokeWidth={2} />
      {showName && (
        <text x={x + 8} y={y + 20} fill="#fff" fontSize={12} fontWeight={700} style={{ pointerEvents: "none" }}>
          {name && name.length > width / 8 ? `${name.slice(0, Math.floor(width / 8))}…` : name}
        </text>
      )}
      {showScore && (
        <text x={x + 8} y={y + 38} fill="rgba(255,255,255,0.78)" fontSize={11} fontFamily="var(--mx-font-mono)" style={{ pointerEvents: "none" }}>
          {size}
        </text>
      )}
    </g>
  );
}

function TreemapTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Node }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border px-4 py-3 shadow-xl" style={{ borderColor: "var(--mx-border-2)", background: "color-mix(in srgb, var(--mx-surface) 95%, transparent)", backdropFilter: "blur(8px)" }}>
      <p className="m-0 font-bold text-sm" style={{ color: "var(--mx-fg)" }}>{d.name}</p>
      <p className="m-0 mt-0.5 text-xs" style={{ color: "var(--mx-muted)" }}>{d.category}</p>
      <div className="mt-2 flex flex-col gap-1 text-xs" style={{ color: "var(--mx-muted)" }}>
        <p className="m-0">Score CarbonCo : <span className="font-bold" style={{ fontFamily: "var(--mx-font-mono)", color: "var(--mx-amber)" }}>{d.size}</span></p>
        <p className="m-0">Part Chine : <span className="font-bold" style={{ fontFamily: "var(--mx-font-mono)", color: fillFor(d.china) }}>{d.china}%</span></p>
        <p className="m-0">Statut UE : <span className="font-semibold" style={{ color: "var(--mx-fg)" }}>{d.strategic ? "Stratégique (⊂ critique)" : "Critique"}</span></p>
      </div>
      <p className="m-0 mt-2 text-[10px]" style={{ color: "var(--mx-subtle)" }}>Cliquer pour le détail →</p>
    </div>
  );
}

export default function CriticalityTreemap({ materials }: Props) {
  const [view, setView] = useState<"treemap" | "bars">("treemap");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sorted = [...materials].sort((a, b) => (b.carbonco_supply_risk_score ?? 0) - (a.carbonco_supply_risk_score ?? 0));
  const data: Node[] = sorted.map(m => {
    const china = getChinaShare(m);
    return {
      id: m.id, name: m.name_fr, size: m.carbonco_supply_risk_score ?? 0,
      china, category: m.category, strategic: m.is_strategic_eu, fill: fillFor(china),
    };
  });
  const maxScore = Math.max(1, ...sorted.map(m => m.carbonco_supply_risk_score ?? 0));
  const selected = materials.find(m => m.id === selectedId) ?? null;

  const segBase = "px-3.5 py-1.5 rounded-[7px] border-none text-xs font-semibold cursor-pointer transition-colors";
  const segOn = { background: "color-mix(in srgb, var(--mx-em) 16%, transparent)", color: "var(--mx-em)" };
  const segOff = { background: "transparent", color: "var(--mx-muted)" };

  return (
    <section id="treemap" className="mx-anchor space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="m-0 mb-1.5 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ fontFamily: "var(--mx-font-mono)", color: "var(--mx-amber)" }}>
            <span className="w-[22px] h-px" style={{ background: "var(--mx-amber)" }} />
            Score CarbonCo
          </p>
          <h2 className="m-0 font-bold text-2xl tracking-tight" style={{ fontFamily: "var(--mx-font-display)", color: "var(--mx-fg)" }}>
            Treemap de risque d&apos;approvisionnement
          </h2>
          <p className="mt-1.5 mb-0 text-[13px] max-w-xl" style={{ color: "var(--mx-muted)" }}>
            Surface proportionnelle au score de risque (estimé). Couleur selon la part chinoise de production. Cliquer une tuile pour la fiche.
          </p>
        </div>
        <div className="flex items-center gap-4.5">
          <div className="flex gap-3.5 text-[11.5px]" style={{ color: "var(--mx-muted)" }}>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: "var(--mx-tier-high)" }} />Chine ≥ 50%</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: "var(--mx-tier-mid)" }} />20–49%</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: "var(--mx-tier-low)" }} />&lt; 20%</span>
          </div>
          <div className="flex p-[3px] rounded-[9px] border" style={{ borderColor: "var(--mx-border)", background: "var(--mx-card-2)" }}>
            <button type="button" onClick={() => setView("treemap")} className={segBase} style={view === "treemap" ? segOn : segOff}>Treemap</button>
            <button type="button" onClick={() => setView("bars")} className={segBase} style={view === "bars" ? segOn : segOff}>Classement</button>
          </div>
        </div>
      </div>

      {view === "treemap" ? (
        <div className="rounded-2xl border p-2 h-[420px] lg:h-[480px]" style={{ borderColor: "var(--mx-border)", background: "var(--mx-card)", boxShadow: "var(--mx-shadow)" }}>
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={data} dataKey="size" nameKey="name" aspectRatio={4 / 3}
              isAnimationActive={false}
              content={<TreemapCell />}
              onClick={(node: unknown) => {
                const id = (node as { id?: string })?.id;
                if (id) setSelectedId(prev => (prev === id ? null : id));
              }}
            >
              <Tooltip content={<TreemapTooltip />} />
            </Treemap>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="rounded-2xl border p-5 grid grid-cols-1 md:grid-cols-2 gap-x-9 gap-y-1.5" style={{ borderColor: "var(--mx-border)", background: "var(--mx-card)", boxShadow: "var(--mx-shadow)" }}>
          {sorted.map((m, i) => {
            const score = m.carbonco_supply_risk_score ?? 0;
            const color = fillFor(getChinaShare(m));
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedId(prev => (prev === m.id ? null : m.id))}
                className="flex items-center gap-3 px-2 py-1.5 rounded-lg border-none bg-transparent cursor-pointer text-left transition-colors hover:bg-[var(--mx-card-2)]"
              >
                <span className="w-[18px] font-semibold text-[10.5px]" style={{ fontFamily: "var(--mx-font-mono)", color: "var(--mx-subtle)" }}>{String(i + 1).padStart(2, "0")}</span>
                <span className="w-[130px] shrink-0 text-[12.5px] font-medium overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: "var(--mx-fg)" }}>{m.name_fr}</span>
                <div className="flex-1 h-3.5 rounded-md overflow-hidden" style={{ background: "var(--mx-chip)" }}>
                  <div className="h-full rounded-md" style={{ width: `${(score / maxScore) * 100}%`, background: `linear-gradient(90deg, color-mix(in srgb, ${color} 55%, transparent), ${color})` }} />
                </div>
                <span className="w-7 text-right font-bold text-xs" style={{ fontFamily: "var(--mx-font-mono)", color: "var(--mx-fg)" }}>{score.toFixed(1)}</span>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div
          className="rounded-2xl border p-5 md:p-6 grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr] gap-8"
          style={{ borderColor: "color-mix(in srgb, var(--mx-amber) 30%, var(--mx-border))", background: "linear-gradient(130deg, color-mix(in srgb, var(--mx-amber) 5%, transparent), transparent 50%), var(--mx-card)", boxShadow: "var(--mx-shadow)" }}
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <h3 className="m-0 font-bold text-[19px]" style={{ fontFamily: "var(--mx-font-display)", color: "var(--mx-fg)" }}>{selected.name_fr}</h3>
              <span
                className="font-semibold text-[10px] px-2.5 py-0.5 rounded-full"
                style={{ color: selected.is_strategic_eu ? "var(--mx-amber)" : "var(--mx-blue)", background: `color-mix(in srgb, ${selected.is_strategic_eu ? "var(--mx-amber)" : "var(--mx-blue)"} 14%, transparent)` }}
              >
                {selected.is_strategic_eu ? "Stratégique" : "Critique"}
              </span>
              <button type="button" onClick={() => setSelectedId(null)} className="ml-auto border-none bg-transparent cursor-pointer text-[15px] p-0.5" style={{ color: "var(--mx-subtle)" }} aria-label="Fermer le détail">✕</button>
            </div>
            <p className="m-0 text-xs" style={{ color: "var(--mx-subtle)" }}>{selected.category}</p>
            <div className="flex gap-6 mt-2">
              <div>
                <p className="m-0 font-bold text-2xl" style={{ fontFamily: "var(--mx-font-display)", color: "var(--mx-amber)" }}>{(selected.carbonco_supply_risk_score ?? 0).toFixed(1)}</p>
                <p className="m-0 mt-0.5 text-[11px]" style={{ color: "var(--mx-subtle)" }}>score de risque /10</p>
              </div>
              <div>
                <p className="m-0 font-bold text-2xl" style={{ fontFamily: "var(--mx-font-display)", color: fillFor(getChinaShare(selected)) }}>{getChinaShare(selected)}%</p>
                <p className="m-0 mt-0.5 text-[11px]" style={{ color: "var(--mx-subtle)" }}>part chinoise</p>
              </div>
              {selected.price_snapshot && (
                <div>
                  <p className="m-0 font-bold text-2xl" style={{ fontFamily: "var(--mx-font-display)", color: "var(--mx-fg)" }}>{selected.price_snapshot.value.toLocaleString("fr-FR")}</p>
                  <p className="m-0 mt-0.5 text-[11px]" style={{ color: "var(--mx-subtle)" }}>{selected.price_snapshot.unit}</p>
                </div>
              )}
            </div>
            <Link href={`/materials/${selected.id}`} className="mt-2 inline-flex w-fit items-center gap-1.5 text-xs font-semibold transition-colors" style={{ color: "var(--mx-amber)" }}>
              Fiche complète →
            </Link>
          </div>
          <div>
            <p className="m-0 mb-2.5 font-semibold text-[10.5px] uppercase tracking-[0.14em]" style={{ fontFamily: "var(--mx-font-mono)", color: "var(--mx-subtle)" }}>Usages clés</p>
            <div className="flex flex-col gap-1.5">
              {selected.main_uses.map(u => (
                <p key={u} className="m-0 flex gap-2 text-[13px]" style={{ color: "var(--mx-muted)" }}><span style={{ color: "var(--mx-amber)" }}>›</span><span>{u}</span></p>
              ))}
            </div>
          </div>
          <div>
            <p className="m-0 mb-2.5 font-semibold text-[10.5px] uppercase tracking-[0.14em]" style={{ fontFamily: "var(--mx-font-mono)", color: "var(--mx-subtle)" }}>Top producteurs</p>
            <div className="flex flex-col gap-2">
              {selected.top_producers.slice(0, 3).map(p => (
                <div key={p.country} className="flex items-center gap-2.5 text-[13px]">
                  <span className="w-24 shrink-0" style={{ color: "var(--mx-fg)" }}>{p.country}</span>
                  <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "var(--mx-chip)" }}>
                    <div className="h-full rounded-full" style={{ width: `${p.share_pct}%`, background: "var(--mx-amber)" }} />
                  </div>
                  <span className="w-9 text-right font-semibold text-xs" style={{ fontFamily: "var(--mx-font-mono)", color: "var(--mx-muted)" }}>{p.share_pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
