"use client";

/**
 * AiActivityTrace — surface de la revue IA du cockpit.
 *
 * Affiche UNIQUEMENT la trace FONCTIONNELLE du pipeline (sélection des preuves,
 * licence/sensibilité, résolution des citations, confrontation, brouillon, revue)
 * — JAMAIS de chain-of-thought. Puis rend le VRAI composant <ReviewGate/> avec la
 * revue canonique (mode demo) : les 4 statuts déterministes (étayé, partiellement,
 * contredit, non étayé), citations ouvrables. IA SIMULÉE, zéro appel externe.
 */

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { CheckCircle2, Cpu, ShieldOff } from "lucide-react";

import { ReviewGate } from "@/components/intelligence/review-gate";
import {
  ASTERION_AI_TRACE,
  ASTERION_EXCLUDED_EVIDENCE,
  ASTERION_REVIEW,
} from "@/lib/demo/asterion-motion-data";

export function AiActivityTrace() {
  const reduce = useReducedMotion();
  const [revealed, setRevealed] = useState(reduce ? ASTERION_AI_TRACE.length : 0);

  useEffect(() => {
    if (reduce) {
      setRevealed(ASTERION_AI_TRACE.length);
      return;
    }
    setRevealed(0);
    const t = setInterval(() => {
      setRevealed((n) => {
        if (n >= ASTERION_AI_TRACE.length) {
          clearInterval(t);
          return n;
        }
        return n + 1;
      });
    }, 220);
    return () => clearInterval(t);
  }, [reduce]);

  return (
    <div className="space-y-4" data-testid="ai-activity-trace">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-carbon-emerald-light">
          <Cpu className="h-3.5 w-3.5" aria-hidden />
          Pipeline de revue (trace fonctionnelle)
        </p>
        <ol className="space-y-2">
          {ASTERION_AI_TRACE.map((step, i) => {
            const done = i < revealed;
            return (
              <li
                key={step.id}
                data-testid={`ai-trace-step-${step.id}`}
                data-done={done}
                className={`flex items-start gap-2 transition-opacity duration-200 motion-reduce:transition-none ${
                  done ? "opacity-100" : "opacity-30"
                }`}
              >
                <CheckCircle2
                  className={`mt-0.5 h-4 w-4 flex-shrink-0 ${done ? "text-carbon-emerald" : "text-white/20"}`}
                  aria-hidden
                />
                <div>
                  <p className="text-sm font-medium text-white/90">{step.label}</p>
                  <p className="text-xs text-white/50">{step.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <div
          className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-[11px] text-amber-200/80"
          data-testid="ai-trace-excluded"
        >
          <ShieldOff className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
          <span className="font-semibold">Exclues du contexte modèle :</span>
          {ASTERION_EXCLUDED_EVIDENCE.map((e) => (
            <span key={e.marker} className="rounded bg-white/5 px-1.5 py-0.5">
              {e.label} ({e.reason})
            </span>
          ))}
        </div>
      </div>

      {/* Composant RÉEL de PR-11, alimenté par la revue canonique (mode demo). */}
      <ReviewGate result={ASTERION_REVIEW} title="Revue IA — Asterion (simulée)" />
    </div>
  );
}
