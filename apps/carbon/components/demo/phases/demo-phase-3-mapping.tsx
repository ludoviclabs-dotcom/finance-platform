"use client";

// PHASE 3 — Calcul des émissions (LA SCÈNE PHARE — celle qu'on garde et enrichit).
//
// Cœur de la démo : le compteur GES qui s'anime de 0 → 1 847 tCO₂e, désormais
// SERTI DANS UN ANNEAU ORBITAL qui tourne (la « animation qui tourne »). Autour,
// on ajoute du concret métier : la formule de calcul, la RÉPARTITION par scope
// (GHG Protocol) qui se remplit en cadence, le mapping ADEME, la justification du
// facteur, le verrou de gouvernance NEURAL et la remontée de traçabilité auditeur
// (drill-down : du chiffre publié à la cellule source).
//
//   1. « mapping-rows-fade »         → lignes source + badges.
//   2. « mapping-factors-attach »    → justification du facteur (aside).
//   3. « mapping-neural-validation » → verrou de gouvernance NEURAL (amber→vert).
//   4. « mapping-counter »           → compteur + anneau + formule + scopes.
//   5. « mapping-audit-trace »       → onde de drill-down + cascade de traçabilité.
//
// Composant PRÉSENTATIONNEL. prefers-reduced-motion : état final, sans animation.

import { motion, useReducedMotion } from "framer-motion";
import { MousePointerClick } from "lucide-react";

import { PhaseShell } from "@/components/demo/phases/phase-shell";
import { AnimatedGesCounter } from "@/components/demo/primitives/animated-ges-counter";
import { OrbitalRing } from "@/components/demo/primitives/orbital-ring";
import { ScopeBreakdown } from "@/components/demo/primitives/scope-breakdown";
import { CarbonNeuralValidation } from "@/components/demo/features/carbon-neural-validation";
import { CarbonAuditTrace } from "@/components/demo/features/carbon-audit-trace";
import {
  MAPPING_ROWS,
  SCOPE_BREAKDOWN,
  DEMO_FACTOR,
  DEMO_GES_TARGET,
  DEMO_GES_UNIT,
  DEMO_TONE_CLASSES,
  PHASE_META,
  isMoment,
  isMomentAtOrAfter,
} from "@/components/demo/demo-types";
import { DEMO_CSS, EASE } from "@/components/demo/demo-tokens";
import { useDemoTimeline } from "@/lib/hooks/use-demo-timeline";

/** Classes de base d'un badge d'état (complétées par la tonalité de la ligne). */
const BADGE_BASE = "rounded-full border px-3 py-1 text-xs font-bold";

