"use client";

// PHASE 4 — Contrôle qualité (scan automatique : détection → correction).
//
// On met en scène un VRAI contrôle qualité : un score de conformité qui grimpe,
// un faisceau de scan qui balaie la liste pendant la détection, des anomalies
// typées (unités mixtes, doublon, période manquante) dont le badge bascule
// AVANT → APRÈS, et un bandeau d'état qui passe d'ambre à vert. Bien plus
// « cockpit » que la simple liste d'origine.
//
//   1. « anomalies-detected »  → bandeau ambre « 3 anomalies détectées »,
//                                badges « avant », scan en cours, score 96 %.
//   2. « anomalies-corrected » → bandeau vert « corrigées · historisées »,
//                                badges « après », score 100 %.
//
// Composant PRÉSENTATIONNEL. prefers-reduced-motion : état final (corrigé),
// sans scan ni bascule.

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Copy,
  Ruler,
  type LucideIcon,
} from "lucide-react";

import { PhaseShell } from "@/components/demo/phases/phase-shell";
import {
  ANOMALY_ROWS,
  DEMO_TONE_CLASSES,
  PHASE_META,
  isMoment,
  isMomentAtOrAfter,
} from "@/components/demo/demo-types";
import { DEMO_COLORS, DEMO_CSS, EASE } from "@/components/demo/demo-tokens";
import { useDemoTimeline } from "@/lib/hooks/use-demo-timeline";

/** Classes de base d'un badge d'état (complétées par la tonalité de la ligne). */
const BADGE_BASE = "rounded-full border px-3 py-1 text-xs font-bold";

/** Icône de catégorie par anomalie (clé = id de la ligne). */
const ROW_ICON: Record<string, LucideIcon> = {
  units: Ruler,
  dup: Copy,
  period: CalendarClock,
};

/** Jauge de conformité : 96 % en détection → 100 % une fois corrigé. */
function ConformityMeter({
  corrected,
  reduce,
}: {
  corrected: boolean;
  reduce: boolean;
}) {
  const score = corrected ? 100 : 96;
  const color = corrected ? DEMO_COLORS.emerald : DEMO_COLORS.amber;

  return (
    <div
      data-testid="demo-anomalies-score"
      className={`min-w-[200px] rounded-2xl border bg-white/[0.03] p-4 ${
        corrected ? "border-emerald-400/25" : "border-amber-400/25"
      }`}
    >
      <p
        className={`text-[0.68rem] font-bold uppercase tracking-widest ${
          corrected ? "text-emerald-300/80" : "text-amber-300/80"
        }`}
      >
        Score de conformité
      </p>
      <div className="mt-1 flex items-baseline gap-2">
        <span
          className="text-3xl font-extrabold tabular-nums"
          style={{ color }}
        >
          {score}%
        </span>
        <span className="text-xs text-white/50">
          {corrected ? "0 anomalie" : "3 anomalies"}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color, transformOrigin: "left" }}
          initial={reduce ? false : { scaleX: 0 }}
          animate={{ scaleX: score / 100 }}
          transition={reduce ? { duration: 0 } : { duration: 0.7, ease: EASE.out }}
        />
      </div>
    </div>
  );
}

export function DemoPhase4Anomalies() {
  const reduce = useReducedMotion() ?? false;
  const { currentMoment } = useDemoTimeline();

  const showDetected = reduce || isMomentAtOrAfter(currentMoment, "anomalies-detected");
  const corrected = reduce || isMomentAtOrAfter(currentMoment, "anomalies-corrected");
  // Bandeau ambre + scan : uniquement pendant le moment de détection.
  const showDetectedBanner = !reduce && isMoment(currentMoment, "anomalies-detected");
  const scanning = showDetectedBanner;

  return (
    <PhaseShell
      kicker={PHASE_META[4].kicker}
      title="Contrôle qualité"
      testId="demo-phase-4-anomalies"
    >
      {/* Bandeau d'état + jauge de conformité. */}
      {showDetected ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
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

          <ConformityMeter corrected={corrected} reduce={reduce} />
        </div>
      ) : null}

      {/* Liste des anomalies + faisceau de scan (pendant la détection). */}
      {showDetected ? (
        <div className="relative mt-6 max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
          <motion.ul
            data-testid="demo-anomalies-list"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE.out, delay: reduce ? 0 : 0.05 }}
          >
            {ANOMALY_ROWS.map((row) => {
              const badge = corrected ? row.after : row.before;
              const Icon = ROW_ICON[row.id] ?? AlertTriangle;

              return (
                <li
                  key={row.id}
                  data-testid="demo-anomaly-row"
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-white/[0.08] px-4 py-3 last:border-b-0"
                >
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition-colors ${
                      corrected
                        ? "bg-emerald-400/10 text-emerald-300"
                        : "bg-amber-400/10 text-amber-300"
                    }`}
                    aria-hidden="true"
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm text-white/80">{row.label}</span>

                  {/* Swap animé du badge (avant → après). */}
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

          {/* Faisceau de scan : balaie la liste pendant la détection. */}
          {scanning ? (
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-x-0 top-0 h-16 ${DEMO_CSS.scanBeam}`}
              style={{
                background:
                  "linear-gradient(180deg, transparent, rgba(251,191,36,0.16) 45%, rgba(251,191,36,0.28) 50%, transparent)",
              }}
            />
          ) : null}
        </div>
      ) : null}
    </PhaseShell>
  );
}
