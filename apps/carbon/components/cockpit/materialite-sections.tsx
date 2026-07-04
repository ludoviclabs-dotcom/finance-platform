"use client";

/* Matérialité — composants cockpit refonte.
   IROMatrix (draggable) · KPI micro-viz · EnjeuxPanel · NarrativePanel. */

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown, Edit3, Filter, Layers, Save, ShieldCheck, Sparkles, Target as TargetIcon, TrendingUp,
} from "lucide-react";
import { useCountUp } from "./cockpit-charts";

/* ─── Types partagés ─────────────────────────────────────────────────────── */
export type Pillar = "E" | "S" | "G";
export type PillarMap = Record<Pillar, { label: string; color: string }>;
export type Trend = "up" | "down" | "flat";

export type MatIssue = {
  code: string;
  label: string;
  pillar: Pillar;
  esrs: string;
  x: number;
  y: number;
  fin: number;
  imp: number;
  iro: Array<"I" | "R" | "O">;
  trend: Trend;
  owner: string;
  score: number;
  materiel: boolean;
};

export type NarrativeBlock = { h?: string; p?: string; li?: string };

/* ─── Edit button + Save button + Sector bar ─────────────────────────────── */

export function EditModeButton({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      className={`mat-edit-btn ${on ? "on" : ""}`}
      onClick={onToggle}
      title={on ? "Sortir du mode édition" : "Activer le mode édition"}
    >
      <Edit3 className="w-3.5 h-3.5" /> {on ? "Édition active" : "Mode édition"}
    </button>
  );
}

export function SaveButton({
  onSave, saved, disabled,
}: { onSave: () => void; saved: boolean; disabled?: boolean }) {
  return (
    <button
      className={`mat-save-btn ${saved ? "saved" : ""}`}
      onClick={onSave}
      disabled={disabled}
    >
      <Save className="w-3.5 h-3.5" />
      <span>{saved ? "Enregistré" : "Sauvegarder"}</span>
    </button>
  );
}

