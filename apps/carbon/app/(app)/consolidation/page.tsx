"use client";

/**
 * /consolidation — Périmètre organisationnel & vue groupe (T4.4). Approche de
 * consolidation (contrôle opérationnel / financier / parts de capital), liste
 * des entités, et KPIs consolidés (calculés, lecture seule). Changer d'approche
 * recalcule et journalise un event de périmètre.
 */

import { useCallback, useEffect, useState } from "react";

import {
  fetchConsolidationGroup,
  fetchConsolidationPerimeter,
  setConsolidationApproach,
  type ConsolidationGroup,
  type ConsolidationPerimeter,
} from "@/lib/api";

function fmt(v: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v);
}

export default function ConsolidationPage() {
  const [perimeter, setPerimeter] = useState<ConsolidationPerimeter | null>(null);
  const [group, setGroup] = useState<ConsolidationGroup | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const ctrl = new AbortController();
    Promise.all([fetchConsolidationPerimeter(ctrl.signal), fetchConsolidationGroup(ctrl.signal)])
      .then(([p, g]) => {
        setPerimeter(p);
        setGroup(g);
      })
      .catch(() => setError(true));
    return ctrl;
  }, []);

  useEffect(() => {
    const ctrl = load();
    return () => ctrl.abort();
  }, [load]);

  const changeApproach = async (approach: string) => {
    setBusy(true);
    try {
      await setConsolidationApproach(approach);
      load();
    } catch {
      /* ignore (admin requis) */
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="p-8 text-sm text-red-600">Impossible de charger le périmètre.</div>;
  if (!perimeter || !group) return <div className="p-8 text-sm text-neutral-400">Chargement…</div>;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-extrabold tracking-tight mb-1">Périmètre & consolidation</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Approche : <strong>{perimeter.approach_label}</strong> ·{" "}
        {perimeter.entities.length} entité(s)
      </p>

      <div className="rounded-2xl border border-neutral-200 p-5 mb-6">
        <p className="text-xs font-bold uppercase tracking-wide text-neutral-500 mb-3">Approche de consolidation</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(perimeter.approaches).map(([key, def]) => (
            <button
              key={key}
              onClick={() => changeApproach(key)}
              disabled={busy}
              className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                perimeter.approach === key
                  ? "bg-black text-white border-black"
                  : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50"
              }`}
              title={def.definition}
            >
              {def.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-neutral-500">{perimeter.approaches[perimeter.approach]?.definition}</p>
      </div>

      <div className="rounded-2xl border border-neutral-200 p-5 mb-6">
        <p className="text-xs font-bold uppercase tracking-wide text-neutral-500 mb-3">Entités du périmètre</p>
        <div className="divide-y divide-neutral-100">
          {perimeter.entities.map((e) => (
            <div key={e.company_id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-neutral-700">
                {e.name ?? `Entité ${e.company_id}`}
                {e.is_parent && <span className="ml-2 text-[10px] text-neutral-400 uppercase">mère</span>}
              </span>
              <span className="text-neutral-500 tabular-nums">{fmt(e.ownership_pct)} %</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-neutral-500 mb-3">
          KPIs consolidés (groupe — calculé)
        </p>
        {Object.keys(group.kpis).length === 0 ? (
          <p className="text-sm text-neutral-400">Aucun KPI consolidé disponible.</p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {Object.entries(group.kpis).map(([code, value]) => (
              <div key={code} className="flex items-center justify-between py-2 text-sm">
                <span className="font-mono text-xs text-neutral-500">{code}</span>
                <span className="tabular-nums font-semibold">{fmt(value)}</span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-[10px] text-neutral-400">
          Vue calculée en lecture seule — jamais ré-émise comme facts.
        </p>
      </div>
    </div>
  );
}
