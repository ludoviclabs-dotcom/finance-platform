"use client";

/* Scopes 1-2-3 — composants cockpit refonte.
   Treemap (binary split) · StackedTrend · SbtiBar · ScopesHero ·
   ScopeTiles · AnalysisSection · TrendSection · ReductionPriorities. */

import { useState } from "react";
import {
  ArrowRight, Bot, Factory, Layers, TrendingUp, Truck, Zap,
} from "lucide-react";
import { Sparkline, useCountUp, fmt } from "./cockpit-charts";

/* ─── Types ──────────────────────────────────────────────────────────────── */
export type ScopeId = 1 | 2 | 3;
export type ScopeSelected = ScopeId | "all";

export type SourceQ = "mesured" | "estimated";
export type SourceMap = Record<string, { src: string; q: SourceQ }>;

export type ScopeMeta = {
  target: number;
  shades: string[];
};
export type ScopeMetaMap = Record<ScopeId, ScopeMeta>;

export type ScopeData = {
  id: ScopeId;
  name: string;
  label: string;
  total: number;
  trend: number;
  share: number;
  color: string;
  icon: "factory" | "zap" | "truck";
  sbti: { status: "ok" | "warn" | "alert"; text: string };
  spark: number[];
  categories: { name: string; value: number }[];
};

export type MonthlyPoint = { m: string; s1: number; s2: number; s3: number };

export type EnrichedCategory = {
  name: string;
  value: number;
  scopeId: ScopeId;
  scopeName: string;
  color: string;
  source: { src: string; q: SourceQ };
};

/* ─── Helpers : enrichissement + sources ─────────────────────────────────── */

export const DEFAULT_SOURCES: SourceMap = {
  "Combustion fixe":       { src: "Factures gaz",         q: "mesured" },
  "Flotte véhicules":      { src: "ERP carburant",        q: "mesured" },
  "Réfrigérants":          { src: "Relevés maintenance",  q: "mesured" },
  "Procédés":              { src: "Relevés site",         q: "estimated" },
  "Électricité":           { src: "Factures électricité", q: "mesured" },
  "Chauffage urbain":      { src: "Factures réseau",      q: "mesured" },
  "Vapeur":                { src: "Relevés site",         q: "estimated" },
  "Achats biens & services": { src: "Comptabilité · ADEME", q: "estimated" },
  "Transport amont":       { src: "ERP logistique",       q: "estimated" },
  "Transport aval":        { src: "Modèle distribution",  q: "estimated" },
  "Déplacements pro":      { src: "Notes de frais",       q: "mesured" },
  "Déchets":               { src: "Registre déchets",     q: "mesured" },
  "Utilisation produits":  { src: "Modèle d'usage",       q: "estimated" },
};

export function enrichCats(
  scope: ScopeData,
  meta: ScopeMetaMap,
  sources: SourceMap = DEFAULT_SOURCES,
): EnrichedCategory[] {
  const shades = meta[scope.id].shades;
  return scope.categories.map((c, i) => ({
    name: c.name,
    value: c.value,
    scopeId: scope.id,
    scopeName: scope.name,
    color: shades[i % shades.length],
    source: sources[c.name] ?? { src: "—", q: "estimated" as SourceQ },
  }));
}

/* ─── ScopesHero : empreinte totale + composition ────────────────────────── */

