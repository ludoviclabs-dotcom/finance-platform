"use client";

/**
 * Scope3Panel — répartition Scope 3 par catégorie GHG Protocol (T4.1), refonte
 * interactive.
 *
 * Deux états RÉELS uniquement (`evaluated` vrai/faux) — jamais d'état « en cours »
 * ou « partielle » inventé (le backend ne les expose pas). Filtre Toutes /
 * Évaluées / Non évaluées, statut coloré + icône + libellé (jamais la couleur
 * seule), barre de magnitude pour les catégories évaluées, action « Renseigner »
 * au survol des catégories vides.
 *
 * Repli démonstration : jeu FICTIF clairement étiqueté si le backend est
 * injoignable OU s'il répond pour un tenant VIDE (aucune catégorie évaluée),
 * afin que le panneau ne reste pas à « 0 / 15 » au milieu d'un cockpit nourri
 * par les données de démonstration.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, CircleDashed, ArrowRight, Layers } from "lucide-react";

import { fetchScope3Breakdown, type Scope3Breakdown } from "@/lib/api";

function fmt(v: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v);
}

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

/* Jeu fictif calé sur la maquette (12 catégories évaluées sur 15) et cohérent
   avec le total Scope 3 du cockpit : Σ = 7 420 tCO₂e. Les catégories 3.10,
   3.13 et 3.14 restent volontairement non évaluées. */
const DEMO_VALUES: Record<number, number> = {
  1: 2680, 2: 450, 3: 610, 4: 1020, 5: 130, 6: 370, 7: 290, 8: 70,
  9: 510, 11: 890, 12: 170, 15: 230,
};
const DEMO_CATEGORIES = SCOPE3_LABELS.map((label, i) => {
  const code = i + 1;
  const value = DEMO_VALUES[code] ?? 0;
  return { code, label, value, evaluated: value > 0 };
});
const DEMO_TOTAL = DEMO_CATEGORIES.reduce((sum, c) => sum + c.value, 0);
const DEMO_SCOPE3: Scope3Breakdown = {
  categories: DEMO_CATEGORIES,
  coverage: DEMO_CATEGORIES.filter((c) => c.evaluated).map((c) => c.code),
  coverage_count: DEMO_CATEGORIES.filter((c) => c.evaluated).length,
  categorized_total: DEMO_TOTAL,
  uncategorized_total: 0,
  total_scope3: DEMO_TOTAL,
};

/** Aucune catégorie évaluée = rien à restituer, pas « 0 tCO₂e mesurés ». */
function isEmpty(b: Scope3Breakdown): boolean {
  return b.coverage_count === 0;
}

type Filter = "all" | "evaluated" | "todo";

export function Scope3Panel() {
  const [data, setData] = useState<Scope3Breakdown | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    const ctrl = new AbortController();
    fetchScope3Breakdown(ctrl.signal)
      .then(setData)
      .catch(() => setFailed(true));
    return () => ctrl.abort();
  }, []);

  const live = data && !isEmpty(data) ? data : null;
  const display = live ?? (data || failed ? DEMO_SCOPE3 : null);
  const isDemo = display !== null && live === null;

  const max = useMemo(
    () => Math.max(1, ...(display?.categories ?? []).map((c) => c.value)),
    [display],
  );
  const rows = useMemo(() => {
    const all = display?.categories ?? [];
    if (filter === "evaluated") return all.filter((c) => c.evaluated);
    if (filter === "todo") return all.filter((c) => !c.evaluated);
    return all;
  }, [display, filter]);

  if (!display) return null;

  const evaluated = display.coverage_count;
  const filters: { key: Filter; label: string; n: number }[] = [
    { key: "all", label: "Toutes", n: 15 },
    { key: "evaluated", label: "Évaluées", n: evaluated },
    { key: "todo", label: "À renseigner", n: 15 - evaluated },
  ];

  return (
    <div className="cc-card px-[22px] py-5" data-testid="scope3-panel">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="cc-eyebrow">
            <Layers className="h-3.5 w-3.5" /> Scope 3 par catégorie
          </h3>
          {isDemo && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-500">
              Démo — données fictives
            </span>
          )}
        </div>
        <div
          className="text-right"
          data-testid="scope3-coverage"
          aria-label={`Couverture : ${evaluated} catégories sur 15, ${fmt(display.total_scope3)} tCO₂e`}
        >
          <div className="font-display text-xl font-bold leading-none tabular-nums">
            {evaluated}
            <span className="text-xs font-normal text-[var(--color-foreground-subtle)]"> / 15</span>
          </div>
          <div className="mt-1 text-[9.5px] font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Couverture · {fmt(display.total_scope3)} tCO₂e
          </div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filtrer les catégories">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            data-testid={`scope3-filter-${f.key}`}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === f.key
                ? "bg-carbon-emerald/15 text-carbon-emerald-light"
                : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-raised)]"
            }`}
          >
            {f.label} <span className="tabular-nums opacity-70">{f.n}</span>
          </button>
        ))}
      </div>

      <ul className="grid grid-cols-1 gap-x-6 gap-y-0.5 lg:grid-cols-2" data-testid="scope3-rows">
        {rows.map((c) => (
          <li
            key={c.code}
            data-testid={`scope3-row-${c.code}`}
            className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-[var(--color-surface-raised)]"
          >
            <span className="w-7 shrink-0 text-right font-mono text-[var(--color-foreground-subtle)]">
              3.{c.code}
            </span>
            <span className="flex w-5 shrink-0 justify-center" aria-hidden="true">
              {c.evaluated ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <CircleDashed className="h-3.5 w-3.5 text-[var(--color-foreground-subtle)]" />
              )}
            </span>
            <span
              className="w-40 shrink-0 truncate text-[var(--color-foreground-muted)]"
              title={c.label}
            >
              {c.label}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-raised)]">
              {c.evaluated && (
                <motion.div
                  className="h-full rounded-full bg-emerald-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${(c.value / max) * 100}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              )}
            </div>
            {c.evaluated ? (
              <span className="w-20 text-right tabular-nums text-[var(--color-foreground)]">
                {fmt(c.value)}
              </span>
            ) : (
              <span className="relative flex w-20 items-center justify-end">
                {/* La maquette affiche « — » au repos ; « Renseigner » n'apparaît
                    qu'au survol / focus clavier (le lien reste tabulable). */}
                <span
                  aria-hidden="true"
                  className="font-mono text-[var(--color-foreground-subtle)] transition-opacity group-hover:opacity-0 group-focus-within:opacity-0"
                >
                  —
                </span>
                <Link
                  href="/upload"
                  data-testid={`scope3-fill-${c.code}`}
                  className="absolute inset-y-0 right-0 inline-flex items-center gap-0.5 whitespace-nowrap text-[var(--color-foreground-subtle)] opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 hover:text-carbon-emerald-light"
                >
                  Renseigner <ArrowRight className="h-3 w-3" />
                </Link>
              </span>
            )}
          </li>
        ))}
      </ul>

      {display.uncategorized_total > 0 && (
        <p className="mt-3 text-[10px] text-[var(--color-foreground-subtle)]">
          + {fmt(display.uncategorized_total)} tCO₂e Scope 3 non catégorisés (agrégat historique).
        </p>
      )}
    </div>
  );
}
