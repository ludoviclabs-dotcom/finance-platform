"use client";

/**
 * PhaseShell — wrapper de scène commun à toutes les phases de la démo /demo.
 *
 * Conteneur centré + en-tête optionnel (kicker / titre / sous-titre), avec une
 * animation d'entrée framer-motion alignée sur le Reveal de la landing
 * (opacity 0 / y 16 → opacity 1 / y 0, sortie vers le haut).
 *
 * Composant PRÉSENTATIONNEL : il ne pilote pas la timeline. Le fond de grille
 * de la scène est géré en amont par DemoStage — on ne le rend surtout pas ici.
 *
 * prefers-reduced-motion : rendu de l'état final immédiatement, sans animation.
 */

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { EASE } from "@/components/demo/demo-tokens";

interface PhaseShellProps {
  /** Kicker en capitales (style emerald) au-dessus du titre. */
  kicker?: string;
  /** Titre principal de la scène. */
  title?: string;
  /** Sous-titre / accroche secondaire. */
  subtitle?: string;
  /** Contenu de la scène. */
  children: ReactNode;
  /** Classes additionnelles sur le conteneur. */
  className?: string;
  /** data-testid posé sur le conteneur racine. */
  testId?: string;
}

export function PhaseShell({
  kicker,
  title,
  subtitle,
  children,
  className,
  testId,
}: PhaseShellProps) {
  const reduce = useReducedMotion();
  const hasHeader = Boolean(kicker || title || subtitle);

  return (
    <motion.div
      data-testid={testId}
      className={`mx-auto w-full max-w-[1100px] px-5 sm:px-8${
        className ? ` ${className}` : ""
      }`}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: EASE.out }}
    >
      {hasHeader ? (
        <header className="mb-8">
          {kicker ? (
            <p className="text-[0.68rem] font-bold uppercase tracking-widest text-emerald-300/80">
              {kicker}
            </p>
          ) : null}
          {title ? (
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-white md:text-4xl">
              {title}
            </h2>
          ) : null}
          {subtitle ? (
            <p className="mt-2 max-w-2xl text-white/55">{subtitle}</p>
          ) : null}
        </header>
      ) : null}

      {children}
    </motion.div>
  );
}
