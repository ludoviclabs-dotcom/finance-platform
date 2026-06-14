"use client";

// PHASE 2 — Import du fichier.
//
// Scène présentationnelle de la séquence /demo : on matérialise l'import du
// fichier source, le flux des lignes normalisées, puis le résultat consolidé.
// Trois moments rythment l'apparition du contenu (cf. MOMENT_SEQUENCE) :
//   1. « import-file-pick »   → badge fichier (nom + nombre de feuilles).
//   2. « import-rows-stream » → flux progressif des lignes (ExcelRowStream).
//   3. « import-complete »    → encart résultat (847 lignes normalisées).
//
// Composant PRÉSENTATIONNEL : il LIT currentMoment via useDemoTimeline() mais ne
// pilote JAMAIS la progression — l'horloge auto-avance toute seule. Chaque bloc
// se révèle dès que le moment correspondant est atteint (isMomentAtOrAfter), de
// sorte que l'état reste cohérent même après un saut de phase.
//
// prefers-reduced-motion : les blocs sont rendus dans leur état final, sans
// animation d'entrée (la visibilité dépend uniquement du moment courant).

import { motion, useReducedMotion } from "framer-motion";
import { FileSpreadsheet } from "lucide-react";

import { PhaseShell } from "@/components/demo/phases/phase-shell";
import { ExcelRowStream } from "@/components/demo/primitives/excel-row-stream";
import {
  IMPORT_ROWS,
  DEMO_FILE,
  PHASE_META,
  isMoment,
  isMomentAtOrAfter,
} from "@/components/demo/demo-types";
import { EASE } from "@/components/demo/demo-tokens";
import { useDemoTimeline } from "@/lib/hooks/use-demo-timeline";

export function DemoPhase2Import() {
  const reduce = useReducedMotion();
  const { currentMoment } = useDemoTimeline();

  // Visibilité dérivée du moment courant : chaque seuil reste vrai pour tous les
  // moments ultérieurs (cumulatif), ce qui garantit un état final stable.
  const showFile = isMomentAtOrAfter(currentMoment, "import-file-pick");
  const showRows = isMomentAtOrAfter(currentMoment, "import-rows-stream");
  const showResult = isMomentAtOrAfter(currentMoment, "import-complete");

  // Référence explicite à isMoment (helper du contrat) sans effet de bord : on
  // garde le flux de lignes « actif » tant qu'on n'est pas allé au-delà.
  const rowsActive = showRows && !isMoment(currentMoment, "import-complete");

  return (
    <PhaseShell
      kicker={PHASE_META[2].kicker}
      title="Import du fichier"
      testId="demo-phase-2-import"
    >
      {/* Badge fichier : nom du fichier source + nombre de feuilles. */}
      {showFile ? (
        <motion.div
          data-testid="demo-import-file"
          className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE.out }}
        >
          <FileSpreadsheet className="h-5 w-5 text-emerald-400" aria-hidden="true" />
          <span className="font-mono text-sm text-white">{DEMO_FILE}</span>
          <span className="text-sm text-white/50">14 feuilles</span>
        </motion.div>
      ) : null}

      {/* Flux des lignes importées : révélation progressive (ExcelRowStream). */}
      {showRows ? (
        <ExcelRowStream
          rows={IMPORT_ROWS}
          active={rowsActive}
          className="mt-5 max-w-xl"
        />
      ) : null}

      {/* Encart résultat : lignes normalisées prêtes pour le calcul carbone. */}
      {showResult ? (
        <motion.div
          data-testid="demo-import-result"
          className="mt-5 rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.06] p-4"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE.out }}
        >
          <p className="text-[0.68rem] font-bold uppercase tracking-widest text-cyan-300/80">
            Résultat
          </p>
          <p className="mt-2 text-sm text-white/80">
            847 lignes normalisées · prêtes pour le calcul carbone
          </p>
        </motion.div>
      ) : null}
    </PhaseShell>
  );
}