export function SectorBar({
  sectors, sector, setSector, hint = "Les seuils et presets s'adaptent au secteur",
}: { sectors: string[]; sector: string; setSector: (s: string) => void; hint?: string }) {
  return (
    <div className="mat-sector">
      <span className="mat-sector-l"><Layers className="w-3.5 h-3.5" /> Secteur de référence</span>
      <div className="cc-seg">
        {sectors.map((s) => (
          <button
            key={s}
            className={`cc-seg-b ${sector === s ? "is-on" : ""}`}
            onClick={() => setSector(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <span className="mat-sector-hint">{hint}</span>
    </div>
  );
}

/* ─── KPI micro-visualisations ───────────────────────────────────────────── */

function PillarSplitBar({
  counts, pillars,
}: { counts: Record<Pillar, number>; pillars: PillarMap }) {
  const total = counts.E + counts.S + counts.G || 1;
  const seg: Array<[Pillar, number]> = [["E", counts.E], ["S", counts.S], ["G", counts.G]];
  return (
    <div className="mat-split">
      <div className="mat-split-bar">
        {seg.map(([p, n]) =>
          n > 0 ? (
            <div
              key={p}
              style={{ width: `${(n / total) * 100}%`, background: pillars[p].color }}
              title={`${pillars[p].label}: ${n}`}
            />
          ) : null
        )}
      </div>
      <div className="mat-split-legend">
        {seg.map(([p, n]) => (
          <span key={p}>
            <i style={{ background: pillars[p].color }} />{p} {n}
          </span>
        ))}
      </div>
    </div>
  );
}

function DotMatrix({ filled, total, color = "#34D399" }: { filled: number; total: number; color?: string }) {
  return (
    <div className="mat-dots">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="mat-dot"
          style={{
            background: i < filled ? color : "transparent",
            borderColor: i < filled ? color : "var(--cc-border-strong)",
          }}
        />
      ))}
    </div>
  );
}

function SegmentGauge({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="mat-seg-gauge">
      {Array.from({ length: max }).map((_, i) => {
        const fillPct = Math.max(0, Math.min(1, value - i)) * 100;
        return (
          <div key={i} className="mat-seg">
            <div className="mat-seg-fill" style={{ width: `${fillPct}%` }} />
          </div>
        );
      })}
    </div>
  );
}

function PillarBars({
  counts, pillars,
}: { counts: Record<Pillar, number>; pillars: PillarMap }) {
  const max = Math.max(counts.E, counts.S, counts.G, 1);
  return (
    <div className="mat-vbars">
      {(Object.keys(pillars) as Pillar[]).map((p) => (
        <div key={p} className="mat-vbar-col">
          <div className="mat-vbar-track">
            <div
              className="mat-vbar-fill"
              style={{ height: `${(counts[p] / max) * 100}%`, background: pillars[p].color }}
            />
          </div>
          <span className="mat-vbar-n" style={{ color: pillars[p].color }}>{counts[p]}</span>
          <span className="mat-vbar-l">{p}</span>
        </div>
      ))}
    </div>
  );
}

export function MatKpiRow({
  issues, pillars, scoreMoyen,
}: { issues: MatIssue[]; pillars: PillarMap; scoreMoyen: number }) {
  const total = issues.length;
  const material = issues.filter((i) => i.materiel).length;
  const countAll: Record<Pillar, number> = { E: 0, S: 0, G: 0 };
  const countMat: Record<Pillar, number> = { E: 0, S: 0, G: 0 };
  issues.forEach((i) => {
    countAll[i.pillar]++;
    if (i.materiel) countMat[i.pillar]++;
  });
  const totalAnim = useCountUp(total, 900, [total]);
  const matAnim = useCountUp(material, 1000, [material]);
  const scoreAnim = useCountUp(scoreMoyen, 1100, [scoreMoyen]);
  const matPct = total > 0 ? Math.round((material / total) * 100) : 0;

  return (
    <div className="mat-kpis">
      <div className="cc-card mat-kpi">
        <div className="mat-kpi-head">
          <span className="mat-kpi-ic em"><TargetIcon className="w-4 h-4" /></span>
          <span className="cc-eyebrow">Enjeux évalués</span>
        </div>
        <div className="mat-kpi-num">
          {Math.round(totalAnim)}
          <span className="mat-kpi-unit">enjeux ESRS</span>
        </div>
        <PillarSplitBar counts={countAll} pillars={pillars} />
      </div>

      <div className="cc-card mat-kpi">
        <div className="mat-kpi-head">
          <span className="mat-kpi-ic em"><Sparkles className="w-4 h-4" /></span>
          <span className="cc-eyebrow">Matériels</span>
        </div>
        <div className="mat-kpi-num">
          {Math.round(matAnim)}
          <span className="mat-kpi-unit">/ {total} · {matPct}%</span>
        </div>
        <DotMatrix filled={material} total={total} />
      </div>

      <div className="cc-card mat-kpi">
        <div className="mat-kpi-head">
          <span className="mat-kpi-ic amber"><TrendingUp className="w-4 h-4" /></span>
          <span className="cc-eyebrow">Score moyen</span>
        </div>
        <div className="mat-kpi-num">
          {scoreAnim.toFixed(1)}
          <span className="mat-kpi-unit">/ 5</span>
        </div>
        <SegmentGauge value={scoreMoyen} />
      </div>

      <div className="cc-card mat-kpi">
        <div className="mat-kpi-head">
          <span className="mat-kpi-ic violet"><ShieldCheck className="w-4 h-4" /></span>
          <span className="cc-eyebrow">Matériels par pilier</span>
        </div>
        <div className="mat-esg-wrap">
          <PillarBars counts={countMat} pillars={pillars} />
          <div className="mat-esg-legend">
            <div><i style={{ background: pillars.E.color }} />Environnement</div>
            <div><i style={{ background: pillars.S.color }} />Social</div>
            <div><i style={{ background: pillars.G.color }} />Gouvernance</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── IROMatrix : matrice draggable avec quadrants et seuils ─────────────── */

export function IROMatrix({
  issues, hovered, setHovered, editMode, onMove, threshold = 2.5, pillars,
}: {
  issues: MatIssue[];
  hovered: string | null;
  setHovered: (code: string | null) => void;
  editMode: boolean;
  onMove: (code: string, x: number, y: number) => void;
  threshold?: number;
  pillars: PillarMap;
}) {
  const SIZE = 520, padL = 48, padB = 46, padT = 30, padR = 22;
  const plotW = SIZE - padL - padR;
  const plotH = SIZE - padT - padB;
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<string | null>(null);

  const X = (v: number) => padL + (v / 5) * plotW;
  const Y = (v: number) => padT + plotH - (v / 5) * plotH;
  const tx = X(threshold);
  const tyv = Y(threshold);

  useEffect(() => {
    if (!editMode) return;
    const toData = (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      const sx = SIZE / rect.width, sy = SIZE / rect.height;
      const px = (clientX - rect.left) * sx;
      const py = (clientY - rect.top) * sy;
      const x = Math.max(0, Math.min(5, ((px - padL) / plotW) * 5));
      const y = Math.max(0, Math.min(5, ((padT + plotH - py) / plotH) * 5));
      return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    };
    const move = (e: MouseEvent | TouchEvent) => {
      if (!dragRef.current) return;
      const pt = "touches" in e ? e.touches[0] : (e as MouseEvent);
      const d = toData(pt.clientX, pt.clientY);
      if (d) onMove(dragRef.current, d.x, d.y);
    };
    const up = () => {
      dragRef.current = null;
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
  }, [editMode, onMove, plotW, plotH]);

  const ticks = [0, 1, 2, 3, 4, 5];
  const quadrants = [
    { x: padL,    y: tyv,  w: tx - padL,            h: (padT + plotH) - tyv, label: "Surveiller",        fill: "rgba(255,255,255,0.012)", hi: false },
    { x: tx,      y: tyv,  w: (padL + plotW) - tx,  h: (padT + plotH) - tyv, label: "Risque émergent",    fill: "rgba(96,165,250,0.05)",   hi: false },
    { x: padL,    y: padT, w: tx - padL,            h: tyv - padT,           label: "Impact fort",        fill: "rgba(167,139,250,0.05)",  hi: false },
    { x: tx,      y: padT, w: (padL + plotW) - tx,  h: tyv - padT,           label: "Matériel prioritaire", fill: "rgba(52,211,153,0.07)",  hi: true  },
  ];

  return (
    <div className="mat-matrix-wrap">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mat-matrix-svg"
        style={{ touchAction: editMode ? "none" : "auto" }}
      >
        <defs>
          <radialGradient id="mat-glow-em" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#34D399" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#34D399" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Quadrants */}
        {quadrants.map((q, i) => (
          <rect key={i} x={q.x} y={q.y} width={q.w} height={q.h} fill={q.fill} />
        ))}
        {/* Zone matérielle accent */}
        <rect
          x={tx} y={padT}
          width={(padL + plotW) - tx}
          height={tyv - padT}
          fill="none"
          stroke="rgba(52,211,153,0.25)"
          strokeWidth="1"
          strokeDasharray="4 4"
          rx="2"
        />

        {/* Labels quadrants */}
        {quadrants.map((q, i) => (
          <text
            key={i}
            x={q.x + q.w - 8}
            y={q.y + 16}
            textAnchor="end"
            fontSize="10.5"
            fontFamily="'Space Grotesk', sans-serif"
            fontWeight="600"
            fill={q.hi ? "#34D399" : "var(--cc-subtle)"}
            opacity={q.hi ? 0.9 : 0.55}
          >
            {q.label}
          </text>
        ))}

        {/* Grille */}
        {ticks.map((v) => (
          <g key={v}>
            <line x1={X(v)} y1={padT} x2={X(v)} y2={padT + plotH} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            <line x1={padL} y1={Y(v)} x2={padL + plotW} y2={Y(v)} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            <text x={X(v)} y={padT + plotH + 18} textAnchor="middle" fontSize="10" fill="var(--cc-subtle)" fontFamily="'JetBrains Mono', monospace">{v}</text>
            <text x={padL - 11} y={Y(v) + 3.5} textAnchor="end" fontSize="10" fill="var(--cc-subtle)" fontFamily="'JetBrains Mono', monospace">{v}</text>
          </g>
        ))}

        {/* Seuils */}
        <line x1={tx} y1={padT} x2={tx} y2={padT + plotH} stroke="#34D399" strokeWidth="1.4" strokeDasharray="5 4" opacity="0.5" />
        <line x1={padL} y1={tyv} x2={padL + plotW} y2={tyv} stroke="#34D399" strokeWidth="1.4" strokeDasharray="5 4" opacity="0.5" />
        <text x={tx + 5} y={padT + 10} fontSize="8.5" fill="#34D399" opacity="0.65" fontFamily="'JetBrains Mono', monospace">
          seuil {threshold}
        </text>

        {/* Axes */}
        <text
          x={padL + plotW / 2}
          y={SIZE - 6}
          textAnchor="middle"
          fontSize="11"
          fill="var(--cc-muted)"
          fontFamily="'Space Grotesk', sans-serif"
        >
          Probabilité / Occurrence — matérialité financière →
        </text>
        <text
          x={14}
          y={padT + plotH / 2}
          textAnchor="middle"
          fontSize="11"
          fill="var(--cc-muted)"
          fontFamily="'Space Grotesk', sans-serif"
          transform={`rotate(-90 14 ${padT + plotH / 2})`}
        >
          Impact → matérialité d&apos;impact
        </text>

        {/* Bulles */}
        {issues.map((it) => {
          const c = pillars[it.pillar]?.color ?? "#94a3b8";
          const cx = X(it.x);
          const cy = Y(it.y);
          const r = 8 + it.score * 1.7;
          const isHover = hovered === it.code;
          const dim = hovered !== null && !isHover;
          return (
            <g
              key={it.code}
              style={{ cursor: editMode ? "grab" : "pointer", opacity: dim ? 0.28 : 1 }}
              onMouseEnter={() => setHovered(it.code)}
              onMouseLeave={() => setHovered(null)}
              onMouseDown={(e) => {
                if (editMode) {
                  e.preventDefault();
                  dragRef.current = it.code;
                  document.body.style.cursor = "grabbing";
                }
              }}
              onTouchStart={() => {
                if (editMode) dragRef.current = it.code;
              }}
            >
              {it.materiel && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={r + 10}
                  fill="url(#mat-glow-em)"
                  opacity={isHover ? 0.5 : 0.22}
                  style={{ pointerEvents: "none" }}
                />
              )}
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={it.materiel ? c : "transparent"}
                stroke={c}
                strokeWidth={it.materiel ? (isHover ? 2.5 : 0) : 2}
                opacity={it.materiel ? 0.92 : 0.85}
              />
              <text
                x={cx}
                y={cy + 3.5}
                textAnchor="middle"
                fontSize="9.5"
                fontWeight="700"
                fill={it.materiel ? "#08111d" : c}
                fontFamily="'JetBrains Mono', monospace"
                style={{ pointerEvents: "none" }}
              >
                {it.code}
              </text>
              {isHover && (
                <text
                  x={cx}
                  y={cy - r - 7}
                  textAnchor="middle"
                  fontSize="10.5"
                  fontWeight="600"
                  fill="var(--cc-fg)"
                  fontFamily="'Inter', sans-serif"
                  style={{ pointerEvents: "none" }}
                >
                  {it.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ─── EnjeuxPanel : liste digitalisée avec filtres, tri, expand ──────────── */

const IRO_LABELS: Record<"I" | "R" | "O", { t: string; c: string }> = {
  I: { t: "Impact",      c: "var(--cc-em)" },
  R: { t: "Risque",      c: "var(--cc-amber)" },
  O: { t: "Opportunité", c: "var(--cc-cyan)" },
};

function DualBar({ imp, fin, color }: { imp: number; fin: number; color: string }) {
  return (
    <div className="mat-dual">
      <div className="mat-dual-row">
        <span className="mat-dual-k">I</span>
        <div className="mat-dual-track">
          <div className="mat-dual-fill" style={{ width: `${(imp / 5) * 100}%`, background: color }} />
        </div>
        <span className="mat-dual-v">{imp.toFixed(1)}</span>
      </div>
      <div className="mat-dual-row">
        <span className="mat-dual-k">F</span>
        <div className="mat-dual-track">
          <div className="mat-dual-fill" style={{ width: `${(fin / 5) * 100}%`, background: color, opacity: 0.55 }} />
        </div>
        <span className="mat-dual-v">{fin.toFixed(1)}</span>
      </div>
    </div>
  );
}

export function EnjeuxPanel({
  issues, pillars, hovered, setHovered,
}: {
  issues: MatIssue[];
  pillars: PillarMap;
  hovered: string | null;
  setHovered: (code: string | null) => void;
}) {
  const [filter, setFilter] = useState<"Tous" | Pillar>("Tous");
  const [sortKey, setSortKey] = useState<"score" | "alpha">("score");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = filter === "Tous" ? issues : issues.filter((i) => i.pillar === filter);
  const list = [...filtered].sort((a, b) =>
    sortKey === "score" ? b.score - a.score : a.label.localeCompare(b.label)
  );
  const matCount = list.filter((i) => i.materiel).length;
  const trendIcon: Record<Trend, string> = { up: "▲", down: "▼", flat: "—" };

  return (
    <div className="cc-card mat-enjeux">
      <div className="mat-enjeux-head">
        <div>
          <div className="cc-card-title">
            Enjeux <span className="mat-enjeux-count">{list.length}</span>
          </div>
          <div className="cc-card-sub">
            {matCount} matériels · triés par {sortKey === "score" ? "score" : "nom"}
          </div>
        </div>
        <button
          className="mat-sort"
          onClick={() => setSortKey((k) => (k === "score" ? "alpha" : "score"))}
          title="Changer le tri"
        >
          <Filter className="w-3 h-3" /> {sortKey === "score" ? "Score" : "A→Z"}
        </button>
      </div>

      <div className="mat-filters">
        {(["Tous", "E", "S", "G"] as const).map((f) => (
          <button
            key={f}
            className={`mat-filter ${filter === f ? "on" : ""}`}
            style={
              filter === f && f !== "Tous"
                ? {
                    borderColor: pillars[f].color,
                    color: pillars[f].color,
                    background: `color-mix(in srgb, ${pillars[f].color} 12%, transparent)`,
                  }
                : undefined
            }
            onClick={() => setFilter(f)}
          >
            {f === "Tous" ? "Tous" : pillars[f].label}
          </button>
        ))}
      </div>

      <div className="mat-enjeux-list">
        {list.map((it) => {
          const c = pillars[it.pillar]?.color ?? "#94a3b8";
          const isHover = hovered === it.code;
          const isOpen = expanded === it.code;
          return (
            <div
              key={it.code}
              className={`mat-row ${isHover ? "hover" : ""} ${it.materiel ? "" : "nonmat"} ${isOpen ? "open" : ""}`}
              style={{ ["--mat-pc" as string]: c }}
              onMouseEnter={() => setHovered(it.code)}
              onMouseLeave={() => setHovered(null)}
            >
              <button className="mat-row-main" onClick={() => setExpanded(isOpen ? null : it.code)}>
                <span className="mat-row-bar" />
                <span className="mat-row-code cc-mono">{it.code}</span>
                <div className="mat-row-mid">
                  <div className="mat-row-label">{it.label}</div>
                  <div className="mat-row-tags">
                    <span className="mat-esrs">{it.esrs}</span>
                    {it.iro.map((k) => (
                      <span
                        key={k}
                        className="mat-iro"
                        style={{
                          color: IRO_LABELS[k].c,
                          borderColor: `color-mix(in srgb, ${IRO_LABELS[k].c} 40%, transparent)`,
                        }}
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mat-row-score">
                  <div className="mat-row-scorebar">
                    <div style={{ width: `${(it.score / 5) * 100}%`, background: c }} />
                  </div>
                  <span className="mat-row-scoreval cc-mono">{it.score.toFixed(1)}</span>
                </div>
                <span className={`mat-row-mat ${it.materiel ? "yes" : "no"}`}>
                  {it.materiel ? "Matériel" : "Sous seuil"}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 mat-row-chev ${isOpen ? "rot" : ""}`} />
              </button>
              {isOpen && (
                <div className="mat-row-exp">
                  <DualBar imp={it.imp} fin={it.fin} color={c} />
                  <div className="mat-row-meta">
                    <div className="mat-meta-item">
                      <span>Pilote</span>
                      <strong>{it.owner}</strong>
                    </div>
                    <div className="mat-meta-item">
                      <span>Type IRO</span>
                      <strong>{it.iro.map((k) => IRO_LABELS[k].t).join(" · ")}</strong>
                    </div>
                    <div className="mat-meta-item">
                      <span>Tendance</span>
                      <strong className={`mat-trend ${it.trend}`}>
                        {trendIcon[it.trend]}{" "}
                        {it.trend === "up" ? "Hausse" : it.trend === "down" ? "Baisse" : "Stable"}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {list.length === 0 && (
          <div className="text-sm text-[var(--cc-muted)] text-center py-6">
            Aucun enjeu dans ce filtre.
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── MatrixSection : combine matrice + panneau Enjeux ───────────────────── */

export function MatrixSection({
  issues, pillars, hovered, setHovered, editMode, onMove, threshold,
}: {
  issues: MatIssue[];
  pillars: PillarMap;
  hovered: string | null;
  setHovered: (code: string | null) => void;
  editMode: boolean;
  onMove: (code: string, x: number, y: number) => void;
  threshold: number;
}) {
  return (
    <div className="mat-grid">
      <div className="cc-card mat-matrix-card">
        <div className="cc-card-head">
          <div>
            <div className="cc-card-title">Matrice impact × probabilité</div>
            <div className="cc-card-sub">
              {editMode
                ? "Glissez les enjeux pour les repositionner — recalcul instantané"
                : "Chaque bulle = un enjeu · taille ∝ score de matérialité"}
            </div>
          </div>
          <div className="mat-legend">
            {(Object.keys(pillars) as Pillar[]).map((p) => (
              <span key={p}><i style={{ background: pillars[p].color }} />{pillars[p].label}</span>
            ))}
          </div>
        </div>
        <IROMatrix
          issues={issues}
          hovered={hovered}
          setHovered={setHovered}
          editMode={editMode}
          onMove={onMove}
          threshold={threshold}
          pillars={pillars}
        />
      </div>

      <EnjeuxPanel
        issues={issues}
        pillars={pillars}
        hovered={hovered}
        setHovered={setHovered}
      />
    </div>
  );
}

/* ─── NarrativePanel ─────────────────────────────────────────────────────── */

function renderInline(text: string) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i}>{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

export function NarrativePanel({
  blocks, sector,
}: { blocks: NarrativeBlock[]; sector: string }) {
  return (
    <div className="cc-card mat-narrative">
      <div className="cc-card-head">
        <div className="cc-neural-brand">
          <div className="cc-neural-orb"><Sparkles className="w-3.5 h-3.5" /></div>
          <div>
            <div className="cc-neural-title">Narratif double matérialité</div>
            <div className="cc-neural-sub">Pré-rédigé par NEURAL · secteur {sector} · à valider</div>
          </div>
        </div>
        <button className="cc-neural-ask">
          <Edit3 className="w-3 h-3" /> Éditer
        </button>
      </div>
      <div className="mat-narr-body">
        {blocks.map((b, i) => {
          if (b.h) return <h3 key={i} className="mat-narr-h">{b.h}</h3>;
          if (b.li) return <p key={i} className="mat-narr-li">{renderInline(b.li)}</p>;
          if (b.p) return <p key={i} className="mat-narr-p">{renderInline(b.p)}</p>;
          return null;
        })}
      </div>
    </div>
  );
}

/* ─── Helper : parse narratif markdown plat vers blocs ───────────────────── */

export function parseNarrative(narrative: string): NarrativeBlock[] {
  const out: NarrativeBlock[] = [];
  const lines = narrative.split("\n");
  for (const line of lines) {
    if (line.startsWith("## ")) out.push({ h: line.slice(3).trim() });
    else if (line.startsWith("- ") || line.startsWith("* ")) out.push({ li: line.slice(2).trim() });
    else if (line.trim() && line !== "---") out.push({ p: line.trim() });
  }
  return out;
}
