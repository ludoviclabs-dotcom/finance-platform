"use client";

// FEATURE B — chaîne de preuve (5 blocs signés).
//
// Encadré présentationnel illustrant l'horodatage et la signature en chaîne de
// chaque étape du parcours (Import → Calcul → Contrôle → Rapport → Evidence
// Pack). Les blocs apparaissent un par un, démarrent en état « pending »
// (bordure pointillée, sans coche) puis basculent en état « validated »
// (bordure pleine emerald, CheckmarkDraw qui se trace, mini-hash révélé).
//
// Le composant NE pilote PAS la timeline : il réagit à la prop `visible`
// (passée par son parent) et anime sa séquence pour tenir dans la durée du
// moment "export-proof-chain" (~6 s). Le callback `onLastValidated` est
// OPTIONNEL (analytics) — rien ne doit en dépendre pour séquencer.
//
// prefers-reduced-motion : on rend directement l'ÉTAT FINAL (tous les blocs
// validés, mini-hash visibles, glow appliqué), sans aucun timer ni animation
// d'entrée. Tous les timers sont nettoyés au démontage.

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { useDemoTimeline } from "@/lib/hooks/use-demo-timeline";
import { SPRING, DEMO_CSS } from "@/components/demo/demo-tokens";
import { PROOF_BLOCKS, type ProofBlock } from "@/components/demo/demo-types";
import { CheckmarkDraw } from "@/components/demo/primitives/checkmark-draw";

type CarbonProofChainProps = {
  /** Le parent rend la chaîne visible pour le moment courant. */
  visible: boolean;
  /** Blocs à signer (défaut : PROOF_BLOCKS). */
  blocks?: ProofBlock[];
  /** Callback optionnel (analytics) appelé une fois le DERNIER bloc validé. */
  onLastValidated?: () => void;
  /** Classes additionnelles sur le conteneur racine. */
  className?: string;
};

// Cadence de la séquence (tient dans ~6 s pour 5 blocs).
const APPEAR_STEP_S = 0.3; // décalage d'apparition entre deux blocs (delay = index * step)
const APPEAR_STEP_MS = APPEAR_STEP_S * 1000;
const PENDING_MS = 400; // durée de l'état « pending » avant bascule en validé

/** Petit indicateur d'attente (trois points qui pulsent) affiché tant que le bloc est en « pending ». */
function PendingDots({ animate }: { animate: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-[3px]"
      aria-hidden="true"
      style={{ width: 14, height: 14, justifyContent: "center" }}
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block h-[3px] w-[3px] rounded-full bg-white/40"
          animate={animate ? { opacity: [0.25, 1, 0.25] } : undefined}
          transition={
            animate
              ? { duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }
              : undefined
          }
        />
      ))}
    </span>
  );
}

