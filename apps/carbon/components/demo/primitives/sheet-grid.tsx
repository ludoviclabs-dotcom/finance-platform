"use client";

/**
 * SheetGrid — tableur source réaliste qui se remplit (Phase 2 — Import).
 *
 * Matérialise concrètement « du tableur au rapport » : une fenêtre de classeur
 * (barre de titre + pastilles macOS), un en-tête de colonnes, puis les lignes
 * qui apparaissent une à une pendant qu'un FAISCEAU DE SCAN balaie la grille
 * (carbon-scan-beam). Des onglets de feuilles ancrent le bas. Bien plus crédible
 * que des pastilles génériques — c'est le geste métier réel de l'utilisateur.
 *
 * Composant PRÉSENTATIONNEL : il ne pilote pas la timeline. `active` lance le
 * flux des lignes + le scan ; sous mouvement réduit tout est affiché d'emblée,
 * sans balayage (cf. neutralisation CSS de carbon-scan-beam).
 */

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { FileSpreadsheet } from "lucide-react";

import { DEMO_CSS, EASE } from "@/components/demo/demo-tokens";
import {
  DEMO_FILE,
  SHEET_COLUMNS,
  SHEET_TABS,
  type SheetRow,
} from "@/components/demo/demo-types";

type SheetGridProps = {
  /** Lignes du tableur, révélées dans l'ordre. */
  rows: SheetRow[];
  /** Démarre la révélation progressive + le faisceau de scan. */
  active: boolean;
  /** Intervalle (ms) entre deux lignes. Défaut 850. */
  rowIntervalMs?: number;
  /** Classes additionnelles sur le conteneur. */
  className?: string;
};

/** Gabarit de colonnes partagé entre l'en-tête et les lignes. */
const GRID_COLS =
  "grid grid-cols-[3.75rem_minmax(8rem,1fr)_5rem_2.75rem_4.5rem] items-center gap-3";

export function SheetGrid({
  rows,
  active,
  rowIntervalMs = 850,
  className,
}: SheetGridProps) {
  const reduce = useReducedMotion() ?? false;
  const [count, setCount] = useState(reduce ? rows.length : 0);

  useEffect(() => {
    if (reduce) {
      setCount(rows.length);
      return;
    }
    if (!active || rows.length === 0) {
      setCount(0);
      return;
    }
    setCount(1);
    let current = 1;
    const interval = window.setInterval(() => {
      current += 1;
      setCount(current);
      if (current >= rows.length) window.clearInterval(interval);
    }, Math.max(1, rowIntervalMs));
    return () => window.clearInterval(interval);
  }, [reduce, active, rows.length, rowIntervalMs]);

  const visibleRows = rows.slice(0, Math.min(count, rows.length));
  const scanning = active && !reduce;

  return (
    <div
      data-testid="demo-sheet-grid"
      className={[
        "w-full overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/70 shadow-[0_24px_60px_rgba(0,0,0,0.45)]",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Barre de titre fenêtre : pastilles + nom de fichier. */}
      <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        </span>
        <FileSpreadsheet className="ml-1 h-4 w-4 text-emerald-400" aria-hidden="true" />
        <span className="font-mono text-xs text-white/80">{DEMO_FILE}</span>
        <span className="ml-auto font-mono text-[0.7rem] text-white/35">
          14 feuilles
        </span>
      </div>

      {/* Corps de la grille (relatif : reçoit le faisceau de scan). */}
      <div className="relative overflow-x-auto">
        {/* En-tête de colonnes. */}
        <div
          className={`${GRID_COLS} min-w-[26rem] border-b border-white/10 bg-white/[0.02] px-4 py-2`}
        >
          {SHEET_COLUMNS.map((col, i) => (
            <span
              key={col}
              className={`text-[0.62rem] font-bold uppercase tracking-widest text-white/40 ${
                i === 2 ? "text-right" : ""
              }`}
            >
              {col}
            </span>
          ))}
        </div>

        {/* Lignes (flux progressif). */}
        <div className="min-w-[26rem]">
          {visibleRows.map((row, index) => (
            <motion.div
              key={`${row.poste}-${index}`}
              data-testid="demo-sheet-row"
              className={`${GRID_COLS} border-b border-white/[0.06] px-4 py-2.5 last:border-b-0`}
              initial={reduce ? false : { opacity: 0, x: -8 }}
              animate={reduce ? undefined : { opacity: 1, x: 0 }}
              transition={{ duration: 0.3, ease: EASE.out }}
            >
              <span className="font-mono text-[0.72rem] text-white/45">{row.date}</span>
              <span className="truncate text-xs text-white/85">{row.poste}</span>
              <span className="text-right font-mono text-xs text-white">{row.quantite}</span>
              <span className="font-mono text-[0.72rem] text-white/55">{row.unite}</span>
              <span className="justify-self-start rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2 py-0.5 text-[0.66rem] font-semibold text-cyan-200">
                {row.source}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Faisceau de scan : balaie la grille verticalement pendant l'import. */}
        {scanning ? (
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-x-0 top-0 h-16 ${DEMO_CSS.scanBeam}`}
            style={{
              background:
                "linear-gradient(180deg, transparent, rgba(52,211,153,0.16) 45%, rgba(52,211,153,0.28) 50%, transparent)",
            }}
          />
        ) : null}
      </div>

      {/* Pied : onglets de feuilles. */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-t border-white/10 bg-white/[0.02] px-3 py-2">
        {SHEET_TABS.map((tab, i) => (
          <span
            key={tab}
            className={`shrink-0 rounded-md px-2.5 py-1 text-[0.66rem] font-semibold ${
              i === 0
                ? "bg-emerald-400/15 text-emerald-200"
                : "text-white/40"
            }`}
          >
            {tab}
          </span>
        ))}
        <span className="ml-auto shrink-0 font-mono text-[0.66rem] text-white/35">
          847 lignes normalisées
        </span>
      </div>
    </div>
  );
}
