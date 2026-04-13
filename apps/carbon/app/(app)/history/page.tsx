"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  History,
  RefreshCw,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Database,
  Clock,
  BarChart3,
  Leaf,
  Users,
  Banknote,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useSnapshotHistory, useSnapshotVersion, type Domain } from "@/lib/hooks/use-snapshot-history";
import type { SnapshotHistoryEntry } from "@/lib/api";
import { pageVariants, staggerContainer, staggerItem } from "@/lib/animations";
import { SectionTitle } from "@/components/ui/section-title";

// ---------------------------------------------------------------------------
// Config domaines
// ---------------------------------------------------------------------------

const DOMAINS: { key: Domain; label: string; icon: React.ElementType; color: string }[] = [
  { key: "carbon",  label: "Carbone",   icon: Leaf,     color: "text-emerald-500" },
  { key: "esg",     label: "ESG",       icon: BarChart3, color: "text-violet-500" },
  { key: "vsme",    label: "VSME",      icon: Users,    color: "text-cyan-500" },
  { key: "finance", label: "Finance",   icon: Banknote, color: "text-amber-500" },
];

// KPIs à afficher par domaine pour le graphe d'évolution
const DOMAIN_KPIS: Record<Domain, { key: string; label: string; unit: string; decimals?: number }[]> = {
  carbon: [
    { key: "totalS123Tco2e", label: "Total S1+S2+S3", unit: "tCO₂e" },
    { key: "scope1Tco2e",    label: "Scope 1",         unit: "tCO₂e" },
  ],
  esg: [
    { key: "scoreGlobal",     label: "Score ESG",       unit: "/100" },
    { key: "enjeuxMateriels", label: "Enjeux matériels", unit: "" },
  ],
  vsme: [
    { key: "scorePct",              label: "Complétude",  unit: "%" },
    { key: "indicateursCompletes",  label: "Indicateurs", unit: "" },
  ],
  finance: [
    { key: "expositionTotaleEur", label: "Exposition carbone", unit: "€" },
    { key: "greenCapexPct",       label: "Green CapEx",         unit: "%" },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function fmtShort(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  } catch { return iso; }
}

function fmtNum(v: unknown, unit: string, decimals = 1): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") {
    const s = v.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return unit ? `${s} ${unit}` : s;
  }
  return String(v);
}

function getDelta(current: unknown, previous: unknown): { pct: number; dir: "up" | "down" | "flat" } | null {
  if (typeof current !== "number" || typeof previous !== "number" || previous === 0) return null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  return { pct: Math.round(pct * 10) / 10, dir: pct > 0.5 ? "up" : pct < -0.5 ? "down" : "flat" };
}

// ---------------------------------------------------------------------------
// Delta badge
// ---------------------------------------------------------------------------
function DeltaBadge({ delta, invertGood = false }: { delta: { pct: number; dir: "up" | "down" | "flat" } | null; invertGood?: boolean }) {
  if (!delta) return null;
  const isGood = invertGood ? delta.dir === "down" : delta.dir === "up";
  const isFlat = delta.dir === "flat";
  const Icon = delta.dir === "up" ? TrendingUp : delta.dir === "down" ? TrendingDown : Minus;
  const cls = isFlat
    ? "text-[var(--color-foreground-muted)] bg-[var(--color-surface-raised)]"
    : isGood
      ? "text-[var(--color-success)] bg-[var(--color-success-bg)]"
      : "text-[var(--color-danger)] bg-[var(--color-danger-bg)]";
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>
      <Icon className="w-2.5 h-2.5" />
      {delta.pct > 0 ? "+" : ""}{delta.pct}%
    </span>
  );
}

