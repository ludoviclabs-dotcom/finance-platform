"use client";

/**
 * DemoStage — scène plein écran de la démo cinématique /demo.
 *
 * Conteneur racine de la démo : fond sombre, overlay de grille décoratif, et
 * rendu de la PHASE COURANTE (1→7) au centre de l'écran. La phase visible est
 * lue depuis la timeline (`currentPhase`) ; le changement de phase déclenche une
 * transition de fondu/glissement via AnimatePresence (mode « wait » : la phase
 * sortante s'efface avant que l'entrante n'apparaisse).
 *
 * Composant PRÉSENTATIONNEL : il NE pilote PAS la progression — l'horloge de
 * useDemoTimeline() auto-avance toute seule. DemoStage se contente de refléter
 * `currentPhase` et de remonter la scène à chaque relecture (`runId`).
 *
 * Le fond de grille est géré ICI (et nulle part ailleurs) : les PhaseShell ne le
 * rendent surtout pas, pour éviter les doublons.
 *
 * prefers-reduced-motion : pas d'animation de transition entre phases (on rend
 * directement la phase courante, sans fondu ni glissement). On s'appuie sur
 * `isReducedMotion` exposé par la timeline.
 */

import { AnimatePresence, motion } from "framer-motion";

import { useDemoTimeline } from "@/lib/hooks/use-demo-timeline";
import { DEMO_COLORS, DEMO_GRID_BACKGROUND, EASE } from "@/components/demo/demo-tokens";
import { DemoPhase1Intro } from "@/components/demo/phases/demo-phase-1-intro";
import { DemoPhase2Import } from "@/components/demo/phases/demo-phase-2-import";
import { DemoPhase3Mapping } from "@/components/demo/phases/demo-phase-3-mapping";
import { DemoPhase4Anomalies } from "@/components/demo/phases/demo-phase-4-anomalies";
import { DemoPhase5AuditTrail } from "@/components/demo/phases/demo-phase-5-audit-trail";
import { DemoPhase6Export } from "@/components/demo/phases/demo-phase-6-export";
import { DemoPhase7Cta } from "@/components/demo/phases/demo-phase-7-cta";

/** Rend la phase correspondant au numéro courant (1→7). */
function renderPhase(phase: number) {
  switch (phase) {
    case 1:
      return <DemoPhase1Intro />;
    case 2:
      return <DemoPhase2Import />;
    case 3:
      return <DemoPhase3Mapping />;
    case 4:
      return <DemoPhase4Anomalies />;
    case 5:
      return <DemoPhase5AuditTrail />;
    case 6:
      return <DemoPhase6Export />;
    case 7:
      return <DemoPhase7Cta />;
    default:
      // Par sécurité : on retombe sur la scène d'ouverture.
      return <DemoPhase1Intro />;
  }
}

export function DemoStage() {
  const { currentPhase, runId, isReducedMotion } = useDemoTimeline();

  return (
    <div
      data-testid="demo-stage"
      className="relative w-full min-h-screen"
      style={{ backgroundColor: DEMO_COLORS.bg }}
    >
      {/* Overlay de grille décoratif (non interactif), géré uniquement ici. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-50"
        style={DEMO_GRID_BACKGROUND}
      />

      {/* Zone de contenu centrée. Le padding haut/bas réserve la place du header
          fixe (en haut) et du footer indicateur de phases (en bas). */}
      <div className="relative flex items-center justify-center min-h-screen px-4 pt-24 pb-28">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            // Clé combinant la phase ET le runId : une relecture (replay) change
            // runId et force le remontage complet de la scène.
            key={"p" + currentPhase + "-" + runId}
            className="w-full"
            initial={isReducedMotion ? false : { opacity: 0, y: 12 }}
            animate={isReducedMotion ? undefined : { opacity: 1, y: 0 }}
            exit={isReducedMotion ? undefined : { opacity: 0, y: -12 }}
            transition={
              isReducedMotion
                ? { duration: 0 }
                : { duration: 0.4, ease: EASE.out }
            }
          >
            {renderPhase(currentPhase)}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
