"use client";

// Primitive : flux de lignes importées depuis un fichier source. Quand `active`
// passe à vrai, on révèle les lignes une par une (compteur croissant piloté par
// un intervalle, nettoyé au démontage et à la désactivation). Chaque ligne =
// une rangée grid (libellé à gauche, badge de tonalité à droite) animée à
// l'entrée via framer-motion. Sous prefers-reduced-motion : toutes les lignes
// sont visibles immédiatement, sans animation ni timer.

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { DEMO_TONE_CLASSES, type DemoRow } from "@/components/demo/demo-types";
import { EASE } from "@/components/demo/demo-tokens";

type ExcelRowStreamProps = {
  /** Lignes importées à révéler dans l'ordre du tableau. */
  rows: DemoRow[];
  /** Quand vrai, démarre la révélation progressive des lignes. */
  active: boolean;
  /** Intervalle (ms) entre l'apparition de deux lignes. Défaut 1400. */
  rowIntervalMs?: number;
  /** Classes additionnelles sur le conteneur. */
  className?: string;
};

/** Classes de base d'un badge d'état (complétées par la tonalité de la ligne). */
const BADGE_BASE = "rounded-full border px-3 py-1 text-xs font-bold";

export function ExcelRowStream({
  rows,
  active,
  rowIntervalMs = 1400,
  className,
}: ExcelRowStreamProps) {
  const reduce = useReducedMotion() ?? false;

  // Nombre de lignes actuellement visibles. En mouvement réduit on affiche
  // tout de suite la totalité ; sinon on part de 0 (rien tant qu'inactif).
  const [count, setCount] = useState(reduce ? rows.length : 0);

  useEffect(() => {
    // Mouvement réduit : état final immédiat, aucun timer.
    if (reduce) {
      setCount(rows.length);
      return;
    }

    // Inactif : on réinitialise (rien de visible) et on n'arme aucun timer.
    if (!active) {
      setCount(0);
      return;
    }

    // Toutes les lignes déjà révélées : rien à programmer.
    if (rows.length === 0) {
      setCount(0);
      return;
    }

    // Première ligne visible dès l'activation, puis une de plus à chaque tick.
    setCount(1);
    let current = 1;
    const interval = window.setInterval(() => {
      current += 1;
      setCount(current);
      if (current >= rows.length) {
        window.clearInterval(interval);
      }
    }, Math.max(1, rowIntervalMs));

    return () => window.clearInterval(interval);
  }, [reduce, active, rows.length, rowIntervalMs]);

  // Borne de sécurité : ne jamais dépasser le nombre réel de lignes.
  const visibleCount = Math.min(count, rows.length);
  const visibleRows = rows.slice(0, visibleCount);

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]${
        className ? ` ${className}` : ""
      }`}
      data-testid="excel-row-stream"
    >
      {visibleRows.map((row, index) => (
        <motion.div
          key={`${row.label}-${index}`}
          className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-white/[0.08] px-4 py-3 last:border-b-0"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ease: EASE.out, duration: 0.32 }}
          data-testid="excel-row"
        >
          <span className="text-sm text-white/80">{row.label}</span>
          <span className={`${BADGE_BASE} ${DEMO_TONE_CLASSES[row.tone]}`}>
            {row.value}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
