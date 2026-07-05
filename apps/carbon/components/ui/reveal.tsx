"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Scroll-reveal partagé (extrait de landing-page.tsx).
 *
 * Historique : le hook d'origine initialisait `visible` à true (commit 66ce7ea),
 * ce qui neutralisait l'animation sur toute la landing. La version partagée
 * restaure le comportement voulu — invisible jusqu'au premier passage dans le
 * viewport — avec les garde-fous qui manquaient :
 *   - navigateur sans IntersectionObserver → contenu visible immédiatement ;
 *   - `once` : l'observer se déconnecte après révélation (pas de re-jeu) ;
 *   - prefers-reduced-motion (réglage OS) → aucun décalage, aucune transition.
 */
export function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          observer.disconnect(); // once : plus rien à observer après révélation
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, visible };
}

export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, visible } = useReveal();
  const prefersReducedMotion = useReducedMotion();
  // Quand l'utilisateur a activé prefers-reduced-motion (réglage OS), on saute
  // l'animation : le contenu est visible immédiatement, sans transition.
  const shown = prefersReducedMotion || visible;
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(32px)",
        transition: prefersReducedMotion
          ? "none"
          : `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}
