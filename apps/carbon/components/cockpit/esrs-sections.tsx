"use client";

/* ESRS / CSRD — composants cockpit refonte.
   ComplianceGauge (270° radial) · MiniRadial · ESRSRadar ·
   EsrsHero · EsrsPriorities · StandardsList (groupée filtrable). */

import { useState } from "react";
import {
  AlertTriangle, ArrowRight, CheckCircle, ChevronDown, Filter, RefreshCw, Search, Sparkles,
} from "lucide-react";
import { useCountUp } from "./cockpit-charts";

/* ─── Types ──────────────────────────────────────────────────────────────── */
export type EsrsPillar = "E" | "S" | "G" | "GEN";
export type EsrsPillarMap = Record<EsrsPillar, { label: string; color: string }>;
export type EsrsStatusKey = "compliant" | "in_progress" | "not_started";

export type EsrsMaterialIssue = { code: string; label: string; score: number };

export type EsrsStandard = {
  id: string;       // ex. "ESRS E1"
  code: string;     // ex. "E1"
  name: string;
  pillar: EsrsPillar;
  progress: number;
  dp: number;
  done: number;
  missing: number;
  status: EsrsStatusKey;
  desc: string;
  owner: string;
  action: string;
  materialIssues: EsrsMaterialIssue[];
};

export type EsrsTotals = {
  avg: number;
  compliant: number;
  inProgress: number;
  notStarted: number;
  dpDone: number;
  dpTotal: number;
  target: number;
};

export type EsrsPillarSummary = {
  pillar: EsrsPillar;
  label: string;
  color: string;
  count: number;
  avg: number;
};

const STATUS_CFG: Record<EsrsStatusKey, { label: string; cls: "ok" | "warn" | "alert" }> = {
  compliant:   { label: "Conforme",    cls: "ok" },
  in_progress: { label: "En cours",    cls: "warn" },
  not_started: { label: "Non démarré", cls: "alert" },
};

/* ─── Compliance gauge 270° ──────────────────────────────────────────────── */

export function ComplianceGauge({
  value, target, size = 196, stroke = 16,
}: { value: number; target: number; size?: number; stroke?: number }) {
  const v = useCountUp(value, 1300, [value]);
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const c = 2 * Math.PI * r;
  const span = 0.75; // 270°
  const bgDash = `${span * c} ${c}`;
  const valDash = `${(Math.min(100, v) / 100) * span * c} ${c}`;
  const ang = (135 + (target / 100) * 270) * (Math.PI / 180);
  const tx = cx + r * Math.cos(ang);
  const ty = cy + r * Math.sin(ang);
  const statusColor = v >= 80 ? "#34D399" : v >= 50 ? "#FBBF24" : "#FB923C";
  return (
    <div className="esrs-gauge" style={{ width: size, height: size * 0.82 }}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id="esrs-gauge-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FB923C" />
            <stop offset="55%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#34D399" />
          </linearGradient>
        </defs>
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={bgDash}
          transform={`rotate(135 ${cx} ${cy})`}
        />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="url(#esrs-gauge-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={valDash}
          transform={`rotate(135 ${cx} ${cy})`}
        />
        <circle cx={tx} cy={ty} r="4.5" fill="#E8EDF4" stroke="#0A0F1A" strokeWidth="2" />
      </svg>
      <div className="esrs-gauge-c">
        <div className="esrs-gauge-v" style={{ color: statusColor }}>
          {Math.round(v)}<span>%</span>
        </div>
        <div className="esrs-gauge-l">conformité</div>
      </div>
    </div>
  );
}

/* ─── MiniRadial (ligne norme) ───────────────────────────────────────────── */

export function MiniRadial({
  value, size = 40, stroke = 4.5,
}: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = useCountUp(value, 900, [value]);
  const off = c - (Math.min(100, v) / 100) * c;
  const col = value >= 80 ? "var(--cc-em)" : value >= 40 ? "var(--cc-amber)" : "var(--cc-orange)";
  return (
    <div className="esrs-mini" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={col}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="esrs-mini-v">{Math.round(v)}</span>
    </div>
  );
}

/* ─── ESRSRadar : couverture par norme thématique ────────────────────────── */

