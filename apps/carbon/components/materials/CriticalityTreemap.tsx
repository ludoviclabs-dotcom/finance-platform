"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useReducedMotion } from "framer-motion";
import type { Material } from "@/lib/crm/dataLoader";
import { getChinaShare, getChinaTier } from "@/lib/crm/dataLoader";
import { CHINA_TIER_META } from "@/lib/crm/chinaTier";
import { squarify } from "@/lib/crm/squarify";
import { Frame } from "./industry/Frame";
import { SectionKicker, SectionTitle, SectionLead } from "./industry/SectionKicker";
import Atlas3D from "./atlas/Atlas3D";

interface Props { materials: Material[] }

type View = "treemap" | "bars" | "3d";

const TREEMAP_H = 520;
const ATLAS_H = 640;

// Encre lisible sur chaque palier — les trois teintes acier n'ont pas le même
// contraste, une seule couleur de texte ne conviendrait pas aux trois.
const INK_ON_TIER: Record<string, string> = {
  high: "var(--ink-on-high)",
  mid: "var(--ink-on-mid)",
  low: "var(--ink-on-low)",
};

const LEAD: Record<View, string> = {
  treemap:
    "Surface proportionnelle au score de risque (estimé). Teinte selon la part chinoise de production. Cliquer une tuile pour la fiche.",
  bars:
    "Les 34 matières classées par score de risque (estimé). Teinte selon la part chinoise de production.",
  "3d":
    "Atlas 3D — l'anneau des matières autour du globe des producteurs. Glisser pour tourner, cliquer une matière pour sa fiche.",
};