export function CarbonProofChain({
  visible,
  blocks = PROOF_BLOCKS,
  onLastValidated,
  className,
}: CarbonProofChainProps) {
  // Normalisé en booléen stable (useReducedMotion renvoie null au 1er rendu) :
  // évite une transition null→false qui annulerait les timers de validation des
  // blocs et, via le garde hasRunRef, les laisserait figés en « en cours ».
  const reduce = useReducedMotion() ?? false;
  const { isMobile } = useDemoTimeline();

  const total = blocks.length;

  // Indices des blocs déjà validés. Sous mouvement réduit, tous validés d'emblée.
  const [validated, setValidated] = useState<Set<number>>(() =>
    reduce ? new Set(blocks.map((_, i) => i)) : new Set<number>(),
  );

  // Réf stable du callback pour ne pas relancer la séquence à chaque rendu.
  const onLastValidatedRef = useRef(onLastValidated);
  useEffect(() => {
    onLastValidatedRef.current = onLastValidated;
  }, [onLastValidated]);

  useEffect(() => {
    // Mouvement réduit : état final immédiat, aucun timer.
    if (reduce) {
      setValidated(new Set(blocks.map((_, i) => i)));
      onLastValidatedRef.current?.();
      return;
    }

    // On attend que la chaîne soit visible. Effet volontairement IDEMPOTENT :
    // aucun garde-fou « une seule fois » qui — combiné au cleanup — figerait les
    // blocs en « en cours » sous le double montage de React StrictMode (setup,
    // cleanup, setup). La rejouabilité vient du remontage du composant (runId).
    if (!visible) {
      return;
    }

    const timers: number[] = [];

    blocks.forEach((_, i) => {
      // Chaque bloc apparaît à `index * step`, puis valide ~PENDING_MS plus tard.
      const validateAt = i * APPEAR_STEP_MS + PENDING_MS;
      const timer = window.setTimeout(() => {
        setValidated((prev) => {
          const next = new Set(prev);
          next.add(i);
          return next;
        });
        // Dernier bloc validé → notifie l'analytics (le glow est dérivé du state).
        if (i === total - 1) {
          onLastValidatedRef.current?.();
        }
      }, validateAt);
      timers.push(timer);
    });

    return () => {
      for (const t of timers) {
        window.clearTimeout(t);
      }
    };
  }, [reduce, visible, blocks, total]);

  // Glow synchronisé : actif dès que TOUS les blocs sont validés.
  const allValidated = validated.size >= total && total > 0;
  const containerGlowClass = !reduce && allValidated ? DEMO_CSS.proofGlow : "";

  // Flèche de liaison entre blocs (caractère, pas d'ancrage cross-DOM).
  const arrow = isMobile ? "↓" : "→";

  // Variants d'entrée des blocs (SPRING.pop, delay = index * step).
  const blockMotion = useMemo(
    () => ({
      initial: reduce ? false : ({ opacity: 0, scale: 0.9, y: 8 } as const),
      animate: reduce ? undefined : ({ opacity: 1, scale: 1, y: 0 } as const),
    }),
    [reduce],
  );

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="proof-chain"
          data-testid="demo-proof-chain"
          className={[
            "rounded-2xl",
            containerGlowClass,
            className ?? "",
          ]
            .filter(Boolean)
            .join(" ")}
          initial={reduce ? false : { opacity: 0 }}
          animate={reduce ? undefined : { opacity: 1 }}
          // Sortie : slide-down (descend + fond).
          exit={reduce ? undefined : { y: 40, opacity: 0 }}
          transition={reduce ? undefined : { duration: 0.4 }}
        >
          <div
            className={[
              "flex",
              isMobile ? "flex-col" : "flex-row items-stretch",
              "gap-2",
            ].join(" ")}
          >
            {blocks.map((block, i) => {
              const isValidated = validated.has(i);
              const isLast = i === total - 1;
              return (
                <div
                  key={block.id}
                  className={[
                    "flex",
                    isMobile ? "flex-col" : "flex-row",
                    "items-center gap-2",
                  ].join(" ")}
                >
                  {/* Carte du bloc signé. */}
                  <motion.div
                    className={[
                      "min-w-[120px] rounded-lg bg-neutral-900 px-3 py-2",
                      "border transition-colors",
                      isValidated
                        ? "border-solid border-emerald-400/30"
                        : "border-dashed border-white/10",
                    ].join(" ")}
                    initial={blockMotion.initial}
                    animate={blockMotion.animate}
                    transition={
                      reduce
                        ? undefined
                        : { ...SPRING.pop, delay: i * APPEAR_STEP_S }
                    }
                  >
                    {/* Ligne 1 : état (coche tracée ou points d'attente) + label. */}
                    <div className="flex items-center gap-1.5">
                      {isValidated ? (
                        <CheckmarkDraw size={14} />
                      ) : (
                        <PendingDots animate={!reduce} />
                      )}
                      <span className="text-xs font-semibold text-white">
                        {block.label}
                      </span>
                    </div>

                    {/* Ligne 2 : horodatage. */}
                    <p className="mt-1 font-mono text-[10px] text-white/50">
                      {block.timestamp}
                    </p>

                    {/* Ligne 3 : mini-hash, révélé une fois le bloc validé. */}
                    <p
                      className="mt-0.5 font-mono text-[10px] text-emerald-300/60 transition-opacity"
                      style={{ opacity: isValidated ? 1 : 0 }}
                    >
                      #{block.miniHash}
                    </p>
                  </motion.div>

                  {/* Flèche de liaison (sauf après le dernier bloc). */}
                  {!isLast ? (
                    <span
                      aria-hidden="true"
                      className="select-none px-0.5 text-emerald-400/60"
                    >
                      {arrow}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