export function DemoPhase3Mapping() {
  const reduce = useReducedMotion();
  const { currentMoment, isMobile } = useDemoTimeline();

  const showRows =
    reduce || isMomentAtOrAfter(currentMoment, "mapping-rows-fade");
  const showFactors =
    reduce || isMomentAtOrAfter(currentMoment, "mapping-factors-attach");
  const showCounter =
    reduce || isMomentAtOrAfter(currentMoment, "mapping-counter");

  // Le compteur + l'anneau + les scopes s'activent au moment du calcul ; l'onde
  // de drill-down s'allume pile sur la remontée de traçabilité.
  const counterActive = isMomentAtOrAfter(currentMoment, "mapping-counter");
  const drillingDown = isMoment(currentMoment, "mapping-audit-trace");

  const neuralVisible = isMoment(currentMoment, "mapping-neural-validation");
  const auditVisible = isMoment(currentMoment, "mapping-audit-trace");

  const fadeUp = (delay = 0) =>
    reduce
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.4, ease: EASE.out, delay },
        };

  return (
    <PhaseShell
      kicker={PHASE_META[3].kicker}
      title="Calcul des émissions"
      testId="demo-phase-3-mapping"
    >
      {/* Compteur central serti dans l'anneau orbital + formule de calcul. */}
      {showCounter ? (
        <motion.div
          data-testid="demo-mapping-counter"
          className="relative flex flex-col items-center justify-center py-2 text-center"
          {...fadeUp(0)}
        >
          <p className="mb-4 text-[0.68rem] font-bold uppercase tracking-widest text-emerald-300/80">
            Total des émissions calculé
          </p>

          <div className="relative">
            <OrbitalRing active={counterActive} size={isMobile ? 280 : 360}>
              <AnimatedGesCounter
                target={DEMO_GES_TARGET}
                unit={DEMO_GES_UNIT}
                active={counterActive}
                glow={drillingDown}
              />
            </OrbitalRing>

            {/* Onde de drill-down : « on clique sur le chiffre publié ». */}
            {drillingDown && !reduce ? (
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-400/40 ${DEMO_CSS.ripplePing}`}
              />
            ) : null}
          </div>

          {/* Formule : la lecture humaine du calcul (versionnée, donc auditable). */}
          <motion.p
            className="mt-6 font-mono text-xs text-white/45"
            {...fadeUp(0.12)}
          >
            847 lignes × facteur ADEME versionné{" "}
            <span className="text-emerald-300">= 1 847 tCO₂e</span>
          </motion.p>
        </motion.div>
      ) : null}

      {/* Répartition par scope (GHG Protocol) qui se remplit en cadence. */}
      {showCounter ? (
        <motion.div className="mx-auto mt-8 max-w-2xl" {...fadeUp(0.18)}>
          <ScopeBreakdown slices={SCOPE_BREAKDOWN} active={counterActive} />
        </motion.div>
      ) : null}

      {/* Corps : lignes source mappées / justification facteur. */}
      <div
        className={
          isMobile
            ? "mt-10 flex flex-col gap-6"
            : "mt-10 grid grid-cols-2 items-start gap-6"
        }
      >
        <div>
          <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-widest text-emerald-300/80">
            Lignes source mappées
          </p>

          {showRows ? (
            <motion.ul
              data-testid="demo-mapping-rows"
              className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]"
              {...fadeUp(0.05)}
            >
              {MAPPING_ROWS.map((row, index) => (
                <li
                  key={`${row.label}-${index}`}
                  data-testid="demo-mapping-row"
                  className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-white/[0.08] px-4 py-3 last:border-b-0"
                >
                  <span className="text-sm text-white/80">{row.label}</span>
                  <span className={`${BADGE_BASE} ${DEMO_TONE_CLASSES[row.tone]}`}>
                    {row.value}
                  </span>
                </li>
              ))}
            </motion.ul>
          ) : null}
        </div>

        <div>
          <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-widest text-emerald-300/80">
            Justification facteur
          </p>

          {showFactors ? (
            <motion.aside
              data-testid="demo-mapping-factors"
              className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"
              {...fadeUp(0.1)}
            >
              <p className="text-sm font-semibold text-white">
                {DEMO_FACTOR.name}
              </p>

              <dl className="mt-4 flex flex-col gap-3">
                <div>
                  <dt className="text-[0.68rem] font-bold uppercase tracking-widest text-white/40">
                    Identifiant facteur conservé
                  </dt>
                  <dd className="mt-1 font-mono text-xs text-emerald-300">
                    {DEMO_FACTOR.reference}
                  </dd>
                </div>

                <div>
                  <dt className="text-[0.68rem] font-bold uppercase tracking-widest text-white/40">
                    Version Base Empreinte®
                  </dt>
                  <dd className="mt-1 text-xs text-white/70">
                    {DEMO_FACTOR.source}
                  </dd>
                </div>

                <div>
                  <dt className="text-[0.68rem] font-bold uppercase tracking-widest text-white/40">
                    Méthode de conversion
                  </dt>
                  <dd className="mt-1 text-xs text-white/70">
                    Activité × facteur d'émission → tCO₂e
                  </dd>
                </div>
              </dl>
            </motion.aside>
          ) : null}
        </div>
      </div>

      {/* Verrou de gouvernance NEURAL. */}
      <div className={isMobile ? "mt-6" : "mt-6 flex justify-end"}>
        <CarbonNeuralValidation
          visible={neuralVisible}
          factorName={DEMO_FACTOR.name}
          source={DEMO_FACTOR.source}
          reference={DEMO_FACTOR.reference}
        />
      </div>

      {/* Remontée de traçabilité auditeur (drill-down du chiffre à la cellule). */}
      <section className="mt-6" data-testid="demo-mapping-audit">
        {auditVisible ? (
          <p className="mb-3 flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-widest text-emerald-300/80">
            <MousePointerClick className="h-3.5 w-3.5" aria-hidden="true" />
            Remontée de preuve — du chiffre publié à la cellule source
          </p>
        ) : null}
        <CarbonAuditTrace visible={auditVisible} />
      </section>
    </PhaseShell>
  );
}
