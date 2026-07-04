"use client";

// Primitive : « expansion » d'un hash. On affiche d'abord l'URL tronquée
// (basePath + hash court + caractère de suspension), puis on « tape » un à un
// les caractères restants du hash complet jusqu'à révéler l'URL entière
// (basePath + hash complet). Logique de frappe AUTONOME (n'importe pas
// text-typewriter). Léger scale à l'entrée via framer-motion. Sous
// prefers-reduced-motion : URL complète rendue directement, sans animation.

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { EASE, TYPEWRITER_MS } from "@/components/demo/demo-tokens";

type HashTypewriterProps = {
  /** Hash court (préfixe du hash complet) affiché avant la frappe. */
  shortHash: string;
  /** Hash complet révélé caractère par caractère. */
  fullHash: string;
  /** Préfixe d'URL devant le hash. Défaut "/demo/verify/sha256-". */
  basePath?: string;
  /** Cadence de frappe en millisecondes par caractère. Défaut TYPEWRITER_MS. */
  speedMs?: number;
  /** Classes additionnelles sur le conteneur. */
  className?: string;
  /** Callback optionnel (analytics) appelé une fois l'URL complète affichée. */
  onDone?: () => void;
};

/** Caractère de suspension affiché tant que le hash n'est pas complet. */
const ELLIPSIS = "…";

export function HashTypewriter({
  shortHash,
  fullHash,
  basePath = "/demo/verify/sha256-",
  speedMs = TYPEWRITER_MS,
  className,
  onDone,
}: HashTypewriterProps) {
  const reduce = useReducedMotion() ?? false;

  // Indice du dernier caractère « tapé » au-delà de la longueur du hash court.
  // 0 => seul le hash court (+ suspension) est visible ; à terme on atteint
  // fullHash.length - shortHash.length pour révéler la totalité.
  const remaining = Math.max(0, fullHash.length - shortHash.length);
  const [typed, setTyped] = useState(reduce ? remaining : 0);

  // Réf stable du callback pour ne pas relancer l'effet à chaque rendu.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    // Mouvement réduit : état final immédiat, aucun timer.
    if (reduce) {
      setTyped(remaining);
      onDoneRef.current?.();
      return;
    }

    setTyped(0);

    // Rien à taper : l'URL est déjà complète.
    if (remaining === 0) {
      onDoneRef.current?.();
      return;
    }

    let count = 0;
    const interval = window.setInterval(() => {
      count += 1;
      setTyped(count);
      if (count >= remaining) {
        window.clearInterval(interval);
        onDoneRef.current?.();
      }
    }, Math.max(1, speedMs));

    return () => window.clearInterval(interval);
  }, [reduce, remaining, speedMs, fullHash, shortHash]);

  const done = typed >= remaining;
  // Pendant la frappe : hash court + caractères tapés + suspension.
  // Une fois terminé : hash complet, sans suspension.
  const revealed = done
    ? fullHash
    : `${shortHash}${fullHash.slice(shortHash.length, shortHash.length + typed)}`;

  return (
    <motion.span
      className={`font-mono text-emerald-300${className ? ` ${className}` : ""}`}
      style={{ transformOrigin: "left" }}
      initial={reduce ? false : { scaleX: 0.96, opacity: 0 }}
      animate={{ scaleX: 1, opacity: 1 }}
      transition={{ ease: EASE.out, duration: 0.32 }}
      data-testid="hash-typewriter"
    >
      {basePath}
      {revealed}
      {done ? null : ELLIPSIS}
    </motion.span>
  );
}
