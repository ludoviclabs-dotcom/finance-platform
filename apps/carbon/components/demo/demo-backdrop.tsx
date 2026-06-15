"use client";

/**
 * DemoBackdrop — fond de scène cinématique multi-couches de la démo /demo.
 *
 * Remplace l'ancienne grille plate par un décor « cockpit » vivant mais sobre :
 *   1. nappes « aurora » emerald/cyan qui dérivent lentement (carbon-aurora) ;
 *   2. un spotlight radial qui SUIT la phase courante (gauche → droite),
 *      reliant subtilement le fond au récit (framer-motion) ;
 *   3. une grille fine en lente dérive (carbon-grid-drift) masquée en vignette ;
 *   4. un voile de bruit très discret (anti-banding) ;
 *   5. une vignette haut/bas pour ancrer le contenu.
 *
 * Composant PRÉSENTATIONNEL : il LIT `currentPhase` via la timeline mais ne la
 * pilote jamais. `aria-hidden` + pointer-events-none : purement décoratif.
 *
 * prefers-reduced-motion : aucune classe d'animation n'est appliquée et le
 * spotlight est figé au centre (la timeline expose `isReducedMotion`).
 */

import { motion } from "framer-motion";

import { useDemoTimeline } from "@/lib/hooks/use-demo-timeline";
import { DEMO_CSS, DEMO_GRID_BACKGROUND, EASE } from "@/components/demo/demo-tokens";
import { TOTAL_PHASES } from "@/components/demo/demo-types";

/** Voile de bruit en SVG inline (anti-banding), encodé en data-URI. */
const NOISE_DATA_URI =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

export function DemoBackdrop() {
  const { currentPhase, isReducedMotion } = useDemoTimeline();

  // Position horizontale du spotlight selon la phase (0 → 100 %). En mouvement
  // réduit on le fige au centre (50 %).
  const spotlightX = isReducedMotion
    ? 50
    : 12 + ((currentPhase - 1) / (TOTAL_PHASES - 1)) * 76;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ backgroundColor: "#070909" }}
    >
      {/* (1) Nappes aurora qui dérivent — emerald (gauche) + cyan (droite). */}
      <div
        className={`absolute -left-[12%] top-[-18%] h-[62vh] w-[62vh] rounded-full blur-[120px] ${
          isReducedMotion ? "" : DEMO_CSS.aurora
        }`}
        style={{
          background:
            "radial-gradient(circle at center, rgba(16,185,129,0.22), transparent 68%)",
        }}
      />
      <div
        className={`absolute right-[-10%] bottom-[-20%] h-[58vh] w-[58vh] rounded-full blur-[130px] ${
          isReducedMotion ? "" : DEMO_CSS.aurora
        }`}
        style={{
          background:
            "radial-gradient(circle at center, rgba(34,211,238,0.16), transparent 70%)",
          animationDelay: "-9s",
        }}
      />

      {/* (2) Spotlight narratif : suit la phase courante. */}
      <motion.div
        className="absolute inset-0"
        initial={false}
        animate={{
          background: `radial-gradient(120vh 90vh at ${spotlightX}% 28%, rgba(52,211,153,0.10), transparent 60%)`,
        }}
        transition={
          isReducedMotion ? { duration: 0 } : { duration: 1.1, ease: EASE.out }
        }
      />

      {/* (3) Grille fine en dérive lente, masquée en vignette pour fondre les bords. */}
      <div
        className={`absolute inset-0 opacity-[0.5] ${
          isReducedMotion ? "" : DEMO_CSS.gridDrift
        }`}
        style={{
          ...DEMO_GRID_BACKGROUND,
          WebkitMaskImage:
            "radial-gradient(ellipse 95% 80% at 50% 38%, #000 35%, transparent 82%)",
          maskImage:
            "radial-gradient(ellipse 95% 80% at 50% 38%, #000 35%, transparent 82%)",
        }}
      />

      {/* (4) Voile de bruit très discret (anti-banding sur les dégradés). */}
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-soft-light"
        style={{ backgroundImage: NOISE_DATA_URI }}
      />

      {/* (5) Vignette haut/bas : ancre le header et le footer. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(7,9,9,0.55) 0%, transparent 18%, transparent 80%, rgba(7,9,9,0.7) 100%)",
        }}
      />
    </div>
  );
}
