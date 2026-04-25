"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDot, ShieldAlert } from "lucide-react";

import {
  BANK_MKT_AGENTS,
  BANK_MKT_SCENARIOS,
  type BankMktAgentSlug,
  type BankMktGateState,
  type BankMktVerdict,
} from "@/lib/data/bank-marketing-catalog";

const VERDICT_STYLE: Record<BankMktVerdict, string> = {
  PASS: "border-emerald-400/35 bg-emerald-400/10 text-emerald-100",
  PASS_WITH_REVIEW: "border-amber-400/35 bg-amber-400/10 text-amber-100",
  BLOCK: "border-rose-400/35 bg-rose-400/10 text-rose-100",
};

const GATE_STYLE: Record<BankMktGateState, string> = {
  pass: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
  review: "border-amber-400/25 bg-amber-400/10 text-amber-100",
  block: "border-rose-400/25 bg-rose-400/10 text-rose-100",
};

const GATE_ICON = {
  pass: CheckCircle2,
  review: AlertTriangle,
  block: ShieldAlert,
};

export function BankMarketingConsole() {
  const [activeAgent, setActiveAgent] = useState<BankMktAgentSlug>(
    "bank-marketing-compliance-guard",
  );
  const scenarios = useMemo(
    () => BANK_MKT_SCENARIOS.filter((scenario) => scenario.agentSlug === activeAgent),
    [activeAgent],
  );
  const [activeScenarioId, setActiveScenarioId] = useState(scenarios[0]?.id ?? "");

  const activeScenario = scenarios.find((scenario) => scenario.id === activeScenarioId) ?? scenarios[0];
  const activeAgentMeta = BANK_MKT_AGENTS.find((agent) => agent.slug === activeAgent);

  function handleAgentChange(slug: BankMktAgentSlug) {
    const firstScenario = BANK_MKT_SCENARIOS.find((scenario) => scenario.agentSlug === slug);
    setActiveAgent(slug);
    setActiveScenarioId(firstScenario?.id ?? "");
  }

  if (!activeAgentMeta || !activeScenario) {
    return null;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="rounded-[20px] border border-white/10 bg-white/[0.045] p-3">
        <div className="px-2 pb-3 pt-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/45">
            Console scenario-id
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white/62">
            12 cas synthetiques issus des workbooks. Aucun texte libre, aucun appel LLM.
          </p>
        </div>
        <div className="space-y-2">
          {BANK_MKT_AGENTS.map((agent) => {
            const selected = agent.slug === activeAgent;
            return (
              <button
                key={agent.slug}
                type="button"
                onClick={() => handleAgentChange(agent.slug)}
                className={[
                  "w-full rounded-2xl border px-4 py-3 text-left transition-colors",
                  selected
                    ? "border-cyan-300/35 bg-cyan-300/10"
                    : "border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.05]",
                ].join(" ")}
              >
                <span className="font-mono text-[11px] text-white/45">{agent.id}</span>
                <span className="mt-1 block text-sm font-semibold text-white">{agent.name}</span>
                <span className="mt-1 block text-xs leading-relaxed text-white/50">{agent.owner}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-[20px] border border-white/10 bg-[#081521] p-5 shadow-2xl shadow-black/20">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan-200/70">
              {activeAgentMeta.id} / {activeAgentMeta.owner}
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              {activeAgentMeta.name}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/62">
              {activeAgentMeta.mission}
            </p>
          </div>
          <span className="max-w-full truncate rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1 font-mono text-[11px] text-white/62">
            {activeAgentMeta.workbook}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              onClick={() => setActiveScenarioId(scenario.id)}
              className={[
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                scenario.id === activeScenario.id
                  ? "border-white/35 bg-white text-[#081521]"
                  : "border-white/[0.12] bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white",
              ].join(" ")}
            >
              {scenario.id}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_300px]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/40">
                  {activeScenario.product} / {activeScenario.channel} / {activeScenario.segment}
                </p>
                <h4 className="mt-1 text-xl font-semibold text-white">{activeScenario.label}</h4>
              </div>
              <span
                className={[
                  "rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em]",
                  VERDICT_STYLE[activeScenario.verdict],
                ].join(" ")}
              >
                {activeScenario.verdict}
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-white/65">{activeScenario.summary}</p>

            <div className="mt-5 space-y-2">
              {activeScenario.gates.map((gate) => {
                const Icon = GATE_ICON[gate.state];
                return (
                  <div
                    key={`${activeScenario.id}-${gate.id}`}
                    className={[
                      "flex items-start gap-3 rounded-xl border px-3 py-3",
                      GATE_STYLE[gate.state],
                    ].join(" ")}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="break-words font-mono text-[11px] uppercase tracking-[0.08em]">
                        {gate.id}
                      </p>
                      <p className="mt-0.5 text-xs opacity-80">{gate.note}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/40">
              Sortie attendue
            </p>
            <p className="mt-4 text-sm leading-relaxed text-white/68">
              {activeScenario.expectedOutput}
            </p>
            <div className="mt-5 space-y-3">
              {[
                ["Decision", activeScenario.verdict],
                ["Mode", "scenario-id only"],
                ["HITL", activeScenario.verdict === "PASS" ? "logged" : "required"],
                ["Trace", "workbook hash seed"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
                  <span className="text-xs text-white/45">{label}</span>
                  <span className="text-right text-xs font-semibold text-white/78">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.08] p-3">
              <div className="flex items-center gap-2 text-cyan-100">
                <CircleDot className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.12em]">Anti-hallucination</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-cyan-100/70">
                Les gates du workbook determinent le verdict. Le site ne genere pas de nouveau conseil financier.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
