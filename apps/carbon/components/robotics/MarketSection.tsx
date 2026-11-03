"use client";

import { useState } from "react";
import type { Actor, KeyFigure as KeyFigureData, MarketProjection, Oem } from "@/lib/robotics/dataLoader";
import { countryLabelFr } from "@/lib/iso3166";
import { Section } from "@/components/materials/industry/Section";
import { SectionKicker } from "@/components/materials/industry/SectionKicker";
import { QualityTag } from "./KeyFigure";
import { BLOC_COLOR, VOLUME_KIND_LABEL, blocHatch, formatBnUsd, formatIsoDate, institutionBase, institutionShort } from "./labels";
import {
  PanelFigure,
  PanelHead,
  PanelHint,
  PanelKicker,
  PanelNote,
  PanelText,
  PanelTitle,
  SectionHeading,
  ViewSwitch,
  VizFrame,
  cycle,
  useInView,
} from "./viz";

type View = "projections" | "volumes" | "constructeurs";

export interface VolumeStep {
  figure: KeyFigureData;
  /** Livraisons de l'année, ou parc en service (une autre grandeur). */
  kind: "livraisons" | "parc";
  caption: string;
}

const nf = (v: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
// Math.log10 peut différer au dernier chiffre entre Node et le navigateur :
// arrondies au dixième de pixel, les coordonnées s'hydratent sans écart.
const r1 = (v: number) => Math.round(v * 10) / 10;
const unitScale = (unit: string) => (unit.startsWith("millions") ? 1e6 : 1);

const chartIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 20h18" />
    <path d="M4 16 10 12l4 2 6-9" />
    <path d="M15 5h5v5" />
  </svg>
);

const VIEWS = [
  { id: "projections", label: "Projections", icon: chartIcon },
  { id: "volumes", label: "Volumes" },
  { id: "constructeurs", label: "Constructeurs" },
] as const;

const heading: React.CSSProperties = { fontFamily: "var(--font-heading)", fontWeight: 600, letterSpacing: ".02em", fontFeatureSettings: "'tnum' 1" };
const axisText: React.CSSProperties = { fontSize: 11, fill: "var(--ink-70)", fontFeatureSettings: "'tnum' 1" };

/** Année entre parenthèses d'une institution (« révision 2026 »), 0 sinon. */
const editionYear = (name: string) => Number(/\((?:[^)]*?)(\d{4})\)/.exec(name)?.[1] ?? 0);

