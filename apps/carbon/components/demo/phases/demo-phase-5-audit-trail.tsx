"use client";

// PHASE 5 — Journal de preuve (la chaîne d'événements signés).
//
// Scène présentationnelle de la séquence /demo : on déroule le journal d'audit
// (AUDIT_EVENTS) sous forme de timeline verticale. Chaque événement signé est
// matérialisé par une pastille emerald (icône bouclier) reliée à la suivante par
// une ligne verticale, accompagné de son horodatage, de son libellé et de son
// empreinte (#hash). Un seul moment rythme cette phase (cf. MOMENT_SEQUENCE) :
//   « audit-trail-events » → apparition en cascade (staggered) des événements.
//
// Composant PRÉSENTATIONNEL : il LIT currentMoment via useDemoTimeline() mais ne
// pilote JAMAIS la progression — l'horloge auto-avance toute seule. Les éléments
// se révèlent dès que le moment est atteint (isMomentAtOrAfter), de sorte que
// l'état reste cohérent même après un saut de phase (goToPhase).
//
// prefers-reduced-motion : on rend directement l'ÉTAT FINAL (tout visible, sans
// animation d'entrée). Aucun timer/raf n'est posé dans CE fichier (l'orchestration
// du stagger est gérée par framer-motion via les variants) — rien à nettoyer ici.

import { motion, useReducedMotion } from "framer-motion";
import { ShieldCheck, Lock } from "lucide-react";

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

  // Visibilité dérivée du moment courant : reste vraie pour tous les moments
  // ultérieurs (état final stable après un saut de phase). Sous mouvement réduit,
  // on force l'affichage : tout est visible d'emblée, sans animation d'entrée.
  const showEvents =
    reduce || isMomentAtOrAfter(currentMoment, "audit-trail-events");

  return (
    <PhaseShell
      kicker={PHASE_META[5].kicker}
      title="Journal de preuve"
      testId="demo-phase-5-audit-trail"
    >
      {/* Intitulé de section : rappel de la nature signée et inviolable du journal. */}
      <p className="mb-6 flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-widest text-emerald-300/80">
        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
        Chaîne d'événements signés
      </p>

      {showEvents ? (
        <motion.ul
          data-testid="demo-audit-trail-events"
          className="relative"
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
                className="relative flex gap-4 pb-6 last:pb-0"
                variants={reduce ? undefined : itemVariants}
              >
                {/* Colonne gauche : pastille emerald + ligne verticale de liaison.
                    La ligne (border-l) relie chaque pastille à la suivante ; on la
                    masque sur le dernier événement (fin de chaîne). */}
                <div className="relative flex flex-col items-center">
                  <span className="relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  </span>
                  {!isLast ? (
                    <span
                      aria-hidden="true"
                      className="mt-1 h-full flex-1 border-l border-emerald-400/30"
                    />
                  ) : null}
                </div>

                {/* Colonne droite : horodatage, libellé puis empreinte (#hash). */}
                <div className="min-w-0 flex-1 pt-1">
                  <p className="font-mono text-xs text-white/50">{event.time}</p>
                  <p className="mt-0.5 text-sm text-white">{event.label}</p>
                  <p className="mt-1 font-mono text-xs text-emerald-300/60">
                    #{event.hash}
                  </p>
                </div>
              </motion.li>
            );
          })}
        </motion.ul>
      ) : null}
    </PhaseShell>
  );
}
