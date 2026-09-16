"use client";

/* CarbonCo Cockpit — sections de contenu (Hero, ScopeStrip, NeuralPanel, AnalyticsRow,
   BridgeRow, SourcesRow). L'ordre et les libellés suivent la maquette « Refonte
   CarbonCo » (frame 1a).

   Toute valeur sans source réelle est optionnelle (`null`) : le composant
   affiche alors un « — » ou un encart explicatif à la même place, jamais un
   chiffre de maquette présenté comme une donnée de l'organisation. */

import { useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowRight, X, ChevronDown, TrendingDown,
  Factory, Zap, Truck, FileText, Sparkles, CheckCircle, Bot,
  Upload, Database, PieChart, Radar, BarChart3, LayoutGrid, Gauge, MessageCircle, Flag,
  Lightbulb, ExternalLink,
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
  /** Variation annuelle en % — `null` sans historique réel. */
  trend: number | null;
  share: number;
  color: string;
  icon: "factory" | "zap" | "truck";
  /** Position vs trajectoire SBTi — `null` sans évaluation réelle. */
  sbti: { status: "ok" | "warn" | "alert"; text: string } | null;
  /** Série mensuelle — `null` sans série réelle. */
  spark: number[] | null;
  /** Répartition par poste — `null` sans ventilation réelle. */
  categories: { name: string; value: number }[] | null;
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
  impact?: "high" | "medium";
  scope: string;
  /** Gain estimé — omis quand aucun calcul ne l'étaye. */
  saving?: string;
};
export type RegulatoryNote = {
  src: string;
  date: string;
  text: string;
  /** Lien vers la source officielle. */
  href?: string;
  hrefLabel?: string;
};
export type Benchmark = {
  intensity: { you: number; sector: number };
  radar: { axis: string; you: number; sector: number }[];
  rows: { label: string; you: string; sector: string; status: "top" | "warn"; tag: string }[];
};
export type EsrsState = {
  /** Score de conformité 0-100, `null` quand il ne peut pas être calculé. */
  score: number | null;
  target: number;
  compliant: number;
  inProgress: number;
  notStarted: number;
  /** Avancement par norme (vide sans données réelles). */
  radial: { k: string; label: string; v: number }[];
};
export type ActivityRow = {
  id: number | string;
  type: "upload" | "validation" | "alert" | "report";
  title: string;
  desc: string;
  time: string;
};
export type Connector = { id: string; label: string; status: "connected" | "idle"; glyph: string };
export type Deadline = { label: string; days: number; level: "warn" | "alert" | "info"; href?: string };

/** Encart affiché à la place d'une visualisation sans donnée réelle. */
function CardPlaceholder({ height, children }: { height?: number; children: ReactNode }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--cc-border)] px-4 text-center text-xs text-[var(--cc-muted)]"
      style={{ minHeight: height }}
      data-testid="cockpit-placeholder"
    >
      {children}
    </div>
  );
}