export function ESRSRadar({
  standards, pillars, size = 248, hovered, setHovered,
}: {
  standards: EsrsStandard[];
  pillars: EsrsPillarMap;
  size?: number;
  hovered: string | null;
  setHovered: (id: string | null) => void;
}) {
  const axes = standards.filter((s) => s.pillar !== "GEN");
  if (axes.length === 0) return null;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 40;
  const n = axes.length;
  const pt = (val: number, i: number, rad = R): [number, number] => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + (rad * val / 100) * Math.cos(a), cy + (rad * val / 100) * Math.sin(a)];
  };
  const poly = axes.map((s, i) => pt(s.progress, i).join(",")).join(" ");
  return (
    <svg width="100%" height={size} viewBox={`0 0 ${size} ${size}`} className="esrs-radar">
      <defs>
        <radialGradient id="esrs-radar-fill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#34D399" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#22D3EE" stopOpacity="0.12" />
        </radialGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <polygon
          key={g}
          points={axes
            .map((_, i) => {
              const a = (Math.PI * 2 * i) / n - Math.PI / 2;
              return [cx + R * g * Math.cos(a), cy + R * g * Math.sin(a)].join(",");
            })
            .join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="1"
        />
      ))}
      {axes.map((s, i) => {
        const a = (Math.PI * 2 * i) / n - Math.PI / 2;
        const ex = cx + R * Math.cos(a);
        const ey = cy + R * Math.sin(a);
        const lx = cx + (R + 16) * Math.cos(a);
        const ly = cy + (R + 16) * Math.sin(a);
        return (
          <g key={s.id}>
            <line x1={cx} y1={cy} x2={ex} y2={ey} stroke="rgba(255,255,255,0.05)" />
            <text
              x={lx} y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="9.5"
              fontFamily="'JetBrains Mono', monospace"
              fontWeight="600"
              fill={hovered === s.id ? pillars[s.pillar].color : "var(--cc-subtle)"}
            >
              {s.code}
            </text>
          </g>
        );
      })}
      <polygon
        points={poly}
        fill="url(#esrs-radar-fill)"
        stroke="#34D399"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {axes.map((s, i) => {
        const [x, y] = pt(s.progress, i);
        const isH = hovered === s.id;
        return (
          <circle
            key={s.id}
            cx={x} cy={y}
            r={isH ? 5 : 3.2}
            fill={pillars[s.pillar].color}
            stroke="#0A0F1A"
            strokeWidth="1.5"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHovered(s.id)}
            onMouseLeave={() => setHovered(null)}
          />
        );
      })}
    </svg>
  );
}

/* ─── EsrsHero : jauge + couverture (radar + barres par pilier) ──────────── */

