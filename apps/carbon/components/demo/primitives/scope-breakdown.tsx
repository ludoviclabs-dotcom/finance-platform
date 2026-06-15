"use client";

/**
 * ScopeBreakdown — répartition animée du total GES par scope (GHG Protocol).
 *
 * Une barre empilée Scope 1 / 2 / 3 dont les segments « poussent » depuis une
 * largeur nulle quand `active` devient vrai, doublée d'une légende (pastille +
 * libellé + valeur tCO₂e + part %). Élément métier fort qui ancre le compteur
 * dans le réel (et le distingue d'une démo « IA générique »).
 *
 * Composant PRÉSENTATIONNEL : il ne pilote pas la timeline. Sous mouvement
 * réduit, les segments sont rendus à leur largeur finale, sans animation.
 */

import { motion, useReducedMotion } from "framer-motion";

import { DEMO_COLORS, EASE } from "@/components/demo/demo-tokens";
import {
  DEMO_GES_UNIT,
  type ScopeSlice,
} from "@/components/demo/demo-types";

type ScopeBreakdownProps = {
  /** Tranches par scope (la somme des valeurs vaut le total GES). */
  slices: ScopeSlice[];
  /** Déclenche la poussée des segments quand vrai. */
  active: boolean;
  /** Classes additionnelles sur le conteneur racine. */
  className?: string;
};

const FR_NUMBER_FORMAT = new Intl.NumberFormat("fr-FR");

export function ScopeBreakdown({ slices, active, className }: ScopeBreakdownProps) {
  const reduce = useReducedMotion() ?? false;
  const grown = active || reduce;

  const total = slices.reduce((sum, s) => sum + s.value, 0) || 1;

  return (
    <div
      data-testid="demo-scope-breakdown"
      className={["w-full", className ?? ""].filter(Boolean).join(" ")}
    >
      <p className="mb-2 flex items-center justify-between text-[0.68rem] font-bold uppercase tracking-widest text-emerald-300/80">
        <span>Répartition par scope</span>
        <span className="font-mono text-white/35">GHG Protocol</span>
      </p>

      {/* Barre empilée : chaque segment pousse jusqu'à sa part. */}
      <div className="flex h-3 w-full overflow-hidden rounded-full border border-white/10 bg-white/[0.05]">
        {slices.map((slice) => {
          const pct = (slice.value / total) * 100;
          return (
            <motion.div
              key={slice.id}
              className="h-full"
              style={{ backgroundColor: DEMO_COLORS[slice.colorKey] }}
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${grown ? pct : 0}%` }}
              transition={
                reduce ? { duration: 0 } : { duration: 0.9, ease: EASE.out }
              }
            />
          );
        })}
      </div>

      {/* Légende : pastille + libellé + valeur + part. */}
      <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {slices.map((slice, index) => {
          const pct = Math.round((slice.value / total) * 100);
          return (
            <motion.li
              key={slice.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={reduce ? undefined : { opacity: 1, y: 0 }}
              transition={{
                duration: 0.35,
                ease: EASE.out,
                delay: reduce ? 0 : 0.25 + index * 0.12,
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: DEMO_COLORS[slice.colorKey] }}
                />
                <span className="text-xs font-bold text-white">{slice.label}</span>
                <span className="ml-auto font-mono text-xs text-white/45">{pct}%</span>
              </div>
              <p className="mt-1 font-mono text-sm text-white/90">
                {FR_NUMBER_FORMAT.format(slice.value)}{" "}
                <span className="text-[0.7rem] text-white/40">{DEMO_GES_UNIT}</span>
              </p>
              <p className="text-[0.68rem] text-white/40">{slice.sublabel}</p>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