/** Dimensions internes du cadre du treemap, mesurées pour poser les tuiles. */
function useMeasuredBox(active: boolean) {
  const ref = useRef<HTMLElement>(null);
  const [box, setBox] = useState({ w: 1198, h: TREEMAP_H - 2 });

  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    const measure = () => {
      // −2 : le cadre porte un filet de 1px de chaque côté.
      const w = el.clientWidth - 2;
      const h = el.clientHeight - 2;
      if (w > 0 && h > 0) setBox(prev => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [active]);

  return { ref, box };
}

export default function CriticalityTreemap({ materials }: Props) {
  const prefersReducedMotion = useReducedMotion();
  const animate = !prefersReducedMotion;
  const [view, setView] = useState<View>("treemap");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { ref: treeRef, box } = useMeasuredBox(view === "treemap");

  const sorted = [...materials].sort(
    (a, b) => (b.carbonco_supply_risk_score ?? 0) - (a.carbonco_supply_risk_score ?? 0)
  );
  const maxScore = Math.max(1, ...sorted.map(m => m.carbonco_supply_risk_score ?? 0));
  const selected = materials.find(m => m.id === selectedId) ?? null;
  const toggle = (id: string) => setSelectedId(prev => (prev === id ? null : id));

  const tiles = squarify(
    sorted.map(m => ({ value: m.carbonco_supply_risk_score ?? 0, material: m })),
    0, 0, box.w, box.h
  );

  return (
    <section id="risque" className="mx-anchor">
      <SectionKicker>04 · Score CarbonCo</SectionKicker>

      <div className="flex items-end justify-between gap-6 flex-wrap mb-8">
        <div>
          <SectionTitle>Risque d&apos;approvisionnement</SectionTitle>
          <SectionLead>{LEAD[view]}</SectionLead>
        </div>
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex gap-4 flex-wrap" style={{ fontSize: 12, color: "var(--ink-70)" }}>
            {(["high", "mid", "low"] as const).map(tier => (
              <span key={tier} className="flex items-center gap-1.5">
                <i style={{ width: 10, height: 10, background: CHINA_TIER_META[tier].colorVar, border: "1px solid var(--color-divider)" }} />
                {tier === "high" ? "Chine ≥ 50 %" : tier === "mid" ? "20–49 %" : "< 20 %"}
              </span>
            ))}
          </div>
          <div className="ind-seg" role="group" aria-label="Vue">
            <label className="ind-seg-opt">
              <input type="radio" name="mx-view" checked={view === "treemap"} onChange={() => setView("treemap")} />
              Treemap
            </label>
            <label className="ind-seg-opt">
              <input type="radio" name="mx-view" checked={view === "bars"} onChange={() => setView("bars")} />
              Classement
            </label>
            <label className="ind-seg-opt">
              <input type="radio" name="mx-view" checked={view === "3d"} onChange={() => setView("3d")} />
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <path d="m3.3 7 8.7 5 8.7-5" />
                <path d="M12 22V12" />
              </svg>
              Atlas 3D
            </label>
          </div>
        </div>
      </div>

      {view === "treemap" && (
        <Frame as="figure" ref={treeRef} className="m-0" style={{ height: TREEMAP_H }}>
          {tiles.map((t, i) => {
            const m = t.item.material;
            const tier = getChinaTier(getChinaShare(m));
            const showName = t.w > 64 && t.h > 30;
            const showScore = t.w > 64 && t.h > 56;
            // Troncature à la largeur disponible : ~7,5px par glyphe en
            // Barlow Condensed 15px.
            const maxChars = Math.floor(t.w / 7.5);
            const label = m.name_fr.length > maxChars ? `${m.name_fr.slice(0, maxChars - 1)}…` : m.name_fr;
            const isOn = selectedId === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle(m.id)}
                title={`${m.name_fr} — score ${m.carbonco_supply_risk_score}`}
                className={animate ? "ind-tile-in" : undefined}
                style={{
                  position: "absolute",
                  left: t.x, top: t.y, width: t.w, height: t.h,
                  boxSizing: "border-box",
                  border: "1px solid var(--color-bg)",
                  background: CHINA_TIER_META[tier].colorVar,
                  color: INK_ON_TIER[tier],
                  cursor: "pointer",
                  overflow: "hidden",
                  padding: 0,
                  textAlign: "left",
                  font: "inherit",
                  outline: isOn ? "1px solid var(--color-text)" : "none",
                  outlineOffset: -1,
                  animationDelay: animate ? `${0.15 + i * 0.03}s` : undefined,
                }}
              >
                <span
                  style={{
                    position: "absolute", left: 8, top: 6,
                    fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 15, lineHeight: "18px",
                    letterSpacing: ".02em", textTransform: "uppercase", whiteSpace: "nowrap",
                    display: showName ? "block" : "none", pointerEvents: "none",
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    position: "absolute", left: 8, top: 26,
                    fontSize: 12, fontWeight: 500, opacity: 0.8, fontFeatureSettings: "'tnum' 1",
                    display: showScore ? "block" : "none", pointerEvents: "none",
                  }}
                >
                  {(m.carbonco_supply_risk_score ?? 0).toFixed(1)}
                </span>
              </button>
            );
          })}
        </Frame>
      )}

      {view === "bars" && (
        <Frame className="grid grid-cols-1 md:grid-cols-2 gap-x-12" style={{ padding: "8px 24px" }}>
          {sorted.map((m, i) => {
            const score = m.carbonco_supply_risk_score ?? 0;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle(m.id)}
                className="grid grid-cols-[28px_minmax(0,110px)_minmax(0,1fr)_40px] sm:grid-cols-[28px_150px_minmax(0,1fr)_40px] gap-3 items-center text-left"
                style={{
                  padding: "8px 0", border: 0,
                  borderBottom: "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)",
                  background: "transparent", color: "inherit", font: "inherit", cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".08em", color: "var(--color-accent-700)", fontFeatureSettings: "'tnum' 1" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">{m.name_fr}</span>
                <div style={{ height: 12, background: "var(--color-divider)" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${(score / maxScore) * 100}%`,
                      background: CHINA_TIER_META[getChinaTier(getChinaShare(m))].colorVar,
                      transition: "width .8s cubic-bezier(.16,1,.3,1)",
                    }}
                  />
                </div>
                <span style={{ textAlign: "right", fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 18, letterSpacing: ".02em", fontFeatureSettings: "'tnum' 1" }}>
                  {score.toFixed(1)}
                </span>
              </button>
            );
          })}
        </Frame>
      )}

      {view === "3d" && (
        <>
          <Frame as="figure" className="m-0" style={{ height: ATLAS_H }}>
            <Atlas3D materials={materials} />
          </Frame>
          <p style={{ margin: "16px 0 0", fontSize: 13, lineHeight: "20px", color: "var(--ink-70)", maxWidth: "80ch" }}>
            Anneau des {materials.length} matières autour du globe : hauteur proportionnelle au score de risque, teinte
            selon la part chinoise. Cliquer une matière fait pivoter le globe vers ses producteurs et trace les flux
            vers l&apos;Europe ; les filtres en haut à gauche isolent les matières par famille de composants.
          </p>
        </>
      )}

      {/* La fiche est partagée par le treemap et le classement. L'Atlas 3D a la
          sienne, ancrée dans la scène — la répéter ici ferait doublon. */}
      {selected && view !== "3d" && (
        <Frame className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr]" style={{ marginTop: 32 }}>
          <div className="border-b md:border-b-0 md:border-r" style={{ padding: 24, borderColor: "var(--color-divider)" }}>
            <div className="flex items-center gap-3 flex-wrap">
              <h3
                style={{
                  margin: 0, fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 32,
                  lineHeight: "32px", letterSpacing: ".02em", textTransform: "uppercase",
                }}
              >
                {selected.name_fr}
              </h3>
              <span className={selected.is_strategic_eu ? "ind-tag ind-tag-accent" : "ind-tag ind-tag-outline"}>
                {selected.is_strategic_eu ? "Stratégique" : "Critique"}
              </span>
              <button
                type="button"
                className="ind-btn ind-btn-ghost ml-auto"
                onClick={() => setSelectedId(null)}
                aria-label="Fermer le détail"
              >
                ✕
              </button>
            </div>
            <p style={{ margin: "4px 0 20px", fontSize: 13, color: "var(--ink-70)" }}>{selected.category}</p>
            <div className="flex flex-wrap gap-6">
              <div>
                <p style={{ margin: 0, fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 40, lineHeight: "40px", letterSpacing: ".02em", fontFeatureSettings: "'tnum' 1" }}>
                  {(selected.carbonco_supply_risk_score ?? 0).toFixed(1)}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 12, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-70)" }}>score /10</p>
              </div>
              <div>
                <p style={{ margin: 0, fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 40, lineHeight: "40px", letterSpacing: ".02em", fontFeatureSettings: "'tnum' 1" }}>
                  {getChinaShare(selected)} %
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 12, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-70)" }}>part chinoise</p>
              </div>
              {selected.price_snapshot && (
                <div>
                  <p style={{ margin: 0, fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 40, lineHeight: "40px", letterSpacing: ".02em", fontFeatureSettings: "'tnum' 1" }}>
                    {selected.price_snapshot.value.toLocaleString("fr-FR")}
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-70)" }}>
                    {selected.price_snapshot.unit}
                  </p>
                </div>
              )}
            </div>
            <Link href={`/materials/${selected.id}`} className="ind-btn ind-btn-secondary" style={{ marginTop: 24 }}>
              Fiche complète →
            </Link>
          </div>

          <div className="border-b md:border-b-0 md:border-r" style={{ padding: 24, borderColor: "var(--color-divider)" }}>
            <p style={{ margin: "0 0 12px", fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600, color: "var(--ink-70)" }}>
              Usages clés
            </p>
            <div className="flex flex-col gap-2">
              {selected.main_uses.map(u => (
                <p key={u} style={{ margin: 0, display: "flex", gap: 10, fontSize: 14, lineHeight: "20px", color: "var(--ink-78)" }}>
                  <span style={{ color: "var(--color-accent-700)" }}>›</span>
                  <span>{u}</span>
                </p>
              ))}
            </div>
          </div>

          <div style={{ padding: 24 }}>
            <p style={{ margin: "0 0 12px", fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600, color: "var(--ink-70)" }}>
              Top producteurs
            </p>
            <div className="flex flex-col gap-2.5">
              {selected.top_producers.slice(0, 3).map(p => (
                <div key={p.country} className="grid grid-cols-[96px_minmax(0,1fr)_44px] gap-3 items-center" style={{ fontSize: 14 }}>
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis">{p.country}</span>
                  <div style={{ height: 3, background: "var(--color-divider)" }}>
                    <div style={{ height: "100%", width: `${p.share_pct}%`, background: "var(--color-accent)" }} />
                  </div>
                  <span style={{ textAlign: "right", fontWeight: 600, color: "var(--ink-70)", fontFeatureSettings: "'tnum' 1" }}>
                    {p.share_pct} %
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Frame>
      )}
    </section>
  );
}
