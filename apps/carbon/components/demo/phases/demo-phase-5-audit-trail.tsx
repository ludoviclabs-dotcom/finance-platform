"use client";

// PHASE 5 — Journal de preuve (chaîne d'événements signés, façon « ledger »).
//
// On déroule le journal d'audit (AUDIT_EVENTS) comme un REGISTRE CRYPTOGRAPHIQUE :
// chaque événement est une carte signée (horodatage, libellé, empreinte) reliée à
// la précédente par un maillon — matérialisant le chaînage des hash (inviolable).
// Apparition en cascade au moment « audit-trail-events ».
//
// Composant PRÉSENTATIONNEL. prefers-reduced-motion : état final, sans cascade.

import { motion, useReducedMotion } from "framer-motion";
import { Link2, Lock, ShieldCheck } from "lucide-react";

import { PhaseShell } from "@/components/demo/phases/phase-shell";
import { AUDIT_EVENTS, PHASE_META, isMomentAtOrAfter } from "@/components/demo/demo-types";
import { DUR, EASE } from "@/components/demo/demo-tokens";
import { useDemoTimeline } from "@/lib/hooks/use-demo-timeline";

/** Variants du conteneur : orchestre la cascade d'apparition des événements. */
const listVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: DUR.stagger, delayChildren: 0.1 },
  },
};

/** Variants d'un événement : fondu + léger glissement vertical à l'entrée. */
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.slow, ease: EASE.out },
  },
};

export function DemoPhase5AuditTrail() {
  const reduce = useReducedMotion();
  const { currentMoment } = useDemoTimeline();

  const showEvents =
    reduce || isMomentAtOrAfter(currentMoment, "audit-trail-events");

  return (
    <PhaseShell
      kicker={PHASE_META[5].kicker}
      title="Journal de preuve"
      testId="demo-phase-5-audit-trail"
    >
      <p className="mb-6 flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-widest text-emerald-300/80">
        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
        Chaîne d'événements signés · inviolable
      </p>

      {showEvents ? (
        <motion.ul
          data-testid="demo-audit-trail-events"
          className="relative max-w-2xl"
          variants={reduce ? undefined : listVariants}
          initial={reduce ? false : "hidden"}
          animate={reduce ? undefined : "visible"}
        >
          {AUDIT_EVENTS.map((event, index) => {
            const isLast = index === AUDIT_EVENTS.length - 1;
            return (
              <motion.li
                key={event.id}
                data-testid="demo-audit-trail-event"
                className="relative flex gap-4 pb-5 last:pb-0"
                variants={reduce ? undefined : itemVariants}
              >
                {/* Colonne gauche : pastille bouclier + maillon vers le suivant. */}
                <div className="relative flex flex-col items-center">
                  <span className="relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  </span>
                  {!isLast ? (
                    <span
                      aria-hidden="true"
                      className="mt-1 h-full flex-1 border-l border-dashed border-emerald-400/30"
                    />
                  ) : null}
                </div>

                {/* Carte signée : horodatage + n° de bloc, libellé, empreinte. */}
                <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-xs text-white/50">{event.time}</p>
                    <p className="font-mono text-[0.66rem] uppercase tracking-widest text-emerald-300/60">
                      Bloc {String(index + 1).padStart(2, "0")}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-white">{event.label}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs">
                    <span className="text-emerald-300/70">#{event.hash}</span>
                    {index > 0 ? (
                      <span className="inline-flex items-center gap-1 text-white/30">
                        <Link2 className="h-3 w-3" aria-hidden="true" />
                        chaîné au bloc {String(index).padStart(2, "0")}
                      </span>
                    ) : (
                      <span className="text-white/30">bloc de genèse</span>
                    )}
                  </div>
                </div>
              </motion.li>
            );
          })}
        </motion.ul>
      ) : null}
    </PhaseShell>
  );
}
