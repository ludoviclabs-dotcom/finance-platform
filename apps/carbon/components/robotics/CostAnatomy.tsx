"use client";

import Link from "next/link";
import { useState } from "react";
import type { BomItem, Chokepoint, KeyFigure as KeyFigureData, Layer } from "@/lib/robotics/dataLoader";
import { squarify } from "@/lib/crm/squarify";
import { Section } from "@/components/materials/industry/Section";
import { SectionKicker } from "@/components/materials/industry/SectionKicker";
import { QualityTag } from "./KeyFigure";
import { BOM_WEIGHT_META, bomWeight, formatIsoDate } from "./labels";
import {
  PanelFigure,
  PanelHead,
  PanelKicker,
  PanelNote,
  PanelText,
  PanelTitle,
  SectionHeading,
  ViewSwitch,
  VizFrame,
  cycle,
  useCountUp,
  useInView,
} from "./viz";

type View = "robot" | "treemap" | "trajectoire";
type Part = "lin" | "rot" | "mains" | "struct" | "ctrl" | "vis" | "ener";

export interface CostFigures {
  actuatorsHands: KeyFigureData;
  bom2025: KeyFigureData;
  bom2030: KeyFigureData;
  offChina: KeyFigureData;
  avgPrice: KeyFigureData;
  digitCost: KeyFigureData;
  digitHourly: KeyFigureData;
  wageUs: KeyFigureData;
  wageEu: KeyFigureData;
  roi: KeyFigureData;
}

/**
 * Où chaque poste du coût matériel se pose sur la silhouette : la pièce du
 * corps qu'il colore, le côté de sa légende et le point d'ancrage de son trait
 * (coordonnées du dessin avant recentrage). Un poste absent de cette table ne
 * figure que dans le treemap : le test de la page l'interdit.
 */
export const ROBOT_PLACEMENT: Record<string, { part: Part; side: "L" | "R"; y: number; ax: number }> = {
  "actionneurs-lineaires": { part: "lin", side: "L", y: 517, ax: 353 },
  "actionneurs-rotatifs": { part: "rot", side: "L", y: 246, ax: 295 },
  "mains-dextres": { part: "mains", side: "R", y: 380, ax: 492 },
  autres: { part: "struct", side: "R", y: 80, ax: 427 },
  controle: { part: "ctrl", side: "L", y: 156, ax: 362 },
  "vision-capteurs": { part: "vis", side: "L", y: 56, ax: 366 },
  energie: { part: "ener", side: "R", y: 223, ax: 420 },
};

// La silhouette est dessinée centrée sur x = 392, le graphique sur x = 330.
const SHIFT = -62;
const CALLOUT_W = 170;
const RIGHT_X = 660 - CALLOUT_W;

// Heures travaillées par an : convention du BLS pour annualiser un salaire horaire.
const BLS_HOURS = 2080;

const pctLabel = (b: BomItem) => (b.min_pct === b.max_pct ? `${b.max_pct} %` : `${b.min_pct}–${b.max_pct} %`);
const tierOf = (b: BomItem) => BOM_WEIGHT_META[bomWeight(b.max_pct)];
const nf = (v: number, digits = 0) => v.toLocaleString("fr-FR", { maximumFractionDigits: digits });

const robotIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="8" y="2" width="8" height="6" rx="2" />
    <path d="M7 10h10l-1 7H8z" />
    <path d="M9 17v5M15 17v5M7 10l-3 6M17 10l3 6" />
  </svg>
);

const VIEWS = [
  { id: "robot", label: "Robot éclaté", icon: robotIcon },
  { id: "treemap", label: "Treemap" },
  { id: "trajectoire", label: "Trajectoire" },
] as const;

const heading: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontWeight: 600,
  letterSpacing: ".02em",
  fontFeatureSettings: "'tnum' 1",
};

