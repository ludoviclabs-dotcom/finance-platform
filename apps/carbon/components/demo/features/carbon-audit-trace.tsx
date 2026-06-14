"use client";

// FEATURE A — remontée de traçabilité auditeur.
//
// Lorsqu'un auditeur clique sur une valeur consolidée, la plateforme « remonte »
// toute la chaîne de preuve : du chiffre publié jusqu'à la cellule source du
// fichier importé. Ce composant matérialise cette remontée sous forme d'une
// CASCADE VERTICALE de 6 blocs (cf. AUDIT_TRACE_BLOCKS), chaque bloc s'affichant
// en décalé pour donner l'impression d'un fil de preuve qui se déroule.
//
// Composant PRÉSENTATIONNEL : il NE pilote PAS la timeline. Il réagit à la prop
// `visible` (passée par le parent, qui maîtrise la durée d'affichage ~6 s) et
// s'anime pour tenir dans ce budget. Le callback `onComplete` est OPTIONNEL
// (analytics) — rien ne doit en dépendre pour séquencer.
//
// DESKTOP : un fil vertical en pointillés emerald relie les blocs et se « trace »
// (un trait SVG dont on anime le strokeDashoffset). MOBILE : stack vertical
// compact, sans fil SVG.
//
// prefers-reduced-motion : les 6 blocs sont visibles immédiatement, sans aucun
// tracé ni cascade. Tous les timers sont nettoyés au démontage.

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Table,
  Database,
  Calculator,
  FileCheck,
  ShieldCheck,
  FileText,
  type LucideIcon,
} from "lucide-react";

import {
  AUDIT_TRACE_BLOCKS,
  type AuditTraceBlock,
} from "@/components/demo/demo-types";
import { DUR, EASE } from "@/components/demo/demo-tokens";
import { useDemoTimeline } from "@/lib/hooks/use-demo-timeline";

type CarbonAuditTraceProps = {
  /** Le parent rend la cascade visible pour le moment courant. */
  visible: boolean;
  /** Callback optionnel (analytics) appelé une fois la cascade terminée. */
  onComplete?: () => void;
  /** Classes additionnelles sur le conteneur racine. */
  className?: string;
};

/** Clé d'icône → composant lucide correspondant. */
const ICON_MAP: Record<AuditTraceBlock["icon"], LucideIcon> = {
  table: Table,
  database: Database,
  calculator: Calculator,
  "file-check": FileCheck,
  "shield-check": ShieldCheck,
  "file-text": FileText,
};

/**
 * Détecte si un détail contient un hash ou une formule (auquel cas on le rend
 * en font-mono). Heuristique : signe d'égalité, opérateur de multiplication
 * (× ou *), ou longue chaîne hexadécimale (≥ 16 caractères) — typique d'un
 * empreinte SHA ou d'un calcul de facteur d'émission.
 */
function isTechnicalDetail(detail: string): boolean {
  return (
    /[=×*]/.test(detail) ||
    /\b[0-9a-f]{16,}\b/i.test(detail) ||
    /\bsha-?256\b/i.test(detail)
  );
}

/** Variantes du conteneur : orchestre la cascade via staggerChildren. */
const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      // Décalage entre deux blocs successifs (cf. DUR.cascade ≈ 0.2 s).
      staggerChildren: DUR.cascade,
    },
  },
};

/** Variantes d'un bloc : entrée opacity 0 / y 10 → opacity 1 / y 0. */
const blockVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { ease: EASE.out, duration: 0.32 },
  },
};

export function CarbonAuditTrace({
  visible,
  onComplete,
  className,
}: CarbonAuditTraceProps) {
  const reduce = useReducedMotion() ?? false;
  const { isMobile } = useDemoTimeline();

  // Réf stable du callback pour ne pas relancer l'effet à chaque rendu.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Garde-fou : on ne signale la fin de cascade qu'UNE seule fois (la
  // rejouabilité est gérée en amont par la timeline, qui remonte le composant
  // via son runId).
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    // Mouvement réduit : tout est affiché d'emblée, on signale la fin sans timer.
    if (reduce) {
      if (visible && !hasCompletedRef.current) {
        hasCompletedRef.current = true;
        onCompleteRef.current?.();
      }
      return;
    }

    // Inactif ou déjà terminé : rien à programmer.
    if (!visible || hasCompletedRef.current) {
      return;
    }

    // Durée totale estimée de la cascade : un décalage par bloc + la durée
    // d'entrée du dernier bloc. On notifie onComplete à ce terme.
    const blockCount = AUDIT_TRACE_BLOCKS.length;
    const cascadeMs = (blockCount * DUR.cascade + 0.32) * 1000;

    const timer = window.setTimeout(() => {
      hasCompletedRef.current = true;
      onCompleteRef.current?.();
    }, Math.max(0, cascadeMs));

    return () => window.clearTimeout(timer);
  }, [reduce, visible]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="audit-trace"
          data-testid="demo-audit-trace"
          className={[
            "relative w-full",
            isMobile ? "max-w-full" : "max-w-xl",
            className ?? "",
          ]
            .filter(Boolean)
            .join(" ")}
          variants={containerVariants}
          initial={reduce ? false : "hidden"}
          animate="visible"
          exit={reduce ? undefined : { opacity: 0 }}
        >
          {/*
            DESKTOP uniquement : fil vertical en pointillés emerald qui se trace.
            Positionné en relatif dans le conteneur (aucun ancrage cross-DOM),
            calé sur l'axe des cercles d'icônes (gauche). Purement décoratif.
          */}
          {!isMobile ? (
            <svg
              className="pointer-events-none absolute left-[1.45rem] top-6 bottom-6 w-px"
              aria-hidden="true"
              focusable="false"
              preserveAspectRatio="none"
              viewBox="0 0 1 100"
            >
              <motion.line
                x1="0.5"
                y1="0"
                x2="0.5"
                y2="100"
                stroke="#34D399"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                initial={reduce ? false : { strokeDashoffset: 100 }}
                animate={{ strokeDashoffset: 0 }}
                transition={
                  reduce
                    ? undefined
                    : {
                        ease: EASE.out,
                        duration: AUDIT_TRACE_BLOCKS.length * DUR.cascade,
                      }
                }
              />
            </svg>
          ) : null}

          <ul
            className={`relative flex flex-col ${isMobile ? "gap-2" : "gap-3"}`}
          >
            {AUDIT_TRACE_BLOCKS.map((block, index) => {
              const Icon = ICON_MAP[block.icon];
              const technical = isTechnicalDetail(block.detail);

              return (
                <motion.li
                  key={`${block.icon}-${index}`}
                  data-testid="demo-audit-trace-block"
                  className="flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-white/[0.04] px-4 py-3"
                  variants={blockVariants}
                >
                  {/* Icône dans un cercle emerald discret. */}
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-400/10"
                    aria-hidden="true"
                  >
                    <Icon className="h-4 w-4 text-emerald-400" />
                  </span>

                  {/* Bloc texte : libellé + détail (mono si hash/formule). */}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      {block.label}
                    </p>
                    <p
                      className={`mt-0.5 text-xs text-white/55${
                        technical ? " break-all font-mono" : ""
                      }`}
                    >
                      {block.detail}
                    </p>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