export function ScopesHero({
  scopes, total, revenue, deltaPct = -5.8, postesCount,
}: {
  scopes: ScopeData[];
  total: number;
  revenue: number;
  deltaPct?: number;
  postesCount: number;
}) {
  const totalAnim = useCountUp(total, 1300, [total]);
  const intensity = revenue > 0 ? (total / revenue).toFixed(1) : "—";
  const ly = total / (1 + deltaPct / 100);
  const saved = Math.max(0, Math.round(ly - total));
  return (
    <section className="cc-card sc-hero">
      <div className="sc-hero-l">
        <div className="cc-eyebrow"><Factory className="w-3.5 h-3.5" /> Empreinte carbone totale</div>
        <div className="sc-hero-metric">
          <span className="sc-hero-num">{fmt(totalAnim)}</span>
          <span className="sc-hero-unit">tCO₂e</span>
          <span className={`cc-delta ${deltaPct < 0 ? "down" : "up"}`}>
            {deltaPct < 0 ? "▼" : "▲"} {Math.abs(deltaPct).toFixed(1)} %
          </span>
        </div>
        <div className="sc-hero-stats">
          <div className="sc-stat">
            <span className="sc-stat-v cc-mono">{intensity}</span>
            <span className="sc-stat-l">tCO₂e / M€ de CA</span>
          </div>
          <div className="sc-stat-sep" />
          <div className="sc-stat">
            <span className="sc-stat-v cc-mono">−{fmt(saved)}</span>
            <span className="sc-stat-l">t évitées vs N-1</span>
          </div>
          <div className="sc-stat-sep" />
          <div className="sc-stat">
            <span className="sc-stat-v cc-mono">{postesCount}</span>
            <span className="sc-stat-l">postes d&apos;émission</span>
          </div>
        </div>
      </div>
      <div className="sc-hero-r">
        <div className="sc-comp-head">Composition par périmètre</div>
        <CompositionBarStatic scopes={scopes} total={total} />
      </div>
    </section>
  );
}

