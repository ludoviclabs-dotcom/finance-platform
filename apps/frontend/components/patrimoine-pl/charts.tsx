"use client";

import { useSimulateurStore } from "@/lib/store/simulateur-store";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import type { ValueType, NameType } from "recharts/types/component/DefaultTooltipContent";

/* ── helpers ─────────────────────────────────────────────────────────────── */

function fmtK(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return `${Math.round(v)}`;
}

function tooltipFmt(v: ValueType | undefined): string {
  const n = Number(v ?? 0);
  return `${n.toLocaleString("fr-FR")} \u20AC`;
}

const COLORS = [
  "#34d399", "#60a5fa", "#fbbf24", "#f87171",
  "#a78bfa", "#38bdf8", "#fb923c", "#e879f9",
];

/* ── 1. Donut Cotisations ────────────────────────────────────────────────── */

export function ChartCotisations() {
  const { resultats, calculsDone } = useSimulateurStore();
  if (!calculsDone || !resultats.cotisations) return null;

  const data = resultats.cotisations.lignes
    .filter((l) => l.montant > 0)
    .map((l) => ({ name: l.label, value: Math.round(l.montant) }));

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="text-sm font-medium text-foreground-muted mb-3">
        R\u00e9partition des cotisations
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }: { name?: string; percent?: number }) =>
              `${(name ?? "").split(" ")[0]} ${((percent ?? 0) * 100).toFixed(0)}%`
            }
            labelLine={false}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => tooltipFmt(v)}
            contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }}
            itemStyle={{ color: "#e0e0e0" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── 2. Waterfall fiscal ─────────────────────────────────────────────────── */

export function ChartWaterfallFiscal() {
  const { resultats, calculsDone, client } = useSimulateurStore();
  if (!calculsDone || !resultats.cotisations || !resultats.fiscalite) return null;

  const bnc = client.activite.bncN;
  const c = resultats.cotisations;
  const f = resultats.fiscalite;

  const data = [
    { name: "BNC", positif: bnc, negatif: 0 },
    { name: "Cotisations", positif: 0, negatif: c.totalCotisations },
    { name: "CSG d\u00e9d.", positif: 0, negatif: c.csgDeductible },
    { name: "PER", positif: 0, negatif: client.contrats.retraiteSupplementaireVersement },
    { name: "IR", positif: 0, negatif: f.irNet },
    { name: "CEHR", positif: 0, negatif: f.cehr },
    { name: "Net dispo", positif: bnc - c.totalCotisations - f.totalImpot, negatif: 0 },
  ];

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="text-sm font-medium text-foreground-muted mb-3">
        Cascade fiscale (BNC \u2192 Net disponible)
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} barGap={0}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="name" tick={{ fill: "#999", fontSize: 11 }} />
          <YAxis tickFormatter={fmtK} tick={{ fill: "#999", fontSize: 11 }} />
          <Tooltip
            formatter={(v) => tooltipFmt(v)}
            contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }}
            itemStyle={{ color: "#e0e0e0" }}
          />
          <Bar dataKey="positif" fill="#34d399" name="Positif" radius={[4, 4, 0, 0]} />
          <Bar dataKey="negatif" fill="#f87171" name="N\u00e9gatif" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── 3. Projection patrimoine 30 ans ─────────────────────────────────────── */