/* ─── Regulatory banner ──────────────────────────────────────────────────── */
function RegNoteRow({ note }: { note: RegulatoryNote }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="cc-reg" data-testid="reg-note">
      <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "var(--cc-amber)" }} />
      <span className="cc-reg-src">{note.src} · {note.date}</span>
      <span className="cc-reg-txt">{note.text}</span>
      {note.href && (
        <a className="cc-reg-cta" href={note.href} target="_blank" rel="noopener noreferrer">
          {note.hrefLabel ?? "Source"} <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
      <button className="cc-reg-x" onClick={() => setOpen(false)} aria-label="Masquer">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/** Veille réglementaire : uniquement des faits datés et sourcés. */
export function RegBanner({ notes }: { notes: RegulatoryNote[] }) {
  if (notes.length === 0) return null;
  return (
    <div className="space-y-2">
      {notes.map((note) => (
        <RegNoteRow key={`${note.src}-${note.date}`} note={note} />
      ))}
    </div>
  );
}

/* ─── Hero : trajectoire + score conformité ─────────────────────────────── */

/** Trajectoire mensuelle et objectif — uniquement quand une série existe. */
export type HeroTrajectory = {
  monthly: MonthPoint[];
  /** Objectif annuel (tCO₂e) et libellé de sa référence. */
  target: number;
  targetLabel: ReactNode;
};

export function Hero({
  totalEmissions,
  trajectory,
  esrs,
  scopesOn,
  setScopesOn,
  deltaPct,
}: {
  totalEmissions: number;
  trajectory: HeroTrajectory | null;
  esrs: EsrsState;
  scopesOn: ScopesOn;
  setScopesOn: (fn: (s: ScopesOn) => ScopesOn) => void;
  /** Variation vs N-1 en % — pastille masquée si `null`. */
  deltaPct: number | null;
}) {
  const total = useCountUp(totalEmissions, 1300);
  const legend: { k: keyof ScopesOn; c: string; label: string }[] = [
    { k: "s1", c: "#34D399", label: "Scope 1" },
    { k: "s2", c: "#22D3EE", label: "Scope 2" },
    { k: "s3", c: "#A78BFA", label: "Scope 3" },
  ];
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
              {deltaPct !== null && Number.isFinite(deltaPct) && (
                <span className={`cc-delta ${deltaPct < 0 ? "down" : "up"}`}>
                  {deltaPct < 0 ? "▼" : "▲"} {Math.abs(deltaPct).toFixed(1)} %
                </span>
              )}
            </div>
            <div className="cc-hero-sub">
              {trajectory
                ? "12 mois glissants · émissions S1+S2+S3 consolidées"
                : "Émissions S1+S2+S3 consolidées · dernier import"}
            </div>
          </div>
          {trajectory && (
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
          )}
        </div>

        {trajectory ? (
          <>
            <TrajectoryChart
              data={trajectory.monthly}
              scopesOn={scopesOn}
              height={210}
              targetMonthly={trajectory.target / 12}
            />

            <div className="cc-hero-foot">
              <div className="cc-hero-target-row">
                <span>{trajectory.targetLabel}</span>
                <span>Reste <strong className="cc-mono cc-warn-txt">{fmt(Math.max(0, totalEmissions - trajectory.target))}</strong> tCO₂e à réduire</span>
              </div>
              <TargetGauge
                current={totalEmissions}
                target={trajectory.target}
                max={Math.max(trajectory.target * 1.4, totalEmissions * 1.15)}
              />
            </div>
          </>
        ) : (
          <CardPlaceholder height={210}>
            <TrendingDown className="h-5 w-5" aria-hidden="true" />
            <span>Trajectoire mensuelle et objectif de réduction non disponibles pour vos données.</span>
          </CardPlaceholder>
        )}
      </div>

      {/* Score conformité */}
      <div className="cc-card cc-hero-score">
        <div className="cc-eyebrow"><Gauge className="w-3.5 h-3.5" /> Score de conformité ESRS</div>
        {esrs.score !== null ? (
          <>
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
          </>
        ) : (
          <>
            <div className="cc-score-ring-wrap" data-testid="esrs-score-empty">
              <div className="cc-ring" style={{ width: 138, height: 138 }}>
                <svg width={138} height={138} aria-hidden="true">
                  <circle cx={69} cy={69} r={63.5} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={11} />
                </svg>
                <div className="cc-ring-c">
                  <div className="cc-ring-v">—</div>
                  <div className="cc-ring-l">/ 100</div>
                </div>
              </div>
            </div>
            <p className="cc-score-legend">
              Score non calculé : aucune matrice de matérialité ESG importée.
            </p>
            <Link href="/esrs" className="cc-score-goal">
              <Flag className="w-3.5 h-3.5" style={{ color: "var(--cc-em)" }} />
              <span>Voir la conformité ESRS</span>
            </Link>
          </>
        )}
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
              {s.spark && <Sparkline data={s.spark} color={s.color} />}
              <ChevronDown className={`w-4 h-4 cc-scope-chev ${isOpen ? "rot" : ""}`} />
            </button>

            <div className="cc-scope-metric">
              <span className="cc-scope-val">{fmt(s.total)}</span>
              <span className="cc-scope-unit">tCO₂e</span>
              {/* La part dominante est teintée à la couleur du scope (cf. maquette). */}
              <span className={`cc-scope-share ${s.share >= 50 ? "is-major" : ""}`}>{s.share} %</span>
            </div>

            {(s.trend !== null || s.sbti) && (
              <div className="cc-scope-tags">
                {s.trend !== null && (
                  <span className={`cc-trend ${s.trend < 0 ? "down" : "up"}`}>
                    {s.trend < 0 ? "−" : "+"}{fmt(Math.abs(s.trend), Number.isInteger(s.trend) ? 0 : 1)} %
                  </span>
                )}
                {s.sbti && <span className={`cc-sbti ${s.sbti.status}`}>{s.sbti.text}</span>}
              </div>
            )}

            <div className="cc-scope-drawer" style={{ maxHeight: isOpen ? 480 : 0 }}>
              <div className="cc-scope-drawer-in">
                <div className="cc-scope-desc">{s.desc}</div>
                {s.categories ? (
                  <CategoryBars categories={s.categories} color={s.color} />
                ) : (
                  <p className="cc-card-sub">Ventilation par poste non disponible dans vos imports.</p>
                )}
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
  subtitle,
}: {
  items: NeuralItem[];
  suggestions: Suggestion[];
  onOpenCopilot: () => void;
  /** Provenance des signaux (par défaut : générés par IA, à valider). */
  subtitle?: string;
}) {
  const [items, setItems] = useState(initial);
  const [dismissed, setDismissed] = useState(0);
  const [tab, setTab] = useState<"insights" | "actions">("insights");
  const dismiss = (id: string) => {
    setItems((p) => p.filter((i) => i.id !== id));
    setDismissed((n) => n + 1);
  };

  return (
    <section className="cc-card cc-neural">
      <div className="cc-neural-head">
        <div className="cc-neural-brand">
          <div className="cc-neural-orb"><Sparkles className="w-3.5 h-3.5" /></div>
          <div>
            <div className="cc-neural-title">NEURAL <span className="cc-neural-by">· Copilote CarbonCo</span></div>
            <div className="cc-neural-sub">
              {items.length} insight{items.length > 1 ? "s" : ""} proactif{items.length > 1 ? "s" : ""} ·{" "}
              {subtitle ?? "généré par IA — à valider RSE"}
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
              <CheckCircle className="w-5 h-5" />
              {/* « Traités » seulement si des signaux ont réellement été écartés. */}
              {dismissed > 0 ? "Tous les signaux ont été traités." : "Aucun signal pour le moment."}
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
                  {sg.impact && (
                    <span className={`cc-sugg-impact ${sg.impact === "high" ? "high" : "med"}`}>
                      {sg.impact === "high" ? "Impact fort" : "Impact moyen"}
                    </span>
                  )}
                  <span className="cc-sugg-scope">{sg.scope}</span>
                  {sg.saving && <span className="cc-sugg-save">{sg.saving}</span>}
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
}: { scopes: ScopeRow[]; benchmark: Benchmark | null }) {
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
          {benchmark && (
            <span className="cc-bench-int">
              Intensité <strong>{benchmark.intensity.you}</strong>{" "}
              <i>/ {benchmark.intensity.sector} secteur</i> tCO₂e/M€
            </span>
          )}
        </div>
        {benchmark ? (
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
        ) : (
          <CardPlaceholder height={220}>
            <Radar className="h-5 w-5" aria-hidden="true" />
            <span>Comparaison sectorielle non disponible pour vos données.</span>
          </CardPlaceholder>
        )}
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
  /** Décomposition par levier avec son libellé de période, `null` sans données. */
  waterfall: { title: string; steps: WaterfallStep[] } | null;
}) {
  return (
    <section className="cc-bridge">
      <div className="cc-card cc-wf-card">
        <div className="cc-card-head">
          <div className="cc-eyebrow">
            <BarChart3 className="w-3.5 h-3.5" /> {waterfall?.title ?? "Variation des émissions"}
          </div>
          <span className="cc-card-note">bridge par levier</span>
        </div>
        {waterfall ? (
          <WaterfallChart steps={waterfall.steps} height={210} />
        ) : (
          <CardPlaceholder height={210}>
            <BarChart3 className="h-5 w-5" aria-hidden="true" />
            <span>Décomposition des variations par levier non disponible pour vos données.</span>
          </CardPlaceholder>
        )}
      </div>

      <div className="cc-card cc-esrs-heat">
        <div className="cc-card-head">
          <div className="cc-eyebrow">
            <LayoutGrid className="w-3.5 h-3.5" /> Conformité ESRS · heatmap
          </div>
        </div>
        {esrs.radial.length > 0 ? (
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
        ) : (
          <CardPlaceholder height={160}>
            <LayoutGrid className="h-5 w-5" aria-hidden="true" />
            <span>Avancement par norme disponible dès l&apos;import de votre matrice de matérialité.</span>
            <Link href="/esrs" className="font-semibold underline text-[var(--cc-em)]">
              Voir ESRS / CSRD
            </Link>
          </CardPlaceholder>
        )}
      </div>
    </section>
  );
}

