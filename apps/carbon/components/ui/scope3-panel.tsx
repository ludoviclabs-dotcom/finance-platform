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
 * injoignable.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, CircleDashed, ArrowRight } from "lucide-react";

import { StatTile } from "@/components/resources/viz/stat-tile";
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

  const display = data ?? (failed ? DEMO_SCOPE3 : null);
  const isDemo = !data && failed;

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
    <div
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
      data-testid="scope3-panel"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Scope 3 par catégorie
          </h3>
          {isDemo && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600">
              Démo — données fictives
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <StatTile
            testId="scope3-coverage"
            label="Couverture"
            value={evaluated}
            context={`sur 15 · ${fmt(display.total_scope3)} tCO₂e`}
          />
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
              <span className="flex w-20 justify-end">
                <Link
                  href="/upload"
                  data-testid={`scope3-fill-${c.code}`}
                  className="inline-flex items-center gap-0.5 text-[var(--color-foreground-subtle)] opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 hover:text-carbon-emerald-light"
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
