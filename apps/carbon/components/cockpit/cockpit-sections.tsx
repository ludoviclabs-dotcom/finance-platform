"use client";

/* CarbonCo Cockpit — sections de contenu (Hero, ScopeStrip, NeuralPanel, AnalyticsRow,
   BridgeRow, SourcesRow). L'ordre et les libellés suivent la maquette « Refonte
   CarbonCo » (frame 1a). */

import { useState, type MouseEvent } from "react";
import {
  AlertTriangle, ArrowRight, X, ChevronDown, TrendingDown,
  Factory, Zap, Truck, FileText, Sparkles, CheckCircle, Bot,
  Upload, Database, PieChart, Radar, BarChart3, LayoutGrid, Gauge, MessageCircle, Flag,
  Lightbulb,
} from "lucide-react";
import {
  TrajectoryChart, ScoreRing, TargetGauge, ScopeDonut, RadarChart, Sparkline, CategoryBars,
  WaterfallChart, fmt, useCountUp,
  type MonthPoint, type ScopesOn, type WaterfallStep,
} from "./cockpit-charts";

/* ─── Types ──────────────────────────────────────────────────────────────── */
export type ScopeRow = {
  id: 1 | 2 | 3;
  name: string;
  label: string;
  desc: string;
  total: number;
  trend: number;
  share: number;
  color: string;
  icon: "factory" | "zap" | "truck";
  sbti: { status: "ok" | "warn" | "alert"; text: string };
  spark: number[];
  categories: { name: string; value: number }[];
};
export type NeuralItem = {
  id: string;
  type: "anomalie" | "opportunité" | "action" | "compliance" | "draft";
  title: string;
  desc: string;
  metric: string;
  metricLabel: string;
  cta: string;
  time: string;
};
export type Suggestion = {
  id: number;
  title: string;
  desc: string;
  impact: "high" | "medium";
  scope: string;
  saving: string;
};
export type RegulatoryNote = { src: string; date: string; text: string };
export type Benchmark = {
  intensity: { you: number; sector: number };
  radar: { axis: string; you: number; sector: number }[];
  rows: { label: string; you: string; sector: string; status: "top" | "warn"; tag: string }[];
};
export type EsrsState = {
  score: number;
  target: number;
  compliant: number;
  inProgress: number;
  notStarted: number;
  radial: { k: string; label: string; v: number }[];
};
export type ActivityRow = {
  id: number;
  type: "upload" | "validation" | "alert" | "report";
  title: string;
  desc: string;
  time: string;
};
export type Connector = { id: string; label: string; status: "connected" | "idle"; glyph: string };
export type Deadline = { label: string; days: number; level: "warn" | "alert" | "info" };

/* ─── Regulatory banner ──────────────────────────────────────────────────── */
export function RegBanner({ note, onAction }: { note: RegulatoryNote; onAction?: () => void }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="cc-reg">
      <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "var(--cc-amber)" }} />
      <span className="cc-reg-src">{note.src} · {note.date}</span>
      <span className="cc-reg-txt">{note.text}</span>
      <button className="cc-reg-cta" onClick={onAction}>
        Voir l&apos;impact <ArrowRight className="w-3.5 h-3.5" />
      </button>
      <button className="cc-reg-x" onClick={() => setOpen(false)} aria-label="Masquer">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* ─── Hero : trajectoire + score conformité ─────────────────────────────── */
