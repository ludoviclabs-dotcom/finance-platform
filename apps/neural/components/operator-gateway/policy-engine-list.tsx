/**
 * PolicyEngineList — liste visuelle des policies enforced.
 */

import { ShieldCheck } from "lucide-react";

interface Policy {
  id: string;
  label: string;
  description: string;
  category: string;
  blocked24h: number;
}

const CATEGORY_CLS: Record<string, string> = {
  Security: "border-violet-400/25 bg-violet-400/[0.08] text-violet-200",
  "AI Act": "border-cyan-400/25 bg-cyan-400/[0.08] text-cyan-200",
  RGPD: "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-200",
  Operational: "border-amber-400/25 bg-amber-400/[0.08] text-amber-200",
  Sectoriel: "border-rose-400/25 bg-rose-400/[0.08] text-rose-200",
};

export function PolicyEngineList({ policies }: { policies: Policy[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {policies.map((policy) => {
        const cCls = CATEGORY_CLS[policy.category] || CATEGORY_CLS["Operational"];
        return (
          <div
            key={policy.id}
            className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4 transition-colors hover:border-white/16"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-emerald-400/25 bg-emerald-400/[0.08]">
                  <ShieldCheck className="h-4 w-4 text-emerald-300" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{policy.label}</p>
                  <span
                    className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${cCls}`}
                  >
                    {policy.category}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Bloqué 24h</p>
                <p
                  className={`font-display text-xl font-bold tabular-nums ${
                    policy.blocked24h > 0 ? "text-amber-300" : "text-white/40"
                  }`}
                >
                  {policy.blocked24h}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-white/60">{policy.description}</p>
          </div>
        );
      })}
    </div>
  );
}