function CompositionBarStatic({ scopes, total }: { scopes: ScopeData[]; total: number }) {
  return (
    <div>
      <div className="sc-comp-bar">
        {scopes.map((s) => {
          const pct = total > 0 ? (s.total / total) * 100 : 0;
          return (
            <div
              key={s.id}
              className="sc-comp-seg-static"
              style={{ width: `${pct}%`, background: s.color }}
              title={`${s.name} ${pct.toFixed(0)}%`}
            >
              {pct > 12 && <span>{s.name.replace("Scope ", "S")} · {pct.toFixed(0)}%</span>}
            </div>
          );
        })}
      </div>
      <div className="sc-comp-legend">
        {scopes.map((s) => (
          <div key={s.id} className="sc-comp-leg">
            <span style={{ background: s.color }} />
            {s.name}
            <strong>{fmt(s.total)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── ScopeTiles : sélecteur (Tous + 3 scopes) ───────────────────────────── */

function ScopeIcon({ name }: { name: ScopeData["icon"] }) {
  if (name === "factory") return <Factory className="w-4 h-4" />;
  if (name === "zap") return <Zap className="w-4 h-4" />;
  return <Truck className="w-4 h-4" />;
}

export function ScopeTiles({
  scopes, selected, setSelected,
}: {
  scopes: ScopeData[];
  selected: ScopeSelected;
  setSelected: (s: ScopeSelected) => void;
}) {
  const sbtiCls = { ok: "ok", warn: "warn", alert: "alert" } as const;
  return (
    <section className="sc-tiles">
      <button
        className={`sc-tile sc-tile-all ${selected === "all" ? "on" : ""}`}
        onClick={() => setSelected("all")}
      >
        <div className="sc-tile-all-in">
          <Layers className="w-5 h-5" />
          <span className="sc-tile-all-l">Tous les scopes</span>
          <span className="sc-tile-all-sub">Vue consolidée</span>
        </div>
      </button>
      {scopes.map((s) => {
        const on = selected === s.id;
        return (
          <button
            key={s.id}
            className={`sc-tile ${on ? "on" : ""}`}
            style={{ ["--sc-tc" as string]: s.color }}
            onClick={() => setSelected(s.id)}
          >
            <div className="sc-tile-head">
              <span className="sc-tile-ic" style={{ color: s.color }}>
                <ScopeIcon name={s.icon} />
              </span>
              <span className="sc-tile-name">{s.name}</span>
              <Sparkline data={s.spark} color={s.color} w={64} h={22} />
            </div>
            <div className="sc-tile-metric">
              <span className="sc-tile-val">{fmt(s.total)}</span>
              <span className="sc-tile-unit">tCO₂e</span>
              <span className="sc-tile-share">{s.share}%</span>
            </div>
            <div className="sc-tile-tags">
              <span className={`cc-trend ${s.trend < 0 ? "down" : "up"}`}>
                {s.trend < 0 ? "▼" : "▲"} {Math.abs(s.trend).toFixed(1)}%
              </span>
              <span className={`cc-sbti ${sbtiCls[s.sbti.status]}`}>{s.sbti.text}</span>
            </div>
          </button>
        );
      })}
    </section>
  );
}

/* ─── Treemap binary split (sans dépendance) ─────────────────────────────── */

type TreemapItem = EnrichedCategory & { x: number; y: number; w: number; h: number };

function splitTreemap(
  items: EnrichedCategory[],
  x: number, y: number, w: number, h: number,
  out: TreemapItem[],
) {
  if (items.length === 0) return;
  if (items.length === 1) {
    out.push({ ...items[0], x, y, w, h });
    return;
  }
  const total = items.reduce((a, b) => a + b.value, 0);
  let acc = 0;
  let i = 0;
  for (; i < items.length - 1; i++) {
    if (acc + items[i].value > total / 2) break;
    acc += items[i].value;
  }
  const a = items.slice(0, i + 1);
  const b = items.slice(i + 1);
  const aSum = a.reduce((s, v) => s + v.value, 0);
  if (w >= h) {
    const aw = w * (aSum / total);
    splitTreemap(a, x, y, aw, h, out);
    splitTreemap(b, x + aw, y, w - aw, h, out);
  } else {
    const ah = h * (aSum / total);
    splitTreemap(a, x, y, w, ah, out);
    splitTreemap(b, x, y + ah, w, h - ah, out);
  }
}

export function Treemap({
  items, total, hovered, setHovered, height = 320,
}: {
  items: EnrichedCategory[];
  total: number;
  hovered: string | null;
  setHovered: (n: string | null) => void;
  height?: number;
}) {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const rects: TreemapItem[] = [];
  splitTreemap(sorted, 0, 0, 100, 100, rects);
  return (
    <div className="sc-treemap" style={{ height }}>
      {rects.map((r) => {
        const pct = total > 0 ? (r.value / total) * 100 : 0;
        const big = r.w > 18 && r.h > 16;
        const isH = hovered === r.name;
        return (
          <div
            key={`${r.scopeId}-${r.name}`}
            className={`sc-tm-cell ${isH ? "hover" : ""}`}
            style={{
              left: `${r.x}%`,
              top: `${r.y}%`,
              width: `${r.w}%`,
              height: `${r.h}%`,
              background: r.color,
              opacity: hovered !== null && !isH ? 0.45 : 1,
            }}
            onMouseEnter={() => setHovered(r.name)}
            onMouseLeave={() => setHovered(null)}
            title={`${r.name} · ${fmt(r.value)} tCO₂e · ${pct.toFixed(1)}%`}
          >
            <div className="sc-tm-in">
              <div className="sc-tm-name">{big ? r.name : ""}</div>
              <div className="sc-tm-val">{big ? `${fmt(r.value)} t · ${pct.toFixed(0)}%` : `${pct.toFixed(0)}%`}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── AnalysisSection : treemap + détail filtrable par scope ─────────────── */

export function AnalysisSection({
  scopes, meta, selected, hovered, setHovered,
}: {
  scopes: ScopeData[];
  meta: ScopeMetaMap;
  selected: ScopeSelected;
  hovered: string | null;
  setHovered: (n: string | null) => void;
}) {
  const cats: EnrichedCategory[] = selected === "all"
    ? scopes.flatMap((s) => enrichCats(s, meta))
    : (() => {
        const s = scopes.find((sc) => sc.id === selected);
        return s ? enrichCats(s, meta) : [];
      })();
  const catTotal = cats.reduce((a, c) => a + c.value, 0);
  const sorted = [...cats].sort((a, b) => b.value - a.value);
  const selScope = selected === "all" ? null : scopes.find((s) => s.id === selected);
  const title = selScope ? `Répartition ${selScope.name}` : "Tous les postes d'émission";
  return (
    <section className="sc-analysis">
      <div className="cc-card sc-tm-card">
        <div className="cc-card-head">
          <div>
            <div className="cc-card-title">{title}</div>
            <div className="cc-card-sub">Surface ∝ volume d&apos;émissions · {cats.length} postes</div>
          </div>
        </div>
        <Treemap
          items={cats}
          total={catTotal}
          hovered={hovered}
          setHovered={setHovered}
          height={selected === "all" ? 360 : 300}
        />
      </div>

      <div className="cc-card sc-detail">
        <div className="cc-card-head">
          <div>
            <div className="cc-card-title">Détail par catégorie</div>
            <div className="cc-card-sub">Volume, part &amp; source de donnée</div>
          </div>
        </div>
        <div className="sc-detail-list">
          {sorted.map((c) => {
            const pct = catTotal > 0 ? (c.value / catTotal) * 100 : 0;
            const isH = hovered === c.name;
            return (
              <div
                key={`${c.scopeId}-${c.name}`}
                className={`sc-det-row ${isH ? "hover" : ""}`}
                onMouseEnter={() => setHovered(c.name)}
                onMouseLeave={() => setHovered(null)}
              >
                <span className="sc-det-dot" style={{ background: c.color }} />
                <div className="sc-det-mid">
                  <div className="sc-det-top">
                    <span className="sc-det-name">{c.name}</span>
                    {selected === "all" && (
                      <span className="sc-det-scope">{c.scopeName.replace("Scope ", "S")}</span>
                    )}
                  </div>
                  <div className="sc-det-bar">
                    <div style={{ width: `${pct}%`, background: c.color }} />
                  </div>
                  <div className="sc-det-src">
                    <span className={`sc-q ${c.source.q}`}>
                      {c.source.q === "mesured" ? "Mesuré" : "Estimé"}
                    </span>
                    {c.source.src}
                  </div>
                </div>
                <div className="sc-det-vals">
                  <span className="sc-det-v">{fmt(c.value)}</span>
                  <span className="sc-det-pct">{pct.toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
          {cats.length === 0 && (
            <div className="text-sm text-[var(--cc-muted)] text-center py-6">
              Aucune catégorie pour ce périmètre.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ─── StackedTrend + TrendSection ────────────────────────────────────────── */

function StackedTrend({
  monthly, scopes, selected, height = 170,
}: {
  monthly: MonthlyPoint[];
  scopes: ScopeData[];
  selected: ScopeSelected;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const keys: Array<{ k: "s1" | "s2" | "s3"; c: string }> = selected === "all"
    ? [
        { k: "s3", c: scopes[2]?.color ?? "#A78BFA" },
        { k: "s2", c: scopes[1]?.color ?? "#22D3EE" },
        { k: "s1", c: scopes[0]?.color ?? "#34D399" },
      ]
    : (() => {
        const sc = scopes.find((s) => s.id === selected);
        const k = (`s${selected}` as "s1" | "s2" | "s3");
        return [{ k, c: sc?.color ?? "#34D399" }];
      })();
  const valFor = (m: MonthlyPoint) =>
    selected === "all" ? m.s1 + m.s2 + m.s3 : (m[(`s${selected}` as "s1" | "s2" | "s3")]);
  const max = Math.max(1, ...monthly.map(valFor)) * 1.1;
  const bw = monthly.length > 0 ? 100 / monthly.length : 0;
  return (
    <div className="sc-trend" style={{ height }}>
      <div className="sc-trend-bars">
        {monthly.map((m, i) => {
          const tot = valFor(m);
          return (
            <div
              key={i}
              className="sc-trend-col"
              style={{ width: `${bw}%` }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div className="sc-trend-stack" style={{ height: `${(tot / max) * 100}%` }}>
                {keys.map(({ k, c }) => (
                  <div key={k} style={{ height: tot > 0 ? `${(m[k] / tot) * 100}%` : "0%", background: c }} />
                ))}
              </div>
              <span className={`sc-trend-m ${hover === i ? "on" : ""}`}>{m.m}</span>
              {hover === i && <div className="sc-trend-tip">{fmt(tot)} t</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SbtiBar({ current, target, color }: { current: number; target: number; color: string }) {
  const max = Math.max(current, target) * 1.18 || 1;
  const curPct = (current / max) * 100;
  const tgtPct = (target / max) * 100;
  const over = current > target;
  return (
    <div>
      <div className="sc-sbti-track">
        <div className="sc-sbti-fill" style={{ width: `${curPct}%`, background: over ? "var(--cc-red)" : color }} />
        <div className="sc-sbti-tgt" style={{ left: `${tgtPct}%` }}>
          <span>cible {fmt(target)}</span>
        </div>
      </div>
    </div>
  );
}

export function TrendSection({
  scopes, monthly, selected, meta,
}: {
  scopes: ScopeData[];
  monthly: MonthlyPoint[];
  selected: ScopeSelected;
  meta: ScopeMetaMap;
}) {
  const sel = selected === "all" ? null : scopes.find((s) => s.id === selected);
  const legendScopes = sel ? [sel] : scopes;
  return (
    <section className="sc-trend-row">
      <div className="cc-card sc-trend-card">
        <div className="cc-card-head">
          <div>
            <div className="cc-card-title">Évolution mensuelle</div>
            <div className="cc-card-sub">
              {sel ? `${sel.name} · 12 mois` : "Scopes 1 + 2 + 3 · 12 mois"}
            </div>
          </div>
          <div className="sc-trend-legend">
            {legendScopes.map((s) => (
              <span key={s.id}>
                <i style={{ background: s.color }} />
                {s.name.replace("Scope ", "S")}
              </span>
            ))}
          </div>
        </div>
        <StackedTrend monthly={monthly} scopes={scopes} selected={selected} height={170} />
      </div>

      <div className="cc-card sc-sbti-card">
        <div className="cc-card-head">
          <div>
            <div className="cc-card-title">Trajectoire SBTi</div>
            <div className="cc-card-sub">Émissions vs cible validée</div>
          </div>
        </div>
        <div className="sc-sbti-list">
          {scopes.map((s) => {
            const tgt = meta[s.id].target;
            const over = s.total > tgt;
            return (
              <div key={s.id}>
                <div className="sc-sbti-top">
                  <span className="sc-sbti-name" style={{ color: s.color }}>{s.name}</span>
                  <span className={`sc-sbti-status ${over ? "alert" : "ok"}`}>
                    {over ? "À surveiller" : "Sur trajectoire"}
                  </span>
                </div>
                <SbtiBar current={s.total} target={tgt} color={s.color} />
                <div className="sc-sbti-foot">
                  <span className="cc-mono">{fmt(s.total)} t</span> · cible{" "}
                  <span className="cc-mono">{fmt(tgt)} t</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── ReductionPriorities : top 5 postes cross-scope ─────────────────────── */

export function ReductionPriorities({
  scopes, meta, total, onAsk,
}: {
  scopes: ScopeData[];
  meta: ScopeMetaMap;
  total: number;
  onAsk?: () => void;
}) {
  const cats = scopes
    .flatMap((s) => enrichCats(s, meta))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  const topSum = cats.reduce((a, c) => a + c.value, 0);
  const topShare = total > 0 ? (topSum / total) * 100 : 0;
  return (
    <section className="cc-card sc-prio">
      <div className="sc-prio-head">
        <div className="cc-neural-brand">
          <div className="cc-neural-orb"><TrendingUp className="w-3.5 h-3.5" /></div>
          <div>
            <div className="cc-neural-title">Priorités de réduction</div>
            <div className="cc-neural-sub">
              Les 5 plus gros postes = {topShare.toFixed(0)}% de l&apos;empreinte
            </div>
          </div>
        </div>
        {onAsk && (
          <button className="cc-neural-ask" onClick={onAsk}>
            <Bot className="w-3.5 h-3.5" /> Plan d&apos;action NEURAL
          </button>
        )}
      </div>
      <div className="sc-prio-list">
        {cats.map((c, i) => {
          const pct = total > 0 ? (c.value / total) * 100 : 0;
          return (
            <div
              key={`${c.scopeId}-${c.name}`}
              className="sc-prio-row"
              style={{ ["--sc-pc" as string]: c.color }}
            >
              <span className="sc-prio-rank">{i + 1}</span>
              <span className="sc-prio-dot" style={{ background: c.color }} />
              <div className="sc-prio-mid">
                <div className="sc-prio-name">
                  {c.name}
                  <span className="sc-prio-scope">{c.scopeName}</span>
                </div>
                <div className="sc-prio-bar">
                  <div style={{ width: `${pct}%`, background: c.color }} />
                </div>
              </div>
              <span className="sc-prio-v">{fmt(c.value)} t</span>
              <span className="sc-prio-pct">{pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* Re-export pour usage externe */
export { Sparkline, ArrowRight };
