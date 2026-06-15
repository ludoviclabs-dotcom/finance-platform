"use client";

/**
 * Scope3Panel — répartition Scope 3 par catégorie GHG Protocol (T4.1). Affiche
 * les 15 catégories ; celles sans émission évaluée sont grisées « non évaluée »
 * (honnêteté sur la couverture partielle).
 *
 * Repli démonstration : si le backend est injoignable (déploiement vitrine sans
 * base Neon), le panneau affiche un jeu de données FICTIF clairement étiqueté
 * plutôt que de disparaître — pour que la valeur reste visible.
 */

import { useEffect, useState } from "react";

import { fetchScope3Breakdown, type Scope3Breakdown } from "@/lib/api";

function fmt(v: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v);
}

/** Libellés des 15 catégories Scope 3 (GHG Protocol). */
const SCOPE3_LABELS = [
  "Biens & services achetés",
  "Biens d'équipement",
  "Énergie & carburants (amont)",
  "Transport & distribution amont",
  "Déchets générés",
  "Déplacements professionnels",
  "Domicile-travail",
  "Actifs loués (amont)",
  "Transport & distribution aval",
  "Transformation produits vendus",
  "Utilisation produits vendus",
  "Fin de vie produits vendus",
  "Actifs loués (aval)",
  "Franchises",
  "Investissements",
];

/** Jeu fictif (somme = 7 222 tCO2e, cohérent avec demo-dataset.json). */
const DEMO_VALUES: Record<number, number> = { 1: 3800, 3: 862, 4: 1450, 5: 180, 6: 520, 7: 410 };
const DEMO_SCOPE3: Scope3Breakdown = {
  categories: SCOPE3_LABELS.map((label, i) => {
    const code = i + 1;
    const value = DEMO_VALUES[code] ?? 0;
    return { code, label, value, evaluated: value > 0 };
  }),
  coverage: [1, 3, 4, 5, 6, 7],
  coverage_count: 6,
  categorized_total: 7222,
  uncategorized_total: 0,
  total_scope3: 7222,
};

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

  // Données réelles si disponibles ; sinon repli démo une fois le fetch en échec.
  const display = data ?? (failed ? DEMO_SCOPE3 : null);
  if (!display) return null;
  const isDemo = !data && failed;

  const max = Math.max(1, ...display.categories.map((c) => c.value));

  return (
    <div className="rounded-2xl border border-neutral-200 p-5" data-testid="scope3-panel">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-neutral-500">Scope 3 par catégorie</h3>
        <div className="flex items-center gap-2">
          {isDemo && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              Démo — données fictives
            </span>
          )}
          <span className="text-xs text-neutral-400">
            {display.coverage_count}/15 évaluées · {fmt(display.total_scope3)} tCO2e
          </span>
        </div>
      </div>
      <div className="space-y-1">
        {display.categories.map((c) => (
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
      {display.uncategorized_total > 0 && (
        <p className="mt-3 text-[10px] text-neutral-400">
          + {fmt(display.uncategorized_total)} tCO2e Scope 3 non catégorisés (agrégat historique).
        </p>
      )}
    </div>
  );
}