export default function CostAnatomy({
  bom,
  layers,
  chokepoints,
  figures,
  revealDelay,
  initialView = "robot",
}: {
  bom: BomItem[];
  layers: Pick<Layer, "id" | "name">[];
  chokepoints: Pick<Chokepoint, "id" | "title" | "layer_ids">[];
  figures: CostFigures;
  revealDelay?: number;
  initialView?: View;
}) {
  const [view, setView] = useState<View>(initialView);
  const [sel, setSel] = useState<string | null>(null);
  const [hov, setHov] = useState<string | null>(null);
  const [frameRef, inView] = useInView<HTMLElement>();
  const t = useCountUp(inView && view === "robot", view);

  const sorted = [...bom].sort((a, b) => b.max_pct - a.max_pct);
  const ids = sorted.map(b => b.id);
  const selected = sorted.find(b => b.id === sel) ?? null;
  const focus = sel ?? hov;
  const choose = (id: string) => setSel(prev => (prev === id ? null : id));
  const go = (next: View) => {
    setView(next);
    setSel(null);
    setHov(null);
  };
  const layerName = (id: string) => layers.find(l => l.id === id)?.name ?? id;

  // ── Robot éclaté ───────────────────────────────────────────────────────
  const itemOfPart = (part: Part) => bom.find(b => ROBOT_PLACEMENT[b.id]?.part === part);
  const partFill = (part: Part) => {
    const item = itemOfPart(part);
    return item ? tierOf(item).colorVar : "var(--color-surface)";
  };
  const partOpacity = (part: Part) => {
    const item = itemOfPart(part);
    return !focus || item?.id === focus ? 1 : 0.16;
  };
  const partStyle = (part: Part, delay: number): React.CSSProperties => ({ opacity: partOpacity(part), animationDelay: `${delay}s` });
  const fill = (part: Part) => ({ fill: partFill(part) });
  const lineOnBody = { stroke: "color-mix(in srgb, var(--color-bg) 55%, transparent)" };

  const placed = sorted.filter(b => ROBOT_PLACEMENT[b.id]);
  const callout = (b: BomItem, i: number) => {
    const p = ROBOT_PLACEMENT[b.id];
    return (
      <button
        key={b.id}
        type="button"
        className="rb-hit rb-fade"
        aria-pressed={sel === b.id}
        onClick={() => choose(b.id)}
        onMouseEnter={() => setHov(b.id)}
        onMouseLeave={() => setHov(null)}
        style={{
          position: "absolute",
          left: p.side === "L" ? 0 : RIGHT_X,
          top: p.y - 32,
          width: CALLOUT_W,
          minHeight: 64,
          boxSizing: "border-box",
          padding: "4px 10px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: p.side === "L" ? "flex-end" : "flex-start",
          textAlign: p.side === "L" ? "right" : "left",
          animationDelay: `${0.6 + i * 0.08}s`,
        }}
      >
        <span style={{ ...heading, fontSize: 34, lineHeight: "34px" }}>{t >= 1 ? pctLabel(b) : `${Math.round(b.max_pct * t)} %`}</span>
        <span style={{ ...heading, fontSize: 14, lineHeight: "17px", letterSpacing: ".04em", textTransform: "uppercase", color: "var(--ink-78)" }}>{b.label}</span>
      </button>
    );
  };

  const robot = (
    <div style={{ position: "relative", width: 660, height: 620 }}>
      <svg width={660} height={620} viewBox="0 0 660 620" style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} role="img" aria-label="Silhouette d’humanoïde dont chaque partie prend la teinte de son poids dans le coût matériel">
        <defs>
          <pattern id="rb-cost-struct" width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={5} height={5} style={{ fill: "var(--color-surface)" }} />
            <rect width={1.6} height={5} style={{ fill: partFill("struct") }} />
          </pattern>
        </defs>
        <g transform={`translate(${SHIFT} 0)`}>
          <g className="rb-dim rb-fade" style={partStyle("struct", 0.1)}>
            {[
              <rect key="head" x={357} y={24} width={70} height={74} rx={24} />,
              <rect key="neck" x={381} y={98} width={22} height={16} rx={3} />,
              <path key="torso" d="M330 114 H454 Q466 114 465 126 L451 262 Q450 272 440 272 H344 Q334 272 333 262 L319 126 Q318 114 330 114 Z" />,
              <path key="pelvis" d="M344 284 H440 L432 320 H352 Z" strokeLinejoin="round" />,
              <rect key="foot-l" x={344} y={580} width={46} height={16} rx={6} />,
              <rect key="foot-r" x={394} y={580} width={46} height={16} rx={6} />,
            ].map(shape => (
              <g key={shape.key} style={{ fill: "url(#rb-cost-struct)", stroke: partFill("struct") }}>
                {shape}
              </g>
            ))}
          </g>
          <g className="rb-dim rb-fade" style={partStyle("ener", 0.35)}>
            <rect x={386} y={188} width={12} height={5} style={fill("ener")} />
            <rect x={364} y={192} width={56} height={62} rx={4} strokeWidth={1.5} style={{ ...fill("ener"), stroke: "var(--mx-tier-mid)" }} />
            <path d="M364 212.7 H420 M364 233.3 H420" strokeWidth={1.5} style={{ stroke: "var(--mx-tier-mid)" }} />
          </g>
          <g className="rb-dim rb-fade" style={partStyle("ctrl", 0.4)}>
            <rect x={362} y={134} width={60} height={44} rx={4} style={fill("ctrl")} />
            <path d="M372 146 H392 V162 H412 M372 168 H384 M400 146 H412" fill="none" strokeWidth={1.5} strokeLinecap="round" style={lineOnBody} />
          </g>
          <g className="rb-dim rb-fade" style={partStyle("vis", 0.45)}>
            <rect x={366} y={46} width={52} height={20} rx={10} strokeWidth={1.5} style={{ ...fill("vis"), stroke: "var(--mx-tier-mid)" }} />
            <circle cx={380} cy={56} r={4} style={{ fill: "var(--mx-tier-high)" }} />
            <circle cx={404} cy={56} r={4} style={{ fill: "var(--mx-tier-high)" }} />
          </g>
          <g className="rb-dim rb-fade" style={partStyle("lin", 0.2)}>
            {[
              [292, 145, 28, 90, 12], [464, 145, 28, 90, 12], [294, 259, 24, 86, 11], [466, 259, 24, 86, 11],
              [352, 344, 28, 102, 13], [404, 344, 28, 102, 13], [353, 472, 26, 90, 12], [405, 472, 26, 90, 12],
            ].map(([x, y, w, h, r]) => (
              <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx={r} style={fill("lin")} />
            ))}
            {/* Le filet pointillé figure la vis à rouleaux du membre. */}
            <path d="M306 157 V223 M478 157 V223 M306 271 V333 M478 271 V333 M366 356 V434 M418 356 V434 M366 484 V550 M418 484 V550" strokeWidth={2} strokeDasharray="2 3" style={lineOnBody} />
          </g>
          <g className="rb-dim rb-fade" style={partStyle("rot", 0.3)}>
            {[
              [306, 128, 13], [478, 128, 13], [306, 246, 11], [478, 246, 11], [306, 356, 8], [478, 356, 8], [392, 277, 7],
              [366, 330, 12], [418, 330, 12], [366, 458, 12], [418, 458, 12], [366, 571, 8], [418, 571, 8],
            ].map(([cx, cy, r]) => (
              <g key={`${cx}-${cy}`}>
                <circle cx={cx} cy={cy} r={r} style={fill("rot")} />
                {r >= 11 && <circle cx={cx} cy={cy} r={r - 4.5} fill="none" strokeWidth={1} style={lineOnBody} />}
              </g>
            ))}
          </g>
          <g className="rb-dim rb-fade" style={partStyle("mains", 0.5)}>
            {[
              [292, 365, 28, 30, 6], [293, 393, 5, 26, 2.5], [299.5, 393, 5, 28, 2.5], [306, 393, 5, 27, 2.5], [312.5, 393, 5, 23, 2.5], [320, 370, 6, 18, 3],
              [464, 365, 28, 30, 6], [465, 393, 5, 23, 2.5], [471.5, 393, 5, 27, 2.5], [478, 393, 5, 28, 2.5], [484.5, 393, 5, 26, 2.5], [458, 370, 6, 18, 3],
            ].map(([x, y, w, h, r]) => (
              <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx={r} style={fill("mains")} />
            ))}
          </g>
        </g>
        <rect className="rb-scan" x={208} y={14} width={244} height={2} style={{ fill: "var(--color-accent)" }} />
        {placed.map((b, i) => {
          const p = ROBOT_PLACEMENT[b.id];
          const x1 = p.side === "L" ? CALLOUT_W + 4 : RIGHT_X - 4;
          const x2 = p.ax + SHIFT;
          const on = focus === b.id;
          const stroke = on ? "var(--color-text)" : "color-mix(in srgb, var(--color-text) 50%, transparent)";
          return (
            <g key={b.id} className="rb-fade" style={{ animationDelay: `${0.7 + i * 0.08}s` }}>
              <line x1={x1} x2={x2} y1={p.y} y2={p.y} strokeWidth={3} style={{ stroke: "var(--color-bg)" }} />
              <line x1={x1} x2={x2} y1={p.y} y2={p.y} strokeWidth={on ? 1.5 : 1} style={{ stroke }} />
              <circle cx={x2} cy={p.y} r={3.5} strokeWidth={1.5} style={{ fill: "var(--color-bg)", stroke }} />
            </g>
          );
        })}
      </svg>
      {placed.map(callout)}
      <div className="flex flex-col" style={{ position: "absolute", left: RIGHT_X + 10, top: 470, gap: 6, fontSize: 12, lineHeight: "16px", color: "var(--ink-70)" }}>
        {Object.values(BOM_WEIGHT_META).map(meta => (
          <span key={meta.label} className="flex items-center" style={{ gap: 6 }}>
            <i style={{ width: 10, height: 10, background: meta.colorVar, border: "1px solid var(--color-divider)" }} />
            {meta.label}
          </span>
        ))}
        <span className="flex items-center" style={{ gap: 6 }}>
          <i style={{ width: 10, height: 10, background: `repeating-linear-gradient(45deg, ${partFill("struct")} 0 1.6px, var(--color-surface) 1.6px 5px)`, border: "1px solid var(--color-divider)" }} />
          Structure diffuse
        </span>
      </div>
    </div>
  );

  // ── Treemap ────────────────────────────────────────────────────────────
  const TREE_H = 460;
  const tiles = squarify(sorted.map(b => ({ value: b.max_pct, bom: b })), 0, 0, 660, TREE_H);
  const treemap = (
    <div>
      <div style={{ position: "relative", width: 660, height: TREE_H }}>
        {tiles.map((tile, i) => {
          const b = tile.item.bom;
          const meta = tierOf(b);
          const big = tile.w > 200 && tile.h > 140;
          return (
            <button
              key={b.id}
              type="button"
              className="ind-tile rb-tile"
              aria-pressed={sel === b.id}
              onClick={() => choose(b.id)}
              title={`${b.label} — ${pctLabel(b)}`}
              style={{
                position: "absolute",
                left: tile.x,
                top: tile.y,
                width: tile.w,
                height: tile.h,
                boxSizing: "border-box",
                border: "1px solid var(--color-bg)",
                background: meta.colorVar,
                color: meta.ink,
                cursor: "pointer",
                overflow: "hidden",
                padding: 0,
                textAlign: "left",
                font: "inherit",
                animationDelay: `${0.1 + i * 0.06}s`,
              }}
            >
              <span style={{ ...heading, position: "absolute", left: 14, top: 12, right: 12, fontSize: big ? 56 : tile.w > 120 ? 36 : 24, lineHeight: 1, pointerEvents: "none", display: tile.w > 56 && tile.h > 36 ? "block" : "none" }}>
                {pctLabel(b)}
              </span>
              <span className="flex flex-col" style={{ position: "absolute", left: 14, right: 12, bottom: 12, gap: 2, pointerEvents: "none", display: tile.w > 110 && tile.h > 80 ? "flex" : "none" }}>
                <span style={{ ...heading, fontSize: 15, lineHeight: "18px", textTransform: "uppercase" }}>{b.label}</span>
                {big && <span style={{ fontSize: 12, lineHeight: "16px", opacity: 0.85 }}>{b.detail}</span>}
              </span>
            </button>
          );
        })}
      </div>
      <p style={{ margin: "12px 0 0", fontSize: 12, lineHeight: "18px", color: "var(--ink-70)" }}>
        Surface de chaque tuile proportionnelle à sa part du coût matériel projeté. Choisir une tuile pour la lire.
      </p>
    </div>
  );

  // ── Trajectoire ────────────────────────────────────────────────────────
  // Le prix moyen est publié comme une trajectoire « départ → arrivée » :
  // value_label et as_of se découpent sur leur flèche et leur tiret.
  const [priceFrom, priceTo] = figures.avgPrice.value_label.split(" → ");
  const [priceFromYear, priceToYear] = figures.avgPrice.as_of.split("–");
  const rows = [
    {
      title: "Coût matériel en Chine",
      sub: "BofA Global Research",
      from: { v: figures.bom2025.max, label: `${formatIsoDate(figures.bom2025.as_of)} · ${figures.bom2025.value_label}` },
      to: { v: figures.bom2030.max, label: `${formatIsoDate(figures.bom2030.as_of)} · ${figures.bom2030.value_label}` },
    },
    {
      title: "Prix de vente moyen",
      sub: "Yole Group",
      from: { v: figures.avgPrice.max, label: `${priceFromYear} · ${priceFrom}` },
      to: { v: figures.avgPrice.min, label: `${priceToYear} · ${priceTo}` },
    },
    {
      title: "Coût de production d’un Digit",
      sub: "Agility Robotics",
      from: null,
      to: { v: figures.digitCost.max, label: `${formatIsoDate(figures.digitCost.as_of)} · ${figures.digitCost.value_label}` },
    },
  ];
  const X0 = 180;
  const X1 = 640;
  const axisMax = Math.ceil(Math.max(...rows.map(r => r.to.v), ...rows.map(r => r.from?.v ?? 0)) / 20000) * 20000;
  const xOf = (v: number) => X0 + (v / axisMax) * (X1 - X0);
  const ROW_H = 76;
  const ticks = Array.from({ length: axisMax / 20000 + 1 }, (_, i) => i * 20000);

  const wageHourly = figures.wageUs.max / BLS_HOURS;
  const hourlyMax = Math.max(figures.digitHourly.max, wageHourly) * 1.1;

  const trajectory = (
    <div className="rb-fade" style={{ width: 660 }}>
      <PanelKicker>Le coût par robot fond · en dollars</PanelKicker>
      <svg width={660} height={rows.length * ROW_H + 30} viewBox={`0 0 660 ${rows.length * ROW_H + 30}`} role="img" aria-label="Coûts et prix d’un humanoïde, valeur de départ et valeur projetée">
        {ticks.map(v => (
          <g key={v}>
            <line x1={xOf(v)} x2={xOf(v)} y1={0} y2={rows.length * ROW_H} strokeWidth={1} style={{ stroke: v === 0 ? "color-mix(in srgb, var(--color-text) 30%, transparent)" : "color-mix(in srgb, var(--color-text) 8%, transparent)" }} />
            <text x={xOf(v)} y={rows.length * ROW_H + 18} textAnchor="middle" style={{ fontSize: 11, fill: "var(--ink-70)", fontFeatureSettings: "'tnum' 1" }}>
              {v === 0 ? "0" : `${v / 1000} k$`}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const y = i * ROW_H + ROW_H / 2;
          const xTo = xOf(r.to.v);
          const xFrom = r.from ? xOf(r.from.v) : xTo;
          const dir = xTo < xFrom ? 1 : -1;
          return (
            <g key={r.title}>
              <text x={0} y={y - 2} style={{ fontSize: 14, fontWeight: 600, fill: "var(--color-text)" }}>{r.title}</text>
              <text x={0} y={y + 15} style={{ fontSize: 12, fill: "var(--ink-70)" }}>{r.sub}</text>
              {r.from && (
                <>
                  <line className="rb-draw" x1={xFrom} y1={y} x2={xTo + dir * 8} y2={y} strokeWidth={2.5} style={{ stroke: "var(--mx-tier-high)", animationDelay: `${0.3 + i * 0.25}s` }} />
                  <path
                    className="rb-fade"
                    d={`M${xTo + dir * 14} ${y - 5} L${xTo + dir * 7} ${y} L${xTo + dir * 14} ${y + 5}`}
                    fill="none"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ stroke: "var(--mx-tier-high)", animationDelay: `${1.2 + i * 0.25}s` }}
                  />
                  <circle className="rb-pop" cx={xFrom} cy={y} r={5.5} style={{ fill: "var(--mx-tier-high)", animationDelay: `${0.2 + i * 0.25}s` }} />
                  <text x={xFrom} y={y + 24} textAnchor="middle" style={{ fontSize: 12, fill: "var(--ink-78)", fontFeatureSettings: "'tnum' 1" }}>{r.from.label}</text>
                </>
              )}
              <circle className="rb-pop" cx={xTo} cy={y} r={5.5} strokeWidth={2} style={{ fill: r.from ? "var(--color-bg)" : "var(--mx-tier-high)", stroke: "var(--mx-tier-high)", animationDelay: `${1.2 + i * 0.25}s` }} />
              {/* Près du bord gauche, l'étiquette part du point pour ne pas toucher le titre de la ligne. */}
              <text
                x={xTo < X0 + 120 ? xTo - 8 : xTo}
                y={y - 13}
                textAnchor={xTo > 560 ? "end" : xTo < X0 + 120 ? "start" : "middle"}
                style={{ ...heading, fontSize: 15, fill: "var(--color-text)" }}
              >
                {r.to.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap" style={{ gap: "24px 40px", marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--color-divider)" }}>
        <div className="min-w-0" style={{ flex: "1 1 280px" }}>
          <PanelKicker>Sans fournisseurs chinois</PanelKicker>
          <div className="grid items-center" style={{ gridTemplateColumns: "110px minmax(0,1fr)", gap: "8px 12px", fontSize: 13, lineHeight: "18px" }}>
            <span>Chaîne chinoise</span>
            <i className="rb-growx" style={{ display: "block", height: 14, width: `${100 / figures.offChina.max}%`, background: "var(--mx-tier-mid)", animationDelay: ".3s" }} />
            <span>Hors Chine</span>
            <i className="rb-growx" style={{ display: "block", height: 14, width: "100%", background: "var(--mx-tier-high)", animationDelay: ".5s" }} />
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: "20px", color: "var(--ink-78)" }}>
            <b style={{ ...heading, fontSize: 22 }}>{figures.offChina.value_label}</b> · {figures.offChina.label}, {formatIsoDate(figures.offChina.as_of)}{" "}
            <QualityTag quality={figures.offChina.provenance.data_quality} />
          </p>
        </div>
        <div className="min-w-0" style={{ flex: "1 1 280px" }}>
          <PanelKicker>Face au coût du travail · $ de l’heure</PanelKicker>
          <div className="grid items-center" style={{ gridTemplateColumns: "110px minmax(0,1fr) 64px", gap: "8px 12px", fontSize: 13, lineHeight: "18px" }}>
            <span>Digit, exploitation</span>
            <span style={{ position: "relative", height: 14, background: "color-mix(in srgb, var(--color-text) 6%, transparent)" }}>
              <i
                className="rb-growx"
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: `${(figures.digitHourly.min / hourlyMax) * 100}%`,
                  width: `${((figures.digitHourly.max - figures.digitHourly.min) / hourlyMax) * 100}%`,
                  minWidth: 3,
                  background: "var(--mx-tier-high)",
                  animationDelay: ".4s",
                }}
              />
            </span>
            <span style={{ ...heading, fontSize: 16, textAlign: "right" }}>{figures.digitHourly.min}–{figures.digitHourly.max} $</span>
            <span>Ouvrier de production, États-Unis</span>
            <span style={{ position: "relative", height: 14, background: "color-mix(in srgb, var(--color-text) 6%, transparent)" }}>
              <i className="rb-growx" style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${(wageHourly / hourlyMax) * 100}%`, background: "var(--mx-tier-mid)", animationDelay: ".6s" }} />
            </span>
            <span style={{ ...heading, fontSize: 16, textAlign: "right" }}>≈ {nf(wageHourly, 1)} $</span>
          </div>
          <p className="flex flex-wrap items-center" style={{ margin: "10px 0 0", gap: "4px 6px", fontSize: 12, lineHeight: "18px", color: "var(--ink-70)" }}>
            Digit : estimation {formatIsoDate(figures.digitHourly.as_of)} <QualityTag quality={figures.digitHourly.provenance.data_quality} /> · Ouvrier : {figures.wageUs.value_label} par an (
            {formatIsoDate(figures.wageUs.as_of)}) ramenés à {nf(BLS_HOURS)} heures, convention du BLS <span className="ind-tag ind-tag-neutral">Calcul</span>
          </p>
        </div>
      </div>
    </div>
  );

  // ── Panneau de lecture ─────────────────────────────────────────────────
  const actuatorShare = bom.filter(b => b.layer_ids.includes("moteurs-actionneurs")).reduce((s, b) => s + b.max_pct, 0);
  const worse = (a: KeyFigureData, b: KeyFigureData) => (a.provenance.data_quality === "verified" ? b.provenance.data_quality : a.provenance.data_quality);

  const overview = (
    <div>
      <PanelKicker>Lecture · coût matériel {figures.actuatorsHands.as_of}</PanelKicker>
      <PanelTitle>{figures.actuatorsHands.value_label} dans les articulations et les mains</PanelTitle>
      <PanelText>
        Les postes qui passent par les moteurs et actionneurs pèsent {actuatorShare} % du coût, et chaque articulation repose sur un moteur
        à aimants NdFeB.
      </PanelText>
      <div className="flex" style={{ height: 18, gap: 1, margin: "6px 0 8px" }} aria-hidden="true">
        {sorted.map((b, i) => (
          <i key={b.id} className="rb-growx" title={b.label} style={{ display: "block", height: 18, width: `${b.max_pct}%`, background: tierOf(b).colorVar, animationDelay: `${0.2 + i * 0.07}s` }} />
        ))}
      </div>
      <div className="flex flex-wrap" style={{ gap: "6px 14px", marginBottom: 18, fontSize: 12, lineHeight: "16px", color: "var(--ink-70)" }}>
        {Object.values(BOM_WEIGHT_META).map(meta => (
          <span key={meta.label} className="flex items-center" style={{ gap: 6 }}>
            <i style={{ width: 10, height: 10, background: meta.colorVar, border: "1px solid var(--color-divider)" }} />
            {meta.label}
          </span>
        ))}
      </div>
      <PanelFigure
        value={`${figures.bom2025.value_label} → ${figures.bom2030.value_label}`}
        label={`${figures.bom2030.label}, ${formatIsoDate(figures.bom2025.as_of)} → ${formatIsoDate(figures.bom2030.as_of)}`}
        meta={<QualityTag quality={worse(figures.bom2025, figures.bom2030)} />}
      />
      <PanelFigure
        value={figures.offChina.value_label}
        label={figures.offChina.label}
        meta={<>{formatIsoDate(figures.offChina.as_of)} <QualityTag quality={figures.offChina.provenance.data_quality} /></>}
      />
      <button type="button" className="ind-btn ind-btn-secondary" onClick={() => go("trajectoire")} style={{ marginTop: 14 }}>
        Voir la trajectoire du coût →
      </button>
    </div>
  );

  const exposed = selected ? chokepoints.filter(c => c.layer_ids.some(id => selected.layer_ids.includes(id))) : [];
  const detail = selected && (
    <div>
      <PanelHead
        kicker={`Poste de coût · ${figures.actuatorsHands.as_of}`}
        onPrev={() => setSel(cycle(ids, selected.id, -1))}
        onNext={() => setSel(cycle(ids, selected.id, 1))}
        onClose={() => setSel(null)}
        prevLabel="Poste précédent"
        nextLabel="Poste suivant"
      />
      <span style={{ ...heading, display: "block", fontSize: 64, lineHeight: "60px" }}>{pctLabel(selected)}</span>
      <PanelTitle style={{ marginTop: 6 }}>{selected.label}</PanelTitle>
      <PanelText>{selected.detail}</PanelText>
      <PanelKicker>Couches de la chaîne</PanelKicker>
      <div className="flex flex-col" style={{ gap: 4, marginBottom: 16 }}>
        {selected.layer_ids.map(id => (
          <Link key={id} href={`/robotics/${id}`} style={{ fontSize: 14, lineHeight: "20px" }}>
            {layerName(id)} →
          </Link>
        ))}
      </div>
      <PanelKicker>Goulots d’étranglement exposés</PanelKicker>
      {exposed.length > 0 ? (
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          {exposed.map(c => (
            <a key={c.id} href="#goulots" className="ind-tag ind-tag-outline">
              {c.title}
            </a>
          ))}
        </div>
      ) : (
        <PanelText small>Aucun goulot identifié dans le snapshot.</PanelText>
      )}
    </div>
  );

  const trajectoryPanel = (
    <div>
      <PanelKicker>Lecture</PanelKicker>
      <PanelTitle>Le coût matériel fond</PanelTitle>
      <PanelText>
        {figures.bom2025.value_label} en {formatIsoDate(figures.bom2025.as_of)}, {figures.bom2030.value_label.toLowerCase()} projetés en{" "}
        {formatIsoDate(figures.bom2030.as_of)} pour un humanoïde assemblé en Chine. Sans fournisseurs chinois, Optimus Gen 2 coûterait{" "}
        {figures.offChina.value_label} plus cher en matériel.
      </PanelText>
      <PanelText>
        L’heure d’exploitation estimée de Digit ({figures.digitHourly.value_label}) se compare à environ {nf(wageHourly, 1)} $ de l’heure
        pour un ouvrier de production américain payé au salaire médian.
      </PanelText>
      <PanelFigure
        value={figures.digitCost.value_label}
        label={figures.digitCost.label}
        meta={<>{formatIsoDate(figures.digitCost.as_of)} <QualityTag quality={figures.digitCost.provenance.data_quality} /></>}
      />
      <PanelFigure value={figures.roi.value_label} label={figures.roi.label} meta={<>{formatIsoDate(figures.roi.as_of)} <QualityTag quality={figures.roi.provenance.data_quality} /></>} />
      <PanelFigure
        value={figures.wageEu.value_label}
        label={figures.wageEu.label}
        meta={<>{formatIsoDate(figures.wageEu.as_of)} <QualityTag quality={figures.wageEu.provenance.data_quality} /></>}
      />
      <PanelNote>Coût matériel, coût de production et prix de vente sont trois grandeurs différentes : elles se lisent côte à côte, pas l’une contre l’autre.</PanelNote>
    </div>
  );

  return (
    <Section id="cout" revealDelay={revealDelay}>
      <SectionKicker>04 · Anatomie du coût</SectionKicker>
      <SectionHeading
        title="Où se loge la valeur matérielle"
        lead={`Le coût matériel projeté d’un humanoïde assemblé en Chine en ${figures.actuatorsHands.as_of}, poste par poste, posé sur le corps du robot (BofA Global Research).`}
        aside={<ViewSwitch name="rb-cost-view" value={view} options={VIEWS} onChange={go} />}
      />
      <VizFrame
        frameRef={frameRef}
        play={inView}
        chart={view === "robot" ? robot : view === "treemap" ? treemap : trajectory}
        panel={view === "trajectoire" ? trajectoryPanel : selected ? detail : overview}
      />
    </Section>
  );
}
