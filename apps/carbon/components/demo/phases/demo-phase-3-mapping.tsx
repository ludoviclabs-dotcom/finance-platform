"use client";

// PHASE 3 — Calcul des émissions (LA SCÈNE LA PLUS RICHE).
//
// Scène présentationnelle de la séquence /demo : on matérialise le mapping des
// lignes source vers leurs facteurs d'émission, le calcul du total GES, puis la
// double preuve (validation NEURAL + remontée de traçabilité auditeur). Cinq
// moments rythment l'apparition du contenu (cf. MOMENT_SEQUENCE) :
//   1. « mapping-rows-fade »        → lignes source (MAPPING_ROWS) + badges.
//   2. « mapping-factors-attach »   → encart « Justification facteur » (aside).
//   3. « mapping-counter »          → compteur GES qui s'anime de 0 → cible.
//   4. « mapping-neural-validation »→ verrou de gouvernance NEURAL (amber→vert).
//   5. « mapping-audit-trace »      → cascade de traçabilité + halo du compteur.
//
// Composant PRÉSENTATIONNEL : il LIT currentMoment via useDemoTimeline() mais ne
// pilote JAMAIS la progression — l'horloge auto-avance toute seule. Chaque bloc
// se révèle dès que le moment correspondant est atteint (isMomentAtOrAfter), de
// sorte que l'état reste cohérent même après un saut de phase. Les composants
// enfants (compteur, validation, traçabilité) gèrent eux-mêmes leurs timers.
//
// prefers-reduced-motion : on rend directement l'ÉTAT FINAL (tout visible, sans
// animation d'entrée) ; les enfants affichent eux aussi leur état final. Aucun
// timer/raf n'est posé dans CE fichier — rien à nettoyer ici.

import { motion, useReducedMotion } from "framer-motion";

import { PhaseShell } from "@/components/demo/phases/phase-shell";
import { AnimatedGesCounter } from "@/components/demo/primitives/animated-ges-counter";
import { CarbonNeuralValidation } from "@/components/demo/features/carbon-neural-validation";
import { CarbonAuditTrace } from "@/components/demo/features/carbon-audit-trace";
import {
  MAPPING_ROWS,
  DEMO_FACTOR,
  DEMO_GES_TARGET,
  DEMO_GES_UNIT,
  DEMO_TONE_CLASSES,
  PHASE_META,
  isMoment,
  isMomentAtOrAfter,
} from "@/components/demo/demo-types";
import { EASE } from "@/components/demo/demo-tokens";
import { useDemoTimeline } from "@/lib/hooks/use-demo-timeline";

/** Classes de base d'un badge d'état (complétées par la tonalité de la ligne). */
const BADGE_BASE = "rounded-full border px-3 py-1 text-xs font-bold";

export function DemoPhase3Mapping() {
  const reduce = useReducedMotion();
  const { currentMoment, isMobile } = useDemoTimeline();

  // Visibilité dérivée du moment courant : chaque seuil reste vrai pour tous les
  // moments ultérieurs (cumulatif), ce qui garantit un état final stable. Sous
  // mouvement réduit, on force l'état final : tout est visible d'emblée.
  const showRows =
    reduce || isMomentAtOrAfter(currentMoment, "mapping-rows-fade");
  const showFactors =
    reduce || isMomentAtOrAfter(currentMoment, "mapping-factors-attach");
  const showCounter =
    reduce || isMomentAtOrAfter(currentMoment, "mapping-counter");

  // Le compteur s'active pile au moment du calcul (et le reste ensuite) ; il se
  // pare du halo lumineux exactement sur le moment de la remontée auditeur.
  const counterActive = isMomentAtOrAfter(currentMoment, "mapping-counter");
  const counterGlow = isMoment(currentMoment, "mapping-audit-trace");

  // Les deux features de preuve sont pilotées par leur prop `visible` (le moment
  // précis) — elles gèrent elles-mêmes apparition / disparition / timers.
  const neuralVisible = isMoment(currentMoment, "mapping-neural-validation");
  const auditVisible = isMoment(currentMoment, "mapping-audit-trace");

  // Transition d'entrée commune (fade + léger translate), neutralisée sous
  // mouvement réduit (on rend alors l'état final, sans animation).
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
      {/* Compteur GES central : bien visible, centré au-dessus des colonnes. */}
      {showCounter ? (
        <motion.div
          data-testid="demo-mapping-counter"
          className="flex flex-col items-center justify-center py-2 text-center"
          {...fadeUp(0)}
        >
          <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-widest text-emerald-300/80">
            Total des émissions calculé
          </p>
          <AnimatedGesCounter
            target={DEMO_GES_TARGET}
            unit={DEMO_GES_UNIT}
            active={counterActive}
            glow={counterGlow}
          />
        </motion.div>
      ) : null}

      {/* Corps : desktop = 2 colonnes (lignes source / justification facteur),
          mobile = pile. Les seuils de visibilité restent indépendants. */}
      <div
        className={
          isMobile
            ? "mt-8 flex flex-col gap-6"
            : "mt-8 grid grid-cols-2 items-start gap-6"
        }
      >
        {/* Colonne gauche : lignes source mappées (libellé + badge de tonalité). */}
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

        {/* Colonne droite : encart « Justification facteur » (aside discret).
            S'attache lorsque le moment « mapping-factors-attach » est atteint. */}
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
                {/* Identifiant du facteur conservé dans le journal de preuve. */}
                <div>
                  <dt className="text-[0.68rem] font-bold uppercase tracking-widest text-white/40">
                    Identifiant facteur conservé
                  </dt>
                  <dd className="mt-1 font-mono text-xs text-emerald-300">
                    {DEMO_FACTOR.reference}
                  </dd>
                </div>

                {/* Version de la base officielle de facteurs d'émission. */}
                <div>
                  <dt className="text-[0.68rem] font-bold uppercase tracking-widest text-white/40">
                    Version Base Empreinte®
                  </dt>
                  <dd className="mt-1 text-xs text-white/70">
                    {DEMO_FACTOR.source}
                  </dd>
                </div>

                {/* Méthode de conversion appliquée pour obtenir les tCO₂e. */}
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

      {/* Verrou de gouvernance NEURAL : il gère lui-même son apparition /
          disparition selon `visible`. En bas (colonne droite sur desktop). */}
      <div className={isMobile ? "mt-6" : "mt-6 flex justify-end"}>
        <CarbonNeuralValidation
          visible={neuralVisible}
          factorName={DEMO_FACTOR.name}
          source={DEMO_FACTOR.source}
          reference={DEMO_FACTOR.reference}
        />
      </div>

      {/* Section dédiée : remontée de traçabilité auditeur (cascade verticale),
          montée sous le compteur. Le composant maîtrise sa durée d'affichage. */}
      <section className="mt-6" data-testid="demo-mapping-audit">
        <CarbonAuditTrace visible={auditVisible} />
      </section>
    </PhaseShell>
  );
}
