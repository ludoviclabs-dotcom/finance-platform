import { CheckCircle2, CircleAlert, OctagonX } from "lucide-react";

import {
  policyDecisions,
  type PolicyDecision,
  type SafetyVerdict,
} from "@/lib/data/agent-safety";

const VERDICT_UI: Record<
  SafetyVerdict,
  { icon: typeof CheckCircle2; border: string; bg: string; text: string; label: string }
> = {
  ALLOW: {
    icon: CheckCircle2,
    border: "border-emerald-400/25",
    bg: "bg-emerald-400/[0.07]",
    text: "text-emerald-200",
    label: "ALLOW",
  },
  REVIEW: {
    icon: CircleAlert,
    border: "border-amber-400/25",
    bg: "bg-amber-400/[0.07]",
    text: "text-amber-200",
    label: "REVIEW",
  },
  BLOCK: {
    icon: OctagonX,
    border: "border-red-400/25",
    bg: "bg-red-400/[0.07]",
    text: "text-red-200",
    label: "BLOCK",
  },
};

export function VerdictBadge({ verdict }: { verdict: SafetyVerdict }) {
  const ui = VERDICT_UI[verdict];
  const Icon = ui.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${ui.border} ${ui.bg} ${ui.text}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {ui.label}
    </span>
  );
}

export function PolicyDecisionMatrix({
  decisions = policyDecisions,
}: {
  decisions?: PolicyDecision[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {decisions.map((decision) => {
        const ui = VERDICT_UI[decision.verdict];
        return (
          <article
            key={decision.verdict}
            className={`rounded-[24px] border ${ui.border} ${ui.bg} p-6`}
          >
            <div className="flex items-center justify-between gap-3">
              <VerdictBadge verdict={decision.verdict} />
              <span className="text-xs text-white/45">
                {decision.requiresApproval ? "Validation requise" : "Sans review"}
              </span>
            </div>
            <h3 className="mt-5 font-display text-2xl font-bold text-white">
              {decision.label}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-white/68">
              {decision.summary}
            </p>
            <ul className="mt-5 space-y-2">
              {decision.examples.map((example) => (
                <li key={example} className="flex gap-2 text-sm text-white/68">
                  <span className={`mt-2 h-1.5 w-1.5 rounded-full ${ui.bg}`} />
                  <span>{example}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-3">
              <p className="text-xs text-white/42">Preuve produite</p>
              <p className="mt-1 font-mono text-xs text-white/72">
                {decision.traceEvidence}
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
