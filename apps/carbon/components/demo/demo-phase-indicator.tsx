"use client";

/**
 * DemoPhaseIndicator — pied de page de la démo cinématique /demo.
 *
 * Footer fixé en bas de l'écran qui matérialise l'avancement dans la séquence :
 * une rangée de TOTAL_PHASES pastilles (la phase courante mise en avant, les
 * phases passées atténuées, les futures en gris), le kicker de la phase courante
 * et une fine barre de progression alignée sur l'index du moment dans
 * MOMENT_SEQUENCE.
 *
 * Composant PRÉSENTATIONNEL : il LIT la timeline (currentPhase / index) mais ne
 * la pilote jamais — l'horloge auto-avance toute seule. Purement décoratif :
 * aria-hidden + pointer-events-none (les contrôles clavier vivent ailleurs).
 *
 * prefers-reduced-motion : en mouvement réduit on n'affiche pas l'indicateur
 * (return null) — l'utilisateur n'a pas besoin du feedback d'animation de
 * progression, et l'état final de chaque scène est déjà rendu directement.
 */

import { motion, useReducedMotion } from "framer-motion";

import { EASE, Z } from "@/components/demo/demo-tokens";
import {
  MOMENT_SEQUENCE,
  PHASE_META,
  TOTAL_PHASES,
} from "@/components/demo/demo-types";
import { useDemoTimeline } from "@/lib/hooks/use-demo-timeline";

export function DemoPhaseIndicator() {
  const { currentPhase, index, isReducedMotion } = useDemoTimeline();
  // Garde-fou local : même si la timeline n'expose pas isReducedMotion, on
  // s'appuie sur le hook framer-motion pour neutraliser le rendu.
  const reduce = useReducedMotion();

  // Mouvement réduit : aucun indicateur de progression (pas de feedback animé).
  if (isReducedMotion || reduce) {
    return null;
  }

  // 7 pastilles, numérotées de 1 à TOTAL_PHASES.
  const phases = Array.from({ length: TOTAL_PHASES }, (_, i) => i + 1);

  // Avancement global : (index du moment + 1) / nombre total de moments, borné.
  const totalMoments = MOMENT_SEQUENCE.length;
  const progress =
    totalMoments > 0
      ? Math.min(Math.max((index + 1) / totalMoments, 0), 1)
      : 0;

  // Kicker de la phase courante (libellé court en capitales).
  const kicker = PHASE_META[currentPhase]?.kicker ?? "";

  return (
    <footer
      data-testid="demo-phase-indicator"
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 bottom-0 flex flex-col items-center gap-2 py-4"
      style={{ zIndex: Z.footer }}
    >
      {/* Rangée de pastilles : une par phase. */}
      <div className="flex items-center gap-2">
        {phases.map((phase) => {
          const isCurrent = phase === currentPhase;
          const isPast = phase < currentPhase;

          // Phase courante : pastille allongée emerald pleine.
          // Phases passées : emerald atténué. Phases futures : gris discret.
          const dotClass = isCurrent
            ? "w-6 bg-emerald-400"
            : isPast
              ? "w-1.5 bg-emerald-400/40"
              : "w-1.5 bg-white/15";

          return (
            <motion.span
              key={phase}
              className={`h-1.5 rounded-full ${dotClass}`}
              // Transition douce de la largeur / couleur entre phases.
              transition={{ duration: 0.4, ease: EASE.out }}
              layout
            />
          );
        })}
      </div>

      {/* Kicker de la phase courante. */}
      <span className="text-[0.68rem] uppercase tracking-widest text-white/40">
        {kicker}
      </span>

      {/* Barre de progression fine, alignée sur la position dans la séquence. */}
      <div className="h-px w-40 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full bg-emerald-400/60"
          initial={false}
          animate={{ scaleX: progress }}
          style={{ transformOrigin: "left" }}
          transition={{ duration: 0.4, ease: EASE.out }}
        />
      </div>
    </footer>
  );
}
