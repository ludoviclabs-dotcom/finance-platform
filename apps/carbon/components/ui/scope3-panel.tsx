"use client";

/**
 * Scope3Panel — répartition Scope 3 par catégorie GHG Protocol (T4.1). Affiche
 * les 15 catégories ; celles sans émission évaluée sont grisées « non évaluée »
 * (honnêteté sur la couverture partielle).
 */

import { useEffect, useState } from "react";

import { fetchScope3Breakdown, type Scope3Breakdown } from "@/lib/api";

function fmt(v: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v);
}

export function Scope3Panel() {
  const [data, setData] = useState<Scope3Breakdown | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchScope3Breakdown(ctrl.signal)
      .then(setData)
      .catch(() => setFailed(true));
    return () => ctrl.abort();
  }, []);

  if (failed || !data) return null;

  const max = Math.max(1, ...data.categories.map((c) => c.value));

  return (
    <div className="rounded-2xl border border-neutral-200 p-5" data-testid="scope3-panel">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-neutral-500">Scope 3 par catégorie</h3>
        <span className="text-xs text-neutral-400">
          {data.coverage_count}/15 évaluées · {fmt(data.total_scope3)} tCO2e
        </span>
      </div>
      <div className="space-y-1">
        {data.categories.map((c) => (
          <div key={c.code} className="flex items-center gap-2 text-xs">
            <span className="w-7 shrink-0 text-right font-mono text-neutral-400">3.{c.code}</span>
            <span className="w-44 shrink-0 truncate text-neutral-600" title={c.label}>
              {c.label}
            </span>
            <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
              <div
                className={`h-full ${c.evaluated ? "bg-emerald-500" : "bg-transparent"}`}
                style={{ width: `${(c.value / max) * 100}%` }}
              />
            </div>
            <span className={`w-16 text-right tabular-nums ${c.evaluated ? "text-neutral-700" : "text-neutral-300"}`}>
              {c.evaluated ? fmt(c.value) : "non éval."}
            </span>
          </div>
        ))}
      </div>
      {data.uncategorized_total > 0 && (
        <p className="mt-3 text-[10px] text-neutral-400">
          + {fmt(data.uncategorized_total)} tCO2e Scope 3 non catégorisés (agrégat historique).
        </p>
      )}
    </div>
  );
}
