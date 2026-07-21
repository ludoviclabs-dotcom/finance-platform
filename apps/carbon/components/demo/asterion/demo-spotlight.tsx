"use client";

/**
 * DemoSpotlight — met en valeur un contenu (halo + légère élévation) sans gêner
 * la lecture. Désactivé sous prefers-reduced-motion (rendu statique).
 */

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

export function DemoSpotlight({
  active = true,
  children,
  className = "",
}: {
  active?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  // Animation UNE FOIS au montage puis stabilisée (scale/opacité convergent vers
  // une cible constante) : évite une animation perpétuelle qui empêcherait
  // l'interaction (Playwright « waiting for stable »). Le halo est en CSS (ring).
  return (
    <motion.div
      data-testid="demo-spotlight"
      data-active={active}
      initial={reduce ? false : { opacity: 0.92, scale: 0.995 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reduce ? 0 : 0.24, ease: "easeOut" }}
      className={`rounded-2xl ${active ? "ring-1 ring-carbon-emerald/25" : ""} ${className}`}
    >
      {children}
    </motion.div>
  );
}
