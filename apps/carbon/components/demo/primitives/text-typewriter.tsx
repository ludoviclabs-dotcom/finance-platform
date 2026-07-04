"use client";

/**
 * Effet « machine à écrire » autonome pour la démo cinématique /demo.
 *
 * Composant purement présentationnel : il révèle `text` caractère par
 * caractère, sans dépendre d'aucun autre composant de la démo. Il ne pilote
 * jamais la timeline — il se contente de tenir dans la durée du moment courant
 * via sa vitesse (`speedMs`).
 *
 * Accessibilité / mouvement réduit : sous prefers-reduced-motion, le texte
 * complet est affiché immédiatement et `onDone` est appelé une seule fois.
 * Tous les timers sont nettoyés au démontage.
 */

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

import { DEMO_CSS, TYPEWRITER_MS } from "@/components/demo/demo-tokens";

interface TextTypewriterProps {
  /** Texte à révéler caractère par caractère. */
  text: string;
  /** Délai entre deux caractères (ms). Défaut : TYPEWRITER_MS. */
  speedMs?: number;
  /** Délai avant le premier caractère (ms). Défaut : 0. */
  startDelayMs?: number;
  /** Classes appliquées au span conteneur. */
  className?: string;
  /** Affiche un caret clignotant (barre verticale) après le texte. Défaut : false. */
  showCaret?: boolean;
  /** Callback analytics appelé une fois la révélation terminée. */
  onDone?: () => void;
}

export function TextTypewriter({
  text,
  speedMs = TYPEWRITER_MS,
  startDelayMs = 0,
  className,
  showCaret = false,
  onDone,
}: TextTypewriterProps): React.JSX.Element {
  const prefersReducedMotion = useReducedMotion() ?? false;

  // Nombre de caractères actuellement révélés.
  const [count, setCount] = useState(0);

  // Garde le dernier onDone sans relancer l'effet d'animation.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    // Mouvement réduit : on rend l'état final immédiatement, une seule notif.
    if (prefersReducedMotion) {
      setCount(text.length);
      onDoneRef.current?.();
      return;
    }

    // (Re)démarrage de la révélation à chaque changement de texte / réglages.
    setCount(0);

    const timers: ReturnType<typeof setTimeout>[] = [];
    let done = false;

    const step = (next: number): void => {
      setCount(next);
      if (next >= text.length) {
        if (!done) {
          done = true;
          onDoneRef.current?.();
        }
        return;
      }
      timers.push(setTimeout(() => step(next + 1), speedMs));
    };

    // Premier caractère après le délai d'amorçage.
    timers.push(setTimeout(() => step(1), startDelayMs));

    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [text, speedMs, startDelayMs, prefersReducedMotion]);

  return (
    <span className={className}>
      {text.slice(0, count)}
      {showCaret ? (
        <span className={DEMO_CSS.cursorBlink} aria-hidden="true">
          |
        </span>
      ) : null}
    </span>
  );
}