export function Hero({
  totalEmissions,
  target2025,
  monthly,
  esrs,
  scopesOn,
  setScopesOn,
  deltaPct = -5.8,
}: {
  totalEmissions: number;
  target2025: number;
  monthly: MonthPoint[];
  esrs: EsrsState;
  scopesOn: ScopesOn;
  setScopesOn: (fn: (s: ScopesOn) => ScopesOn) => void;
  deltaPct?: number;
}) {
  const total = useCountUp(totalEmissions, 1300);
  const remaining = totalEmissions - target2025;
  const legend: { k: keyof ScopesOn; c: string; label: string }[] = [
    { k: "s1", c: "#34D399", label: "Scope 1" },
    { k: "s2", c: "#22D3EE", label: "Scope 2" },
    { k: "s3", c: "#A78BFA", label: "Scope 3" },
  ];
  const targetMonthly = target2025 / 12;
  const onSpotlight = (e: MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <section className="cc-hero">
      {/* Trajectoire */}
      <div className="cc-card cc-hero-traj" onMouseMove={onSpotlight}>
        <div className="cc-hero-head">
          <div>
            <div className="cc-eyebrow"><TrendingDown className="w-3.5 h-3.5" /> Trajectoire net-zéro</div>
            <div className="cc-hero-metric">
              <span className="cc-hero-num">{fmt(total)}</span>
              <span className="cc-hero-unit">tCO₂e</span>
              <span className={`cc-delta ${deltaPct < 0 ? "down" : "up"}`}>
                {deltaPct < 0 ? "▼" : "▲"} {Math.abs(deltaPct).toFixed(1)} %
              </span>
            </div>
            <div className="cc-hero-sub">12 mois glissants · émissions S1+S2+S3 consolidées</div>
          </div>
          <div className="cc-hero-legend">
            {legend.map((l) => (
              <button
                key={l.k}
                className={`cc-legend-b ${scopesOn[l.k] ? "" : "off"}`}
                onClick={() => setScopesOn((s) => ({ ...s, [l.k]: !s[l.k] }))}
              >
                <i style={{ background: l.c }} />{l.label}
              </button>
            ))}
          </div>
        </div>

        <TrajectoryChart
          data={monthly}
          scopesOn={scopesOn}
          height={210}
          targetMonthly={targetMonthly}
        />

        <div className="cc-hero-foot">
          <div className="cc-hero-target-row">
            <span>Objectif SBTi 2030 · <strong className="cc-mono cc-em-txt">−42 %</strong> vs 2023</span>
            <span>Reste <strong className="cc-mono cc-warn-txt">{fmt(Math.max(0, remaining))}</strong> tCO₂e à réduire</span>
          </div>
          <TargetGauge current={totalEmissions} target={target2025} max={Math.max(target2025 * 1.4, totalEmissions * 1.15)} />
        </div>
      </div>

      {/* Score conformité */}
      <div className="cc-card cc-hero-score">
        <div className="cc-eyebrow"><Gauge className="w-3.5 h-3.5" /> Score de conformité ESRS</div>
        <div className="cc-score-ring-wrap">
          <ScoreRing value={esrs.score} target={esrs.target} size={138} />
        </div>
        <div className="cc-score-legend">
          <div><span className="cc-pip ok" />{esrs.compliant} conformes</div>
          <div><span className="cc-pip warn" />{esrs.inProgress} en cours</div>
          <div><span className="cc-pip muted" />{esrs.notStarted} non démarré</div>
        </div>
        <div className="cc-score-goal">
          <Flag className="w-3.5 h-3.5" style={{ color: "var(--cc-em)" }} />
          <span>Objectif : <strong>{esrs.target}</strong> · +{Math.max(0, esrs.target - esrs.score)} pts nécessaires</span>
        </div>
      </div>
    </section>
  );
}

/* ─── ScopeStrip : 3 cartes scope expandables ───────────────────────────── */
function ScopeIcon({ name }: { name: ScopeRow["icon"] }) {
  if (name === "factory") return <Factory className="w-4 h-4" />;
  if (name === "zap") return <Zap className="w-4 h-4" />;
  return <Truck className="w-4 h-4" />;
}

