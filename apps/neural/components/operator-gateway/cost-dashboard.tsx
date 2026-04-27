/**
 * CostDashboard — coût et usage par agent.
 */

interface AgentCost {
  agent: string;
  cost: number;
  calls: number;
  share: number;
}

interface CostDashboardProps {
  monthlyTotal: number;
  currency: string;
  month: string;
  byAgent: AgentCost[];
}

function formatEuro(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

const AGENT_COLORS = [
  "from-violet-400 to-violet-600",
  "from-emerald-400 to-emerald-600",
  "from-cyan-400 to-cyan-600",
  "from-amber-400 to-amber-600",
  "from-rose-400 to-rose-600",
  "from-orange-400 to-orange-600",
  "from-fuchsia-400 to-fuchsia-600",
  "from-white/40 to-white/60",
];

export function CostDashboard({ monthlyTotal, month, byAgent }: CostDashboardProps) {
  const totalCalls = byAgent.reduce((acc, a) => acc + a.calls, 0);
  const avgCostPerCall = monthlyTotal / totalCalls;

  return (
    <div className="space-y-6">
      {/* Top stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[20px] border border-emerald-400/25 bg-emerald-400/[0.06] p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/70">
            Coût mensuel
          </p>
          <p className="mt-3 font-display text-4xl font-bold tabular-nums text-emerald-200">
            {formatEuro(monthlyTotal)}
          </p>
          <p className="mt-2 text-xs text-white/55">{month}</p>
        </div>
        <div className="rounded-[20px] border border-violet-400/25 bg-violet-400/[0.06] p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-violet-300/70">
            Décisions agent
          </p>
          <p className="mt-3 font-display text-4xl font-bold tabular-nums text-violet-100">
            {new Intl.NumberFormat("fr-FR").format(totalCalls)}
          </p>
          <p className="mt-2 text-xs text-white/55">cumulé sur le mois</p>
        </div>
        <div className="rounded-[20px] border border-cyan-400/25 bg-cyan-400/[0.06] p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-300/70">Coût/décision</p>
          <p className="mt-3 font-display text-4xl font-bold tabular-nums text-cyan-100">
            {avgCostPerCall.toFixed(3)}€
          </p>
          <p className="mt-2 text-xs text-white/55">moyenne pondérée</p>
        </div>
      </div>

      {/* Breakdown by agent */}
      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
        <h3 className="font-display text-lg font-bold tracking-tight text-white">
          Répartition par agent
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-white/55">
          Top 7 agents par coût absolu — les autres regroupés.
        </p>
        <div className="mt-5 space-y-3">
          {byAgent.map((a, i) => {
            const gradient = AGENT_COLORS[i] || AGENT_COLORS[AGENT_COLORS.length - 1];
            return (
              <div key={a.agent}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <p className="font-semibold text-white/90">{a.agent}</p>
                  <div className="flex items-baseline gap-3">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-white/40">
                      {new Intl.NumberFormat("fr-FR").format(a.calls)} décisions
                    </span>
                    <span className="font-mono tabular-nums text-white/80">{formatEuro(a.cost)}</span>
                    <span className="font-mono tabular-nums text-emerald-300/80">{a.share}%</span>
                  </div>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-500 ease-out`}
                    style={{ width: `${a.share}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
