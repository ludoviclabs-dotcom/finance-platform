"use client";

/* CarbonCo Cockpit — datavisualisation SVG sans dépendance.
   Composants : TrajectoryChart, ScoreRing, TargetGauge, ScopeDonut, RadarChart, Sparkline,
   WaterfallChart, CategoryBars. */

import { useEffect, useRef, useState } from "react";

export const fmt = (n: number, d = 0) =>
  Number(n).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Count-up animation hook (rAF) avec filet de sécurité timeout. */
export function useCountUp(target: number, duration = 1100, deps: unknown[] = []) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf = 0;
    let start: number | null = null;
    let done = false;
    const tick = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else done = true;
    };
    raf = requestAnimationFrame(tick);
    const fb = window.setTimeout(() => { if (!done) setVal(target); }, duration + 250);
    return () => { cancelAnimationFrame(raf); clearTimeout(fb); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, ...deps]);
  return val;
}

/* ─── TrajectoryChart : aires empilées S1/S2/S3 + ligne objectif ─────────── */
export type MonthPoint = { m: string; s1: number; s2: number; s3: number };
export type ScopesOn = { s1: boolean; s2: boolean; s3: boolean };

export function TrajectoryChart({
  data, scopesOn, height = 230, targetMonthly,
}: {
  data: MonthPoint[];
  scopesOn: ScopesOn;
  height?: number;
  targetMonthly: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = height, padL = 8, padR = 8, padT = 16, padB = 26;
  const innerW = W - padL - padR, innerH = H - padT - padB;

  const totals = data.map((d) =>
    (scopesOn.s1 ? d.s1 : 0) + (scopesOn.s2 ? d.s2 : 0) + (scopesOn.s3 ? d.s3 : 0)
  );
  const maxV = Math.max(...data.map((d) => d.s1 + d.s2 + d.s3)) * 1.12;
  const x = (i: number) => padL + (innerW * i) / (data.length - 1);
  const y = (v: number) => padT + innerH - (innerH * v) / maxV;

  const keys: Array<{ k: keyof Pick<MonthPoint, "s1" | "s2" | "s3">; c: string; on: boolean }> = [
    { k: "s3", c: "#A78BFA", on: scopesOn.s3 },
    { k: "s2", c: "#22D3EE", on: scopesOn.s2 },
    { k: "s1", c: "#34D399", on: scopesOn.s1 },
  ];

  const layers: { area: string; c: string; k: string }[] = [];
  let base = data.map(() => 0);
  keys.slice().reverse().forEach(({ k, c, on }) => {
    if (!on) return;
    const top = data.map((d, i) => base[i] + d[k]);
    const area =
      data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(top[i])}`).join(" ") +
      " " +
      data.map((_, i) => `L ${x(data.length - 1 - i)} ${y(base[data.length - 1 - i])}`).join(" ") +
      " Z";
    layers.push({ area, c, k });
    base = top;
  });

  const yTarget = y(targetMonthly);
  const lineTop = data
    .map((_, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(totals[i])}`)
    .join(" ");

  return (
    <div className="cc-chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          {keys.map(({ k, c }) => (
            <linearGradient key={k} id={`cc-grad-${k}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c} stopOpacity="0.45" />
              <stop offset="100%" stopColor={c} stopOpacity="0.04" />
            </linearGradient>
          ))}
        </defs>
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line
            key={g}
            x1={padL}
            x2={W - padR}
            y1={padT + innerH * g}
            y2={padT + innerH * g}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
          />
        ))}
        {layers.map((l) => (
          <path
            key={l.k}
            d={l.area}
            fill={`url(#cc-grad-${l.k})`}
            stroke={l.c}
            strokeWidth="1"
          />
        ))}
        <path d={lineTop} fill="none" stroke="currentColor" strokeWidth="2" opacity="0.85" />
        <line
          x1={padL}
          x2={W - padR}
          y1={yTarget}
          y2={yTarget}
          stroke="#FBBF24"
          strokeWidth="1.5"
          strokeDasharray="6 4"
          opacity="0.9"
        />
        <text
          x={W - padR}
          y={yTarget - 6}
          textAnchor="end"
          fill="#FBBF24"
          fontSize="11"
          fontFamily="'JetBrains Mono', monospace"
          opacity="0.9"
        >
          objectif {fmt(targetMonthly)} t/mois
        </text>
        {data.map((d, i) => (
          <g key={i}>
            <rect
              x={x(i) - innerW / data.length / 2}
              y={padT}
              width={innerW / data.length}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
            {hover === i && (
              <>
                <line
                  x1={x(i)}
                  x2={x(i)}
                  y1={padT}
                  y2={padT + innerH}
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth="1"
                />
                <circle
                  cx={x(i)}
                  cy={y(totals[i])}
                  r="4"
                  fill="currentColor"
                  stroke="#0A0F1A"
                  strokeWidth="2"
                />
              </>
            )}
          </g>
        ))}
        {data.map((d, i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize="10"
            fill={hover === i ? "currentColor" : "#5C6B82"}
            fontFamily="'JetBrains Mono', monospace"
          >
            {d.m}
          </text>
        ))}
      </svg>
      {hover !== null && (
        <div className="cc-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <div className="cc-tip-m">
            {data[hover].m} · {fmt(totals[hover])} t
          </div>
          {scopesOn.s1 && (
            <div><i style={{ background: "#34D399" }} />S1 · {fmt(data[hover].s1)}</div>
          )}
          {scopesOn.s2 && (
            <div><i style={{ background: "#22D3EE" }} />S2 · {fmt(data[hover].s2)}</div>
          )}
          {scopesOn.s3 && (
            <div><i style={{ background: "#A78BFA" }} />S3 · {fmt(data[hover].s3)}</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── ScoreRing : anneau radial de progression avec repère objectif ──────── */
export function ScoreRing({
  value, target, size = 132, stroke = 11,
}: { value: number; target: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = useCountUp(value, 1200);
  const off = c - (Math.min(100, v) / 100) * c;
  const targetAngle = (target / 100) * 360 - 90;
  const tx = size / 2 + r * Math.cos((targetAngle * Math.PI) / 180);
  const ty = size / 2 + r * Math.sin((targetAngle * Math.PI) / 180);
  return (
    <div className="cc-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id="cc-ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#22D3EE" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#cc-ring-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <circle cx={tx} cy={ty} r="3.5" fill="#FBBF24" />
      </svg>
      <div className="cc-ring-c">
        <div className="cc-ring-v">{Math.round(v)}</div>
        <div className="cc-ring-l">/ 100</div>
      </div>
    </div>
  );
}

/* ─── TargetGauge : jauge horizontale courant vs objectif ────────────────── */
export function TargetGauge({
  current, target, max,
}: { current: number; target: number; max: number }) {
  const pct = Math.min(100, (current / max) * 100);
  const tpct = (target / max) * 100;
  return (
    <div className="cc-gauge">
      <div className="cc-gauge-track">
        <div className="cc-gauge-fill" style={{ width: `${pct}%` }} />
        <div className="cc-gauge-target" style={{ left: `${tpct}%` }}>
          <span>objectif</span>
        </div>
      </div>
    </div>
  );
}

/* ─── ScopeDonut : donut interactif par scope ───────────────────────────── */
type DonutItem = { id: string | number; name: string; total: number; color: string };
export function ScopeDonut({
  items, size = 168, active, onHover,
}: {
  items: DonutItem[];
  size?: number;
  active?: DonutItem["id"] | null;
  onHover?: (id: DonutItem["id"] | null) => void;
}) {
  const total = items.reduce((a, s) => a + s.total, 0);
  const r = size / 2, ir = r * 0.62, cx = r, cy = r;
  // Pré-calcule les angles cumulés (immuable) — évite la mutation d'un curseur
  // dans .map(), que react-hooks/immutability interdit.
  const angles = items.reduce<number[]>((acc, s) => {
    const prev = acc.length ? acc[acc.length - 1] : -90;
    return [...acc, prev + (s.total / total) * 360];
  }, []);
  const arcs = items.map((s, i) => {
    const a0 = i === 0 ? -90 : angles[i - 1];
    const a1 = angles[i];
    const ang = a1 - a0;
    const gap = 2;
    const large = ang > 180 ? 1 : 0;
    const p = (deg: number, rad: number): [number, number] => [
      cx + rad * Math.cos((deg * Math.PI) / 180),
      cy + rad * Math.sin((deg * Math.PI) / 180),
    ];
    const [x0, y0] = p(a0 + gap, r);
    const [x1, y1] = p(a1 - gap, r);
    const [x2, y2] = p(a1 - gap, ir);
    const [x3, y3] = p(a0 + gap, ir);
    return {
      s,
      d: `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${ir} ${ir} 0 ${large} 0 ${x3} ${y3} Z`,
    };
  });
  return (
    <div className="cc-donut" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {arcs.map(({ s, d }) => (
          <path
            key={s.id}
            d={d}
            fill={s.color}
            opacity={active == null || active === s.id ? 1 : 0.3}
            onMouseEnter={() => onHover?.(s.id)}
            onMouseLeave={() => onHover?.(null)}
            style={{ cursor: "pointer", transition: "opacity .25s" }}
          />
        ))}
      </svg>
      <div className="cc-donut-c">
        <div className="cc-donut-v">{fmt(total)}</div>
        <div className="cc-donut-l">tCO₂e</div>
      </div>
    </div>
  );
}

/* ─── RadarChart : benchmark vous vs secteur ─────────────────────────────── */
type RadarPoint = { axis: string; you: number; sector: number };
export function RadarChart({ data, size = 230 }: { data: RadarPoint[]; size?: number }) {
  const cx = size / 2, cy = size / 2, R = size / 2 - 34;
  const n = data.length;
  const pt = (val: number, i: number, max = 80): [number, number] => {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
    const rr = (val / max) * R;
    return [cx + rr * Math.cos(ang), cy + rr * Math.sin(ang)];
  };
  const poly = (key: "you" | "sector") =>
    data.map((d, i) => pt(d[key], i).join(",")).join(" ");
  return (
    <div>
      <svg width="100%" height={size} viewBox={`0 0 ${size} ${size}`}>
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <polygon
            key={g}
            points={data
              .map((_, i) => {
                const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
                return [cx + R * g * Math.cos(ang), cy + R * g * Math.sin(ang)].join(",");
              })
              .join(" ")}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="1"
          />
        ))}
        {data.map((d, i) => {
          const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
          const ex = cx + R * Math.cos(ang);
          const ey = cy + R * Math.sin(ang);
          const lx = cx + (R + 18) * Math.cos(ang);
          const ly = cy + (R + 18) * Math.sin(ang);
          return (
            <g key={i}>
              <line x1={cx} y1={cy} x2={ex} y2={ey} stroke="rgba(255,255,255,0.06)" />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="10"
                fill="#8A99B0"
              >
                {d.axis}
              </text>
            </g>
          );
        })}
        <polygon
          points={poly("sector")}
          fill="rgba(34,211,238,0.10)"
          stroke="#22D3EE"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        <polygon
          points={poly("you")}
          fill="rgba(52,211,153,0.20)"
          stroke="#34D399"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

/* ─── Sparkline ──────────────────────────────────────────────────────────── */
export function Sparkline({
  data, color, w = 96, h = 30,
}: { data: number[]; color: string; w?: number; h?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const max = Math.max(...data);
  const min = Math.min(...data);
  const x = (i: number) => (w * i) / (data.length - 1);
  const y = (v: number) => h - 3 - ((h - 6) * (v - min)) / (max - min || 1);
  const d = data.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
  const area = `${d} L ${w} ${h} L 0 ${h} Z`;
  const id = `cc-sp-${color.replace("#", "")}`;
  return (
    <svg ref={ref} width={w} height={h} className="cc-spark">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/* ─── WaterfallChart : bridge des émissions par levier ───────────────────── */
export type WaterfallStep = {
  label: string;
  /** Ancre (`base`/`total`) : valeur absolue. `delta` : variation signée. */
  value: number;
  kind: "base" | "delta" | "total";
};

const WF_COLOR = {
  anchor: "#8A99B0",
  down: "#34D399",
  up: "#F87171",
  total: "#34D399",
} as const;

/** Cumule les étapes en barres positionnées (hors rendu : l'accumulateur ne doit
 *  pas être réassigné depuis une closure de rendu). */
function buildWaterfallBars(steps: WaterfallStep[]) {
  const bars: (WaterfallStep & {
    start: number; end: number; lo: number; hi: number; color: string; text: string;
  })[] = [];
  let running = 0;
  for (const s of steps) {
    const start = s.kind === "delta" ? running : 0;
    const end = s.kind === "base" ? s.value
      : s.kind === "total" ? running
      : running + s.value;
    if (s.kind !== "total") running = end;
    const color = s.kind === "base" ? WF_COLOR.anchor
      : s.kind === "total" ? WF_COLOR.total
      : s.value < 0 ? WF_COLOR.down : WF_COLOR.up;
    const text = s.kind === "delta"
      ? `${s.value < 0 ? "−" : "+"}${fmt(Math.abs(s.value))}`
      : fmt(end);
    bars.push({ ...s, start, end, color, text, lo: Math.min(start, end), hi: Math.max(start, end) });
  }
  return bars;
}

export function WaterfallChart({
  steps, height = 210,
}: { steps: WaterfallStep[]; height?: number }) {
  const bars = buildWaterfallBars(steps);
  const max = Math.max(1, ...bars.map((b) => b.hi));
  const pct = (v: number) => (v / max) * 100;
  const summary = bars.map((b) => `${b.label} ${b.text}`).join(", ");

  return (
    <div className="cc-wf" role="img" aria-label={`Bridge des émissions : ${summary}`}>
      <div className="cc-wf-plot" style={{ height }}>
        {bars.map((b, i) => (
          <div key={b.label} className="cc-wf-col">
            <span
              className="cc-wf-val cc-mono"
              style={{ bottom: `${pct(b.hi)}%`, color: b.color }}
            >
              {b.text}
            </span>
            <span
              className="cc-wf-bar"
              style={{
                bottom: `${pct(b.lo)}%`,
                height: `max(3px, ${pct(b.hi - b.lo)}%)`,
                background: b.color,
                opacity: b.kind === "delta" ? 0.92 : 1,
              }}
            />
            {i < bars.length - 1 && (
              <span className="cc-wf-link" style={{ bottom: `${pct(b.end)}%` }} />
            )}
          </div>
        ))}
      </div>
      <div className="cc-wf-axis">
        {bars.map((b) => (
          <span key={b.label} title={b.label}>{b.label}</span>
        ))}
      </div>
    </div>
  );
}

/* ─── CategoryBars : drill-down par scope ────────────────────────────────── */
export function CategoryBars({
  categories, color,
}: { categories: { name: string; value: number }[]; color: string }) {
  const max = Math.max(...categories.map((c) => c.value));
  return (
    <div className="cc-catbars">
      {categories.map((c) => (
        <div key={c.name} className="cc-catbar">
          <div className="cc-catbar-head">
            <span>{c.name}</span>
            <span className="cc-mono">{fmt(c.value)}</span>
          </div>
          <div className="cc-catbar-track">
            <div
              className="cc-catbar-fill"
              style={{ width: `${(c.value / max) * 100}%`, background: color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
