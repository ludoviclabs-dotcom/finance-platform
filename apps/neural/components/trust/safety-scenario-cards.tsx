import { ArrowRight, FileWarning, ShieldCheck } from "lucide-react";

import {
  safetyScenarios,
  type SafetyScenario,
} from "@/lib/data/agent-safety";
import { VerdictBadge } from "./policy-decision-matrix";

export function SafetyScenarioCards({
  scenarios = safetyScenarios,
}: {
  scenarios?: SafetyScenario[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {scenarios.map((scenario) => (
        <article
          key={scenario.id}
          className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs text-white/42">{scenario.id}</p>
              <h3 className="mt-1 font-display text-2xl font-bold text-white">
                {scenario.title}
              </h3>
            </div>
            <VerdictBadge verdict={scenario.verdict} />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-200">
                <FileWarning className="h-4 w-4" />
                Risque
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white/68">
                {scenario.risk}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                <ShieldCheck className="h-4 w-4" />
                Controle applique
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white/68">
                {scenario.controlApplied}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 text-sm md:grid-cols-[1fr_auto_1fr] md:items-center">
            <p className="rounded-2xl border border-white/10 bg-black/10 p-4 leading-relaxed text-white/62">
              {scenario.agentAttempt}
            </p>
            <ArrowRight className="mx-auto hidden h-5 w-5 text-white/35 md:block" />
            <p className="rounded-2xl border border-white/10 bg-black/10 p-4 leading-relaxed text-white/78">
              {scenario.finalOutcome}
            </p>
          </div>

          <p className="mt-5 rounded-2xl border border-violet-400/20 bg-violet-400/[0.06] px-4 py-3 font-mono text-xs leading-relaxed text-violet-100/85">
            {scenario.auditEvidence}
          </p>
        </article>
      ))}
    </div>
  );
}
