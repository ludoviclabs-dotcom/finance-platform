"use client";

/**
 * /actions — Leviers de réduction : MACC (T5.1) + plan de transition (T5.2).
 * Kanban par statut (proposée → engagée → réalisée, journalisé), courbe de coût
 * d'abattement (barres triées par coût marginal croissant), trajectoire projetée,
 * exports PDF.
 */

import { useCallback, useEffect, useState } from "react";

import {
  createAction,
  deleteAction,
  downloadMaccPdf,
  downloadTransitionPdf,
  fetchActions,
  fetchMacc,
  fetchTrajectory,
  setActionStatus,
  type Action,
  type Macc,
  type Trajectory,
} from "@/lib/api";

const COLUMNS: { key: Action["status"]; label: string }[] = [
  { key: "proposed", label: "Proposées" },
  { key: "committed", label: "Engagées" },
  { key: "done", label: "Réalisées" },
];
const NEXT: Record<Action["status"], Action["status"] | null> = {
  proposed: "committed",
  committed: "done",
  done: null,
};

function num(v: string): number | null {
  const t = v.trim();
  return t === "" ? null : Number(t);
}

export default function ActionsPage() {
  const [actions, setActions] = useState<Action[]>([]);
  const [macc, setMacc] = useState<Macc | null>(null);
  const [traj, setTraj] = useState<Trajectory | null>(null);
  const [form, setForm] = useState({ title: "", capex: "", reduction: "", lifespan: "", owner: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchActions().then((r) => setActions(r.actions)).catch(() => setActions([]));
    fetchMacc().then(setMacc).catch(() => setMacc(null));
    fetchTrajectory().then(setTraj).catch(() => setTraj(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!form.title.trim()) return;
    setBusy(true);
    try {
      await createAction({
        title: form.title.trim(),
        owner: form.owner.trim() || null,
        capex: num(form.capex),
        reduction_tco2e: num(form.reduction),
        lifespan_years: num(form.lifespan),
      });
      setForm({ title: "", capex: "", reduction: "", lifespan: "", owner: "" });
      load();
    } catch {
      /* admin requis / DB indispo */
    } finally {
      setBusy(false);
    }
  };

  const advance = async (a: Action) => {
    const n = NEXT[a.status];
    if (!n) return;
    await setActionStatus(a.id, n).catch(() => null);
    load();
  };

  const remove = async (a: Action) => {
    await deleteAction(a.id).catch(() => null);
    load();
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Leviers de réduction</h1>
        <div className="flex gap-2">
          <button onClick={() => downloadMaccPdf().catch(() => null)} className="px-3 py-1.5 rounded-full border border-neutral-300 text-xs font-semibold">MACC PDF</button>
          <button onClick={() => downloadTransitionPdf().catch(() => null)} className="px-3 py-1.5 rounded-full border border-neutral-300 text-xs font-semibold">Plan PDF</button>
        </div>
      </div>
      <p className="text-sm text-neutral-500 mb-6">
        Coût marginal d&apos;abattement = CapEx / (réduction tCO2e/an × durée de vie). Le statut « réalisée » met à jour la trajectoire projetée.
      </p>

      {/* Ajout d'action */}
      <div className="rounded-2xl border border-neutral-200 p-4 mb-6 grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Action" className="col-span-2 px-2 py-1.5 rounded border border-neutral-200 text-sm" />
        <input value={form.capex} onChange={(e) => setForm({ ...form, capex: e.target.value })} placeholder="CapEx €" className="px-2 py-1.5 rounded border border-neutral-200 text-sm" />
        <input value={form.reduction} onChange={(e) => setForm({ ...form, reduction: e.target.value })} placeholder="tCO2e/an" className="px-2 py-1.5 rounded border border-neutral-200 text-sm" />
        <input value={form.lifespan} onChange={(e) => setForm({ ...form, lifespan: e.target.value })} placeholder="Durée (ans)" className="px-2 py-1.5 rounded border border-neutral-200 text-sm" />
        <button onClick={add} disabled={busy} className="px-3 py-1.5 rounded-full bg-black text-white text-sm font-semibold disabled:opacity-40">Ajouter</button>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {COLUMNS.map((col) => (
          <div key={col.key} className="rounded-2xl border border-neutral-200 p-3">
            <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-500 mb-3">{col.label}</h2>
            <div className="space-y-2">
              {actions.filter((a) => a.status === col.key).map((a) => (
                <div key={a.id} className="rounded-xl border border-neutral-100 bg-neutral-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold">{a.title}</span>
                    <button onClick={() => remove(a)} className="text-neutral-300 hover:text-red-500 text-xs">✕</button>
                  </div>
                  {a.owner && <div className="text-xs text-neutral-400">{a.owner}</div>}
                  {a.reduction_tco2e != null && <div className="text-xs text-neutral-500">-{a.reduction_tco2e} tCO2e/an</div>}
                  {NEXT[a.status] && (
                    <button onClick={() => advance(a)} className="mt-2 text-xs font-semibold text-blue-600 hover:underline">
                      → {NEXT[a.status] === "committed" ? "Engager" : "Marquer réalisée"}
                    </button>
                  )}
                </div>
              ))}
              {actions.filter((a) => a.status === col.key).length === 0 && (
                <p className="text-xs text-neutral-300">—</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Trajectoire */}
      {traj && (
        <div className="rounded-2xl border border-neutral-200 p-5 mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500 mb-3">Trajectoire projetée</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat label="Baseline" value={`${traj.baseline_tco2e} t`} />
            <Stat label="Réalisé" value={`-${traj.reductions.done} t`} color="text-emerald-600" />
            <Stat label="Engagé" value={`-${traj.reductions.committed} t`} color="text-blue-600" />
            <Stat label="Potentiel total" value={`-${traj.reductions.total} t`} color="text-neutral-500" />
          </div>
        </div>
      )}

      {/* MACC */}
      {macc && macc.bars.length > 0 && (
        <div className="rounded-2xl border border-neutral-200 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500 mb-3">
            Courbe de coût d&apos;abattement (triée)
          </h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-neutral-400 uppercase tracking-wide">
                <th className="text-left py-1">Action</th>
                <th className="text-right py-1">€/tCO2e</th>
                <th className="text-right py-1">Potentiel (tCO2e)</th>
              </tr>
            </thead>
            <tbody>
              {macc.bars.map((b) => (
                <tr key={b.id} className="border-t border-neutral-100">
                  <td className="py-1">{b.title}</td>
                  <td className={`py-1 text-right tabular-nums ${b.marginal_cost < 0 ? "text-emerald-600" : ""}`}>{b.marginal_cost}</td>
                  <td className="py-1 text-right tabular-nums">{b.potential_tco2e}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {macc.unpriced.length > 0 && (
            <p className="text-xs text-neutral-400 mt-2">{macc.unpriced.length} action(s) non chiffrée(s) (CapEx/réduction/durée manquants).</p>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color = "" }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-xs text-neutral-400">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
