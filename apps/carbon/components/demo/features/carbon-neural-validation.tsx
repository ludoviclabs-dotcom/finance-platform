"use client";

// FEATURE D — moment NEURAL.
//
// Encadré présentationnel affichant l'application d'un facteur d'émission par
// le moteur NEURAL, suivi de la bascule du verrou de gouvernance :
//   AMBER « Validation humaine requise »  →  VERT « Validé par l'auditeur ».
//
// Le composant NE pilote PAS la timeline : il réagit à la prop `visible`
// (passée par son parent) et, une fois visible, bascule de lui-même vers
// l'état validé au bout de `autoValidateMs` (le temps imparti au moment).
// Le callback `onValidated` est OPTIONNEL (analytics) — rien ne doit en
// dépendre pour séquencer.
//
// prefers-reduced-motion : on rend directement l'ÉTAT VALIDÉ (badge vert,
// bordure emerald), sans aucun timer ni animation d'entrée. Tous les timers
// sont nettoyés au démontage.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { useDemoTimeline } from "@/lib/hooks/use-demo-timeline";
import { DEMO_CSS, SPRING } from "@/components/demo/demo-tokens";

type CarbonNeuralValidationProps = {
  /** Nom du facteur d'émission appliqué (ex. « Électricité — réseau FR »). */
  factorName: string;
  /** Source du facteur (ex. « Base Empreinte® ADEME »). */
  source: string;
  /** Référence / version de la source (rendue en font-mono). */
  reference: string;
  /** Le parent rend l'encadré visible pour le moment courant. */
  visible: boolean;
  /** Délai (ms) avant la bascule vers l'état validé. Défaut 2200. */
  autoValidateMs?: number;
  /** Callback optionnel (analytics) appelé une fois la validation acquise. */
  onValidated?: () => void;
  /** Classes additionnelles sur le conteneur racine. */
  className?: string;
};

/**
 * Icône NEURAL réutilisable (étoile à 8 branches + cœur), tracée en
 * emerald-400. `aria-hidden` car purement décorative.
 */
function NeuralMark({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#34D399"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function CarbonNeuralValidation({
  factorName,
  source,
  reference,
  visible,
  autoValidateMs = 2200,
  onValidated,
  className,
}: CarbonNeuralValidationProps) {
  const reduce = useReducedMotion() ?? false;
  const { isMobile } = useDemoTimeline();

  // État du verrou de gouvernance : sous mouvement réduit on part directement
  // de l'état final (validé), sinon on démarre en attente de validation.
  const [validated, setValidated] = useState<boolean>(() => reduce ?? false);

  // Réf stable du callback pour ne pas relancer l'effet à chaque rendu.
  const onValidatedRef = useRef(onValidated);
  useEffect(() => {
    onValidatedRef.current = onValidated;
  }, [onValidated]);

  // Garde-fou : on ne déclenche la validation qu'UNE seule fois (la rejouabilité
  // est gérée en amont par la timeline, qui remonte le composant via son runId).
  const hasRunRef = useRef(false);

  useEffect(() => {
    // Mouvement réduit : état final immédiat, aucun timer.
    if (reduce) {
      setValidated(true);
      if (!hasRunRef.current) {
        hasRunRef.current = true;
        onValidatedRef.current?.();
      }
      return;
    }

    // On attend que l'encadré soit visible et on ne joue la bascule qu'une fois.
    if (!visible || hasRunRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      hasRunRef.current = true;
      setValidated(true);
      onValidatedRef.current?.();
    }, Math.max(0, autoValidateMs));

    return () => window.clearTimeout(timer);
  }, [reduce, visible, autoValidateMs]);

  return (
    <AnimatePresence mode="wait">
      {visible ? (
        <motion.div
          key="neural"
          data-testid="demo-neural"
          className={[
            "w-full rounded-2xl border bg-neutral-900/90 p-4 transition-colors",
            validated ? "border-emerald-400/30" : "border-white/10",
            isMobile ? "" : "max-w-md",
            className ?? "",
          ]
            .filter(Boolean)
            .join(" ")}
          initial={reduce ? false : { y: 24, opacity: 0 }}
          animate={reduce ? undefined : { y: 0, opacity: 1 }}
          exit={reduce ? undefined : { y: 16, opacity: 0 }}
          transition={SPRING.sheet}
        >
          {/* En-tête : marque NEURAL + version + tag ESRS natif. */}
          <header className="flex items-center gap-2">
            <NeuralMark size={18} />
            <span className="text-xs font-bold text-white">NEURAL · v2.4</span>
            <span className="ml-auto font-mono text-[10px] text-white/40">
              ESRS native
            </span>
          </header>

          {/* Corps : facteur appliqué + provenance. */}
          <div className="mt-3">
            <p className="text-sm text-white">
              Facteur {factorName} appliqué
            </p>
            <p className="mt-1 text-xs text-white/55">
              {source} — <span className="font-mono">{reference}</span>
            </p>
          </div>

          {/* Verrou de gouvernance : bascule AMBER → VERT. */}
          <div className="mt-4">
            <AnimatePresence mode="wait" initial={false}>
              {validated ? (
                <motion.div
                  key="validated"
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.28 }}
                >
                  <span
                    className={`inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300 ${
                      reduce ? "" : DEMO_CSS.badgeIn
                    }`}
                  >
                    ✓ Validé par l'auditeur
                  </span>
                </motion.div>
              ) : (
                <motion.div
                  key="pending"
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                >
                  <span
                    className={`inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300 ${
                      reduce ? "" : DEMO_CSS.badgeOut
                    }`}
                  >
                    ⚠ Validation humaine requise
                  </span>
                  <p className="mt-2 text-xs italic text-white/40">
                    L'IA recommande — l'auditeur confirme.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
