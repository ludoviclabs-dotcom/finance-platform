"use client";

import { useMemo, useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Loader2, AlertTriangle, Target, TrendingUp, Shield } from "lucide-react";
import { useEsgSnapshot } from "@/lib/hooks/use-esg-snapshot";
import type { MaterialiteIssue } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type PillarKey = "ALL" | "E" | "S" | "G";

const PILLARS: { key: PillarKey; label: string; color: string }[] = [
  { key: "ALL", label: "Tous", color: "bg-carbon-emerald" },
  { key: "E", label: "Environnement", color: "bg-emerald-500" },
  { key: "S", label: "Social", color: "bg-blue-500" },
  { key: "G", label: "Gouvernance", color: "bg-violet-500" },
];

const PILLAR_FILL: Record<"E" | "S" | "G" | "OTHER", string> = {
  E: "#10b981",
  S: "#3b82f6",
  G: "#8b5cf6",
  OTHER: "#94a3b8",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pillarOf(issue: MaterialiteIssue): "E" | "S" | "G" | "OTHER" {
  const cat = (issue.categorie ?? "").toUpperCase().trim();
  if (cat.startsWith("E")) return "E";
  if (cat.startsWith("S")) return "S";
  if (cat.startsWith("G")) return "G";
  const norme = (issue.normeEsrs ?? "").toUpperCase();
  if (/E[1-5]/.test(norme)) return "E";
  if (/S[1-4]/.test(norme)) return "S";
  if (/G1/.test(norme)) return "G";
  return "OTHER";
}

interface Point {
  code: string;
  label: string;
  x: number; // probabilité
  y: number; // impact
  materiel: boolean;
  pillar: "E" | "S" | "G" | "OTHER";
  normeEsrs: string;
  scoreTotal: number | null;
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

function ScatterTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Point }> }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-lg max-w-xs">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-mono text-xs text-carbon-emerald font-bold">{p.code}</span>
        <span className="text-[10px] text-[var(--color-foreground-muted)]">{p.normeEsrs}</span>
      </div>
      <p className="text-xs font-semibold text-[var(--color-foreground)] leading-snug mb-2">{p.label}</p>
      <div className="flex items-center justify-between text-[11px] text-[var(--color-foreground-muted)]">
        <span>Impact : <b className="text-[var(--color-foreground)]">{p.y.toFixed(1)}</b></span>
        <span>Proba : <b className="text-[var(--color-foreground)]">{p.x.toFixed(1)}</b></span>
      </div>
      <div className="mt-1.5">
        <span
          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            p.materiel
              ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
              : "bg-[var(--color-border)] text-[var(--color-foreground-muted)]"
          }`}
        >
          {p.materiel ? "Matériel" : "Non matériel"}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MaterialitePage() {
  const snap = useEsgSnapshot();
  const [pillar, setPillar] = useState<PillarKey>("ALL");

  const points: Point[] = useMemo(() => {
    if (snap.status !== "ready") return [];
    const issues = snap.data.materialite.issues ?? [];
    const out: Point[] = [];
    for (const issue of issues) {
      const x = toNum(issue.scoreProbabilite);
      const y = toNum(issue.scoreImpact);
      if (x === null || y === null) continue;
      out.push({
        code: issue.code,
        label: issue.label,
        x,
        y,
        materiel: issue.materiel === true,
        pillar: pillarOf(issue),
        normeEsrs: issue.normeEsrs ?? "—",
        scoreTotal: toNum(issue.scoreImpactTotal),
      });
    }
    return out;
  }, [snap]);

  const filtered = useMemo(
    () => (pillar === "ALL" ? points : points.filter((p) => p.pillar === pillar)),
    [points, pillar],
  );

  const materielPoints = filtered.filter((p) => p.materiel);
  const nonMaterielPoints = filtered.filter((p) => !p.materiel);

  if (snap.status === "loading") {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-[var(--color-foreground-muted)]">
          <Loader2 className="w-8 h-8 animate-spin text-carbon-emerald" />
          <span className="text-sm">Chargement de la double matérialité…</span>
        </div>
      </div>
    );
  }

  if (snap.status === "error") {
    return (
      <div className="p-6">
        <div className="max-w-lg mx-auto rounded-2xl border border-[var(--color-danger-bg)] bg-[var(--color-danger-bg)] p-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[var(--color-danger)] mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[var(--color-danger)] mb-1">
              Impossible de charger la matrice de matérialité
            </p>
            <p className="text-xs text-[var(--color-foreground-muted)]">{snap.error}</p>
          </div>
        </div>
      </div>
    );
  }

  const { materialite } = snap.data;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--color-foreground)] tracking-tight">
          Double matérialité
        </h1>
        <p className="mt-1 text-sm text-[var(--color-foreground-muted)]">
          Matrice IRO : positionnement des enjeux ESRS sur leurs scores d&apos;impact et de probabilité.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-carbon-emerald" />
            <span className="text-xs uppercase tracking-wide font-semibold text-[var(--color-foreground-muted)]">
              Enjeux évalués
            </span>
          </div>
          <div className="font-display text-3xl font-extrabold text-[var(--color-foreground)]">
            {materialite.enjeuxEvalues}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-[var(--color-success)]" />
            <span className="text-xs uppercase tracking-wide font-semibold text-[var(--color-foreground-muted)]">
              Matériels
            </span>
          </div>
          <div className="font-display text-3xl font-extrabold text-[var(--color-success)]">
            {materialite.enjeuxMateriels}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-[var(--color-foreground-muted)]" />
            <span className="text-xs uppercase tracking-wide font-semibold text-[var(--color-foreground-muted)]">
              Non matériels
            </span>
          </div>
          <div className="font-display text-3xl font-extrabold text-[var(--color-foreground-muted)]">
            {materialite.enjeuxNonMateriels}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="text-xs uppercase tracking-wide font-semibold text-[var(--color-foreground-muted)] mb-2">
            Répartition E / S / G
          </div>
          <div className="flex items-baseline gap-3 font-display font-extrabold">
            <span className="text-2xl text-emerald-500">{materialite.enjeuxMaterielsE}</span>
            <span className="text-2xl text-blue-500">{materialite.enjeuxMaterielsS}</span>
            <span className="text-2xl text-violet-500">{materialite.enjeuxMaterielsG}</span>
          </div>
        </div>
      </div>

      {/* Pillar filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-[var(--color-foreground-muted)] font-semibold uppercase tracking-wide mr-2">
          Filtre pilier :
        </span>
        {PILLARS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPillar(p.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              pillar === p.key
                ? "bg-carbon-emerald text-white shadow-sm"
                : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            {p.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-[var(--color-foreground-muted)]">
          {filtered.length} enjeu{filtered.length > 1 ? "x" : ""} affiché{filtered.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Scatter chart */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-base font-bold text-[var(--color-foreground)]">
            Matrice impact × probabilité
          </h2>
          <div className="flex items-center gap-3 text-xs text-[var(--color-foreground-muted)]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-carbon-emerald" /> Matériel
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full border border-[var(--color-border)] bg-transparent" />
              Non matériel
            </span>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="h-[420px] flex items-center justify-center text-sm text-[var(--color-foreground-muted)]">
            Aucun enjeu scoré pour ce filtre.
          </div>
        ) : (
          <div className="h-[420px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Probabilité"
                  domain={[0, 5]}
                  tick={{ fontSize: 11, fill: "var(--color-foreground-muted)" }}
                  label={{
                    value: "Probabilité / Occurrence",
                    position: "insideBottom",
                    offset: -10,
                    fontSize: 11,
                    fill: "var(--color-foreground-muted)",
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Impact"
                  domain={[0, 5]}
                  tick={{ fontSize: 11, fill: "var(--color-foreground-muted)" }}
                  label={{
                    value: "Impact",
                    angle: -90,
                    position: "insideLeft",
                    offset: 10,
                    fontSize: 11,
                    fill: "var(--color-foreground-muted)",
                  }}
                />
                <ZAxis range={[80, 80]} />
                <ReferenceLine x={2.5} stroke="var(--color-border)" strokeDasharray="4 4" />
                <ReferenceLine y={2.5} stroke="var(--color-border)" strokeDasharray="4 4" />
                <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: "3 3" }} />
                <Scatter name="Non matériel" data={nonMaterielPoints} fill="#94a3b8" fillOpacity={0.35} />
                <Scatter name="Matériel" data={materielPoints} fill="#10b981" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Issue list */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="font-display text-base font-bold text-[var(--color-foreground)] mb-4">
          Enjeux {pillar === "ALL" ? "" : `— pilier ${pillar}`} ({filtered.length})
        </h2>
        {filtered.length === 0 ? (
          <p className="text-sm text-[var(--color-foreground-muted)]">Aucun enjeu à afficher.</p>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {filtered
              .slice()
              .sort((a, b) => (b.scoreTotal ?? 0) - (a.scoreTotal ?? 0))
              .map((p) => (
                <div key={p.code} className="py-3 flex items-center gap-3">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: PILLAR_FILL[p.pillar] }}
                  />
                  <span className="font-mono text-xs text-carbon-emerald font-bold w-12 flex-shrink-0">
                    {p.code}
                  </span>
                  <span className="text-sm text-[var(--color-foreground)] flex-1 truncate">{p.label}</span>
                  <span className="text-[10px] text-[var(--color-foreground-muted)] w-20 text-right tabular-nums">
                    I {p.y.toFixed(1)} · P {p.x.toFixed(1)}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold w-20 text-center ${
                      p.materiel
                        ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                        : "bg-[var(--color-border)] text-[var(--color-foreground-muted)]"
                    }`}
                  >
                    {p.materiel ? "Matériel" : "Non matériel"}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