export default function MarketSection({
  projections,
  oems,
  actors,
  steps,
  deliveries,
  chinaShare,
  fleet,
  proUse,
  revealDelay,
  initialView = "projections",
}: {
  projections: MarketProjection[];
  oems: Oem[];
  actors: Pick<Actor, "id" | "name" | "countries" | "bloc">[];
  steps: VolumeStep[];
  deliveries: KeyFigureData;
  chinaShare: KeyFigureData;
  fleet: { total: KeyFigureData; china: KeyFigureData; usa: KeyFigureData };
  proUse: KeyFigureData;
  revealDelay?: number;
  initialView?: View;
}) {
  const [view, setView] = useState<View>(initialView);
  const [sel, setSel] = useState<string | null>(null);
  const [frameRef, inView] = useInView<HTMLElement>();
  const go = (next: View) => {
    setView(next);
    setSel(null);
  };
  const toggle = (id: string) => setSel(prev => (prev === id ? null : id));

  // ── Projections : horizons en colonnes, axe log en Md$ ─────────────────
  const horizons = [...new Set(projections.map(p => p.horizon))].sort((a, b) => a - b);
  const colX = (i: number) => (horizons.length > 1 ? 95 + (i * 480) / (horizons.length - 1) : 330);
  const decades = Math.max(1, Math.ceil(Math.log10(Math.max(...projections.map(p => p.max_bn_usd), 10))));
  const Y_TOP = 40;
  const Y_BASE = 548;
  const yOf = (v: number) => r1(Y_BASE - (Math.log10(Math.max(1, v)) / decades) * (Y_BASE - Y_TOP));

  // Dans une colonne : la fourchette des cabinets d'abord, puis une case par
  // institution (ses révisions s'empilent dans la même case).
  type Placed = MarketProjection & { x: number; side: "L" | "R" | "B"; slot: string };
  const placed: Placed[] = horizons.flatMap((h, hi) => {
    const here = projections.filter(p => p.horizon === h);
    const slots: { key: string; items: MarketProjection[]; range: boolean }[] = [];
    for (const p of [...here].sort((a, b) => Number(b.max_bn_usd > b.min_bn_usd) - Number(a.max_bn_usd > a.min_bn_usd) || a.max_bn_usd - b.max_bn_usd)) {
      const range = p.max_bn_usd > p.min_bn_usd;
      const key = range ? `range-${p.id}` : institutionBase(p.institution);
      const slot = slots.find(s => s.key === key);
      if (slot) slot.items.push(p);
      else slots.push({ key, items: [p], range });
    }
    const last = hi === horizons.length - 1;
    return slots.flatMap((s, si) => {
      const x = colX(hi) + (si - (slots.length - 1) / 2) * 48;
      const side: Placed["side"] = s.range && slots.length > 1 ? "L" : last && slots.length > 1 ? (si === 0 ? "L" : si === slots.length - 1 ? "B" : "R") : "R";
      return s.items.map(p => ({ ...p, x, side, slot: `${h}-${s.key}` }));
    });
  });

  const envelope = horizons.map((h, i) => {
    const here = projections.filter(p => p.horizon === h);
    return { x: colX(i), top: yOf(Math.max(...here.map(p => p.max_bn_usd))), bottom: yOf(Math.min(...here.map(p => p.min_bn_usd))) };
  });
  const envelopePoints = [...envelope.map(e => `${e.x},${e.top.toFixed(1)}`), ...[...envelope].reverse().map(e => `${e.x},${e.bottom.toFixed(1)}`)].join(" ");

  const points = placed.filter(p => p.max_bn_usd === p.min_bn_usd);
  const bases = [...new Set(points.map(p => institutionBase(p.institution)))];
  const connectors = bases.flatMap(base => {
    const firsts = horizons
      .map(h => points.filter(p => institutionBase(p.institution) === base && p.horizon === h).sort((a, b) => editionYear(b.institution) - editionYear(a.institution))[0])
      .filter((p): p is Placed => p !== undefined);
    return firsts.slice(1).map((p, i) => ({ from: firsts[i], to: p }));
  });
  const revisions = [...new Set(points.map(p => p.slot))]
    .map(slot => points.filter(p => p.slot === slot).sort((a, b) => editionYear(a.institution) - editionYear(b.institution)))
    .filter(group => group.length > 1)
    .map(group => ({ from: group[0], to: group[group.length - 1] }));

  const projLabel = (p: MarketProjection) =>
    p.max_bn_usd > p.min_bn_usd ? `${nf(p.min_bn_usd)}–${nf(p.max_bn_usd)}` : `${nf(p.max_bn_usd)} · ${institutionShort(p.institution)}`;

  const projectionsChart = (
    <div style={{ position: "relative", width: 660, height: 600 }}>
      <svg width={660} height={600} viewBox="0 0 660 600" style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} role="img" aria-label="Projections du marché mondial des humanoïdes, en milliards de dollars, échelle logarithmique">
        <text x={50} y={22} textAnchor="end" style={{ ...axisText, fontWeight: 600 }}>
          Md$
        </text>
        {Array.from({ length: decades + 1 }, (_, d) => 10 ** d).map(v => (
          <g key={v}>
            <line x1={60} x2={650} y1={yOf(v)} y2={yOf(v)} strokeWidth={1} style={{ stroke: v === 1 ? "color-mix(in srgb, var(--color-text) 30%, transparent)" : "color-mix(in srgb, var(--color-text) 8%, transparent)" }} />
            <text x={50} y={yOf(v) + 4} textAnchor="end" style={axisText}>
              {nf(v)}
            </text>
          </g>
        ))}
        <polygon className="rb-reveal" points={envelopePoints} style={{ fill: "var(--color-accent-200)", fillOpacity: 0.7 }} />
        {connectors.map(c => (
          <line
            key={`${c.from.id}-${c.to.id}`}
            className="rb-fade"
            x1={c.from.x}
            y1={yOf(c.from.max_bn_usd)}
            x2={c.to.x}
            y2={yOf(c.to.max_bn_usd)}
            strokeWidth={1.25}
            strokeDasharray="4 4"
            style={{ stroke: "var(--mx-tier-high)", animationDelay: "1.3s" }}
          />
        ))}
        {revisions
          .filter(r => Math.abs(yOf(r.from.max_bn_usd) - yOf(r.to.max_bn_usd)) >= 24)
          .map(r => {
            const y1 = yOf(r.from.max_bn_usd) - 8;
            const y2 = yOf(r.to.max_bn_usd) + 9;
            return (
              <path
                key={`${r.from.id}-${r.to.id}`}
                className="rb-fade"
                d={`M${r.from.x} ${y1} V${y2} M${r.from.x - 4.5} ${y2 + 6} L${r.from.x} ${y2} L${r.from.x + 4.5} ${y2 + 6}`}
                fill="none"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ stroke: "var(--mx-tier-high)", animationDelay: "1.2s" }}
              />
            );
          })}
        {placed.map((p, i) => {
          const range = p.max_bn_usd > p.min_bn_usd;
          const yTop = yOf(p.max_bn_usd);
          const yBot = yOf(p.min_bn_usd);
          const lx = p.side === "R" ? p.x + 14 : p.side === "L" ? p.x - 14 : p.x;
          const ly = p.side === "B" ? yTop + 24 : (yTop + yBot) / 2 + 4;
          const delay = `${0.5 + i * 0.1}s`;
          return (
            <g key={p.id} className="rb-dim" style={{ opacity: !sel || sel === p.id ? 1 : 0.3 }}>
              {range ? (
                <rect className="rb-pop" x={p.x - 6} y={yTop} width={12} height={yBot - yTop} rx={6} style={{ fill: "var(--mx-tier-mid)", animationDelay: delay }} />
              ) : (
                <circle
                  className="rb-pop"
                  cx={p.x}
                  cy={yTop}
                  r={6}
                  strokeWidth={2}
                  style={{ fill: p.provenance.data_quality === "verified" ? "var(--mx-tier-high)" : "var(--color-bg)", stroke: "var(--mx-tier-high)", animationDelay: delay }}
                />
              )}
              <text className="rb-fade" x={lx} y={ly} textAnchor={p.side === "L" ? "end" : p.side === "B" ? "middle" : "start"} style={{ fontSize: 12, fontWeight: 500, fill: "var(--color-text)", fontFeatureSettings: "'tnum' 1", animationDelay: delay }}>
                {projLabel(p)}
              </text>
            </g>
          );
        })}
        {horizons.map((h, i) => (
          <text key={h} x={colX(i)} y={578} textAnchor="middle" style={{ ...heading, fontSize: 13, fill: "var(--color-text)" }}>
            {h}
          </text>
        ))}
        {horizons.slice(1).map((h, i) => {
          const gap = h - horizons[i];
          if (gap < 10) return null;
          const x = (colX(i) + colX(i + 1)) / 2;
          return (
            <g key={h}>
              <path d={`M${x - 8} ${Y_BASE + 4} L${x} ${Y_BASE - 8} M${x} ${Y_BASE + 4} L${x + 8} ${Y_BASE - 8}`} strokeWidth={1.25} style={{ stroke: "color-mix(in srgb, var(--color-text) 50%, transparent)" }} />
              <text x={x} y={578} textAnchor="middle" style={axisText}>
                {gap} ans
              </text>
            </g>
          );
        })}
      </svg>
      {placed.map(p => {
        const yTop = yOf(p.max_bn_usd);
        const yBot = yOf(p.min_bn_usd);
        const value = p.max_bn_usd > p.min_bn_usd ? `${formatBnUsd(p.min_bn_usd)} à ${formatBnUsd(p.max_bn_usd)}` : formatBnUsd(p.max_bn_usd);
        return (
          <button
            key={p.id}
            type="button"
            className="rb-hit"
            aria-pressed={sel === p.id}
            aria-label={`${p.institution}, ${p.horizon} : ${value}`}
            title={`${p.institution}, ${p.horizon} : ${value}`}
            onClick={() => toggle(p.id)}
            style={{ position: "absolute", left: p.x - 14, top: yTop - 14, width: 28, height: yBot - yTop + 28, background: sel === p.id ? "color-mix(in srgb, var(--color-accent) 18%, transparent)" : undefined }}
          />
        );
      })}
    </div>
  );

  // ── Volumes : escalier logarithmique et grilles de cent carrés ─────────
  const values = steps.map(s => s.figure.max * unitScale(s.figure.unit));
  const lowDec = Math.floor(Math.log10(Math.min(...values))) - 1;
  const highDec = Math.ceil(Math.log10(Math.max(...values)));
  const BASE = 540;
  const perDec = 480 / Math.max(1, highDec - lowDec);
  const vy = (v: number) => r1(BASE - (Math.log10(v) - lowDec) * perDec);
  const decadeLabel = (d: number) => (d >= 9 ? `${10 ** (d - 9)} Md` : d >= 6 ? `${nf(10 ** (d - 6))} M` : nf(10 ** d));

  const fleetTotal = fleet.total.max * unitScale(fleet.total.unit);
  const cellsOf = (v: KeyFigureData) => Math.round(((v.max * unitScale(v.unit)) / fleetTotal) * 100);
  const chinaCells = Math.round(chinaShare.max);
  const waffle = (parts: { n: number; fill: string; edge: string }[]) => {
    const cells = parts.flatMap(p => Array.from({ length: p.n }, () => p));
    return (
      <div className="grid" style={{ gridTemplateColumns: "repeat(10, 13px)", gap: 3, flex: "0 0 auto" }} aria-hidden="true">
        {cells.slice(0, 100).map((c, i) => (
          <i key={i} className="rb-pop" style={{ display: "block", width: 13, height: 13, boxSizing: "border-box", background: c.fill, border: `1px solid ${c.edge}`, animationDelay: `${0.3 + i * 0.012}s` }} />
        ))}
      </div>
    );
  };
  const swatch = (fill: string, edge = "var(--color-divider)") => (
    <i style={{ display: "inline-block", flex: "0 0 auto", width: 11, height: 11, background: fill, border: `1px solid ${edge}` }} />
  );
  const legendRow = (fill: string, text: string, edge?: string) => (
    <span className="flex items-center" style={{ gap: 6 }}>
      {swatch(fill, edge)}
      {text}
    </span>
  );
  const china2050 = cellsOf(fleet.china);
  const usa2050 = cellsOf(fleet.usa);

  const volumesChart = (
    <div style={{ position: "relative", width: 660, height: 600 }}>
      {Array.from({ length: highDec - lowDec + 1 }, (_, i) => lowDec + i).map(d => (
        <span key={d}>
          <i style={{ position: "absolute", left: 60, width: 316, top: vy(10 ** d), height: 1, background: d === lowDec ? "color-mix(in srgb, var(--color-text) 30%, transparent)" : "color-mix(in srgb, var(--color-text) 8%, transparent)" }} />
          <span style={{ position: "absolute", left: 0, width: 52, top: vy(10 ** d) - 7, textAlign: "right", fontSize: 11, lineHeight: "14px", color: "var(--ink-70)", fontFeatureSettings: "'tnum' 1" }}>{decadeLabel(d)}</span>
        </span>
      ))}
      {steps.map((s, i) => {
        const v = values[i];
        const x = 74 + i * 80;
        const parc = s.kind === "parc";
        return (
          <span key={s.figure.id}>
            <i
              className="rb-grow"
              style={{
                position: "absolute",
                left: x,
                bottom: 600 - BASE,
                width: 56,
                height: BASE - vy(v),
                boxSizing: "border-box",
                background: parc ? "repeating-linear-gradient(45deg, var(--mx-tier-mid) 0 2px, transparent 2px 6px)" : i === 0 ? "var(--mx-tier-high)" : "var(--color-accent-700)",
                border: `1.5px solid ${parc ? "var(--mx-tier-mid)" : i === 0 ? "var(--mx-tier-high)" : "var(--color-accent-700)"}`,
                animationDelay: `${0.2 + i * 0.25}s`,
              }}
            />
            <span className="rb-fade" style={{ ...heading, position: "absolute", left: x - 22, width: 100, top: vy(v) - 32, textAlign: "center", fontSize: 22, lineHeight: "24px", animationDelay: `${0.7 + i * 0.25}s` }}>
              {s.figure.value_label}
            </span>
            <span style={{ position: "absolute", left: x - 22, width: 100, top: BASE + 8, textAlign: "center", fontSize: 12, lineHeight: "16px" }}>
              <b style={{ ...heading, fontSize: 15 }}>{s.figure.as_of}</b>
              <br />
              <span style={{ color: "var(--ink-70)" }}>{s.caption}</span>
            </span>
          </span>
        );
      })}
      <div style={{ position: "absolute", left: 400, top: 0, width: 260 }}>
        <PanelKicker>
          {deliveries.as_of} · {deliveries.value_label} livrés
        </PanelKicker>
        <div className="flex items-start" style={{ gap: 12 }}>
          {waffle([
            { n: chinaCells, fill: "var(--mx-tier-high)", edge: "var(--mx-tier-high)" },
            { n: 100 - chinaCells, fill: "var(--mx-tier-low)", edge: "var(--mx-tier-mid)" },
          ])}
          <div className="flex flex-col" style={{ gap: 6, fontSize: 12, lineHeight: "16px" }}>
            {legendRow("var(--mx-tier-high)", `Chine · ${chinaShare.value_label}`)}
            {legendRow("var(--mx-tier-low)", `Reste du monde · ${100 - chinaCells} %`, "var(--mx-tier-mid)")}
            <span style={{ color: "var(--ink-70)" }}>1 carré = 1 %</span>
          </div>
        </div>
        <PanelKicker style={{ marginTop: 40 }}>
          {fleet.total.as_of} · {fleet.total.value_label} en service
        </PanelKicker>
        <div className="flex items-start" style={{ gap: 12 }}>
          {waffle([
            { n: china2050, fill: "var(--mx-tier-high)", edge: "var(--mx-tier-high)" },
            { n: usa2050, fill: "var(--color-accent-700)", edge: "var(--color-accent-700)" },
            { n: 100 - china2050 - usa2050, fill: "var(--mx-tier-low)", edge: "var(--mx-tier-mid)" },
          ])}
          <div className="flex flex-col" style={{ gap: 6, fontSize: 12, lineHeight: "16px" }}>
            {legendRow("var(--mx-tier-high)", `Chine · ${fleet.china.value_label}`)}
            {legendRow("var(--color-accent-700)", `États-Unis · ${fleet.usa.value_label}`)}
            {legendRow("var(--mx-tier-low)", "Reste du monde", "var(--mx-tier-mid)")}
            <span style={{ color: "var(--ink-70)" }}>1 carré ≈ {nf(fleetTotal / 100 / 1e6)} M</span>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Constructeurs : volumes publiés et capacités visées, axe log ───────
  const actorById = new Map(actors.map(a => [a.id, a]));
  const rows = [...oems].sort((a, b) => {
    const ba = actorById.get(a.actor_id)?.bloc === "cn" ? 0 : 1;
    const bb = actorById.get(b.actor_id)?.bloc === "cn" ? 0 : 1;
    return ba - bb || (b.volume?.value ?? 0) - (a.volume?.value ?? 0);
  });
  const oemValues = rows.flatMap(o => [o.volume?.value ?? 0, o.capacity?.units_per_year ?? 0]).filter(v => v > 0);
  const oLow = Math.floor(Math.log10(Math.min(...oemValues)));
  const oHigh = Math.ceil(Math.log10(Math.max(...oemValues)));
  const OX0 = 200;
  const OX1 = 560;
  const ox = (v: number) => r1(OX0 + ((Math.log10(v) - oLow) / Math.max(1, oHigh - oLow)) * (OX1 - OX0));
  const ROW = 56;
  const kindStyle = (kind: string, bloc: keyof typeof BLOC_COLOR) => {
    const c = BLOC_COLOR[bloc];
    if (kind === "produced") return { background: blocHatch(bloc), border: `1.5px solid ${c.edge}` };
    if (kind === "preorders") return { background: "transparent", border: `1.5px solid ${c.edge}` };
    return { background: c.fill, border: `1.5px solid ${c.edge}` };
  };
  const capLabel = (o: Oem) => (o.capacity ? `${nf(o.capacity.units_per_year)} / an · ${o.capacity.year ?? "à terme"}` : "");
  const oemIds = rows.map(o => o.actor_id);

  const oemChart = (
    <div style={{ position: "relative", width: 660, height: 30 + rows.length * ROW + 70 }}>
      <span style={{ position: "absolute", left: 0, top: 4, fontSize: 11, lineHeight: "14px", letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600, color: "var(--ink-70)" }}>Unités · échelle log</span>
      {Array.from({ length: oHigh - oLow + 1 }, (_, i) => oLow + i).map(d => (
        <span key={d}>
          <i style={{ position: "absolute", left: ox(10 ** d), top: 24, width: 1, height: rows.length * ROW + 6, background: "color-mix(in srgb, var(--color-text) 8%, transparent)" }} />
          <span style={{ position: "absolute", left: ox(10 ** d), top: 4, transform: "translateX(-50%)", fontSize: 11, lineHeight: "14px", color: "var(--ink-70)", fontFeatureSettings: "'tnum' 1" }}>
            {d >= 6 ? `${10 ** (d - 6)} M` : nf(10 ** d)}
          </span>
        </span>
      ))}
      {rows.map((o, i) => {
        const actor = actorById.get(o.actor_id);
        const bloc = actor?.bloc ?? "other";
        const v = o.volume?.value ?? null;
        const bw = v ? ox(v) - OX0 : 0;
        const cx = o.capacity ? ox(o.capacity.units_per_year) : 0;
        const capOverflow = cx > 540;
        return (
          <button
            key={o.actor_id}
            type="button"
            className="rb-hit rb-fade"
            aria-pressed={sel === o.actor_id}
            onClick={() => toggle(o.actor_id)}
            style={{ position: "absolute", left: 0, top: 30 + i * ROW, width: 660, height: ROW - 4, borderBottom: "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)", animationDelay: `${0.1 + i * 0.06}s` }}
          >
            <span className="flex flex-col" style={{ position: "absolute", left: 8, top: 7, width: 184 }}>
              <span style={{ ...heading, fontSize: 17, lineHeight: "19px", textTransform: "uppercase" }}>{actor?.name ?? o.actor_id}</span>
              <span style={{ fontSize: 12, lineHeight: "16px", color: "var(--ink-70)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {(actor?.countries ?? []).map(countryLabelFr).join(" / ")} · {o.model}
              </span>
            </span>
            {o.volume && v ? (
              <>
                <i className="rb-growx" style={{ position: "absolute", left: OX0, top: 10, width: bw, height: 16, boxSizing: "border-box", ...kindStyle(o.volume.kind, bloc), animationDelay: `${0.3 + i * 0.08}s` }} />
                <span style={{ position: "absolute", left: OX0 + bw + 8, top: 10, fontSize: 12, lineHeight: "16px", whiteSpace: "nowrap", fontFeatureSettings: "'tnum' 1" }}>
                  {nf(v)} {VOLUME_KIND_LABEL[o.volume.kind]} · {formatIsoDate(o.volume.as_of)}
                  {o.volume.provenance.data_quality === "estimated" && " · estimé"}
                </span>
              </>
            ) : (
              <span style={{ position: "absolute", left: OX0 + 4, top: 10, fontSize: 12, lineHeight: "16px", color: "var(--ink-70)" }}>Volume non publié</span>
            )}
            {o.capacity && (
              <>
                <i style={{ position: "absolute", left: OX0, top: 36, width: cx - OX0, height: 0, borderTop: "1.5px dashed var(--color-accent-700)" }} />
                <i style={{ position: "absolute", left: cx - 4, top: 32, width: 8, height: 8, boxSizing: "border-box", transform: "rotate(45deg)", background: "var(--color-bg)", border: "1.5px solid var(--color-accent-700)" }} />
                <span
                  style={{
                    position: "absolute",
                    top: capOverflow && !v ? 10 : 29,
                    left: capOverflow ? cx - 10 : cx + 10,
                    transform: capOverflow ? "translateX(-100%)" : undefined,
                    padding: "0 4px",
                    background: "var(--color-bg)",
                    fontSize: 12,
                    lineHeight: "16px",
                    whiteSpace: "nowrap",
                    color: "var(--ink-78)",
                    fontFeatureSettings: "'tnum' 1",
                  }}
                >
                  capacité visée {capLabel(o)}
                </span>
              </>
            )}
          </button>
        );
      })}
      <div className="flex flex-wrap" style={{ position: "absolute", left: OX0, top: 40 + rows.length * ROW, gap: "6px 18px", fontSize: 12, lineHeight: "16px", color: "var(--ink-78)" }}>
        <span className="flex items-center" style={{ gap: 6 }}>{swatch(BLOC_COLOR.cn.fill, BLOC_COLOR.cn.edge)}livré ou vendu</span>
        <span className="flex items-center" style={{ gap: 6 }}>{swatch(blocHatch("us"), BLOC_COLOR.us.edge)}produit</span>
        <span className="flex items-center" style={{ gap: 6 }}>{swatch("transparent", BLOC_COLOR.us.edge)}réservé</span>
        <span className="flex items-center" style={{ gap: 6 }}>
          <i style={{ display: "block", width: 18, borderTop: "1.5px dashed var(--color-accent-700)" }} />
          capacité visée
        </span>
        <span className="flex items-center" style={{ gap: 6 }}>{swatch(BLOC_COLOR.cn.fill, BLOC_COLOR.cn.edge)}Chine · {swatch(BLOC_COLOR.us.fill, BLOC_COLOR.us.edge)}autres pays</span>
      </div>
    </div>
  );

  // ── Panneau de lecture ─────────────────────────────────────────────────
  const first = projections.filter(p => p.horizon === horizons[0]);
  const lastH = projections.filter(p => p.horizon === horizons[horizons.length - 1]);
  const selProj = projections.find(p => p.id === sel) ?? null;
  const selOem = rows.find(o => o.actor_id === sel) ?? null;

  const projOverview = (
    <div>
      <PanelKicker>Lecture</PanelKicker>
      <PanelTitle>
        De {formatBnUsd(Math.min(...first.map(p => p.min_bn_usd)))} à {formatBnUsd(Math.max(...lastH.map(p => p.max_bn_usd)))}
      </PanelTitle>
      <PanelText>
        En {horizons[0]}, les projections vont de {formatBnUsd(Math.min(...first.map(p => p.min_bn_usd)))} à {formatBnUsd(Math.max(...first.map(p => p.max_bn_usd)))} ;
        en {horizons[horizons.length - 1]}, de {formatBnUsd(Math.min(...lastH.map(p => p.min_bn_usd)))} à {formatBnUsd(Math.max(...lastH.map(p => p.max_bn_usd)))}.
      </PanelText>
      {revisions.length > 0 && (
        <PanelText small>
          Révisions :{" "}
          {revisions
            .map(r => `${institutionBase(r.from.institution)} de ${formatBnUsd(r.from.max_bn_usd)} à ${formatBnUsd(r.to.max_bn_usd)} pour ${r.from.horizon}`)
            .join(" ; ")}
          .
        </PanelText>
      )}
      <div className="flex flex-col" style={{ gap: 6, fontSize: 13, lineHeight: "18px", margin: "4px 0 16px" }}>
        <span className="flex items-center" style={{ gap: 8 }}>
          <i style={{ width: 12, height: 12, borderRadius: 6, background: "var(--mx-tier-mid)" }} />
          Fourchette des cabinets d’études
        </span>
        <span className="flex items-center" style={{ gap: 8 }}>
          <i style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--mx-tier-high)" }} />
          Banque · vérifié
        </span>
        <span className="flex items-center" style={{ gap: 8 }}>
          <i style={{ width: 12, height: 12, boxSizing: "border-box", borderRadius: "50%", border: "2px solid var(--mx-tier-high)" }} />
          Banque · estimé ou cité
        </span>
        <span className="flex items-center" style={{ gap: 8 }}>
          <i style={{ width: 12, height: 12, background: "var(--color-accent-200)" }} />
          Enveloppe des projections
        </span>
      </div>
      <PanelNote>
        Les périmètres diffèrent (robots seuls, services compris, marché adressable) : ces projections se comparent en ordre de grandeur, pas
        au dollar près.
      </PanelNote>
      <PanelHint>Choisir une projection →</PanelHint>
    </div>
  );

  const projDetail = selProj && (
    <div>
      <PanelHead kicker={`Projection · horizon ${selProj.horizon}`} onClose={() => setSel(null)} />
      <span style={{ ...heading, display: "block", fontSize: 44, lineHeight: "48px" }}>
        {selProj.max_bn_usd > selProj.min_bn_usd ? `${nf(selProj.min_bn_usd)}–${formatBnUsd(selProj.max_bn_usd)}` : formatBnUsd(selProj.max_bn_usd)}
      </span>
      <PanelTitle style={{ marginTop: 8 }}>{selProj.institution}</PanelTitle>
      <PanelText>{selProj.detail}</PanelText>
      <PanelText small>Périmètre : {selProj.scope}.</PanelText>
      <QualityTag quality={selProj.provenance.data_quality} />
    </div>
  );

  const volumesPanel = (
    <div>
      <PanelKicker>Lecture</PanelKicker>
      <PanelTitle>
        De {steps[0]?.figure.value_label} à {steps[steps.length - 1]?.figure.value_label}
      </PanelTitle>
      <PanelText>
        {deliveries.value_label} humanoïdes livrés en {deliveries.as_of}, dont {chinaShare.value_label} par des entreprises chinoises.
      </PanelText>
      {steps.slice(1).map(s => (
        <PanelFigure key={s.figure.id} value={s.figure.value_label} label={s.figure.label} meta={<>{formatIsoDate(s.figure.as_of)} <QualityTag quality={s.figure.provenance.data_quality} /></>} />
      ))}
      <PanelFigure value={proUse.value_label} label={proUse.label} meta={<>{formatIsoDate(proUse.as_of)} <QualityTag quality={proUse.provenance.data_quality} /></>} />
      <PanelNote>Barre pleine : livraisons de l’année. Barre hachurée : parc en service, une autre grandeur.</PanelNote>
    </div>
  );

  const oemOverview = (
    <div>
      <PanelKicker>Lecture</PanelKicker>
      <PanelTitle>
        {chinaShare.value_label} des livraisons {chinaShare.as_of} sont chinoises
      </PanelTitle>
      <PanelText>
        Produit, livré, vendu ou réservé : chaque constructeur publie une grandeur différente, reprise telle quelle. Les capacités sont des
        objectifs annoncés, pas des productions constatées.
      </PanelText>
      <PanelHint>Choisir un constructeur →</PanelHint>
    </div>
  );

  const oemDetail = selOem && (
    <div>
      <PanelHead
        kicker={`Constructeur · ${(actorById.get(selOem.actor_id)?.countries ?? []).map(countryLabelFr).join(" / ")}`}
        onPrev={() => setSel(cycle(oemIds, selOem.actor_id, -1))}
        onNext={() => setSel(cycle(oemIds, selOem.actor_id, 1))}
        onClose={() => setSel(null)}
        prevLabel="Constructeur précédent"
        nextLabel="Constructeur suivant"
      />
      <PanelTitle>{actorById.get(selOem.actor_id)?.name ?? selOem.actor_id}</PanelTitle>
      <PanelText small>{selOem.model}</PanelText>
      <PanelText>{selOem.facts}</PanelText>
      <PanelFigure
        value={selOem.volume ? selOem.volume.label : "Non publié"}
        label="Volume publié"
        meta={selOem.volume ? <>{formatIsoDate(selOem.volume.as_of)} <QualityTag quality={selOem.volume.provenance.data_quality} /></> : undefined}
      />
      <PanelFigure value={selOem.capacity ? selOem.capacity.label : "—"} label="Capacité visée" meta={selOem.capacity ? <QualityTag quality={selOem.capacity.provenance.data_quality} /> : undefined} />
    </div>
  );

  const panel =
    view === "projections" ? projDetail || projOverview : view === "volumes" ? volumesPanel : oemDetail || oemOverview;

  return (
    <Section id="marche" revealDelay={revealDelay}>
      <SectionKicker>07 · Marché &amp; volumes</SectionKicker>
      <SectionHeading
        title="D’un marché de niche à une économie de masse"
        lead="Projections des banques et des cabinets d’études, volumes projetés, puis volumes déclarés par les constructeurs."
        aside={<ViewSwitch name="rb-market-view" value={view} options={VIEWS} onChange={go} />}
      />
      <VizFrame frameRef={frameRef} play={inView} chart={view === "projections" ? projectionsChart : view === "volumes" ? volumesChart : oemChart} panel={panel} />
    </Section>
  );
}
