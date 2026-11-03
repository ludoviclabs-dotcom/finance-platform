"use client";

import Link from "next/link";
import { useState } from "react";
import type { Actor, BlocId, KeyFigure as KeyFigureData, Layer } from "@/lib/robotics/dataLoader";
import { Section } from "@/components/materials/industry/Section";
import { SectionKicker } from "@/components/materials/industry/SectionKicker";
import { QualityTag } from "./KeyFigure";
import { BLOC_COLOR, BLOC_ORDER, BLOC_SHORT, SEGMENT_LABEL, SEGMENT_ORDER, blocDisplayName, blocHatch, formatIsoDate, layerShort } from "./labels";
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
  useCountUp,
  useInView,
} from "./viz";

type View = "pile" | "matrice" | "chine";
type Role = "dominant" | "challenger" | null;

export interface ChinaGrip {
  extraction: KeyFigureData;
  raffinage: KeyFigureData;
  aimants: KeyFigureData;
  livraisons: KeyFigureData;
  /** Extraction des seules terres rares pour aimants, en note sous les jauges. */
  extractionAimants: KeyFigureData;
}

const roleOf = (layer: Layer, bloc: BlocId): Role =>
  layer.dominant_blocs.includes(bloc) ? "dominant" : layer.challenger_blocs.includes(bloc) ? "challenger" : null;

const pad = (n: number) => String(n).padStart(2, "0");

// Pile isométrique : x le long de la couche, y en profondeur, z vers le haut.
// Une couche choisie sort de la pile comme un tiroir, vers l'avant gauche.
const ISO = { W: 260, D: 150, T: 14, ox: 178, oy: 330, pitch: 22, segGap: 24 };
const COS30 = 0.8660254;
const LABEL_X = 428;

function project(x: number, y: number, z: number): string {
  return `${(ISO.ox + (x - y) * COS30).toFixed(1)},${(ISO.oy + (x + y) * 0.5 - z).toFixed(1)}`;
}

const shade = (bloc: BlocId, pct: number) => `color-mix(in srgb, ${BLOC_COLOR[bloc].fill} ${pct}%, #000)`;

interface Face {
  points: string;
  fill: string;
  stroke: string;
}

function slabFaces(layer: Layer, z: number): Face[] {
  const parts = [
    ...layer.dominant_blocs.map(b => ({ b, w: 1, challenger: false })),
    ...layer.challenger_blocs.map(b => ({ b, w: 0.5, challenger: true })),
  ];
  const total = parts.reduce((s, p) => s + p.w, 0);
  const tops: Face[] = [];
  const fronts: Face[] = [];
  let right: Face | null = null;
  let x = 0;
  parts.forEach((p, i) => {
    const x0 = x;
    const x1 = x + (p.w / total) * ISO.W;
    x = x1;
    const fill = (pct: number) => (p.challenger ? `url(#rb-pile-h-${p.b})` : pct === 100 ? BLOC_COLOR[p.b].fill : shade(p.b, pct));
    const stroke = p.challenger ? BLOC_COLOR[p.b].edge : "color-mix(in srgb, var(--color-bg) 60%, transparent)";
    const { D, T, W } = ISO;
    tops.push({ points: [project(x0, 0, z), project(x1, 0, z), project(x1, D, z), project(x0, D, z)].join(" "), fill: fill(100), stroke });
    fronts.push({ points: [project(x0, D, z), project(x1, D, z), project(x1, D, z - T), project(x0, D, z - T)].join(" "), fill: fill(84), stroke });
    if (i === parts.length - 1) {
      right = { points: [project(W, 0, z), project(W, D, z), project(W, D, z - T), project(W, 0, z - T)].join(" "), fill: fill(70), stroke };
    }
  });
  return right ? [...tops, ...fronts, right] : [...tops, ...fronts];
}

const cubeIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <path d="m3.3 7 8.7 5 8.7-5" />
    <path d="M12 22V12" />
  </svg>
);