export function ScopeStrip({ scopes }: { scopes: ScopeRow[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="cc-scopes">
      {scopes.map((s) => {
        const isOpen = open === s.id;
        return (
          <div
            key={s.id}
            className={`cc-card cc-scope ${isOpen ? "is-open" : ""}`}
            style={{ ["--cc-sc" as string]: s.color }}
          >
            <button className="cc-scope-head" onClick={() => setOpen(isOpen ? null : s.id)}>
              <div className="cc-scope-ic"><ScopeIcon name={s.icon} /></div>
              <div className="cc-scope-id">
                <div className="cc-scope-name">{s.name}</div>
                <div className="cc-scope-label">{s.label}</div>
              </div>
              <Sparkline data={s.spark} color={s.color} />
              <ChevronDown className={`w-4 h-4 cc-scope-chev ${isOpen ? "rot" : ""}`} />
            </button>

            <div className="cc-scope-metric">
              <span className="cc-scope-val">{fmt(s.total)}</span>
              <span className="cc-scope-unit">tCO₂e</span>
              {/* La part dominante est teintée à la couleur du scope (cf. maquette). */}
              <span className={`cc-scope-share ${s.share >= 50 ? "is-major" : ""}`}>{s.share} %</span>
            </div>

            <div className="cc-scope-tags">
              <span className={`cc-trend ${s.trend < 0 ? "down" : "up"}`}>
                {s.trend < 0 ? "−" : "+"}{fmt(Math.abs(s.trend), Number.isInteger(s.trend) ? 0 : 1)} %
              </span>
              <span className={`cc-sbti ${s.sbti.status}`}>{s.sbti.text}</span>
            </div>

            <div className="cc-scope-drawer" style={{ maxHeight: isOpen ? 480 : 0 }}>
              <div className="cc-scope-drawer-in">
                <div className="cc-scope-desc">{s.desc}</div>
                <CategoryBars categories={s.categories} color={s.color} />
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

/* ─── NeuralPanel : insights + suggestions ──────────────────────────────── */
const NEURAL_CFG: Record<NeuralItem["type"], { label: string; c: string }> = {
  anomalie:      { label: "Anomalie",     c: "#F87171" },
  "opportunité": { label: "Opportunité",  c: "#A78BFA" },
  action:        { label: "Action",       c: "#34D399" },
  compliance:    { label: "Compliance",   c: "#FBBF24" },
  draft:         { label: "Brouillon IA", c: "#60A5FA" },
};

function NeuralPill({ type }: { type: NeuralItem["type"] }) {
  const cfg = NEURAL_CFG[type];
  const Ico = type === "anomalie" ? AlertTriangle
    : type === "opportunité" ? Lightbulb
    : type === "action" ? TrendingDown
    : type === "compliance" ? FileText
    : Sparkles;
  return (
    <span className="cc-ins-pill" style={{ ["--cc-ic" as string]: cfg.c, color: cfg.c }}>
      <Ico className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

export function NeuralPanel({
  items: initial,
  suggestions,
  onOpenCopilot,
}: {
  items: NeuralItem[];
  suggestions: Suggestion[];
  onOpenCopilot: () => void;
}) {
  const [items, setItems] = useState(initial);
  const [tab, setTab] = useState<"insights" | "actions">("insights");
  const dismiss = (id: string) => setItems((p) => p.filter((i) => i.id !== id));

  return (
    <section className="cc-card cc-neural">
      <div className="cc-neural-head">
        <div className="cc-neural-brand">
          <div className="cc-neural-orb"><Sparkles className="w-3.5 h-3.5" /></div>
          <div>
            <div className="cc-neural-title">NEURAL <span className="cc-neural-by">· Copilote CarbonCo</span></div>
            <div className="cc-neural-sub">
              {items.length} insights proactifs · généré par IA — à valider RSE
            </div>
          </div>
        </div>
        <div className="cc-seg sm">
          <button
            className={`cc-seg-b ${tab === "insights" ? "is-on" : ""}`}
            onClick={() => setTab("insights")}
          >
            Signaux
          </button>
          <button
            className={`cc-seg-b ${tab === "actions" ? "is-on" : ""}`}
            onClick={() => setTab("actions")}
          >
            Recommandations
          </button>
        </div>
        <button className="cc-neural-ask" onClick={onOpenCopilot}>
          <MessageCircle className="w-3.5 h-3.5" /> Poser une question
        </button>
      </div>

      {tab === "insights" ? (
        <div className="cc-neural-grid">
          {items.map((it) => {
            const cfg = NEURAL_CFG[it.type];
            return (
              <div key={it.id} className="cc-ins" style={{ ["--cc-ic" as string]: cfg.c }}>
                <div className="cc-ins-bar" />
                <div className="cc-ins-body">
                  <div className="cc-ins-top">
                    <NeuralPill type={it.type} />
                    <span className="cc-ins-time">{it.time}</span>
                    <button className="cc-ins-x" onClick={() => dismiss(it.id)} aria-label="Masquer">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="cc-ins-main">
                    <div className="cc-ins-text">
                      <div className="cc-ins-title">{it.title}</div>
                      <div className="cc-ins-desc">{it.desc}</div>
                    </div>
                    <div className="cc-ins-metric">
                      <div className="cc-ins-num">{it.metric}</div>
                      <div className="cc-ins-mlabel">{it.metricLabel}</div>
                    </div>
                  </div>
                  <button className="cc-ins-cta">
                    {it.cta} <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
          {items.length === 0 && (
            <div className="cc-neural-empty">
              <CheckCircle className="w-5 h-5" /> Tous les signaux ont été traités.
            </div>
          )}
        </div>
      ) : (
        <div className="cc-sugg-list">
          {suggestions.map((sg) => (
            <div key={sg.id} className="cc-sugg">
              <div className="cc-sugg-ic"><TrendingDown className="w-4 h-4" /></div>
              <div className="cc-sugg-body">
                <div className="cc-sugg-top">
                  <span className="cc-sugg-title">{sg.title}</span>
                  <span className={`cc-sugg-impact ${sg.impact === "high" ? "high" : "med"}`}>
                    {sg.impact === "high" ? "Impact fort" : "Impact moyen"}
                  </span>
                  <span className="cc-sugg-scope">{sg.scope}</span>
                  <span className="cc-sugg-save">{sg.saving}</span>
                </div>
                <div className="cc-sugg-desc">{sg.desc}</div>
              </div>
              <button className="cc-sugg-apply">Appliquer</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ─── AnalyticsRow : donut + radar ──────────────────────────────────────── */
export function AnalyticsRow({
  scopes,
  benchmark,
}: { scopes: ScopeRow[]; benchmark: Benchmark }) {
  const [active, setActive] = useState<ScopeRow["id"] | null>(null);
  const donutItems = scopes.map((s) => ({ id: s.id, name: s.name, total: s.total, color: s.color }));
  return (
    <section className="cc-analytics">
      <div className="cc-card cc-repart">
        <div className="cc-card-head">
          <div className="cc-eyebrow"><PieChart className="w-3.5 h-3.5" /> Répartition par scope</div>
        </div>
        <div className="cc-repart-body">
          <ScopeDonut items={donutItems} active={active} onHover={(id) => setActive(id as ScopeRow["id"] | null)} />
          <div className="cc-repart-legend">
            {scopes.map((s) => (
              <div
                key={s.id}
                className={`cc-repart-row ${active && active !== s.id ? "dim" : ""}`}
                onMouseEnter={() => setActive(s.id)}
                onMouseLeave={() => setActive(null)}
              >
                <span className="cc-repart-dot" style={{ background: s.color }} />
                <span className="cc-repart-name">{s.name}</span>
                <span className="cc-repart-val cc-mono">{fmt(s.total)}</span>
                <span className="cc-repart-pct">{s.share} %</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="cc-card cc-bench">
        <div className="cc-card-head">
          <div className="cc-eyebrow"><Radar className="w-3.5 h-3.5" /> Benchmark sectoriel</div>
          <span className="cc-bench-int">
            Intensité <strong>{benchmark.intensity.you}</strong>{" "}
            <i>/ {benchmark.intensity.sector} secteur</i> tCO₂e/M€
          </span>
        </div>
        <div className="cc-bench-body">
          <RadarChart data={benchmark.radar} size={220} />
          <div className="cc-bench-rows">
            <div className="cc-bench-key">
              <span><i className="cc-key-you" /> Vous</span>
              <span><i className="cc-key-sec" /> Secteur</span>
            </div>
            {benchmark.rows.map((r) => (
              <div key={r.label} className="cc-bench-row">
                <div>
                  <div className="cc-bench-row-label">{r.label}</div>
                  <div className="cc-bench-row-vals">
                    <strong className={r.status === "top" ? "cc-em-txt" : ""}>{r.you}</strong>
                    <span>vs {r.sector}</span>
                  </div>
                </div>
                <span className={`cc-bench-tag ${r.status === "top" ? "top" : "warn"}`}>{r.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── BridgeRow : waterfall des leviers + heatmap ESRS ──────────────────── */
function heatColor(v: number) {
  if (v >= 75) return "#34D399";
  if (v >= 55) return "#FBBF24";
  if (v >= 40) return "#FB923C";
  return "#F87171";
}
const ACT_ICONS = {
  upload: Upload,
  validation: CheckCircle,
  alert: AlertTriangle,
  report: FileText,
} as const;
const ACT_COLORS: Record<ActivityRow["type"], string> = {
  upload: "#22D3EE",
  validation: "#34D399",
  alert: "#FBBF24",
  report: "#A78BFA",
};

export function BridgeRow({
  esrs,
  waterfall,
}: {
  esrs: EsrsState;
  waterfall: WaterfallStep[];
}) {
  return (
    <section className="cc-bridge">
      <div className="cc-card cc-wf-card">
        <div className="cc-card-head">
          <div className="cc-eyebrow">
            <BarChart3 className="w-3.5 h-3.5" /> Variation des émissions 2023 → 2025
          </div>
          <span className="cc-card-note">bridge par levier</span>
        </div>
        <WaterfallChart steps={waterfall} height={210} />
      </div>

      <div className="cc-card cc-esrs-heat">
        <div className="cc-card-head">
          <div className="cc-eyebrow">
            <LayoutGrid className="w-3.5 h-3.5" /> Conformité ESRS · heatmap
          </div>
        </div>
        <div className="cc-heat-grid">
          {esrs.radial.map((e) => (
            <div key={e.k} className="cc-heat-cell" title={`${e.k} ${e.label} · ${e.v} %`}>
              <div
                className="cc-heat-ring"
                style={{
                  background: `conic-gradient(${heatColor(e.v)} ${e.v * 3.6}deg, rgba(255,255,255,0.07) 0deg)`,
                }}
              >
                <span>{e.k}</span>
              </div>
              <div className="cc-heat-l">{e.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── SourcesRow : activité récente + connecteurs/échéances ─────────────── */
export function SourcesRow({
  activity,
  connectors,
  deadlines,
}: {
  activity: ActivityRow[];
  connectors: Connector[];
  deadlines: Deadline[];
}) {
  return (
    <section className="cc-sources-row">
      <div className="cc-card cc-act">
        <div className="cc-card-head">
          <div className="cc-eyebrow"><CheckCircle className="w-3.5 h-3.5" /> Activité récente</div>
        </div>
        <div className="cc-act-list">
          {activity.slice(0, 4).map((a) => {
            const Ico = ACT_ICONS[a.type];
            const col = ACT_COLORS[a.type];
            return (
              <div key={a.id} className="cc-act-i">
                <span className="cc-act-ic" style={{ color: col, borderColor: col + "33" }}>
                  <Ico className="w-3.5 h-3.5" />
                </span>
                <div className="cc-act-meta">
                  <div className="cc-act-title">{a.title}</div>
                  <div className="cc-act-desc">{a.desc}</div>
                </div>
                <span className="cc-act-time">{a.time}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="cc-card cc-sources">
        <div className="cc-card-head">
          <div className="cc-eyebrow"><Database className="w-3.5 h-3.5" /> Sources &amp; échéances</div>
        </div>
        <div className="cc-dl-list">
          {deadlines.map((d) => (
            <div key={d.label} className={`cc-dl-row ${d.level}`}>
              <span className="cc-dl-rdot" />
              <span className="cc-dl-rlabel">{d.label}</span>
              <span className="cc-dl-rdays">{d.days} j</span>
            </div>
          ))}
        </div>
        <div className="cc-conn-grid">
          {connectors.map((c) => (
            <div key={c.id} className={`cc-conn ${c.status}`} title={c.label}>
              <span className="cc-conn-g">{c.glyph}</span>
              <span className="cc-conn-l">{c.label}</span>
              {c.status === "connected" && <span className="cc-conn-on" />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Copilot drawer ─────────────────────────────────────────────────────── */
export function CopilotDrawer({
  open,
  onClose,
  userFirstName = "Marie",
  scope3SharePct = 78,
}: {
  open: boolean;
  onClose: () => void;
  userFirstName?: string;
  /** Part du Scope 3 dans le total — passée par l'appelant pour rester en
   *  phase avec la carte Scope 3 et le donut plutôt que de figer un chiffre
   *  ici (cf. incohérence 62 % / 78 % corrigée en revue). */
  scope3SharePct?: number;
}) {
  const prompts = [
    "Pourquoi mon Scope 2 a augmenté en mars ?",
    "Comment atteindre l'objectif 2025 ?",
    "Résume mon avancement ESRS E1.",
    "Quelles actions ont le meilleur ROI ?",
  ];
  return (
    <>
      <div
        className={`cc-drawer-scrim ${open ? "show" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`cc-drawer ${open ? "show" : ""}`} aria-hidden={!open}>
        <div className="cc-drawer-head">
          <div className="cc-neural-brand">
            <div className="cc-neural-orb"><Bot className="w-4 h-4" /></div>
            <div>
              <div className="cc-neural-title">Copilote NEURAL</div>
              <div className="cc-neural-sub">Assistant ESG · citations ESRS sourcées</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg border border-[var(--cc-border)] flex items-center justify-center text-[var(--cc-muted)] hover:text-[var(--cc-fg)]"
            aria-label="Fermer le copilote"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="cc-drawer-body">
          <div className="cc-chat-msg">
            <div className="cc-chat-av"><Sparkles className="w-3.5 h-3.5" /></div>
            <div className="cc-chat-bubble">
              Bonjour {userFirstName} 👋 J&apos;ai analysé vos données. Votre{" "}
              <strong>Scope 3</strong> ({scope3SharePct} %) reste le principal levier. Je peux vous aider à le réduire,
              suivre votre conformité ESRS, ou pré-rédiger un rapport.
            </div>
          </div>
        </div>
        <div className="cc-drawer-prompts">
          <div className="cc-drawer-prompts-t">Suggestions</div>
          {prompts.map((p) => (
            <button key={p} className="cc-prompt">
              <ArrowRight className="w-3.5 h-3.5" /> {p}
            </button>
          ))}
        </div>
        <div className="cc-drawer-input">
          <input placeholder="Posez une question à NEURAL…" />
          <button className="cc-send" aria-label="Envoyer">
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </>
  );
}

/* ─── helper : Database icon re-export pour la zone connectors (cf. lucide) ── */
export { Database };
