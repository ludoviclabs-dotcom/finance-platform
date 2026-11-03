"use client";

import Link from "next/link";
import { useState } from "react";
import type { Actor, KeyFigure as KeyFigureData, Layer } from "@/lib/robotics/dataLoader";
import { getChinaTier } from "@/lib/crm/dataLoader";
import { CHINA_TIER_META } from "@/lib/crm/chinaTier";
import { Section } from "@/components/materials/industry/Section";
import { SectionKicker } from "@/components/materials/industry/SectionKicker";
import { QualityTag } from "./KeyFigure";
import { BLOC_COLOR, SEGMENT_DESC, SEGMENT_LABEL, SEGMENT_ORDER, blocCode, blocDisplayName, formatIsoDate, layerShort } from "./labels";
import {
  PanelFigure,
  PanelHead,
  PanelHint,
  PanelKicker,
  PanelText,
  PanelTitle,
  SectionHeading,
  ViewSwitch,
  VizFrame,
  cycle,
  useInView,
} from "./viz";

type View = "flux" | "parcours";

/** Matière critique vue depuis /robotics : part chinoise null quand la Chine
 *  ne figure pas parmi les premiers producteurs suivis par /materials. */
export interface FlowMaterial {
  id: string;
  name: string;
  chinaShare: number | null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const tierColor = (share: number | null) => CHINA_TIER_META[getChinaTier(share ?? 0)].colorVar;
// Trait légèrement assombri : le palier bas, très clair, resterait invisible sur le fond.
const linkColor = (share: number | null) => `color-mix(in srgb, ${tierColor(share)} 82%, var(--color-text))`;
const shareLabel = (share: number | null) => (share === null ? "—" : `${share} %`);

const flowIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 5c9 0 9 14 18 14" />
    <path d="M3 12h18" />
    <path d="M3 19c9 0 9-14 18-14" />
  </svg>
);

const VIEWS = [
  { id: "flux", label: "Flux matières", icon: flowIcon },
  { id: "parcours", label: "Parcours" },
] as const;

const smallCaps: React.CSSProperties = {
  fontSize: 11,
  lineHeight: "14px",
  letterSpacing: ".08em",
  textTransform: "uppercase",
  fontWeight: 600,
  color: "var(--ink-70)",
  whiteSpace: "nowrap",
};

// Géométrie du flux : matières à gauche, couches à droite.
const MAT_X = 156;
const LAYER_X = 470;