export function ChartProjection30ans() {
  const { resultats, calculsDone, client } = useSimulateurStore();
  if (!calculsDone || !resultats.projection) return null;

  // Recalculer pessimiste et optimiste pour le graph
  const central = resultats.projection.tableAnnuelle;

  // Approximation pour le graph via synthèse 5 ans
  const data = resultats.projection.synthese5ans.map((s) => ({
    annee: s.annee,
    age: s.age,
    pessimiste: Math.round(s.pessimiste),
    central: Math.round(s.central),
    optimiste: Math.round(s.optimiste),
  }));

  // Ajouter le point de départ
  data.unshift({
    annee: 2026,
    age: client.identite.age,
    pessimiste: Math.round(client.patrimoine.patrimoineNet),
    central: Math.round(client.patrimoine.patrimoineNet),
    optimiste: Math.round(client.patrimoine.patrimoineNet),
  });

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="text-sm font-medium text-foreground-muted mb-3">
        Projection patrimoine 30 ans (3 sc\u00e9narios)
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="age" tick={{ fill: "#999", fontSize: 11 }} label={{ value: "\u00C2ge", position: "insideBottom", offset: -5, fill: "#999" }} />
          <YAxis tickFormatter={fmtK} tick={{ fill: "#999", fontSize: 11 }} />
          <Tooltip
            formatter={(v) => tooltipFmt(v)}
            contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }}
            itemStyle={{ color: "#e0e0e0" }}
          />
          <Legend />
          <Area type="monotone" dataKey="optimiste" stroke="#34d399" fill="#34d399" fillOpacity={0.15} name="Optimiste" />
          <Area type="monotone" dataKey="central" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.2} name="Central" />
          <Area type="monotone" dataKey="pessimiste" stroke="#f87171" fill="#f87171" fillOpacity={0.1} name="Pessimiste" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── 4. Tranches IR ──────────────────────────────────────────────────────── */

export function ChartTranchesIR() {
  const { resultats, calculsDone } = useSimulateurStore();
  if (!calculsDone || !resultats.fiscalite) return null;

  const data = resultats.fiscalite.detailTranches
    .filter((t) => t.montant > 0)
    .map((t) => ({
      tranche: `${(t.taux * 100).toFixed(0)} %`,
      montant: Math.round(t.montant * resultats.fiscalite!.irBrut > 0 ? useSimulateurStore.getState().client.identite.nbParts : 1),
    }));

  // Recalculate cleanly
  const dataCleaned = resultats.fiscalite.detailTranches
    .filter((t) => t.montant > 0)
    .map((t) => ({
      tranche: `${(t.taux * 100).toFixed(0)} %`,
      montant: Math.round(t.montant * useSimulateurStore.getState().client.identite.nbParts),
    }));

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="text-sm font-medium text-foreground-muted mb-3">
        D\u00e9tail par tranche IR
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={dataCleaned} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis type="number" tickFormatter={fmtK} tick={{ fill: "#999", fontSize: 11 }} />
          <YAxis dataKey="tranche" type="category" tick={{ fill: "#999", fontSize: 11 }} width={50} />
          <Tooltip
            formatter={(v) => tooltipFmt(v)}
            contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }}
            itemStyle={{ color: "#e0e0e0" }}
          />
          <Bar dataKey="montant" fill="#60a5fa" radius={[0, 4, 4, 0]} name="Montant IR" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── 5. Gap prévoyance ───────────────────────────────────────────────────── */

export function ChartGapPrevoyance() {
  const { resultats, calculsDone } = useSimulateurStore();
  if (!calculsDone || !resultats.prevoyance) return null;

  const p = resultats.prevoyance;
  const data = [
    {
      periode: p.gapIJ.periode1.description.split(":")[0] || "P1",
      couverture: Math.round(p.gapIJ.periode1.couverture),
      gap: Math.round(p.gapIJ.periode1.gap),
    },
    {
      periode: p.gapIJ.periode2.description.split(":")[0] || "P2",
      couverture: Math.round(p.gapIJ.periode2.couverture),
      gap: Math.round(p.gapIJ.periode2.gap),
    },
    {
      periode: p.gapIJ.periode3.description.split(":")[0] || "P3",
      couverture: Math.round(p.gapIJ.periode3.couverture),
      gap: Math.round(p.gapIJ.periode3.gap),
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="text-sm font-medium text-foreground-muted mb-3">
        Gap pr\u00e9voyance (IJ / jour)
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="periode" tick={{ fill: "#999", fontSize: 10 }} />
          <YAxis tick={{ fill: "#999", fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }}
            itemStyle={{ color: "#e0e0e0" }}
          />
          <Legend />
          <Bar dataKey="couverture" stackId="a" fill="#34d399" name="Couverture" radius={[0, 0, 0, 0]} />
          <Bar dataKey="gap" stackId="a" fill="#f87171" name="Gap" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
