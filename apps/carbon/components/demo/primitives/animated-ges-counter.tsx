"use client";

// Primitive présentationnelle : un compteur GES (gaz à effet de serre) qui
// s'anime de 0 jusqu'à `target` via requestAnimationFrame avec un easing
// « ease-out cubique » (1 - (1 - p)^3). Le composant ne pilote PAS la
// progression de la timeline : il réagit à la prop `active` (passée par son
// parent) et anime UNE seule fois quand celle-ci devient vraie, le temps
// imparti au moment courant (durationMs).
//
// Sous prefers-reduced-motion : on affiche directement `target`, sans aucune
// animation d'entrée ni requestAnimationFrame.

import { useEffect, useRef, useState } from "react";

import { useReducedMotion } from "framer-motion";

import { DEMO_CSS } from "@/components/demo/demo-tokens";

type AnimatedGesCounterProps = {
  /** Valeur finale à atteindre (le total GES). */
  target: number;
  /** Unité affichée à droite du nombre (ex. « tCO₂e »). */
  unit?: string;
  /**
   * Déclencheur : quand cette prop passe à `true` (une seule fois), le compte
   * de 0 → target démarre. Tant qu'elle est `false`, on reste à 0.
   */
  active: boolean;
  /** Durée du décompte en millisecondes. Défaut 5000. */
  durationMs?: number;
  /** Applique le halo lumineux (gesGlow + haloPulse) autour du compteur. */
  glow?: boolean;
  /** Classes additionnelles sur le conteneur racine. */
  className?: string;
};

// Formateur français mémoïsé au niveau module (évite de recréer l'instance
// Intl.NumberFormat à chaque frame d'animation).
const FR_NUMBER_FORMAT = new Intl.NumberFormat("fr-FR");

function formatGes(value: number): string {
  return FR_NUMBER_FORMAT.format(Math.round(value));
}

export function AnimatedGesCounter({
  target,
  unit,
  active,
  durationMs = 5000,
  glow = false,
  className,
}: AnimatedGesCounterProps) {
  // useReducedMotion() renvoie null au premier rendu puis false : on normalise
  // en booléen stable pour éviter une transition null→false qui, combinée au
  // garde-fou hasRunRef, annulerait le requestAnimationFrame et figerait le
  // compteur à 0 (le décompte démarre, le cleanup l'annule, puis le garde bloque
  // le redémarrage).
  const reduce = useReducedMotion() ?? false;

  // Valeur affichée : en mouvement réduit, on part directement de la cible.
  const [value, setValue] = useState(() => (reduce ? target : 0));

  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Mouvement réduit : état final immédiat, aucun raf.
    if (reduce) {
      setValue(target);
      return;
    }

    // On attend l'activation. L'effet est volontairement IDEMPOTENT : aucun
    // garde-fou « une seule fois » (qui, combiné au cleanup, figerait le
    // compteur à 0 sous le double montage de React StrictMode en dev — setup,
    // cleanup, setup). La rejouabilité reste assurée par le remontage du
    // composant (clé runId du parent), qui repart naturellement de 0.
    if (!active) {
      return;
    }

    // (Re)démarre proprement le décompte depuis 0.
    setValue(0);
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const p = durationMs > 0 ? Math.min(elapsed / durationMs, 1) : 1;
      // Easing ease-out cubique : départ rapide, ralentissement final.
      const eased = 1 - (1 - p) ** 3;
      setValue(target * eased);

      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Garantit la valeur finale exacte (sans erreur d'arrondi flottant).
        setValue(target);
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [active, durationMs, reduce, target]);

  // Nettoyage défensif au démontage (couvre tout raf encore en vol).
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  const glowClasses = glow
    ? `rounded-2xl px-8 py-6 ${DEMO_CSS.gesGlow} ${DEMO_CSS.haloPulse}`
    : "";

  return (
    <div
      data-testid="demo-ges-counter"
      className={[
        "inline-flex items-baseline gap-3",
        glowClasses,
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="text-6xl font-extrabold tracking-tighter text-white tabular-nums md:text-7xl">
        {formatGes(value)}
      </span>
      {unit ? (
        <span className="text-2xl font-semibold text-emerald-300/80">
          {unit}
        </span>
      ) : null}
    </div>
  );
}