const VIEWS = [
  { id: "pile", label: "Pile 3D", icon: cubeIcon },
  { id: "matrice", label: "Matrice" },
  { id: "chine", label: "Emprise Chine" },
] as const;

const smallCaps: React.CSSProperties = {
  fontSize: 11,
  lineHeight: "14px",
  letterSpacing: ".08em",
  textTransform: "uppercase",
  fontWeight: 600,
  color: "var(--ink-70)",
};

export default function ControlSection({
  layers,
  actors,
  keyFigures,
  materialNames,
  china,
  revealDelay,
  initialView = "pile",
}: {
  /** Couches dans l'ordre de lecture (layersInReadingOrder). */
  layers: Layer[];
  actors: Actor[];
  keyFigures: KeyFigureData[];
  materialNames: Record<string, string>;
  china: ChinaGrip;
  revealDelay?: number;
  initialView?: View;
}) {
  const [view, setView] = useState<View>(initialView);
  const [sel, setSel] = useState<string | null>(null);
  const [hov, setHov] = useState<string | null>(null);
  const [frameRef, inView] = useInView<HTMLElement>();
  const t = useCountUp(inView && view === "chine", view);

  const figureById = new Map(keyFigures.map(k => [k.id, k]));
  const actorsOf = (layerId: string) => actors.filter(a => a.layer_ids.includes(layerId));
  // « Autres » se nomme par les pays de ses acteurs (Lynas : Australie).
  const otherActors = layers.filter(l => roleOf(l, "other")).flatMap(l => actorsOf(l.id));
  const blocName = (b: BlocId) => blocDisplayName(b, otherActors);
  // La colonne « Autres » n'existe que si une couche y renvoie.
  const blocs = BLOC_ORDER.filter(b => b !== "other" || layers.some(l => roleOf(l, "other")));
  const ids = layers.map(l => l.id);
  const selected = layers.find(l => l.id === sel) ?? null;

  const choose = (id: string) => setSel(prev => (prev === id ? null : id));
  const go = (next: View, layerId: string | null = null) => {
    setView(next);
    setSel(layerId);
    setHov(null);
  };

  const totals = blocs.map(b => ({
    bloc: b,
    dominant: layers.filter(l => roleOf(l, b) === "dominant").length,
    challenger: layers.filter(l => roleOf(l, b) === "challenger").length,
  }));
  const countLabel = (d: number, h: number) => `${d}${h ? ` (+${h})` : ""}`;

  // ── Pile ───────────────────────────────────────────────────────────────
  const segIndex = (l: Layer) => SEGMENT_ORDER.indexOf(l.segment);
  const zOf = (l: Layer, i: number) => i * ISO.pitch + segIndex(l) * ISO.segGap;
  const labelCenter = (z: number) => ISO.oy + ISO.W * 0.5 - z + 7;
  const groupHeads = SEGMENT_ORDER.map(segment => {
    const zs = layers.map((l, i) => (l.segment === segment ? zOf(l, i) : -1)).filter(z => z >= 0);
    return zs.length ? { segment, top: labelCenter(Math.max(...zs)) - 27 } : null;
  }).filter((g): g is { segment: (typeof SEGMENT_ORDER)[number]; top: number } => g !== null);

  const pile = (
    <div style={{ position: "relative", width: 660, height: 600 }}>
      <svg
        width={LABEL_X}
        height={600}
        viewBox={`0 0 ${LABEL_X} 600`}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
        role="img"
        aria-label="Pile isométrique des douze couches, de la mine en bas aux constructeurs en haut, chaque bande colorée par le bloc qui la tient"
      >
        <defs>
          {blocs.map(b => (
            <pattern key={b} id={`rb-pile-h-${b}`} width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width={5} height={5} style={{ fill: "var(--color-bg)" }} />
              <rect width={2} height={5} style={{ fill: BLOC_COLOR[b].edge }} />
            </pattern>
          ))}
        </defs>
        {layers.map((l, i) => {
          const on = sel === l.id;
          const lifted = !sel && hov === l.id;
          return (
            <g key={l.id} className="rb-drop" style={{ animationDelay: `${0.08 + i * 0.07}s` }}>
              <g
                className="rb-slab"
                style={{
                  transform: on ? "translate(-40px, 23px)" : lifted ? "translate(0px, -5px)" : "none",
                  opacity: sel ? (on ? 1 : 0.3) : hov && hov !== l.id ? 0.6 : 1,
                }}
                onClick={() => choose(l.id)}
                onMouseEnter={() => setHov(l.id)}
                onMouseLeave={() => setHov(null)}
              >
                {slabFaces(l, zOf(l, i)).map((f, k) => (
                  <polygon key={k} points={f.points} strokeWidth={0.75} strokeLinejoin="round" style={{ fill: f.fill, stroke: f.stroke }} />
                ))}
              </g>
            </g>
          );
        })}
        {layers.map((l, i) => {
          const y = labelCenter(zOf(l, i));
          return (
            <line
              key={l.id}
              className="rb-fade"
              x1={(ISO.ox + ISO.W * COS30 + 6).toFixed(1)}
              x2={LABEL_X}
              y1={y}
              y2={y}
              strokeWidth={1}
              style={{ stroke: sel === l.id ? "var(--color-text)" : "color-mix(in srgb, var(--color-text) 35%, transparent)", animationDelay: `${0.5 + i * 0.04}s` }}
            />
          );
        })}
      </svg>
      {groupHeads.map(g => (
        <div key={g.segment} style={{ ...smallCaps, position: "absolute", left: LABEL_X + 8, top: g.top, lineHeight: "12px", whiteSpace: "nowrap" }}>
          <span style={{ color: "var(--color-accent-700)" }}>{SEGMENT_LABEL[g.segment]}</span>
        </div>
      ))}
      {layers.map((l, i) => (
        <button
          key={l.id}
          type="button"
          className="rb-hit rb-fade"
          aria-pressed={sel === l.id}
          title={l.name}
          onClick={() => choose(l.id)}
          onMouseEnter={() => setHov(l.id)}
          onMouseLeave={() => setHov(null)}
          style={{
            position: "absolute",
            left: LABEL_X,
            top: labelCenter(zOf(l, i)) - 11,
            width: 660 - LABEL_X,
            height: 22,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 8px",
            fontSize: 13,
            lineHeight: "22px",
            fontWeight: sel === l.id ? 600 : 400,
            whiteSpace: "nowrap",
            overflow: "hidden",
            animationDelay: `${0.5 + i * 0.04}s`,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".08em", color: "var(--color-accent-700)", fontFeatureSettings: "'tnum' 1" }}>
            {pad(l.order)}
          </span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{layerShort(l)}</span>
        </button>
      ))}
      <p style={{ position: "absolute", left: 0, top: 578, margin: 0, fontSize: 12, lineHeight: "18px", color: "var(--ink-70)" }}>
        Lecture de bas en haut, de la mine au robot. Bande hachurée : bloc qui conteste la couche.
      </p>
    </div>
  );

  // ── Matrice ────────────────────────────────────────────────────────────
  const COL = 60;
  const matrix = (
    <div className="rb-fade" style={{ width: 660 }}>
      <div className="flex items-center" style={{ ...smallCaps, padding: "0 0 8px 8px", borderBottom: "1px solid var(--color-divider)" }}>
        <span style={{ flex: "1 1 auto" }}>Couche</span>
        {blocs.map(b => (
          <span key={b} title={blocName(b)} style={{ flex: `0 0 ${COL}px`, textAlign: "center" }}>
            {b === "other" ? blocName(b) : BLOC_SHORT[b]}
          </span>
        ))}
      </div>
      {layers.map((l, ri) => (
        <button
          key={l.id}
          type="button"
          className="rb-hit flex items-center w-full"
          aria-pressed={sel === l.id}
          onClick={() => choose(l.id)}
          style={{ minHeight: 42, padding: "3px 0 3px 8px", borderBottom: "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)", fontSize: 14, lineHeight: "18px" }}
        >
          <span style={{ flex: "0 0 34px", fontSize: 12, fontWeight: 600, letterSpacing: ".08em", color: "var(--color-accent-700)", fontFeatureSettings: "'tnum' 1" }}>
            {pad(l.order)}
          </span>
          <span className="min-w-0" style={{ flex: "1 1 auto", paddingRight: 12 }}>
            <span style={{ display: "block", fontWeight: 500 }}>{l.name}</span>
            <span style={{ display: "block", fontSize: 12, lineHeight: "16px", color: "var(--ink-70)" }}>{SEGMENT_LABEL[l.segment]}</span>
          </span>
          {blocs.map((b, ci) => {
            const role = roleOf(l, b);
            const label = `${blocName(b)} : ${role === "dominant" ? "domine" : role === "challenger" ? "conteste" : "absent"}`;
            return (
              <span key={b} title={label} className="flex items-center justify-center" style={{ flex: `0 0 ${COL}px` }}>
                <i
                  className="rb-pop"
                  aria-hidden="true"
                  style={
                    role
                      ? {
                          display: "block",
                          width: 16,
                          height: 16,
                          boxSizing: "border-box",
                          border: `1.5px solid ${BLOC_COLOR[b].edge}`,
                          background: role === "dominant" ? BLOC_COLOR[b].fill : blocHatch(b),
                          animationDelay: `${0.1 + ci * 0.12 + ri * 0.025}s`,
                        }
                      : { display: "block", width: 4, height: 4, borderRadius: "50%", background: "color-mix(in srgb, var(--color-text) 30%, transparent)" }
                  }
                />
                <span className="sr-only">{label}</span>
              </span>
            );
          })}
        </button>
      ))}
      <div className="flex items-end" style={{ padding: "12px 0 0 8px" }}>
        <span style={{ ...smallCaps, flex: "1 1 auto" }}>
          Couches tenues, sur {layers.length}
          <span style={{ display: "block", fontWeight: 500, letterSpacing: 0, textTransform: "none" }}>plein : domine · hachuré : conteste</span>
        </span>
        {totals.map(tot => (
          <span key={tot.bloc} className="flex flex-col items-center justify-end" style={{ flex: `0 0 ${COL}px`, height: 96, gap: 3 }}>
            <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 18, lineHeight: "20px", fontFeatureSettings: "'tnum' 1" }}>
              {countLabel(tot.dominant, tot.challenger)}
            </span>
            <i className="rb-grow" style={{ display: "block", width: 18, height: tot.challenger * 6, background: blocHatch(tot.bloc), animationDelay: ".9s" }} />
            <i
              className="rb-grow"
              style={{ display: "block", width: 18, boxSizing: "border-box", height: tot.dominant * 6, background: BLOC_COLOR[tot.bloc].fill, border: tot.dominant ? `1px solid ${BLOC_COLOR[tot.bloc].edge}` : 0, animationDelay: ".6s" }}
            />
          </span>
        ))}
      </div>
    </div>
  );

  // ── Emprise Chine ──────────────────────────────────────────────────────
  const TRACK_TOP = 84;
  const TRACK_H = 280;
  const COL_W = 140;
  const STEP = 173;
  const gauges = [
    { stage: "Mine", label: "Extraction des terres rares", figure: china.extraction },
    { stage: "Raffinage", label: "Raffinage des terres rares", figure: china.raffinage },
    { stage: "Aimants", label: "Aimants permanents frittés", figure: china.aimants },
    { stage: "Robot", label: "Humanoïdes livrés", figure: china.livraisons },
  ].map((g, i) => {
    const pct = g.figure.max;
    const layer = layers.find(l => l.key_figure_ids.includes(g.figure.id)) ?? null;
    return { ...g, pct, layer, cx: i * STEP + COL_W / 2, cy: TRACK_TOP + TRACK_H * (1 - pct / 100) };
  });
  const peak = gauges.slice(0, 3).reduce((a, b) => (b.pct > a.pct ? b : a));

  const chinaView = (
    <div style={{ position: "relative", width: 660, height: 600 }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: TRACK_TOP + TRACK_H / 2, borderTop: "1px dashed color-mix(in srgb, var(--color-text) 30%, transparent)" }} />
      <span style={{ position: "absolute", left: 0, top: TRACK_TOP + TRACK_H / 2 - 18, fontSize: 11, lineHeight: "16px", color: "var(--ink-70)" }}>50 %</span>
      {gauges.map((g, i) => (
        <div key={g.figure.id} style={{ position: "absolute", left: i * STEP, top: 0, width: COL_W, height: 560 }}>
          <span
            style={{
              position: "absolute",
              left: 0,
              width: COL_W,
              top: 16,
              textAlign: "center",
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              fontSize: 48,
              lineHeight: "56px",
              fontFeatureSettings: "'tnum' 1",
            }}
          >
            {t >= 1 ? g.figure.value_label : `${Math.round(g.pct * t)} %`}
          </span>
          <div style={{ position: "absolute", left: (COL_W - 56) / 2, top: TRACK_TOP, width: 56, height: TRACK_H, overflow: "hidden", background: "color-mix(in srgb, var(--color-text) 8%, transparent)" }}>
            <i className="rb-grow" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: (g.pct / 100) * TRACK_H, background: "var(--mx-tier-high)", animationDelay: `${0.1 + i * 0.15}s` }} />
          </div>
          <span style={{ ...smallCaps, position: "absolute", left: 0, width: COL_W, top: 380, textAlign: "center", letterSpacing: ".12em", color: "var(--color-accent-700)" }}>{g.stage}</span>
          <span
            style={{
              position: "absolute",
              left: 4,
              width: COL_W - 8,
              top: 402,
              textAlign: "center",
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              fontSize: 17,
              lineHeight: "21px",
              letterSpacing: ".02em",
              textTransform: "uppercase",
            }}
          >
            {g.label}
          </span>
          <span className="flex items-center justify-center" style={{ position: "absolute", left: 0, width: COL_W, top: 450, gap: 8, fontSize: 12, lineHeight: "18px", color: "var(--ink-70)", fontFeatureSettings: "'tnum' 1" }}>
            {formatIsoDate(g.figure.as_of)} <QualityTag quality={g.figure.provenance.data_quality} />
          </span>
          {g.layer && (
            <button
              type="button"
              className="rb-card"
              onClick={() => go("pile", g.layer!.id)}
              style={{ position: "absolute", left: 10, width: COL_W - 20, top: 482, minHeight: 40, fontSize: 13, textAlign: "center", color: "var(--color-accent-700)" }}
            >
              Couche {pad(g.layer.order)} →
            </button>
          )}
        </div>
      ))}
      <svg width={660} height={600} viewBox="0 0 660 600" style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }} aria-hidden="true">
        <polyline
          className="rb-draw"
          points={gauges.map(g => `${g.cx},${g.cy.toFixed(1)}`).join(" ")}
          fill="none"
          strokeWidth={1.5}
          strokeLinejoin="round"
          style={{ stroke: "var(--color-accent)", animationDelay: ".6s" }}
        />
        {gauges.map(g => (
          <circle key={g.figure.id} className="rb-pop" cx={g.cx} cy={g.cy} r={4.5} strokeWidth={2} style={{ fill: "var(--color-bg)", stroke: "var(--mx-tier-high)", animationDelay: "1.3s" }} />
        ))}
        <circle className="rb-ping" cx={peak.cx} cy={peak.cy} r={5} fill="none" strokeWidth={1.5} style={{ stroke: "var(--mx-tier-high)" }} />
        {gauges.slice(0, -1).map((g, i) => {
          const x = i * STEP + COL_W + 6;
          return (
            <path
              key={g.figure.id}
              d={`M${x} 388 H${x + 21} M${x + 16} 383.5 L${x + 22} 388 L${x + 16} 392.5`}
              fill="none"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ stroke: "var(--color-accent)" }}
            />
          );
        })}
      </svg>
      <p style={{ position: "absolute", left: 0, top: 552, margin: 0, maxWidth: 640, fontSize: 12, lineHeight: "18px", color: "var(--ink-70)" }}>
        {china.extractionAimants.label} : {china.extractionAimants.value_label} ({formatIsoDate(china.extractionAimants.as_of)}).
      </p>
    </div>
  );

  // ── Panneau de lecture ─────────────────────────────────────────────────
  const legend = (
    <div className="grid grid-cols-2" style={{ gap: "6px 12px", fontSize: 13, lineHeight: "18px", marginTop: 4 }}>
      {blocs.map(b => (
        <span key={b} className="flex items-center" style={{ gap: 8 }}>
          <i style={{ display: "inline-block", flex: "0 0 auto", width: 12, height: 12, boxSizing: "border-box", background: BLOC_COLOR[b].fill, border: `1px solid ${BLOC_COLOR[b].edge}` }} />
          {blocName(b)}
        </span>
      ))}
      <span className="flex items-center" style={{ gap: 8 }}>
        <i style={{ display: "inline-block", flex: "0 0 auto", width: 12, height: 12, boxSizing: "border-box", background: blocHatch("cn"), border: `1px solid ${BLOC_COLOR.cn.edge}` }} />
        Conteste
      </span>
    </div>
  );

  const overview = (
    <div>
      <PanelKicker>Lecture</PanelKicker>
      <PanelTitle>
        {layers.length} couches, {blocs.length} blocs
      </PanelTitle>
      <PanelText>Chaque couche prend la teinte du bloc qui la tient. Aucun bloc ne couvre toute la chaîne.</PanelText>
      {legend}
      <PanelKicker style={{ marginTop: 26 }}>Couches tenues par bloc</PanelKicker>
      {[...totals]
        .sort((a, b) => b.dominant - a.dominant || b.challenger - a.challenger)
        .map(tot => (
          <div key={tot.bloc} className="grid items-center" style={{ gridTemplateColumns: "128px minmax(0,1fr) 44px", gap: 10, fontSize: 13, lineHeight: "18px", padding: "5px 0" }}>
            <span>{blocName(tot.bloc)}</span>
            <span className="flex" style={{ height: 10, background: "color-mix(in srgb, var(--color-text) 6%, transparent)" }}>
              <i className="rb-growx" style={{ display: "block", height: 10, width: `${(tot.dominant / layers.length) * 100}%`, boxSizing: "border-box", background: BLOC_COLOR[tot.bloc].fill, border: tot.dominant ? `1px solid ${BLOC_COLOR[tot.bloc].edge}` : 0, animationDelay: ".3s" }} />
              <i className="rb-growx" style={{ display: "block", height: 10, width: `${(tot.challenger / layers.length) * 100}%`, background: blocHatch(tot.bloc), animationDelay: ".5s" }} />
            </span>
            <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 16, textAlign: "right", fontFeatureSettings: "'tnum' 1" }}>
              {countLabel(tot.dominant, tot.challenger)}
            </span>
          </div>
        ))}
      <PanelNote>Rôles des blocs : qualification éditoriale du dossier d’origine, pas une part de marché. Entre parenthèses : couches contestées.</PanelNote>
      <PanelHint>Choisir une couche pour la lire →</PanelHint>
    </div>
  );

  const detail = selected && (
    <div>
      <PanelHead
        kicker={`Couche ${pad(selected.order)} / ${pad(layers.length)} · ${SEGMENT_LABEL[selected.segment]}`}
        onPrev={() => setSel(cycle(ids, selected.id, -1))}
        onNext={() => setSel(cycle(ids, selected.id, 1))}
        onClose={() => setSel(null)}
        prevLabel="Couche précédente"
        nextLabel="Couche suivante"
      />
      <PanelTitle>{selected.name}</PanelTitle>
      <div className="flex flex-wrap" style={{ gap: 6, marginBottom: 12 }}>
        {[...selected.dominant_blocs.map(b => [b, "domine"] as const), ...selected.challenger_blocs.map(b => [b, "conteste"] as const)].map(([b, role]) => (
          <span key={b} className="inline-flex items-center" style={{ gap: 6, fontSize: 13, lineHeight: "18px", padding: "3px 8px 3px 5px", background: "var(--color-surface)" }}>
            <i
              style={{ display: "inline-block", width: 12, height: 12, boxSizing: "border-box", background: role === "domine" ? BLOC_COLOR[b].fill : blocHatch(b), border: `1px solid ${BLOC_COLOR[b].edge}` }}
            />
            {blocDisplayName(b, actorsOf(selected.id))}
            <span style={{ color: "var(--ink-70)" }}>· {role}</span>
          </span>
        ))}
      </div>
      <PanelText>{selected.dominance_note}</PanelText>
      {selected.key_figure_ids.map(id => figureById.get(id)).filter((f): f is KeyFigureData => f !== undefined).map(f => (
        <PanelFigure key={f.id} value={f.value_label} label={f.label} meta={<>{formatIsoDate(f.as_of)} <QualityTag quality={f.provenance.data_quality} /></>} />
      ))}
      <PanelKicker style={{ marginTop: 12 }}>{actorsOf(selected.id).length} acteurs suivis</PanelKicker>
      <PanelText small>{actorsOf(selected.id).map(a => a.name).join(", ")}</PanelText>
      {selected.material_links.length > 0 && (
        <>
          <PanelKicker>Matières critiques consommées</PanelKicker>
          <div className="flex flex-wrap" style={{ gap: 6, marginBottom: 16 }}>
            {selected.material_links.map(m => (
              <Link key={m.material_id} href={`/materials/${m.material_id}`} className="ind-tag ind-tag-accent" title={m.rationale}>
                {materialNames[m.material_id] ?? m.material_id} →
              </Link>
            ))}
          </div>
        </>
      )}
      <Link href={`/robotics/${selected.id}`} style={{ fontSize: 14, fontWeight: 600 }}>
        Fiche de la couche →
      </Link>
    </div>
  );

  const chinaPanel = (
    <div>
      <PanelKicker>Lecture</PanelKicker>
      <PanelTitle>Où l’emprise culmine</PanelTitle>
      <PanelText>
        La Chine assure {china.extraction.value_label} de l’extraction des terres rares, {china.raffinage.value_label} de leur raffinage
        et {china.aimants.value_label} de la production d’aimants frittés : son emprise est la plus forte à l’étape « {peak.stage} ».
      </PanelText>
      <PanelText>
        En bout de chaîne, ses constructeurs ont assuré {china.livraisons.value_label} des livraisons d’humanoïdes en {china.livraisons.as_of}.
      </PanelText>
      <PanelNote>
        Parts relues dans des sources datées ; les corrections apportées au dossier d’origine figurent dans la <a href="#methode">méthode</a>.
      </PanelNote>
    </div>
  );

  return (
    <Section id="controle" revealDelay={revealDelay}>
      <SectionKicker>02 · Contrôle de la chaîne</SectionKicker>
      <SectionHeading
        title="Qui tient chaque maillon"
        lead={`Les blocs qui dominent ou contestent chacune des ${layers.length} couches, de la mine aux modèles d’IA, et l’emprise chinoise là où elle est mesurée.`}
        aside={<ViewSwitch name="rb-control-view" value={view} options={VIEWS} onChange={v => go(v)} />}
      />
      <VizFrame
        frameRef={frameRef}
        play={inView}
        chart={view === "pile" ? pile : view === "matrice" ? matrix : chinaView}
        panel={view === "chine" ? chinaPanel : selected ? detail : overview}
      />
    </Section>
  );
}