export function EsrsHero({
  standards, totals, pillars, pillarSummary, hovered, setHovered,
}: {
  standards: EsrsStandard[];
  totals: EsrsTotals;
  pillars: EsrsPillarMap;
  pillarSummary: EsrsPillarSummary[];
  hovered: string | null;
  setHovered: (id: string | null) => void;
}) {
  const dpPct = totals.dpTotal > 0 ? Math.round((totals.dpDone / totals.dpTotal) * 100) : 0;
  const pills: Array<{ k: EsrsStatusKey; n: number }> = [
    { k: "compliant",   n: totals.compliant },
    { k: "in_progress", n: totals.inProgress },
    { k: "not_started", n: totals.notStarted },
  ];
  return (
    <section className="esrs-hero">
      <div className="cc-card esrs-gauge-card">
        <div className="cc-eyebrow"><CheckCircle className="w-3.5 h-3.5" /> Conformité CSRD globale</div>
        <ComplianceGauge value={totals.avg} target={totals.target} />
        <div className="esrs-gauge-goal">
          <span className="esrs-goal-dot" /> Objectif {totals.target}% ·{" "}
          <strong>{Math.max(0, totals.target - totals.avg)} pts</strong> à gagner
        </div>
        <div className="esrs-pills">
          {pills.map((p) => {
            const cfg = STATUS_CFG[p.k];
            return (
              <div key={p.k} className={`esrs-pill ${cfg.cls}`}>
                <span className="esrs-pill-n">{p.n}</span>
                <span className="esrs-pill-l">{cfg.label}</span>
              </div>
            );
          })}
        </div>
        <div className="esrs-dp">
          <div className="esrs-dp-head">
            <span>Datapoints renseignés</span>
            <strong className="cc-mono">{totals.dpDone}/{totals.dpTotal} · {dpPct}%</strong>
          </div>
          <div className="esrs-dp-track">
            <div className="esrs-dp-fill" style={{ width: `${dpPct}%` }} />
          </div>
        </div>
      </div>

      <div className="cc-card esrs-coverage">
        <div className="cc-card-head">
          <div>
            <div className="cc-card-title">Couverture ESRS</div>
            <div className="cc-card-sub">Progression par norme &amp; par pilier</div>
          </div>
        </div>
        <div className="esrs-cov-body">
          <ESRSRadar
            standards={standards}
            pillars={pillars}
            size={248}
            hovered={hovered}
            setHovered={setHovered}
          />
          <div className="esrs-pillars">
            {pillarSummary.map((p) => (
              <div key={p.pillar} className="esrs-pillar-row">
                <div className="esrs-pillar-head">
                  <span className="esrs-pillar-dot" style={{ background: p.color }} />
                  <span className="esrs-pillar-name">{p.label}</span>
                  <span className="esrs-pillar-count">{p.count} norme{p.count > 1 ? "s" : ""}</span>
                  <span className="esrs-pillar-avg" style={{ color: p.color }}>{p.avg}%</span>
                </div>
                <div className="esrs-pillar-track">
                  <div style={{ width: `${p.avg}%`, background: p.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── EsrsPriorities : 3 normes qui bloquent l'objectif ──────────────────── */

export function EsrsPriorities({
  standards, pillars, onOpen,
}: {
  standards: EsrsStandard[];
  pillars: EsrsPillarMap;
  onOpen: (id: string) => void;
}) {
  const prio = [...standards].sort((a, b) => a.progress - b.progress).slice(0, 3);
  const gap = prio.reduce((a, s) => a + Math.max(0, 80 - s.progress), 0);
  return (
    <section className="cc-card esrs-prio">
      <div className="esrs-prio-head">
        <div className="cc-neural-brand">
          <div className="cc-neural-orb"><Sparkles className="w-3.5 h-3.5" /></div>
          <div>
            <div className="cc-neural-title">Priorités de conformité</div>
            <div className="cc-neural-sub">3 normes concentrent l&apos;essentiel de l&apos;écart vers l&apos;objectif</div>
          </div>
        </div>
        <span className="esrs-prio-gap">écart cumulé <strong>{gap} pts</strong></span>
      </div>
      <div className="esrs-prio-grid">
        {prio.map((s) => (
          <button
            key={s.id}
            className="esrs-prio-card"
            style={{ ["--esrs-pc" as string]: pillars[s.pillar].color }}
            onClick={() => onOpen(s.id)}
          >
            <div className="esrs-prio-top">
              <span className="esrs-prio-code">{s.id}</span>
              <span className="esrs-prio-pct cc-mono">{s.progress}%</span>
            </div>
            <div className="esrs-prio-name">{s.name}</div>
            <div className="esrs-prio-action">
              <ArrowRight className="w-3 h-3" /> {s.action}
            </div>
            <div className="esrs-prio-owner">Pilote · {s.owner}</div>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ─── StandardsList : liste groupée par pilier avec recherche / filtre / tri ── */

const ESRS_FILTERS: Array<{ k: "ALL" | EsrsPillar; l: string }> = [
  { k: "ALL", l: "Toutes" },
  { k: "E",   l: "Environnement" },
  { k: "S",   l: "Social" },
  { k: "G",   l: "Gouvernance" },
  { k: "GEN", l: "Général" },
];

function StandardRow({
  s, pillars, hovered, setHovered, isOpen, onToggle,
}: {
  s: EsrsStandard;
  pillars: EsrsPillarMap;
  hovered: string | null;
  setHovered: (id: string | null) => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const cfg = STATUS_CFG[s.status];
  const c = pillars[s.pillar].color;
  const dpPct = s.dp > 0 ? Math.round((s.done / s.dp) * 100) : 0;
  const StatusIcon = s.status === "compliant" ? CheckCircle : s.status === "in_progress" ? RefreshCw : AlertTriangle;
  return (
    <div
      className={`esrs-row ${hovered === s.id ? "hover" : ""} ${isOpen ? "open" : ""}`}
      style={{ ["--esrs-pc" as string]: c }}
      onMouseEnter={() => setHovered(s.id)}
      onMouseLeave={() => setHovered(null)}
    >
      <button className="esrs-row-main" onClick={onToggle}>
        <span className="esrs-row-bar" />
        <MiniRadial value={s.progress} />
        <span className="esrs-row-code">{s.id}</span>
        <div className="esrs-row-mid">
          <div className="esrs-row-name">{s.name}</div>
          <div className="esrs-row-desc">{s.desc}</div>
        </div>
        <div className="esrs-row-dp">
          <span className="cc-mono">{s.done}/{s.dp}</span>
          <span className="esrs-row-dp-l">datapoints</span>
        </div>
        <span className={`esrs-row-status ${cfg.cls}`}>
          <StatusIcon className="w-3 h-3" /> {cfg.label}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 esrs-row-chev ${isOpen ? "rot" : ""}`} />
      </button>
      {isOpen && (
        <div className="esrs-row-exp">
          <div className="esrs-exp-grid">
            <div className="esrs-exp-block">
              <div className="esrs-exp-t">Avancement datapoints</div>
              <div className="esrs-dp-track">
                <div className="esrs-dp-fill" style={{ width: `${dpPct}%` }} />
              </div>
              <div className="esrs-exp-dp">
                <strong className="cc-mono">{s.done}</strong> renseignés ·{" "}
                <strong className="cc-mono">{s.missing}</strong> manquants
              </div>
            </div>
            <div className="esrs-exp-block">
              <div className="esrs-exp-t">Prochaine action</div>
              <div className="esrs-exp-action">
                <ArrowRight className="w-3.5 h-3.5" /> {s.action}
              </div>
              <div className="esrs-exp-owner">Pilote · <strong>{s.owner}</strong></div>
            </div>
          </div>
          {s.materialIssues.length > 0 && (
            <div className="esrs-exp-block">
              <div className="esrs-exp-t">
                Enjeux matériels liés <span className="esrs-exp-src">↗ Matérialité</span>
              </div>
              <div className="esrs-issues">
                {s.materialIssues.map((i) => (
                  <span
                    key={i.code}
                    className="esrs-issue-chip"
                    style={{ borderColor: `color-mix(in srgb, ${c} 40%, transparent)` }}
                  >
                    <span className="cc-mono" style={{ color: c }}>{i.code}</span> {i.label}
                    <em className="cc-mono">{i.score.toFixed(1)}</em>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function StandardsList({
  standards, pillars, hovered, setHovered, expanded, setExpanded,
}: {
  standards: EsrsStandard[];
  pillars: EsrsPillarMap;
  hovered: string | null;
  setHovered: (id: string | null) => void;
  expanded: string | null;
  setExpanded: (id: string | null) => void;
}) {
  const [filter, setFilter] = useState<"ALL" | EsrsPillar>("ALL");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"progress" | "alpha">("progress");

  let list = standards.filter((s) => filter === "ALL" || s.pillar === filter);
  if (query.trim()) {
    const q = query.toLowerCase();
    list = list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.desc.toLowerCase().includes(q),
    );
  }
  list = [...list].sort((a, b) =>
    sort === "progress" ? b.progress - a.progress : a.id.localeCompare(b.id),
  );

  const grouped = filter === "ALL";
  const groups = grouped
    ? (["E", "S", "G", "GEN"] as EsrsPillar[])
        .map((p) => ({ p, items: list.filter((s) => s.pillar === p) }))
        .filter((g) => g.items.length > 0)
    : [{ p: filter as EsrsPillar, items: list }];

  return (
    <section className="cc-card esrs-list">
      <div className="esrs-list-toolbar">
        <div className="esrs-search">
          <Search className="w-3.5 h-3.5" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une norme…"
          />
        </div>
        <div className="esrs-filters">
          {ESRS_FILTERS.map((f) => (
            <button
              key={f.k}
              className={`esrs-filter ${filter === f.k ? "on" : ""}`}
              onClick={() => setFilter(f.k)}
            >
              {f.l}
            </button>
          ))}
        </div>
        <button
          className="mat-sort"
          onClick={() => setSort((s) => (s === "progress" ? "alpha" : "progress"))}
        >
          <Filter className="w-3 h-3" /> {sort === "progress" ? "Progression" : "A→Z"}
        </button>
      </div>

      {list.length === 0 && (
        <div className="esrs-empty">Aucune norme ne correspond à votre recherche.</div>
      )}

      {groups.map((g) => (
        <div key={g.p} className="esrs-group">
          {grouped && (
            <div className="esrs-group-head">
              <span className="esrs-group-dot" style={{ background: pillars[g.p].color }} />
              {pillars[g.p].label}
              <span className="esrs-group-count">{g.items.length}</span>
            </div>
          )}
          <div className="esrs-rows">
            {g.items.map((s) => (
              <StandardRow
                key={s.id}
                s={s}
                pillars={pillars}
                hovered={hovered}
                setHovered={setHovered}
                isOpen={expanded === s.id}
                onToggle={() => setExpanded(expanded === s.id ? null : s.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
