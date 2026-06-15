"use client";

// PHASE 2 — Import du tableur source.
//
// On matérialise le GESTE MÉTIER réel : un classeur Excel s'ouvre, ses lignes
// (date · poste · quantité · unité · source) défilent sous un faisceau de scan,
// puis un bandeau de consolidation résume la normalisation. Bien plus concret —
// et moins « IA générique » — que des pastilles abstraites.
//
//   1. « import-file-pick »   → la fenêtre du tableur apparaît (en-tête + onglets).
//   2. « import-rows-stream » → les lignes défilent + le faisceau de scan balaie.
//   3. « import-complete »    → bandeau « 847 lignes normalisées » + stats clés.
//
// Composant PRÉSENTATIONNEL : il LIT currentMoment et révèle chaque bloc dès le
// moment atteint (cumulatif). prefers-reduced-motion : état final, sans scan.

import { motion, useReducedMotion } from "framer-motion";

import { PhaseShell } from "@/components/demo/phases/phase-shell";
import { SheetGrid } from "@/components/demo/primitives/sheet-grid";
import {
  DEMO_TONE_CLASSES,
  IMPORT_ROWS,
  PHASE_META,
  SHEET_ROWS,
  isMomentAtOrAfter,
} from "@/components/demo/demo-types";
import { EASE } from "@/components/demo/demo-tokens";
import { useDemoTimeline } from "@/lib/hooks/use-demo-timeline";

const BADGE_BASE = "rounded-full border px-3 py-1 text-xs font-bold";

export function DemoPhase2Import() {
  const reduce = useReducedMotion();
  const { currentMoment } = useDemoTimeline();

  const showGrid = reduce || isMomentAtOrAfter(currentMoment, "import-file-pick");
  const streaming = reduce || isMomentAtOrAfter(currentMoment, "import-rows-stream");
  const showResult = reduce || isMomentAtOrAfter(currentMoment, "import-complete");

  return (
    <PhaseShell
      kicker={PHASE_META[2].kicker}
      title="Import du tableur source"
      testId="demo-phase-2-import"
    >
      {/* Fenêtre de tableur : en-tête + lignes qui défilent sous le scan. */}
      {showGrid ? (
        <motion.div
          className="mx-auto max-w-2xl"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE.out }}
        >
          <SheetGrid rows={SHEET_ROWS} active={streaming} />
        </motion.div>
      ) : null}

      {/* Bandeau de consolidation + stats clés (reprend IMPORT_ROWS). */}
      {showResult ? (
        <motion.div
          data-testid="demo-import-result"
          className="mx-auto mt-5 max-w-2xl rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4"
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE.out }}
        >
          <p className="text-[0.68rem] font-bold uppercase tracking-widest text-emerald-300/80">
            Consolidation
          </p>
          <p className="mt-2 text-sm text-white/80">
            847 lignes normalisées · prêtes pour le calcul carbone.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {IMPORT_ROWS.map((row, index) => (
              <li
                key={`${row.label}-${index}`}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5"
              >
                <span className="text-xs text-white/70">{row.label}</span>
                <span className={`${BADGE_BASE} ${DEMO_TONE_CLASSES[row.tone]}`}>
                  {row.value}
                </span>
              </li>
            ))}
          </ul>
        </motion.div>
      ) : null}
    </PhaseShell>
  );
}
