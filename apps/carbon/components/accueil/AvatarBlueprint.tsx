"use client";

import { useEffect, useRef } from "react";
import { Frame } from "@/components/materials/industry/Frame";

/**
 * Planche « Assistant ESG » du hero : le copilote NEURAL dessiné en épure
 * (robot filaire, cotes, ligne de scan) et sa fiche technique. Données
 * fictives, annoncées comme telles dans le pied de la figure.
 *
 * Animations (Web Animations API, comme la maquette) : tracé des formes,
 * scan en va-et-vient, jauge qui se remplit, et un glitch à intervalle
 * irrégulier. Rien ne joue si le visiteur demande
 * moins d'animations.
 */

type Shape = ["line" | "circle" | "rect", Record<string, number>];

const SHAPES: readonly Shape[] = [
  ["line", { x1: 120, y1: 40, x2: 120, y2: 62 }],
  ["circle", { cx: 120, cy: 34, r: 6 }],
  ["rect", { x: 58, y: 62, width: 124, height: 84, rx: 34 }],
  ["rect", { x: 72, y: 78, width: 96, height: 52, rx: 22 }],
  ["rect", { x: 42, y: 88, width: 12, height: 34, rx: 5 }],
  ["rect", { x: 186, y: 88, width: 12, height: 34, rx: 5 }],
  ["rect", { x: 108, y: 146, width: 24, height: 10 }],
  ["rect", { x: 72, y: 156, width: 96, height: 62, rx: 18 }],
  ["circle", { cx: 120, cy: 187, r: 13 }],
  ["rect", { x: 54, y: 162, width: 12, height: 46, rx: 6 }],
  ["rect", { x: 174, y: 162, width: 12, height: 46, rx: 6 }],
];

const EASE = "cubic-bezier(.2,.7,.2,1)";
const MUTED = "var(--ink-70)";

function Shapes({ draw }: { draw?: boolean }) {
  return SHAPES.map(([Tag, attrs], i) => <Tag key={i} {...attrs} data-s={draw ? 1 : undefined} />);
}

const SPECS = [
  { k: "Copilote", v: "NEURAL v2.4" },
  { k: "Référentiel", v: "ESRS 2026" },
] as const;

const DT: React.CSSProperties = { fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED };
const DD: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-heading)",
  fontWeight: 600,
  fontSize: 19,
  letterSpacing: "0.02em",
};
const ROW: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 12,
  padding: "12px 16px",
  borderBottom: "1px solid var(--color-divider)",
};

