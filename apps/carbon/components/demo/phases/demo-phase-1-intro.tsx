"use client";

// PHASE 1 — Intro (séquence d'ouverture bespoke).
//
// On délaisse l'« atome IA générique » pour une ouverture qui DIT le produit :
// le wordmark Carbon&Co avec un trait dégradé qui se trace, la promesse de
// traçabilité, puis un APERÇU DU PIPELINE (cellule source → preuve) en 5 maillons
// reliés qui se révèlent en cascade. Un discret bandeau « moteur NEURAL · facteurs
// ADEME versionnés » ancre la crédibilité sans surjouer l'IA.
//
//   • intro-neural-appear : wordmark + trait tracé + promesse.
//   • intro-prompt-import : pipeline (5 maillons) + bandeau moteur.
//
// Composant PRÉSENTATIONNEL : il lit `currentMoment` et anime selon le moment.
// prefers-reduced-motion : état final immédiat, sans animation.

import { motion, useReducedMotion } from "framer-motion";
import {
  Calculator,
  FileSpreadsheet,
  FileText,
  Link2,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import { PhaseShell } from "@/components/demo/phases/phase-shell";
import { useDemoTimeline } from "@/lib/hooks/use-demo-timeline";
import {
  PIPELINE_STEPS,
  type PipelineIcon,
  isMomentAtOrAfter,
} from "@/components/demo/demo-types";
import { EASE } from "@/components/demo/demo-tokens";

/** Clé d'icône de maillon → composant lucide. */
const PIPELINE_ICONS: Record<PipelineIcon, LucideIcon> = {
  sheet: FileSpreadsheet,
  calculator: Calculator,
  shield: ShieldCheck,
  link: Link2,
  file: FileText,
};

export function DemoPhase1Intro() {
  const reduce = useReducedMotion();
  const { currentMoment } = useDemoTimeline();

  const titleVisible =
    reduce || isMomentAtOrAfter(currentMoment, "intro-neural-appear");
  const pipelineVisible =
    reduce || isMomentAtOrAfter(currentMoment, "intro-prompt-import");

  const fadeUp = (delay = 0) =>
    reduce
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, ease: EASE.out, delay },
        };

  return (
    <PhaseShell testId="demo-phase-1">
      <div className="flex min-h-[58vh] flex-col items-center justify-center text-center">
        {/* Kicker discret. */}
        {titleVisible ? (
          <motion.p
            className="text-[0.68rem] font-bold uppercase tracking-[0.3em] text-emerald-300/70"
            {...fadeUp(0)}
          >
            Démonstration · 100 secondes
          </motion.p>
        ) : null}

        {/* Wordmark + trait dégradé qui se trace sous le nom. */}
        <div className="relative mt-5">
          <h1 className="text-6xl font-extrabold tracking-tight text-white md:text-7xl">
            Carbon<span className="text-emerald-400">&amp;</span>Co
          </h1>
          <motion.span
            aria-hidden="true"
            className="absolute -bottom-2 left-0 h-[3px] w-full rounded-full"
            style={{
              transformOrigin: "left",
              background:
                "linear-gradient(90deg, #34D399 0%, #22D3EE 60%, transparent 100%)",
            }}
            initial={reduce ? false : { scaleX: 0 }}
            animate={reduce ? undefined : { scaleX: 1 }}
            transition={{ duration: 0.9, ease: EASE.out, delay: 0.25 }}
          />
        </div>

        {/* Promesse : la traçabilité, pas la « magie IA ». */}
        <motion.p className="mt-7 max-w-xl text-lg text-white/60" {...fadeUp(0.15)}>
          De la cellule source au rapport auditable.
        </motion.p>

        {/* Aperçu du pipeline : 5 maillons reliés qui se révèlent en cascade. */}
        {pipelineVisible ? (
          <motion.div
            data-testid="demo-intro-pipeline"
            className="mt-10 flex flex-wrap items-center justify-center gap-x-1 gap-y-3"
            initial={reduce ? false : "hidden"}
            animate={reduce ? undefined : "visible"}
            variants={
              reduce
                ? undefined
                : { hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }
            }
          >
            {PIPELINE_STEPS.map((step, i) => {
              const Icon = PIPELINE_ICONS[step.icon];
              const isLast = i === PIPELINE_STEPS.length - 1;
              return (
                <motion.div
                  key={step.id}
                  className="flex items-center gap-1"
                  variants={
                    reduce
                      ? undefined
                      : {
                          hidden: { opacity: 0, y: 10, scale: 0.92 },
                          visible: { opacity: 1, y: 0, scale: 1 },
                        }
                  }
                  transition={{ duration: 0.32, ease: EASE.out }}
                >
                  <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2">
                    <Icon className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                    <span className="text-sm font-semibold text-white/85">
                      {step.label}
                    </span>
                  </span>
                  {!isLast ? (
                    <span aria-hidden="true" className="px-1 text-emerald-400/50">
                      →
                    </span>
                  ) : null}
                </motion.div>
              );
            })}
          </motion.div>
        ) : null}

        {/* Bandeau moteur — crédibilité sobre (pas de surenchère « IA »). */}
        {pipelineVisible ? (
          <motion.p
            className="mt-8 font-mono text-xs text-white/40"
            {...fadeUp(0.1)}
          >
            moteur NEURAL · facteurs ADEME versionnés · ESRS natif
          </motion.p>
        ) : null}
      </div>
    </PhaseShell>
  );
}