/* ─── SourcesRow : activité récente + connecteurs/échéances ─────────────── */
export function SourcesRow({
  activity,
  activityNotice,
  connectors,
  deadlines,
}: {
  activity: ActivityRow[];
  /** Remplace le message « aucune activité » (chargement, indisponibilité). */
  activityNotice?: string;
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
          {activity.length === 0 && (
            <p className="cc-card-sub" data-testid="activity-empty">
              {activityNotice ?? "Aucune activité récente dans le journal d'audit."}
            </p>
          )}
        </div>
      </div>

      <div className="cc-card cc-sources">
        <div className="cc-card-head">
          <div className="cc-eyebrow"><Database className="w-3.5 h-3.5" /> Sources &amp; échéances</div>
        </div>
        <div className="cc-dl-list">
          {deadlines.map((d) => {
            const row = (
              <>
                <span className="cc-dl-rdot" />
                <span className="cc-dl-rlabel">{d.label}</span>
                <span className="cc-dl-rdays">{d.days < 0 ? "dépassée" : `${d.days} j`}</span>
              </>
            );
            return d.href ? (
              <Link key={d.label} href={d.href} className={`cc-dl-row ${d.level}`}>
                {row}
              </Link>
            ) : (
              <div key={d.label} className={`cc-dl-row ${d.level}`}>{row}</div>
            );
          })}
          {deadlines.length === 0 && (
            <p className="cc-card-sub" data-testid="deadlines-empty">
              Aucune échéance connue.{" "}
              <Link href="/beges" className="underline">
                Déclarez votre dernier dépôt BEGES
              </Link>{" "}
              pour suivre son renouvellement.
            </p>
          )}
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
  userFirstName,
  scope3SharePct,
}: {
  open: boolean;
  onClose: () => void;
  /** Prénom de l'utilisateur connecté s'il est connu — jamais un persona fictif. */
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
              Bonjour{userFirstName ? ` ${userFirstName}` : ""} 👋{" "}
              {typeof scope3SharePct === "number" && scope3SharePct > 0 ? (
                <>
                  Votre <strong>Scope 3</strong> représente {scope3SharePct} % des émissions affichées.{" "}
                </>
              ) : null}
              Je peux vous aider à identifier des leviers de réduction, suivre votre conformité ESRS,
              ou pré-rédiger un rapport.
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
