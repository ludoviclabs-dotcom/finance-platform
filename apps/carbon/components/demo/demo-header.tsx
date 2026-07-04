"use client";

/**
 * DemoHeader — barre supérieure « cockpit » de la démo cinématique /demo.
 *
 * Composant présentationnel : il lit l'état de l'horloge via useDemoTimeline()
 * et expose les contrôles globaux + un SCRUBBER DE CHAPITRES interactif (façon
 * lecteur vidéo) :
 *   • Gauche  : logo Carbon&Co + pastille « DÉMO · LIVE ».
 *   • Centre  : 7 chapitres cliquables (un par phase) avec une jauge de
 *               progression par chapitre ; cliquer effectue un « seek » vers la
 *               phase (seekToPhase). Masqué sous le breakpoint sm.
 *   • Droite  : lecture/pause (masqué une fois terminé), durée totale, « Passer ».
 *
 * Il ne pilote jamais la progression temporelle automatique : l'auto-avancement
 * reste géré par le hook. Le seek est une action utilisateur explicite.
 */

import { Pause, Play, SkipForward } from "lucide-react";

import { EASE, MOMENT_DURATIONS, Z } from "@/components/demo/demo-tokens";
import {
  MOMENT_SEQUENCE,
  PHASE_META,
  PHASE_OF_MOMENT,
  TOTAL_PHASES,
  type DemoPhase,
} from "@/components/demo/demo-types";
import { useDemoTimeline } from "@/lib/hooks/use-demo-timeline";
import { motion } from "framer-motion";

/** Bornes [premier, dernier] index de moment pour chaque phase (calcul unique). */
const PHASE_BOUNDS: Record<number, { first: number; last: number }> = (() => {
  const bounds: Record<number, { first: number; last: number }> = {};
  MOMENT_SEQUENCE.forEach((moment, index) => {
    const phase = PHASE_OF_MOMENT[moment];
    if (!bounds[phase]) bounds[phase] = { first: index, last: index };
    else bounds[phase].last = index;
  });
  return bounds;
})();

/** Durée totale (mm:ss) de la démo, calculée depuis MOMENT_DURATIONS. */
const TOTAL_LABEL = (() => {
  const totalMs = MOMENT_SEQUENCE.reduce(
    (sum, moment) => sum + MOMENT_DURATIONS[moment],
    0,
  );
  const totalSec = Math.round(totalMs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
})();

/** Taux de remplissage [0..1] du chapitre `phase` selon l'index courant. */
function chapterFill(phase: DemoPhase, index: number): number {
  const { first, last } = PHASE_BOUNDS[phase];
  if (index > last) return 1;
  if (index < first) return 0;
  return (index - first + 1) / (last - first + 1);
}

const PHASES: DemoPhase[] = Array.from(
  { length: TOTAL_PHASES },
  (_, i) => (i + 1) as DemoPhase,
);

export function DemoHeader(): React.JSX.Element {
  const {
    status,
    isComplete,
    currentPhase,
    index,
    isReducedMotion,
    togglePause,
    skip,
    seekToPhase,
    goToPhase,
  } = useDemoTimeline();

  const isPlaying = status === "playing";

  // Clic sur un chapitre :
  //   • lecture nominale → « seek » qui relance l'horloge à la phase (DemoStage) ;
  //   • mouvement réduit → DemoExperience rend le DemoStaticSnapshot (pile
  //     scrollable). On reproduit alors son comportement : on défile vers la
  //     section #demo-phase-N et on synchronise la phase courante (goToPhase).
  const handleChapter = (phase: DemoPhase) => {
    if (isReducedMotion) {
      if (typeof document !== "undefined") {
        document
          .getElementById(`demo-phase-${phase}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      goToPhase(phase);
      return;
    }
    seekToPhase(phase);
  };

  return (
    <header
      className="pointer-events-none fixed inset-x-0 top-0 flex items-center gap-4 px-5 py-3 sm:px-8"
      style={{ zIndex: Z.header }}
    >
      {/* Gauche — logo + pastille LIVE. */}
      <div className="flex shrink-0 items-center gap-2.5">
        <span className="text-xl font-extrabold tracking-tighter text-white">
          Carbon<span className="text-emerald-400">&amp;Co</span>
        </span>
        <span className="hidden items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-widest text-emerald-200 sm:inline-flex">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-emerald-400 how-live-dot"
          />
          Démo
        </span>
      </div>

      {/* Centre — scrubber de chapitres (desktop). */}
      <nav
        aria-label="Chapitres de la démonstration"
        className="pointer-events-auto hidden flex-1 items-end gap-1.5 md:flex"
      >
        {PHASES.map((phase) => {
          const fill = chapterFill(phase, index);
          const isCurrent = phase === currentPhase;
          return (
            <button
              key={phase}
              type="button"
              onClick={() => handleChapter(phase)}
              aria-label={`Aller au chapitre ${phase} — ${PHASE_META[phase].label}`}
              aria-current={isCurrent ? "step" : undefined}
              className="group flex min-w-0 flex-1 flex-col gap-1.5"
            >
              <span
                className={`flex items-baseline gap-1 truncate text-[0.6rem] font-bold uppercase tracking-widest transition-colors ${
                  isCurrent
                    ? "text-emerald-200"
                    : "text-white/35 group-hover:text-white/70"
                }`}
              >
                <span className="font-mono">{String(phase).padStart(2, "0")}</span>
                <span className="truncate">{PHASE_META[phase].label}</span>
              </span>
              <span className="h-[3px] w-full overflow-hidden rounded-full bg-white/10">
                <motion.span
                  className="block h-full origin-left rounded-full bg-emerald-400"
                  initial={false}
                  animate={{ scaleX: fill }}
                  transition={{ duration: 0.45, ease: EASE.out }}
                />
              </span>
            </button>
          );
        })}
      </nav>

      {/* Spacer pour pousser les contrôles à droite quand le scrubber est masqué. */}
      <div className="flex-1 md:hidden" />

      {/* Droite — contrôles globaux. */}
      <div className="pointer-events-auto flex shrink-0 items-center gap-2">
        {/* Compteur de phase compact (mobile) + durée totale (desktop). */}
        <span className="font-mono text-xs text-white/40 md:hidden">
          {currentPhase}/{TOTAL_PHASES}
        </span>
        <span className="hidden font-mono text-xs text-white/35 lg:inline">
          ≈ {TOTAL_LABEL}
        </span>

        {!isComplete ? (
          <button
            type="button"
            onClick={togglePause}
            aria-label={
              isPlaying
                ? "Mettre la démonstration en pause"
                : "Reprendre la démonstration"
            }
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/10"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Play className="h-4 w-4" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">{isPlaying ? "Pause" : "Lecture"}</span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={skip}
          aria-label="Passer la démonstration et accéder à l'offre"
          data-testid="demo-skip"
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/10"
        >
          <span className="hidden sm:inline">Passer</span>
          <SkipForward className="h-4 w-4 sm:hidden" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
