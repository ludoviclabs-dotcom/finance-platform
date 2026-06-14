/**
 * Démo cinématique /demo — langage de mouvement & tokens visuels.
 *
 * Source de vérité unique pour : durées de chaque moment (qui pilotent
 * l'horloge dans use-demo-timeline.ts), couleurs JS-side (framer-motion),
 * courbes d'easing, échelle de z-index, et noms des classes CSS d'animation
 * (définies dans app/globals.css). Tout composant de components/demo/ tire
 * ses valeurs d'ici pour garantir la cohérence visuelle.
 */

import type { DemoMoment } from "./demo-types";

/* ────────────────────────────────────────────────────────────────────────────
   DURÉES DES MOMENTS (ms) — pilotent l'auto-avancement de la timeline.
   Total ≈ 104 s (hors moment terminal "cta-final").
   ──────────────────────────────────────────────────────────────────────────── */

export const MOMENT_DURATIONS: Record<DemoMoment, number> = {
  // Phase 1 — Intro (~9 s)
  "intro-neural-appear": 4500,
  "intro-prompt-import": 4500,
  // Phase 2 — Import (~18 s)
  "import-file-pick": 4000,
  "import-rows-stream": 9000,
  "import-complete": 5000,
  // Phase 3 — Mapping (~29 s)
  "mapping-rows-fade": 4000,
  "mapping-factors-attach": 5000,
  "mapping-neural-validation": 7000, // Feature D
  "mapping-counter": 7000, // compteur GES → ~1 847
  "mapping-audit-trace": 6000, // Feature A
  // Phase 4 — Anomalies (~13 s)
  "anomalies-detected": 7000,
  "anomalies-corrected": 6000,
  // Phase 5 — Audit trail (~13 s)
  "audit-trail-events": 13000,
  // Phase 6 — Export (~22 s)
  "export-prepare": 4000,
  "export-checkmarks": 4000,
  "export-proof-chain": 6000, // Feature B
  "export-verify-card": 8000, // Feature C
  // Phase 7 — terminal (pas de timer)
  "cta-final": 0,
};

/* ────────────────────────────────────────────────────────────────────────────
   COULEURS (JS-side, pour framer-motion / styles inline)
   Alignées sur les tokens --carbon-* de globals.css.
   ──────────────────────────────────────────────────────────────────────────── */

export const DEMO_COLORS = {
  /** Fond de scène plein écran (identique au mockup démo de la landing). */
  bg: "#070909",
  bgRaised: "#0c1011",
  emerald: "#34D399", // emerald-400 — accent principal
  emeraldDeep: "#059669", // emerald-600
  emeraldText: "#A7F3D0", // emerald-200
  cyan: "#22D3EE", // cyan-400
  amber: "#FBBF24", // amber-400
  amberText: "#FCD34D",
  white: "#FFFFFF",
  line: "rgba(255,255,255,0.10)", // border-white/10
  lineStrong: "rgba(255,255,255,0.20)",
  haloRgb: "52, 211, 153", // = emerald-400, pour rgba(...) dynamiques
} as const;

/* ────────────────────────────────────────────────────────────────────────────
   EASINGS & TRANSITIONS (framer-motion)
   ──────────────────────────────────────────────────────────────────────────── */

export const EASE = {
  /** cubic-bezier "soft out" — cohérent avec le Reveal de la landing. */
  out: [0.16, 1, 0.3, 1] as const,
  inOut: [0.65, 0, 0.35, 1] as const,
  in: [0.4, 0, 1, 1] as const,
} as const;

export const SPRING = {
  /** Pop d'entrée des blocs (chaîne de preuve, cards). */
  pop: { type: "spring" as const, stiffness: 320, damping: 26 },
  /** Slide-up doux (encadrés, bottom sheets). */
  sheet: { type: "spring" as const, stiffness: 280, damping: 30 },
} as const;

/** Durées de micro-animations (s) pour framer-motion. */
export const DUR = {
  fast: 0.2,
  base: 0.3,
  slow: 0.5,
  stagger: 0.08,
  /** Stagger plus marqué pour la cascade de la Feature A. */
  cascade: 0.2,
} as const;

/** Vitesse du typewriter (ms / caractère). */
export const TYPEWRITER_MS = 28;

/* ────────────────────────────────────────────────────────────────────────────
   Z-INDEX (dans le contexte plein écran de /demo)
   ──────────────────────────────────────────────────────────────────────────── */

export const Z = {
  stage: 0,
  footer: 10,
  header: 20,
  feature: 30,
  modal: 40,
} as const;

/* ────────────────────────────────────────────────────────────────────────────
   NOMS DES CLASSES CSS D'ANIMATION (définies dans app/globals.css)
   Neutralisées sous prefers-reduced-motion.
   ──────────────────────────────────────────────────────────────────────────── */

export const DEMO_CSS = {
  checkDraw: "carbon-check-draw",
  badgeIn: "carbon-badge-in",
  badgeOut: "carbon-badge-out",
  neuralPulse: "carbon-neural-pulse",
  haloPulse: "carbon-halo-pulse",
  gesGlow: "carbon-ges-glow",
  proofGlow: "carbon-proof-glow",
  cursorBlink: "carbon-cursor-blink",
} as const;

/** Motif de grille du fond de scène (repris de ProductDemoSection). */
export const DEMO_GRID_BACKGROUND = {
  backgroundImage:
    "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(180deg, rgba(20,184,166,0.10), transparent 34%, rgba(22,163,74,0.06))",
  backgroundSize: "72px 72px, 72px 72px, 100% 100%",
} as const;
