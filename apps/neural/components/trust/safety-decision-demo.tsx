"use client";

import { useMemo, useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";

import { safetyScenarios } from "@/lib/data/agent-safety";
import { VerdictBadge } from "./policy-decision-matrix";

export function SafetyDecisionDemo() {
  const [activeId, setActiveId] = useState(safetyScenarios[0]?.id ?? "");
  const active = useMemo(
    () => safetyScenarios.find((scenario) => scenario.id === activeId) ?? safetyScenarios[0],
    [activeId],
  );

  if (!active) return null;

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-mono text-xs text-white/42">Demo policy engine</p>
          <h3 className="mt-2 font-display text-2xl font-bold text-white">
            ALLOW / REVIEW / BLOCK sur un cas concret
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/62">
            Choisissez un scenario. La sortie change localement pour montrer comment NEURAL
            transforme une intention agent en decision gouvernee.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveId(safetyScenarios[0]?.id ?? "")}
          className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/[0.09]"
        >
          <RotateCcw className="h-4 w-4" />
          Reinitialiser
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {safetyScenarios.map((scenario) => (
          <button
            type="button"
            key={scenario.id}
            onClick={() => setActiveId(scenario.id)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
              active.id === scenario.id
                ? "border-violet-300 bg-violet-400/20 text-white"
                : "border-white/10 bg-white/[0.03] text-white/58 hover:bg-white/[0.07] hover:text-white"
            }`}
          >
            {scenario.title}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_auto_1.1fr] lg:items-stretch">
        <div className="rounded-[22px] border border-red-400/20 bg-red-400/[0.05] p-5">
          <p className="font-mono text-xs text-red-200/75">Tentative agent</p>
          <h4 className="mt-2 text-lg font-semibold text-white">{active.title}</h4>
          <p className="mt-3 text-sm leading-relaxed text-white/68">
            {active.agentAttempt}
          </p>
          <p className="mt-4 text-xs leading-relaxed text-red-100/75">
            Risque : {active.risk}
          </p>
        </div>

        <div className="hidden items-center justify-center lg:flex">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#111D35]">
            <ArrowRight className="h-5 w-5 text-white/55" />
          </div>
        </div>

        <div className="rounded-[22px] border border-emerald-400/20 bg-emerald-400/[0.05] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-xs text-emerald-200/75">
              Decision NEURAL
            </p>
            <VerdictBadge verdict={active.verdict} />
          </div>
          <p className="mt-3 text-sm leading-relaxed text-white/72">
            {active.controlApplied}
          </p>
          <p className="mt-4 text-sm font-semibold text-white">
            {active.finalOutcome}
          </p>
          <p className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-3 font-mono text-xs leading-relaxed text-white/62">
            {active.auditEvidence}
          </p>
        </div>
      </div>
    </div>
  );
}
