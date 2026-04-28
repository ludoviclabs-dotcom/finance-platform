import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Database,
  FileCheck2,
  FileSearch,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

import { safetyFlowSteps, type SafetyFlowStep } from "@/lib/data/agent-safety";

const ICONS = [Database, FileSearch, BrainCircuit, ShieldCheck, UserCheck, FileCheck2];

export function AgentSafetyFlowchart({
  steps = safetyFlowSteps,
}: {
  steps?: SafetyFlowStep[];
}) {
  return (
    <ol className="grid gap-3 lg:grid-cols-6">
      {steps.map((step, index) => {
        const Icon = ICONS[index] ?? CheckCircle2;
        return (
          <li key={step.id} className="relative">
            <div className="h-full rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-400/25 bg-violet-400/[0.10]">
                  <Icon className="h-5 w-5 text-violet-200" />
                </div>
                <span className="font-mono text-xs text-white/35">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-white">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/62">
                {step.description}
              </p>
              <p className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2 text-xs font-semibold text-emerald-200">
                {step.control}
              </p>
            </div>
            {index < steps.length - 1 ? (
              <div className="absolute right-[-16px] top-1/2 z-10 hidden -translate-y-1/2 lg:block">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#111D35]">
                  <ArrowRight className="h-4 w-4 text-white/55" />
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