// ---------------------------------------------------------------------------
// KPI chart
// ---------------------------------------------------------------------------
function KpiChart({ entries, kpi }: {
  entries: SnapshotHistoryEntry[];
  kpi: { key: string; label: string; unit: string };
}) {
  const data = [...entries]
    .reverse()
    .map((e) => ({
      date: fmtShort(e.generatedAt),
      value: typeof e.summary[kpi.key] === "number" ? (e.summary[kpi.key] as number) : null,
    }))
    .filter((d) => d.value !== null);

  if (data.length < 2) return null;

  return (
    <div className="mt-4">
      <p className="text-xs font-medium text-[var(--color-foreground-muted)] mb-2">{kpi.label}</p>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--color-foreground-subtle)" }} />
          <YAxis tick={{ fontSize: 10, fill: "var(--color-foreground-subtle)" }} width={48} />
          <Tooltip
            contentStyle={{ fontSize: 11, background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            formatter={(v: number) => [`${v.toLocaleString("fr-FR")} ${kpi.unit}`, kpi.label]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#059669"
            strokeWidth={2}
            dot={{ r: 3, fill: "#059669" }}
            activeDot={{ r: 5 }}
          />
          {data.length >= 2 && (
            <ReferenceLine
              y={data[data.length - 2].value ?? undefined}
              stroke="var(--color-border-strong)"
              strokeDasharray="4 2"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Snapshot entry row
// ---------------------------------------------------------------------------
function EntryRow({
  entry,
  prev,
  domain,
  isSelected,
  onSelect,
}: {
  entry: SnapshotHistoryEntry;
  prev: SnapshotHistoryEntry | null;
  domain: Domain;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const kpis = DOMAIN_KPIS[domain];
  const invertGood: Record<string, boolean> = { totalS123Tco2e: true, scope1Tco2e: true, expositionTotaleEur: true };

  return (
    <motion.div
      variants={staggerItem}
      className={`rounded-xl border transition-colors ${
        isSelected
          ? "border-carbon-emerald bg-carbon-emerald/5"
          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full flex items-start gap-4 p-4 text-left cursor-pointer"
      >
        {/* Version badge */}
        <div className="w-10 h-10 rounded-xl bg-carbon-emerald/10 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-carbon-emerald">v{entry.version}</span>
        </div>

        {/* Meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-semibold text-[var(--color-foreground)]">
              Version {entry.version}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-surface-raised)] text-[var(--color-foreground-muted)] border border-[var(--color-border)]">
              {entry.source}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-[var(--color-foreground-muted)]">
            <Clock className="w-3 h-3" />
            {fmtDate(entry.generatedAt)}
          </div>
        </div>

        {/* KPI résumé avec delta */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          {kpis.slice(0, 2).map((kpi) => {
            const curr = entry.summary[kpi.key];
            const prevVal = prev?.summary[kpi.key];
            const delta = prev ? getDelta(curr, prevVal) : null;
            return (
              <div key={kpi.key} className="flex items-center gap-1.5">
                <span className="text-xs text-[var(--color-foreground-muted)]">
                  {fmtNum(curr, kpi.unit, kpi.decimals)}
                </span>
                <DeltaBadge delta={delta} invertGood={invertGood[kpi.key]} />
              </div>
            );
          })}
        </div>

        <ChevronRight className={`w-4 h-4 flex-shrink-0 text-[var(--color-foreground-muted)] transition-transform ${isSelected ? "rotate-90" : ""}`} />
      </button>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function HistoryPage() {
  const [domain, setDomain] = useState<Domain>("carbon");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const history = useSnapshotHistory(domain, 24);
  const kpis = DOMAIN_KPIS[domain];

  const domainConfig = DOMAINS.find((d) => d.key === domain)!;
  const DomainIcon = domainConfig.icon;

  return (
    <motion.div {...pageVariants} className="p-6 space-y-6 max-w-5xl mx-auto">
      <SectionTitle
        title="Historique des snapshots"
        subtitle="Visualisez l'évolution de vos KPIs dans le temps — comparez chaque version"
      />

      {/* Sélecteur de domaine */}
      <div className="flex items-center gap-2 flex-wrap">
        {DOMAINS.map((d) => {
          const Icon = d.icon;
          const active = domain === d.key;
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => { setDomain(d.key); setSelectedId(null); }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                active
                  ? "bg-carbon-emerald text-white shadow-sm"
                  : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-foreground-muted)] hover:border-carbon-emerald"
              }`}
            >
              <Icon className="w-4 h-4" />
              {d.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={history.refresh}
          disabled={history.status === "loading"}
          className="ml-auto inline-flex items-center gap-1 text-xs text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${history.status === "loading" ? "animate-spin" : ""}`} />
          Actualiser
        </button>
      </div>

      {/* Pas de PostgreSQL */}
      {history.status === "ready" && !history.available && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-700">Historique non disponible</p>
            <p className="text-xs text-amber-600 mt-0.5">
              La variable d&apos;environnement <code className="font-mono">DATABASE_URL</code> n&apos;est pas configurée.
              L&apos;historique des snapshots nécessite PostgreSQL (Neon).
            </p>
          </div>
        </div>
      )}

      {/* Erreur */}
      {history.status === "error" && (
        <div className="rounded-2xl border border-[var(--color-danger-bg)] bg-[var(--color-danger-bg)] p-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[var(--color-danger)] flex-shrink-0" />
          <span className="text-xs text-[var(--color-danger)]">{history.error}</span>
        </div>
      )}

      {/* Chargement */}
      {history.status === "loading" && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-carbon-emerald" />
        </div>
      )}

      {/* Contenu principal */}
      {history.status === "ready" && history.available && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Liste des versions */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <DomainIcon className={`w-4 h-4 ${domainConfig.color}`} />
              <span className="text-sm font-semibold text-[var(--color-foreground)]">
                {history.entries.length} version{history.entries.length > 1 ? "s" : ""}
              </span>
            </div>

            {history.entries.length === 0 ? (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
                <Database className="w-8 h-8 text-[var(--color-foreground-subtle)] mx-auto mb-2" />
                <p className="text-sm text-[var(--color-foreground-muted)]">Aucun snapshot enregistré.</p>
                <p className="text-xs text-[var(--color-foreground-subtle)] mt-1">
                  Déclenchez une synchronisation depuis la page Ingest.
                </p>
              </div>
            ) : (
              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="space-y-2"
              >
                {history.entries.map((entry, idx) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    prev={history.entries[idx + 1] ?? null}
                    domain={domain}
                    isSelected={selectedId === entry.id}
                    onSelect={() => setSelectedId(selectedId === entry.id ? null : entry.id)}
                  />
                ))}
              </motion.div>
            )}
          </div>

          {/* Graphes d'évolution */}
          <div className="lg:col-span-3 space-y-4">
            {/* Header */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <h3 className="text-sm font-semibold text-[var(--color-foreground)] mb-1 flex items-center gap-2">
                <History className="w-4 h-4 text-carbon-emerald" />
                Évolution des KPIs — {domainConfig.label}
              </h3>
              <p className="text-xs text-[var(--color-foreground-muted)]">
                {history.entries.length} point{history.entries.length > 1 ? "s" : ""} de mesure
              </p>

              {kpis.map((kpi) => (
                <KpiChart key={kpi.key} entries={history.entries} kpi={kpi} />
              ))}
            </div>

            {/* Tableau comparatif T vs T-1 */}
            {history.entries.length >= 2 && (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <h3 className="text-sm font-semibold text-[var(--color-foreground)] mb-3 flex items-center gap-2">
                  <ChevronDown className="w-4 h-4 text-carbon-emerald" />
                  Comparaison — dernière vs précédente version
                </h3>
                <div className="space-y-2">
                  {kpis.map((kpi) => {
                    const latest = history.entries[0];
                    const prev = history.entries[1];
                    const curr = latest.summary[kpi.key];
                    const prevVal = prev.summary[kpi.key];
                    const delta = getDelta(curr, prevVal);
                    const invertGood: Record<string, boolean> = { totalS123Tco2e: true, scope1Tco2e: true, expositionTotaleEur: true };
                    return (
                      <div
                        key={kpi.key}
                        className="flex items-center gap-3 p-2 rounded-lg bg-[var(--color-surface-raised)]"
                      >
                        <span className="text-xs text-[var(--color-foreground-muted)] flex-1">{kpi.label}</span>
                        <span className="text-xs text-[var(--color-foreground-subtle)]">
                          {fmtNum(prevVal, kpi.unit, kpi.decimals)}
                        </span>
                        <span className="text-[var(--color-foreground-subtle)]">→</span>
                        <span className="text-xs font-semibold text-[var(--color-foreground)]">
                          {fmtNum(curr, kpi.unit, kpi.decimals)}
                        </span>
                        <DeltaBadge delta={delta} invertGood={invertGood[kpi.key]} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
