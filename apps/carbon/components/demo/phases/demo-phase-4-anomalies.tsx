"use client";

// PHASE 4 — Contrôle qualité (détection puis correction des anomalies).
//
// Scène présentationnelle de la séquence /demo : on matérialise le contrôle
// qualité automatique. Deux moments rythment l'apparition du contenu
// (cf. MOMENT_SEQUENCE) :
//   1. « anomalies-detected »  → bandeau ambre « 3 anomalies détectées »,
//                                chaque ligne porte son badge AVANT correction.
//   2. « anomalies-corrected » → bandeau vert « 3 anomalies corrigées ·
//                                historisées », chaque badge bascule vers son
//                                état APRÈS correction (swap animé).
//
// Composant PRÉSENTATIONNEL : il LIT currentMoment via useDemoTimeline() mais ne
// pilote JAMAIS la progression — l'horloge auto-avance toute seule. Les seuils
// de visibilité sont cumulatifs (isMomentAtOrAfter), de sorte que l'état reste
// cohérent même après un saut de phase.
//
// prefers-reduced-motion : on rend directement l'ÉTAT FINAL de la phase, c.-à-d.
// l'état CORRIGÉ (bandeau vert + badges « après »), sans animation d'entrée ni
// de bascule. Aucun timer/raf n'est posé dans ce fichier — rien à nettoyer.

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { PhaseShell } from "@/components/demo/phases/phase-shell";
import {
  ANOMALY_ROWS,
  DEMO_TONE_CLASSES,
  PHASE_META,
  isMoment,
  isMomentAtOrAfter,
} from "@/components/demo/demo-types";
import { DEMO_CSS, EASE } from "@/components/demo/demo-tokens";
import { useDemoTimeline } from "@/lib/hooks/use-demo-timeline";

/** Classes de base d'un badge d'état (complétées par la tonalité de la ligne). */
const BADGE_BASE = "rounded-full border px-3 py-1 text-xs font-bold";

export function DemoPhase4Anomalies() {
  const reduce = useReducedMotion();
  const { currentMoment } = useDemoTimeline();

  // Visibilité dérivée du moment courant. Sous mouvement réduit, on force l'état
  // final de la phase (tout corrigé), tout étant visible d'emblée.
  const showDetected = reduce || isMomentAtOrAfter(currentMoment, "anomalies-detected");
  const corrected = reduce || isMomentAtOrAfter(currentMoment, "anomalies-corrected");

  // Le bandeau ambre n'est affiché QUE pendant le moment de détection ; dès la
  // correction (ou en mouvement réduit), il cède la place au bandeau vert.
  const showDetectedBanner = !reduce && isMoment(currentMoment, "anomalies-detected");

  return (
    <PhaseShell
      kicker={PHASE_META[4].kicker}
      title="Contrôle qualité"
      testId="demo-phase-4-anomalies"
    >
      {/* Bandeau d'état : ambre pendant la détection, vert une fois corrigé. */}
      {showDetected ? (
        <AnimatePresence mode="wait" initial={false}>
          {corrected ? (
            <motion.div
              key="banner-corrected"
              data-testid="demo-anomalies-banner-corrected"
              className="inline-flex items-center gap-3 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-2"
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={reduce ? undefined : { opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.35, ease: EASE.out }}
            >
              <CheckCircle2 className="h-5 w-5 text-emerald-400" aria-hidden="true" />
              <span className="text-sm font-semibold text-emerald-100">
                3 anomalies corrigées · historisées
              </span>
            </motion.div>
          ) : showDetectedBanner ? (
            <motion.div
              key="banner-detected"
              data-testid="demo-anomalies-banner-detected"
              className="inline-flex items-center gap-3 rounded-full border border-amber-400/25 bg-amber-400/10 px-4 py-2"
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={reduce ? undefined : { opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.35, ease: EASE.out }}
            >
              <AlertTriangle className="h-5 w-5 text-amber-400" aria-hidden="true" />
              <span className="text-sm font-semibold text-amber-100">
                3 anomalies détectées
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      ) : null}

      {/* Liste des anomalies : libellé + badge (avant → après correction). */}
      {showDetected ? (
        <motion.ul
          data-testid="demo-anomalies-list"
          className="mt-6 max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]"
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE.out, delay: reduce ? 0 : 0.05 }}
        >
          {ANOMALY_ROWS.map((row) => {
            // État courant du badge de la ligne : « après » dès la correction
            // (toutes les lignes du jeu de données sont marquées corrected),
            // « avant » sinon. La clé pilote le swap via AnimatePresence.
            const badge = corrected ? row.after : row.before;

            return (
              <li
                key={row.id}
                data-testid="demo-anomaly-row"
                className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-white/[0.08] px-4 py-3 last:border-b-0"
              >
                <span className="text-sm text-white/80">{row.label}</span>

                {/* Swap animé du badge (avant → après) : AnimatePresence mode
                    « wait » keyé sur la valeur. La classe DEMO_CSS.badgeIn
                    renforce l'entrée et est neutralisée sous mouvement réduit. */}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={badge.value}
                    data-testid="demo-anomaly-badge"
                    className={`${BADGE_BASE} ${DEMO_TONE_CLASSES[badge.tone]}${
                      reduce ? "" : ` ${DEMO_CSS.badgeIn}`
                    }`}
                    initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                    animate={reduce ? undefined : { opacity: 1, scale: 1 }}
                    exit={reduce ? undefined : { opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2, ease: EASE.out }}
                  >
                    {badge.value}
                  </motion.span>
                </AnimatePresence>
              </li>
            );
          })}
        </motion.ul>
      ) : null}
    </PhaseShell>
  );
}
