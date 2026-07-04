"use client";

/**
 * /baselines — Année de référence & recalcul (T4.5). Gel d'une année, comparaison
 * « vs référence », recalcul motivé (le motif est tracé dans le trail ; l'ancienne
 * valeur reste consultable).
 */

import { useCallback, useEffect, useState } from "react";

import {
  fetchBaselineVsCurrent,
  fetchBaselines,
  freezeBaseline,
  triggerRecalc,
  type BaselineVsCurrent,
  type BaselinesResponse,
} from "@/lib/api";

function fmt(v: number | null): string {
  return v === null ? "—" : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v);
}

export default function BaselinesPage() {
  const [data, setData] = useState<BaselinesResponse | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [vs, setVs] = useState<BaselineVsCurrent | null>(null);
  const [year, setYear] = useState(new Date().getFullYear() - 1);
  const [reason, setReason] = useState("ef_version");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchBaselines().then(setData).catch(() => setData({ reasons: {}, baselines: [] }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openVs = async (id: number) => {
    setSelected(id);
    setVs(null);
    try {
      setVs(await fetchBaselineVsCurrent(id));
    } catch {
      /* ignore */
    }
  };

  const freeze = async () => {
    setBusy(true);
    try {
      await freezeBaseline(year);
      load();
    } catch {
      /* admin requis */
    } finally {
      setBusy(false);
    }
  };

  const recalc = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await triggerRecalc(selected, reason);
      openVs(selected);
    } catch {
      /* admin requis */
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <div className="p-8 text-sm text-neutral-400">Chargement…</div>;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-extrabold tracking-tight mb-1">Année de référence</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Gelez une année de référence, comparez vos émissions vs cette baseline, et tracez tout recalcul.
      </p>

      <div className="rounded-2xl border border-neutral-200 p-5 mb-6 flex flex-wrap items-center gap-3">
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="px-2 py-1 rounded border border-neutral-200 w-28 text-sm"
        />
        <button onClick={freeze} disabled={busy} className="px-4 py-2 rounded-full bg-black text-white text-sm font-semibold disabled:opacity-40">
          {busy ? "…" : "Geler cette année"}
        </button>
      </div>

      {data.baselines.length > 0 && (
        <div className="rounded-2xl border border-neutral-200 divide-y divide-neutral-100 mb-6">
          {data.baselines.map((b) => (
            <button
              key={b.id}
              onClick={() => openVs(b.id)}
              className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-neutral-50 ${selected === b.id ? "bg-neutral-50" : ""}`}
            >
              <span className="text-sm font-semibold">Baseline {b.baseline_year}</span>
              <span className="text-xs text-neutral-400">
                {b.ef_version ? `FE ${b.ef_version} · ` : ""}gelée le {new Date(b.frozen_at).toLocaleDateString("fr-FR")}
              </span>
            </button>
          ))}
        </div>
      )}

      {selected && vs && (
        <div className="rounded-2xl border border-neutral-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">vs référence {vs.baseline_year}</h2>
            <div className="flex items-center gap-2">
              <select value={reason} onChange={(e) => setReason(e.target.value)} className="text-xs rounded border border-neutral-200 px-2 py-1">
                {Object.entries(data.reasons).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <button onClick={recalc} disabled={busy} className="px-3 py-1 rounded-full border border-neutral-300 text-xs font-semibold disabled:opacity-40">
                Recalculer
              </button>
            </div>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-neutral-400 uppercase tracking-wide">
                <th className="text-left py-1">Code</th>
                <th className="text-right py-1">Référence</th>
                <th className="text-right py-1">Actuel</th>
                <th className="text-right py-1">Δ%</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(vs.deltas).map(([code, d]) => (
                <tr key={code} className="border-t border-neutral-100">
                  <td className="py-1 font-mono text-neutral-500">{code}</td>
                  <td className="py-1 text-right tabular-nums">{fmt(d.baseline)}</td>
                  <td className="py-1 text-right tabular-nums">{fmt(d.current)}</td>
                  <td className={`py-1 text-right tabular-nums ${d.change_pct != null && d.change_pct > 0 ? "text-red-600" : d.change_pct != null && d.change_pct < 0 ? "text-emerald-600" : "text-neutral-400"}`}>
                    {d.change_pct === null ? "—" : `${d.change_pct > 0 ? "+" : ""}${d.change_pct}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