export default function ValueChainFlow({
  layers,
  actors,
  keyFigures,
  materials,
  trackedMaterials,
  revealDelay,
  initialView = "flux",
}: {
  /** Couches dans l'ordre de lecture (layersInReadingOrder). */
  layers: Layer[];
  actors: Actor[];
  keyFigures: KeyFigureData[];
  /** Matières consommées par au moins une couche. */
  materials: FlowMaterial[];
  /** Nombre de matières suivies dans /materials. */
  trackedMaterials: number;
  revealDelay?: number;
  initialView?: View;
}) {
  const [view, setView] = useState<View>(initialView);
  const [sel, setSel] = useState<string | null>(null);
  const [hov, setHov] = useState<string | null>(null);
  const [frameRef, inView] = useInView<HTMLElement>();
  const focus = sel ?? hov;

  const materialById = new Map(materials.map(m => [m.id, m]));
  const figureById = new Map(keyFigures.map(k => [k.id, k]));
  const actorsOf = (layerId: string) => actors.filter(a => a.layer_ids.includes(layerId));
  const toggle = (key: string) => setSel(prev => (prev === key ? null : key));
  const go = (next: View) => {
    setView(next);
    setSel(null);
    setHov(null);
  };

  // Matières dans l'ordre où la chaîne les rencontre : les liens se croisent moins.
  const ordered: FlowMaterial[] = [];
  for (const l of layers) {
    for (const link of l.material_links) {
      const m = materialById.get(link.material_id);
      if (m && !ordered.includes(m)) ordered.push(m);
    }
  }
  const links = layers.flatMap(l =>
    l.material_links.filter(link => materialById.has(link.material_id)).map(link => ({ layer: l, materialId: link.material_id, why: link.rationale })),
  );
  const pitch = ordered.length > 1 ? Math.min(28, 532 / (ordered.length - 1)) : 0;
  const matY = new Map(ordered.map((m, i) => [m.id, 44 + i * pitch]));
  const segIndex = (l: Layer) => SEGMENT_ORDER.indexOf(l.segment);
  const layerY = new Map(layers.map((l, i) => [l.id, 68 + i * 36 + segIndex(l) * 28]));

  const linkOn = (materialId: string, layerId: string) => !focus || focus === `m:${materialId}` || focus === `l:${layerId}`;
  const matOn = (id: string) => !focus || focus === `m:${id}` || links.some(k => k.materialId === id && focus === `l:${k.layer.id}`);
  const layerOn = (id: string) => !focus || focus === `l:${id}` || links.some(k => k.layer.id === id && focus === `m:${k.materialId}`);

  const groupHeads = SEGMENT_ORDER.map(segment => {
    const first = layers.find(l => l.segment === segment);
    return first ? { segment, top: (layerY.get(first.id) ?? 0) - 28 } : null;
  }).filter((g): g is { segment: (typeof SEGMENT_ORDER)[number]; top: number } => g !== null);

  const flux = (
    <div style={{ position: "relative", width: 660, height: 620 }}>
      <span style={{ ...smallCaps, position: "absolute", left: 0, top: 4, width: MAT_X, textAlign: "right" }}>Matière · part Chine</span>
      <span style={{ ...smallCaps, position: "absolute", left: LAYER_X + 16, top: 4 }}>Couche de la chaîne</span>
      <svg width={660} height={620} viewBox="0 0 660 620" style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }} aria-hidden="true">
        {links.map((k, i) => {
          const y1 = matY.get(k.materialId) ?? 0;
          const y2 = layerY.get(k.layer.id) ?? 0;
          const mid = (MAT_X + LAYER_X) / 2;
          const d = `M${MAT_X},${y1} C${mid},${y1} ${mid},${y2} ${LAYER_X},${y2}`;
          const on = linkOn(k.materialId, k.layer.id);
          return (
            <g key={`${k.materialId}-${k.layer.id}`} className="rb-dim rb-fade" style={{ opacity: on ? 1 : 0.08, animationDelay: `${0.2 + i * 0.03}s` }}>
              <path d={d} fill="none" strokeWidth={focus && on ? 3 : 2} style={{ stroke: linkColor(materialById.get(k.materialId)?.chinaShare ?? null) }} />
              <path className="rb-flow" d={d} fill="none" strokeWidth={2.6} style={{ stroke: "var(--color-bg)" }} />
            </g>
          );
        })}
      </svg>
      {ordered.map((m, i) => (
        <button
          key={m.id}
          type="button"
          className="rb-hit rb-dim rb-fade"
          aria-pressed={sel === `m:${m.id}`}
          onClick={() => toggle(`m:${m.id}`)}
          onMouseEnter={() => setHov(`m:${m.id}`)}
          onMouseLeave={() => setHov(null)}
          style={{
            position: "absolute",
            left: 0,
            top: (matY.get(m.id) ?? 0) - 13,
            width: MAT_X,
            height: 26,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 6,
            paddingLeft: 4,
            fontSize: 12,
            lineHeight: "16px",
            fontWeight: sel === `m:${m.id}` ? 600 : 400,
            whiteSpace: "nowrap",
            opacity: matOn(m.id) ? 1 : 0.35,
            animationDelay: `${0.05 + i * 0.02}s`,
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</span>
          <span style={{ flex: "0 0 30px", textAlign: "right", color: "var(--ink-70)", fontFeatureSettings: "'tnum' 1" }}>{shareLabel(m.chinaShare)}</span>
          <i style={{ flex: "0 0 6px", height: 16, background: tierColor(m.chinaShare), border: "1px solid var(--color-divider)", boxSizing: "border-box" }} />
        </button>
      ))}
      {groupHeads.map(g => (
        <span key={g.segment} style={{ ...smallCaps, position: "absolute", left: LAYER_X + 16, top: g.top, letterSpacing: ".1em", color: "var(--color-accent-700)" }}>
          {SEGMENT_LABEL[g.segment]}
        </span>
      ))}
      {layers.map((l, i) => (
        <button
          key={l.id}
          type="button"
          className="rb-hit rb-dim rb-fade"
          aria-pressed={sel === `l:${l.id}`}
          title={l.name}
          onClick={() => toggle(`l:${l.id}`)}
          onMouseEnter={() => setHov(`l:${l.id}`)}
          onMouseLeave={() => setHov(null)}
          style={{
            position: "absolute",
            left: LAYER_X,
            top: (layerY.get(l.id) ?? 0) - 16,
            width: 660 - LAYER_X,
            height: 32,
            display: "flex",
            alignItems: "center",
            gap: 10,
            paddingRight: 6,
            fontSize: 12.5,
            lineHeight: "16px",
            fontWeight: sel === `l:${l.id}` ? 600 : 400,
            whiteSpace: "nowrap",
            opacity: layerOn(l.id) ? 1 : 0.35,
            animationDelay: `${0.1 + i * 0.03}s`,
          }}
        >
          <i
            style={{
              flex: "0 0 6px",
              height: 20,
              boxSizing: "border-box",
              border: "1.5px solid var(--color-accent-700)",
              background: l.material_links.length ? "var(--color-accent-700)" : "transparent",
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".08em", color: "var(--color-accent-700)", fontFeatureSettings: "'tnum' 1" }}>{pad(l.order)}</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{layerShort(l)}</span>
        </button>
      ))}
      <p style={{ position: "absolute", left: LAYER_X + 16, top: 584, width: 660 - LAYER_X - 16, margin: 0, fontSize: 12, lineHeight: "16px", color: "var(--ink-70)" }}>
        Nœud creux : aucune matière critique suivie.
      </p>
    </div>
  );

  const path = (
    <div style={{ position: "relative", width: 660, minHeight: 620 }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 104, height: 2, background: "repeating-linear-gradient(90deg, color-mix(in srgb, var(--color-accent-700) 45%, transparent) 0 6px, transparent 6px 12px)" }}>
        {[0, 1.66, 3.33].map(delay => (
          <i key={delay} className="rb-travel" style={{ position: "absolute", top: -3, left: 0, width: 8, height: 8, background: "var(--color-accent-700)", opacity: 0, animationDelay: `${delay}s` }} />
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", columnGap: 16 }}>
        {SEGMENT_ORDER.map((segment, si) => (
          <div key={segment} className="flex flex-col" style={{ gap: 10 }}>
            <div style={{ height: 96, marginBottom: 26 }}>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".08em", color: "var(--color-accent-700)", fontFeatureSettings: "'tnum' 1" }}>
                {pad(si + 1)} / {pad(SEGMENT_ORDER.length)}
              </span>
              <h3 style={{ margin: "4px 0 0", fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 24, lineHeight: "26px", letterSpacing: ".02em", textTransform: "uppercase" }}>
                {SEGMENT_LABEL[segment]}
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: 12, lineHeight: "16px", color: "var(--ink-70)" }}>{SEGMENT_DESC[segment]}</p>
            </div>
            {layers
              .filter(l => l.segment === segment)
              .map((l, i) => {
                const fig = l.key_figure_ids.map(id => figureById.get(id)).find((f): f is KeyFigureData => f !== undefined);
                const layerActors = actorsOf(l.id);
                const roles = [...l.dominant_blocs.map(b => [b, true] as const), ...l.challenger_blocs.map(b => [b, false] as const)];
                return (
                  <button
                    key={l.id}
                    type="button"
                    className="rb-card rb-fade flex flex-col"
                    aria-pressed={sel === `l:${l.id}`}
                    onClick={() => toggle(`l:${l.id}`)}
                    style={{ gap: 8, padding: 12, width: "100%", boxSizing: "border-box", animationDelay: `${0.1 + si * 0.12 + i * 0.06}s` }}
                  >
                    <span className="flex items-baseline" style={{ gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".08em", color: "var(--color-accent-700)", fontFeatureSettings: "'tnum' 1" }}>{pad(l.order)}</span>
                      <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 16, lineHeight: "18px", letterSpacing: ".02em", textTransform: "uppercase" }}>{layerShort(l)}</span>
                    </span>
                    {fig && (
                      <span className="flex flex-col">
                        <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 24, lineHeight: "26px", fontFeatureSettings: "'tnum' 1" }}>{fig.value_label}</span>
                        <span style={{ fontSize: 12, lineHeight: "16px", color: "var(--ink-78)" }}>{fig.label}</span>
                      </span>
                    )}
                    <span className="flex flex-wrap" style={{ gap: 4 }}>
                      {roles.map(([b, dominant]) => (
                        <span
                          key={b}
                          title={`${blocDisplayName(b, layerActors)} : ${dominant ? "domine" : "conteste"}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minWidth: 26,
                            height: 18,
                            boxSizing: "border-box",
                            padding: "0 4px",
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: ".06em",
                            background: dominant ? BLOC_COLOR[b].fill : "transparent",
                            color: dominant ? BLOC_COLOR[b].ink : "var(--color-text)",
                            border: `1px ${dominant ? "solid" : "dashed"} ${BLOC_COLOR[b].edge}`,
                          }}
                        >
                          {blocCode(b, layerActors)}
                        </span>
                      ))}
                    </span>
                    <span style={{ fontSize: 12, lineHeight: "16px", color: "var(--ink-70)" }}>
                      {l.material_links.length ? `${l.material_links.length} matière${l.material_links.length > 1 ? "s" : ""}` : "aucune matière"} · {layerActors.length} acteurs
                    </span>
                  </button>
                );
              })}
          </div>
        ))}
      </div>
      <p style={{ margin: "18px 0 0", fontSize: 12, lineHeight: "18px", color: "var(--ink-70)" }}>
        Pastille pleine : le bloc domine la couche · pointillée : il la conteste.
      </p>
    </div>
  );

  // ── Panneau de lecture ─────────────────────────────────────────────────
  const usesOf = (materialId: string) => links.filter(k => k.materialId === materialId);
  const mostShared = ordered.reduce<FlowMaterial | null>((best, m) => (!best || usesOf(m.id).length > usesOf(best.id).length ? m : best), null);
  const fed = layers.filter(l => l.material_links.length > 0);
  const unfed = layers.filter(l => l.material_links.length === 0);
  const chinaHeavy = ordered.filter(m => getChinaTier(m.chinaShare ?? 0) === "high").length;

  const overview = (
    <div>
      <PanelKicker>Lecture</PanelKicker>
      <PanelTitle>
        {ordered.length} matières, {fed.length} couches
      </PanelTitle>
      <PanelText>
        {ordered.length} des {trackedMaterials} matières suivies entrent dans la chaîne ; {chinaHeavy} sont produites à 50 % ou plus en Chine.
        {mostShared && ` ${mostShared.name} : la plus partagée, consommée par ${usesOf(mostShared.id).length} couches.`}
      </PanelText>
      {unfed.length > 0 && <PanelText small>Sans matière critique suivie : {unfed.map(l => layerShort(l)).join(", ")}.</PanelText>}
      <PanelKicker style={{ marginTop: 16 }}>Part de la Chine dans la production</PanelKicker>
      <div className="flex flex-col" style={{ gap: 6, fontSize: 13, lineHeight: "18px", marginBottom: 18 }}>
        {(["high", "mid", "low"] as const).map(tier => (
          <span key={tier} className="flex items-center" style={{ gap: 8 }}>
            <i style={{ flex: "0 0 auto", width: 12, height: 12, background: CHINA_TIER_META[tier].colorVar, border: "1px solid var(--color-divider)" }} />
            {CHINA_TIER_META[tier].desc}
            {tier === "low" && " (— : Chine hors des premiers producteurs)"}
          </span>
        ))}
      </div>
      <PanelKicker>Fiches matières</PanelKicker>
      <div className="flex flex-wrap" style={{ gap: 6 }}>
        {ordered.map(m => (
          <Link key={m.id} href={`/materials/${m.id}`} className="ind-tag ind-tag-accent">
            {m.name}
          </Link>
        ))}
      </div>
      <PanelHint>Choisir une matière ou une couche →</PanelHint>
    </div>
  );

  const selMaterial = sel?.startsWith("m:") ? materialById.get(sel.slice(2)) ?? null : null;
  const selLayer = sel?.startsWith("l:") ? layers.find(l => l.id === sel.slice(2)) ?? null : null;

  const materialPanel = selMaterial && (
    <div>
      <PanelHead
        kicker="Matière critique"
        onPrev={() => setSel(`m:${cycle(ordered, selMaterial, -1).id}`)}
        onNext={() => setSel(`m:${cycle(ordered, selMaterial, 1).id}`)}
        onClose={() => setSel(null)}
        prevLabel="Matière précédente"
        nextLabel="Matière suivante"
      />
      <PanelTitle>{selMaterial.name}</PanelTitle>
      <div className="flex items-baseline" style={{ gap: 12 }}>
        <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 56, lineHeight: "56px", fontFeatureSettings: "'tnum' 1" }}>{shareLabel(selMaterial.chinaShare)}</span>
        <i style={{ width: 14, height: 14, background: tierColor(selMaterial.chinaShare), border: "1px solid var(--color-divider)" }} />
      </div>
      <PanelText small>
        {selMaterial.chinaShare === null
          ? "La Chine ne figure pas parmi les premiers producteurs de cette matière."
          : "Part de la Chine dans la production, au stade suivi par Matières critiques."}
      </PanelText>
      <PanelKicker>
        Alimente {usesOf(selMaterial.id).length} couche{usesOf(selMaterial.id).length > 1 ? "s" : ""}
      </PanelKicker>
      {usesOf(selMaterial.id).map(k => (
        <div key={k.layer.id} className="flex flex-col" style={{ gap: 2, padding: "9px 0", borderTop: "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)" }}>
          <Link href={`/robotics/${k.layer.id}`} style={{ fontSize: 14, lineHeight: "20px", fontWeight: 600 }}>
            {pad(k.layer.order)} · {k.layer.name}
          </Link>
          <span style={{ fontSize: 13, lineHeight: "18px", color: "var(--ink-78)" }}>{k.why}</span>
        </div>
      ))}
      <Link href={`/materials/${selMaterial.id}`} style={{ display: "inline-block", marginTop: 14, fontSize: 14, fontWeight: 600 }}>
        Fiche de la matière →
      </Link>
    </div>
  );

  const layerPanel = selLayer && (
    <div>
      <PanelHead
        kicker={`Couche ${pad(selLayer.order)} / ${pad(layers.length)} · ${SEGMENT_LABEL[selLayer.segment]}`}
        onPrev={() => setSel(`l:${cycle(layers, selLayer, -1).id}`)}
        onNext={() => setSel(`l:${cycle(layers, selLayer, 1).id}`)}
        onClose={() => setSel(null)}
        prevLabel="Couche précédente"
        nextLabel="Couche suivante"
      />
      <PanelTitle>{selLayer.name}</PanelTitle>
      <PanelText small>
        Domine : {selLayer.dominant_blocs.map(b => blocDisplayName(b, actorsOf(selLayer.id))).join(", ")}
        {selLayer.challenger_blocs.length > 0 && ` · Conteste : ${selLayer.challenger_blocs.map(b => blocDisplayName(b, actorsOf(selLayer.id))).join(", ")}`}
      </PanelText>
      <PanelKicker>{selLayer.material_links.length ? "Matières critiques consommées" : "Matières critiques"}</PanelKicker>
      {selLayer.material_links.length === 0 && <PanelText small>Aucune matière critique suivie pour cette couche.</PanelText>}
      {selLayer.material_links.map(link => {
        const m = materialById.get(link.material_id);
        return (
          <div key={link.material_id} className="flex flex-col" style={{ gap: 2, padding: "9px 0", borderTop: "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)" }}>
            <Link href={`/materials/${link.material_id}`} style={{ fontSize: 14, lineHeight: "20px", fontWeight: 600 }}>
              {m?.name ?? link.material_id} <span style={{ fontWeight: 400, color: "var(--ink-70)" }}>· Chine {shareLabel(m?.chinaShare ?? null)}</span>
            </Link>
            <span style={{ fontSize: 13, lineHeight: "18px", color: "var(--ink-78)" }}>{link.rationale}</span>
          </div>
        );
      })}
      {selLayer.key_figure_ids.map(id => figureById.get(id)).filter((f): f is KeyFigureData => f !== undefined).slice(0, 2).map(f => (
        <PanelFigure key={f.id} value={f.value_label} label={f.label} meta={<>{formatIsoDate(f.as_of)} <QualityTag quality={f.provenance.data_quality} /></>} />
      ))}
      <PanelKicker style={{ marginTop: 14 }}>{actorsOf(selLayer.id).length} acteurs suivis</PanelKicker>
      <PanelText small>{actorsOf(selLayer.id).map(a => a.name).join(", ")}</PanelText>
      <Link href={`/robotics/${selLayer.id}`} style={{ fontSize: 14, fontWeight: 600 }}>
        Fiche de la couche →
      </Link>
    </div>
  );

  return (
    <Section id="chaine" revealDelay={revealDelay}>
      <SectionKicker>05 · De la mine au robot</SectionKicker>
      <SectionHeading
        title={`La chaîne de valeur en ${layers.length} couches`}
        lead={
          <>
            Quelles matières critiques entrent dans quelle couche : {ordered.length} des {trackedMaterials} matières suivies dans{" "}
            <Link href="/materials">Matières critiques</Link>.
          </>
        }
        aside={<ViewSwitch name="rb-chain-view" value={view} options={VIEWS} onChange={go} />}
      />
      <VizFrame frameRef={frameRef} play={inView} chart={view === "flux" ? flux : path} panel={materialPanel || layerPanel || overview} />
    </Section>
  );
}
