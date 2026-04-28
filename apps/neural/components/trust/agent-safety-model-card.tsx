import Link from "next/link";
import { ArrowRight, LockKeyhole, ShieldCheck, UserCheck } from "lucide-react";

import type { AgentSafetyProfile } from "@/lib/data/agent-safety";

const RISK_CLASS: Record<AgentSafetyProfile["riskLevel"], string> = {
  minimal: "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-200",
  limited: "border-amber-400/25 bg-amber-400/[0.08] text-amber-200",
  high: "border-red-400/25 bg-red-400/[0.08] text-red-200",
};

export function AgentSafetyModelCard({
  profile,
  compact = false,
}: {
  profile: AgentSafetyProfile;
  compact?: boolean;
}) {
  return (
    <section className={compact ? "" : "border-b border-white/5 px-6 py-14 md:px-12"}>
      <div className={compact ? "" : "mx-auto max-w-[1280px]"}>
        <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-6 md:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="font-mono text-xs text-white/45">
                Mini Model Card · {profile.agentId}
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold text-white">
                {profile.agentName} · perimetre de securite
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/65">
                {profile.dataScope}
              </p>
            </div>
            <span
              className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${RISK_CLASS[profile.riskLevel]}`}
            >
              {profile.riskLabel}
            </span>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                <ShieldCheck className="h-4 w-4" />
                Outils autorises
              </div>
              <ul className="mt-3 space-y-2">
                {profile.allowedTools.map((item) => (
                  <li key={item} className="text-sm text-white/68">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-200">
                <LockKeyhole className="h-4 w-4" />
                Actions interdites
              </div>
              <ul className="mt-3 space-y-2">
                {profile.forbiddenActions.map((item) => (
                  <li key={item} className="text-sm text-white/68">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-200">
                <UserCheck className="h-4 w-4" />
                HITL obligatoire
              </div>
              <ul className="mt-3 space-y-2">
                {profile.hitlRequiredFor.map((item) => (
                  <li key={item} className="text-sm text-white/68">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <p className="text-xs text-white/42">Gates deterministes</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.deterministicGates.map((gate) => (
                  <span
                    key={gate}
                    className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 font-mono text-xs text-white/72"
                  >
                    {gate}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/62">
                {profile.fallbackBehavior}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <p className="text-xs text-white/42">AI Act et limites</p>
              <p className="mt-2 text-sm font-semibold text-white">
                {profile.aiActClass}
              </p>
              <ul className="mt-3 space-y-2">
                {profile.knownLimits.map((limit) => (
                  <li key={limit} className="text-sm text-white/62">
                    {limit}
                  </li>
                ))}
              </ul>
              <p className="mt-3 font-mono text-xs text-white/50">
                Testset : {profile.lastTestset}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/trust/agent-safety"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.09]"
            >
              Voir la preuve securite agents
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
