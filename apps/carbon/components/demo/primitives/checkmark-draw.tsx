"use client";

// Primitive SVG : un checkmark qui se « dessine » au montage via la classe
// DEMO_CSS.checkDraw (animation de tracé définie dans globals.css, neutralisée
// sous prefers-reduced-motion). En mouvement réduit, on rend directement le
// chemin plein (strokeDashoffset 0) sans appliquer la classe d'animation.

import { useReducedMotion } from "framer-motion";

import { DEMO_CSS } from "@/components/demo/demo-tokens";

type CheckmarkDrawProps = {
  /** Taille en pixels du carré SVG (largeur = hauteur). Défaut 20. */
  size?: number;
  /** Couleur du tracé. Défaut #34D399 (emerald-400). */
  color?: string;
  /** Épaisseur du tracé. Défaut 2.6. */
  strokeWidth?: number;
  /** Délai (ms) avant le démarrage du tracé. Défaut 0. */
  delayMs?: number;
  /** Classes additionnelles sur le svg. */
  className?: string;
};

export function CheckmarkDraw({
  size = 20,
  color = "#34D399",
  strokeWidth = 2.6,
  delayMs = 0,
  className,
}: CheckmarkDrawProps) {
  const reduce = useReducedMotion();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M5 13l4 4L19 7"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        // En mouvement réduit : pas d'animation, chemin plein immédiat.
        className={reduce ? undefined : DEMO_CSS.checkDraw}
        style={
          reduce
            ? { strokeDashoffset: 0 }
            : { animationDelay: `${delayMs}ms` }
        }
      />
    </svg>
  );
}
