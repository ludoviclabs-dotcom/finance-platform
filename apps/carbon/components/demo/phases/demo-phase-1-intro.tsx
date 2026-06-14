"use client";

// PHASE 1 — Intro.
//
// Scène d'ouverture de la démo cinématique /demo : la marque Carbon&Co se révèle
// au centre de l'écran, le moteur NEURAL « s'allume », puis un champ d'import
// stylisé annonce la suite (collecte du tableur).
//
// Composant PRÉSENTATIONNEL : il lit `currentMoment` via useDemoTimeline() et
// affiche/anime les éléments selon le moment courant — il ne pilote JAMAIS la
// progression (l'horloge auto-avance toute seule).
//
//   • intro-neural-appear : la marque + l'icône NEURAL + la pastille d'état
//     apparaissent (fade/scale).
//   • intro-prompt-import : un champ « Importer un fichier… » + le nom du fichier
//     démo se révèle en dessous, curseur clignotant.
//
// prefers-reduced-motion : on rend directement l'ÉTAT FINAL (tout visible, sans
// animation d'entrée). Aucun timer n'est posé ici (la scène est statique).

import { motion, useReducedMotion } from "framer-motion";

import { PhaseShell } from "@/components/demo/phases/phase-shell";
import { useDemoTimeline } from "@/lib/hooks/use-demo-timeline";
import {
  DEMO_FILE,
  isMoment,
  isMomentAtOrAfter,
} from "@/components/demo/demo-types";
import { DEMO_CSS, EASE } from "@/components/demo/demo-tokens";

/**
 * Icône NEURAL réutilisable (étoile à 8 branches + cœur), tracée en emerald-400.
 * `aria-hidden` car purement décorative.
 */
function NeuralMark({ size = 72 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#34D399"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function DemoPhase1Intro() {
  const reduce = useReducedMotion();
  const { currentMoment } = useDemoTimeline();

  // Sous mouvement réduit, on force l'état final : tout est visible d'emblée.
  const neuralVisible =
    reduce || isMomentAtOrAfter(currentMoment, "intro-neural-appear");
  const promptVisible =
    reduce || isMomentAtOrAfter(currentMoment, "intro-prompt-import");
  // Le champ d'import est « actif » pile au moment où on invite à importer :
  // bordure renforcée (border-white/15) tant qu'on reste sur ce moment précis.
  const promptActive = !reduce && isMoment(currentMoment, "intro-prompt-import");

  // Transition d'entrée commune (fade + léger scale/translate), neutralisée
  // sous mouvement réduit.
  const fadeScale = (delay = 0) =>
    reduce
      ? { initial: false as const }
      : {
          initial: { opacity: 0, scale: 0.94, y: 8 },
          animate: { opacity: 1, scale: 1, y: 0 },
          transition: { duration: 0.55, ease: EASE.out, delay },
        };

  return (
    <PhaseShell testId="demo-phase-1">
      {/* Scène centrée verticalement (le conteneur parent fournit la hauteur). */}
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        {/* Icône NEURAL dans un halo emerald — apparaît au moment NEURAL. */}
        {neuralVisible ? (
          <motion.div
            key="neural-mark"
            data-testid="demo-intro-neural"
            className={`flex h-[136px] w-[136px] items-center justify-center rounded-full bg-emerald-400/10 ${
              reduce ? "" : DEMO_CSS.haloPulse
            }`}
            {...fadeScale(0)}
          >
            <NeuralMark size={72} />
          </motion.div>
        ) : null}

        {/* Titre de marque : Carbon + & emerald + Co. */}
        <h1 className="mt-8 text-5xl font-extrabold tracking-tight text-white">
          Carbon<span className="text-emerald-400">&amp;</span>Co
        </h1>

        {/* Accroche. */}
        <p className="mt-3 max-w-xl text-white/55">
          Du tableur au rapport auditable — en 100 secondes.
        </p>

        {/* Pastille d'état NEURAL — apparaît avec l'icône (moment NEURAL). */}
        {neuralVisible ? (
          <motion.p
            key="neural-pill"
            className="mt-5 font-mono text-xs text-emerald-300"
            {...fadeScale(0.15)}
          >
            NEURAL Actif · v2.4 · ESRS native
          </motion.p>
        ) : null}

        {/* Champ d'import stylisé — apparaît au moment « prompt import ». */}
        {promptVisible ? (
          <motion.div
            key="import-prompt"
            data-testid="demo-intro-prompt"
            className={`mt-10 inline-flex items-center gap-2 rounded-xl border bg-white/[0.04] px-4 py-3 transition-colors ${
              promptActive ? "border-white/15" : "border-white/10"
            }`}
            {...fadeScale(reduce ? 0 : 0.1)}
          >
            <span className="text-sm text-white/55">Importer un fichier…</span>
            <span className="font-mono text-sm text-emerald-300">
              {DEMO_FILE}
            </span>
            {/* Curseur clignotant (neutralisé sous mouvement réduit via la classe). */}
            <span
              aria-hidden="true"
              className={`inline-block h-4 w-[2px] translate-y-[1px] bg-emerald-300 ${
                reduce ? "opacity-100" : DEMO_CSS.cursorBlink
              }`}
            />
          </motion.div>
        ) : null}
      </div>
    </PhaseShell>
  );
}
