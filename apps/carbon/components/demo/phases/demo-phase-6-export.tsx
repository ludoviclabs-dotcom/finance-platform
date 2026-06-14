"use client";

// PHASE 6 — Export auditeur (la livraison signée).
//
// Scène présentationnelle de la séquence /demo : on matérialise la livraison du
// dossier de preuve à l'auditeur. Quatre moments rythment l'apparition du
// contenu (cf. MOMENT_SEQUENCE) :
//   1. « export-prepare »     → 3 cards de formats d'export (EXPORT_FORMATS),
//                               libellé + badge d'extension + détail.
//   2. « export-checkmarks »  → chaque card reçoit une coche tracée (CheckmarkDraw,
//                               délai = index × 150 ms) et passe en bordure emerald.
//   3. « export-proof-chain » → Feature B (CarbonProofChain) : la chaîne de preuve
//                               se signe bloc à bloc.
//   4. « export-verify-card » → Feature C (CarbonVerifyCard) : URL publique + card
//                               « Rapport vérifié » (overlay / bottom sheet géré
//                               par le composant lui-même).
//
// Composant PRÉSENTATIONNEL : il LIT currentMoment via useDemoTimeline() mais ne
// pilote JAMAIS la progression — l'horloge auto-avance toute seule. Les seuils de
// visibilité sont cumulatifs (isMomentAtOrAfter), de sorte que l'état reste
// cohérent même après un saut de phase. Les features enfants gèrent elles-mêmes
// leur apparition / disparition / timers selon leur prop `visible`.
//
// prefers-reduced-motion : on rend directement l'ÉTAT FINAL (cards visibles +
// cochées, features en état final), sans animation d'entrée. Aucun timer/raf
// n'est posé dans CE fichier — rien à nettoyer ici.

import { motion, useReducedMotion } from "framer-motion";

import { PhaseShell } from "@/components/demo/phases/phase-shell";
import { CheckmarkDraw } from "@/components/demo/primitives/checkmark-draw";
import { CarbonProofChain } from "@/components/demo/features/carbon-proof-chain";
import { CarbonVerifyCard } from "@/components/demo/features/carbon-verify-card";
import {
  EXPORT_FORMATS,
  PHASE_META,
  isMoment,
  isMomentAtOrAfter,
} from "@/components/demo/demo-types";
import { EASE } from "@/components/demo/demo-tokens";
import { useDemoTimeline } from "@/lib/hooks/use-demo-timeline";

/** Décalage du tracé d'une coche à l'autre (en phase avec delayMs = index × step). */
const CHECK_STEP_MS = 150;

export function DemoPhase6Export() {
  const reduce = useReducedMotion();
  const { currentMoment, isMobile } = useDemoTimeline();

  // Visibilité dérivée du moment courant : chaque seuil reste vrai pour tous les
  // moments ultérieurs (cumulatif), ce qui garantit un état final stable. Sous
  // mouvement réduit, on force l'état final : tout est visible / coché d'emblée.
  const showFormats =
    reduce || isMomentAtOrAfter(currentMoment, "export-prepare");
  const showChecks =
    reduce || isMomentAtOrAfter(currentMoment, "export-checkmarks");
  const showProofChain =
    reduce || isMomentAtOrAfter(currentMoment, "export-proof-chain");

  // La card de vérification est pilotée par son moment précis : elle gère
  // elle-même son overlay / bottom sheet, son apparition et ses timers.
  const verifyVisible = isMoment(currentMoment, "export-verify-card");

  return (
    <PhaseShell
      kicker={PHASE_META[6].kicker}
      title="Export auditeur"
      testId="demo-phase-6-export"
    >
      {/* Grille des formats d'export : desktop = 3 colonnes, mobile = pile. */}
      {showFormats ? (
        <div
          data-testid="demo-export-formats"
          className={
            isMobile
              ? "flex flex-col gap-4"
              : "grid grid-cols-3 items-stretch gap-4"
          }
        >
          {EXPORT_FORMATS.map((format, index) => (
            <motion.article
              key={format.id}
              data-testid="demo-export-format"
              // La bordure passe en emerald dès que les coches sont déclenchées.
              className={`flex flex-col rounded-2xl border bg-white/[0.04] p-5 transition-colors ${
                showChecks ? "border-emerald-400/30" : "border-white/10"
              }`}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={reduce ? undefined : { opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                ease: EASE.out,
                delay: reduce ? 0 : index * 0.08,
              }}
            >
              {/* En-tête de la card : badge d'extension + coche tracée (au moment). */}
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 font-mono text-xs font-bold text-emerald-200">
                  {format.ext}
                </span>
                {showChecks ? (
                  <CheckmarkDraw
                    size={20}
                    delayMs={reduce ? 0 : index * CHECK_STEP_MS}
                  />
                ) : null}
              </div>

              {/* Libellé du format puis détail descriptif. */}
              <p className="mt-4 text-base font-bold text-white">
                {format.label}
              </p>
              <p className="mt-1 text-sm text-white/55">{format.detail}</p>
            </motion.article>
          ))}
        </div>
      ) : null}

      {/* Feature B — chaîne de preuve : elle gère elle-même sa cascade / sortie. */}
      <CarbonProofChain visible={showProofChain} className="mt-8" />

      {/* Feature C — vérification publique : overlay / bottom sheet géré en interne. */}
      <CarbonVerifyCard visible={verifyVisible} />
    </PhaseShell>
  );
}
