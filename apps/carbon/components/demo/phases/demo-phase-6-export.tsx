"use client";

// PHASE 6 — Export auditeur (la livraison signée du dossier de preuve).
//
// On matérialise la remise du dossier à l'auditeur, façon « centre de
// téléchargement » : 3 formats qui se génèrent (coche tracée + reflet qui
// balaie la carte), un manifeste « Evidence Pack » récapitulatif, puis la
// chaîne de preuve qui se signe et la card de vérification publique.
//
//   1. « export-prepare »     → 3 cards de formats (icône + extension).
//   2. « export-checkmarks »  → coche tracée + reflet + bordure emerald +
//                               manifeste Evidence Pack.
//   3. « export-proof-chain » → Feature B (CarbonProofChain).
//   4. « export-verify-card » → Feature C (CarbonVerifyCard).
//
// Composant PRÉSENTATIONNEL. prefers-reduced-motion : état final, sans reflet.

import { motion, useReducedMotion } from "framer-motion";
import {
  FileArchive,
  FileCode2,
  FileText,
  Lock,
  Package,
  type LucideIcon,
} from "lucide-react";

import { PhaseShell } from "@/components/demo/phases/phase-shell";
import { CheckmarkDraw } from "@/components/demo/primitives/checkmark-draw";
import { CarbonProofChain } from "@/components/demo/features/carbon-proof-chain";
import { CarbonVerifyCard } from "@/components/demo/features/carbon-verify-card";
import {
  EXPORT_FORMATS,
  PHASE_META,
  VERIFY_META,
  isMoment,
  isMomentAtOrAfter,
} from "@/components/demo/demo-types";
import { DEMO_CSS, EASE } from "@/components/demo/demo-tokens";
import { useDemoTimeline } from "@/lib/hooks/use-demo-timeline";

/** Décalage du tracé d'une coche à l'autre (en phase avec delayMs = index × step). */
const CHECK_STEP_MS = 150;

/** Icône de type de fichier par format (clé = id). */
const FORMAT_ICON: Record<string, LucideIcon> = {
  pdf: FileText,
  xbrl: FileCode2,
  zip: FileArchive,
};

export function DemoPhase6Export() {
  const reduce = useReducedMotion();
  const { currentMoment, isMobile } = useDemoTimeline();

  const showFormats =
    reduce || isMomentAtOrAfter(currentMoment, "export-prepare");
  const showChecks =
    reduce || isMomentAtOrAfter(currentMoment, "export-checkmarks");
  const showProofChain =
    reduce || isMomentAtOrAfter(currentMoment, "export-proof-chain");

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
          {EXPORT_FORMATS.map((format, index) => {
            const Icon = FORMAT_ICON[format.id] ?? FileText;
            return (
              <motion.article
                key={format.id}
                data-testid="demo-export-format"
                className={`relative flex flex-col overflow-hidden rounded-2xl border bg-white/[0.04] p-5 transition-colors ${
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
                {/* En-tête : icône + extension à gauche, coche tracée à droite. */}
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2">
                    <Icon className="h-5 w-5 text-emerald-400" aria-hidden="true" />
                    <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 font-mono text-xs font-bold text-emerald-200">
                      {format.ext}
                    </span>
                  </span>
                  {showChecks ? (
                    <CheckmarkDraw
                      size={20}
                      delayMs={reduce ? 0 : index * CHECK_STEP_MS}
                    />
                  ) : null}
                </div>

                <p className="mt-4 text-base font-bold text-white">
                  {format.label}
                </p>
                <p className="mt-1 text-sm text-white/55">{format.detail}</p>

                {/* Reflet qui balaie la carte une fois le format généré. */}
                {showChecks && !reduce ? (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3"
                    style={{ animationDelay: `${index * 200}ms` }}
                  >
                    <span
                      className={`block h-full w-full ${DEMO_CSS.sheen}`}
                      style={{
                        background:
                          "linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)",
                      }}
                    />
                  </span>
                ) : null}
              </motion.article>
            );
          })}
        </div>
      ) : null}

      {/* Manifeste « Evidence Pack » : récapitulatif du dossier signé. */}
      {showChecks ? (
        <motion.div
          data-testid="demo-export-manifest"
          className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE.out, delay: reduce ? 0 : 0.2 }}
        >
          <span className="inline-flex items-center gap-2">
            <Package className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            <span className="font-mono text-sm text-white">
              {VERIFY_META.filename}
            </span>
          </span>
          <span className="font-mono text-xs text-white/45">
            {VERIFY_META.sizeLabel}
          </span>
          <span className="font-mono text-xs text-white/45">
            {VERIFY_META.eventCount} événements
          </span>
          <span className="font-mono text-xs text-white/45">
            {VERIFY_META.frozenCount} figés
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            signé
          </span>
        </motion.div>
      ) : null}

      {/* Feature B — chaîne de preuve. */}
      {showProofChain ? (
        <p className="mt-8 mb-3 flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-widest text-emerald-300/80">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          Chaîne de preuve signée
        </p>
      ) : null}
      <CarbonProofChain visible={showProofChain} />

      {/* Feature C — vérification publique (overlay / bottom sheet en interne). */}
      <CarbonVerifyCard visible={verifyVisible} />
    </PhaseShell>
  );
}
