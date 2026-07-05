"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";

/**
 * Compteur animé unifié — remplace les trois implémentations historiques
 * (CountUp de landing-page.tsx, AnimatedCounter mount-only, AnimatedNumber
 * de components/materials). Un seul composant, trois garanties :
 *   - déclenchement au premier passage dans le viewport (once, désactivable
 *     via startOnView={false} pour retrouver le départ au montage) ;
 *   - prefers-reduced-motion → valeur finale affichée immédiatement ;
 *   - format fr-FR (séparateurs de milliers, décimales contrôlées).
 */
interface AnimatedCounterProps {
  value: number;
  /** Durée de l'animation en secondes. */
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  /** true (défaut) : démarre au premier passage dans le viewport ; false : au montage. */
  startOnView?: boolean;
}

export function AnimatedCounter({
  value,
  duration = 1.2,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
  startOnView = true,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(0);
  const shouldStart = !startOnView || inView;

  useEffect(() => {
    if (!shouldStart) return;
    if (reduce) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [shouldStart, reduce, value, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display.toLocaleString("fr-FR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