export function AvatarBlueprint({ size = 150 }: { size?: number }) {
  const main = useRef<SVGGElement>(null);
  const ghost = useRef<SVGGElement>(null);
  const eyes = useRef<SVGGElement>(null);
  const scan = useRef<SVGLineElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const anims: Animation[] = [];
    main.current?.querySelectorAll<SVGGeometryElement>("[data-s]").forEach((el, i) => {
      const L = Math.ceil(el.getTotalLength());
      anims.push(
        el.animate(
          [
            { strokeDasharray: `${L}`, strokeDashoffset: `${L}` },
            { strokeDasharray: `${L}`, strokeDashoffset: "0" },
          ],
          { duration: 900, delay: 200 + i * 70, easing: EASE, fill: "backwards" },
        ),
      );
    });
    if (scan.current)
      anims.push(
        scan.current.animate([{ transform: "translateY(0)" }, { transform: "translateY(190px)" }], {
          duration: 2600,
          iterations: Infinity,
          direction: "alternate",
          easing: "ease-in-out",
        }),
      );
    if (bar.current)
      anims.push(
        bar.current.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
          duration: 1200,
          delay: 900,
          easing: EASE,
          fill: "backwards",
        }),
      );

    let timer: ReturnType<typeof setTimeout>;
    const glitch = () => {
      const g = ghost.current;
      const m = main.current;
      if (!g || !m) return;
      g.animate(
        [
          { opacity: 0, transform: "translate(0,0)" },
          { opacity: 0.9, transform: "translate(-6px,1px)" },
          { opacity: 0, transform: "translate(5px,-1px)" },
          { opacity: 0.7, transform: "translate(2px,2px)" },
          { opacity: 0, transform: "translate(0,0)" },
        ],
        { duration: 380, easing: "steps(5)" },
      );
      m.animate(
        [
          { transform: "translate(0,0)" },
          { transform: "translate(3px,0)" },
          { transform: "translate(-2px,0)" },
          { transform: "translate(0,0)" },
        ],
        { duration: 260, easing: "steps(4)" },
      );
      eyes.current?.animate([{ transform: "scaleY(1)" }, { transform: "scaleY(0.1)" }, { transform: "scaleY(1)" }], {
        duration: 220,
        delay: 520,
      });
      timer = setTimeout(glitch, 2600 + Math.random() * 2600);
    };
    timer = setTimeout(glitch, 1800);

    return () => {
      clearTimeout(timer);
      anims.forEach((a) => a.cancel());
    };
  }, []);

  return (
    <Frame as="figure" style={{ margin: 0, width: "100%", boxSizing: "border-box", color: "var(--color-text)" }}>
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--color-divider)",
          fontSize: 12,
          lineHeight: 1,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        <span style={{ flex: 1, padding: "11px 16px" }}>Assistant ESG</span>
        <span style={{ padding: "11px 16px", borderLeft: "1px solid var(--color-divider)", color: MUTED }}>Plate 01 / 04</span>
        <span style={{ padding: "11px 16px", borderLeft: "1px solid var(--color-divider)", color: MUTED }}>Rev 2.4</span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 1,
          background: "var(--color-divider)",
        }}
      >
        <div
          style={{
            position: "relative",
            display: "grid",
            placeItems: "center",
            minHeight: 236,
            padding: "24px 20px 32px",
            backgroundColor: "var(--color-bg)",
            backgroundImage:
              "linear-gradient(color-mix(in srgb, var(--color-accent) 9%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--color-accent) 9%, transparent) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        >
          <svg
            viewBox="0 0 240 260"
            width={size}
            height={Math.round((size * 260) / 240)}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            style={{ color: "var(--color-accent)", overflow: "visible", display: "block" }}
            aria-hidden
          >
            <g strokeWidth={1} strokeDasharray="2 5" style={{ opacity: 0.5 }}>
              <line x1={120} y1={12} x2={120} y2={252} />
              <line x1={30} y1={104} x2={210} y2={104} />
            </g>
            <g strokeWidth={1} style={{ opacity: 0.75 }}>
              <line x1={22} y1={62} x2={22} y2={218} />
              <line x1={17} y1={62} x2={27} y2={62} />
              <line x1={17} y1={218} x2={27} y2={218} />
              <text
                transform="translate(13 156) rotate(-90)"
                fill="currentColor"
                stroke="none"
                style={{ font: "500 9px var(--font-body)", letterSpacing: ".08em" }}
              >
                H 156
              </text>
            </g>
            <g ref={ghost} style={{ opacity: 0, color: "var(--color-accent-300)" }}>
              <Shapes />
            </g>
            <g ref={main}>
              <Shapes draw />
              <g ref={eyes} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
                <circle cx={100} cy={104} r={7} data-s={1} />
                <circle cx={140} cy={104} r={7} data-s={1} />
                <circle cx={100} cy={104} r={2.5} fill="currentColor" stroke="none" />
                <circle cx={140} cy={104} r={2.5} fill="currentColor" stroke="none" />
              </g>
              <circle cx={120} cy={187} r={5} fill="currentColor" stroke="none" style={{ opacity: 0.35 }} />
            </g>
            <ellipse cx={120} cy={240} rx={54} ry={6} strokeDasharray="3 4" style={{ opacity: 0.6 }} />
            <line
              ref={scan}
              x1={36}
              y1={44}
              x2={204}
              y2={44}
              strokeWidth={1}
              style={{ opacity: 0.5, color: "var(--color-accent-400)" }}
            />
          </svg>
          <span style={{ ...DT, position: "absolute", left: 12, bottom: 10, fontSize: 11, letterSpacing: "0.08em" }}>
            Fig. A — Copilote NEURAL
          </span>
          <span style={{ ...DT, position: "absolute", right: 12, bottom: 10, fontSize: 11, letterSpacing: "0.08em" }}>
            Éch. 1:10
          </span>
        </div>
        <dl style={{ margin: 0, background: "var(--color-bg)", display: "grid", alignContent: "start" }}>
          {SPECS.map((s) => (
            <div key={s.k} style={ROW}>
              <dt style={DT}>{s.k}</dt>
              <dd style={DD}>{s.v}</dd>
            </div>
          ))}
          <div style={ROW}>
            <dt style={DT}>Statut</dt>
            <dd style={{ ...DD, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 7, height: 7, background: "var(--color-accent)" }} />
              Rapport E1 généré
            </dd>
          </div>
          <div style={{ padding: "12px 16px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
              <dt style={DT}>ESRS E1 · couverture climat</dt>
              <dd style={{ ...DD, letterSpacing: undefined, fontVariantNumeric: "tabular-nums" }}>67/100</dd>
            </div>
            <div style={{ height: 3, marginTop: 10, background: "var(--color-divider)" }}>
              <div
                ref={bar}
                style={{ width: "67%", height: "100%", background: "var(--color-accent)", transformOrigin: "left center" }}
              />
            </div>
          </div>
        </dl>
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 8,
          padding: "10px 16px",
          borderTop: "1px solid var(--color-divider)",
          fontSize: 12,
          color: MUTED,
        }}
      >
        <span>Exemple illustratif · données fictives</span>
        <span style={{ letterSpacing: "0.08em" }}>EFRAG · GHG · ADEME</span>
      </div>
    </Frame>
  );
}
