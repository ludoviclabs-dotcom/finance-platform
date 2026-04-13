"use client";

import { motion } from "framer-motion";
import { Users, Database, BookOpen, Shield, ArrowRight } from "lucide-react";
import { staggerItem } from "@/lib/animations";
import type { InvestmentPillar, ValueChainStep } from "@/lib/api";

interface Props {
  investments: InvestmentPillar[];
  valueChain: ValueChainStep[];
}

const PILLAR_ICONS: Record<string, React.ReactNode> = {
  rh: <Users className="w-5 h-5" />,
  si: <Database className="w-5 h-5" />,
  conseil: <BookOpen className="w-5 h-5" />,
  gouvernance: <Shield className="w-5 h-5" />,
};

const PILLAR_COLORS: Record<string, string> = {
  rh: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  si: "text-violet-400 bg-violet-400/10 border-violet-400/20",
  conseil: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  gouvernance: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
};

function fmtBudget(low: number, high: number, unit: string): string {
  const fmt = (n: number) =>
    n >= 1000 ? `${(n / 1000).toLocaleString("fr-FR")}k` : `${n.toLocaleString("fr-FR")}`;
  if (low === 0 && high <= 5000) return "Temps interne";
  return `${fmt(low)} – ${fmt(high)} € ${unit.includes("EUR") ? "" : unit}`.trim();
}

export function InvestmentAndValueChain({ investments, valueChain }: Props) {
  return (
    <motion.div variants={staggerItem} className="space-y-8">
      {/* Section investissements */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-foreground)] mb-1">
          Les 4 piliers d&apos;investissement
        </h2>
        <p className="text-sm text-[var(--color-foreground-muted)] mb-5">
          Les ressources à mobiliser pour produire une donnée ESG fiable et continue.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {investments.map((pillar) => {
            const colorClass = PILLAR_COLORS[pillar.id] ?? "text-[var(--color-primary)] bg-[var(--color-primary)]/10 border-[var(--color-primary)]/20";
            return (
              <div
                key={pillar.id}
                className="rounded-xl border bg-[var(--color-surface)] p-5 space-y-3 hover:border-[var(--color-primary)]/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg border ${colorClass}`}>
                    {PILLAR_ICONS[pillar.id] ?? <Shield className="w-5 h-5" />}
                  </div>
                  <h3 className="font-semibold text-[var(--color-foreground)]">{pillar.label}</h3>
                </div>

                <p className="text-sm text-[var(--color-foreground-muted)]">{pillar.description}</p>

                {pillar.implies.length > 0 && (
                  <ul className="space-y-1">
                    {pillar.implies.map((item, i) => (
                      <li key={i} className="text-xs text-[var(--color-foreground-muted)] flex gap-2">
                        <span className="text-[var(--color-primary)] mt-0.5 shrink-0">·</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                )}

                {pillar.budgetRanges.length > 0 && (
                  <div className="pt-2 border-t border-[var(--color-border)] space-y-1">
                    {pillar.budgetRanges.map((br) => (
                      <div key={br.segment} className="flex justify-between items-center text-xs">
                        <span className="text-[var(--color-foreground-muted)] capitalize">
                          {br.segment === "grand_groupe" ? "Grand groupe" : br.segment.toUpperCase()}
                        </span>
                        <span className="font-medium text-[var(--color-foreground)]">
                          {fmtBudget(br.low, br.high, br.unit)}
                        </span>
                      </div>
                    ))}
                    {pillar.qualitative && (
                      <p className="text-[10px] text-[var(--color-foreground-muted)] italic">
                        Estimations indicatives — Carbon & Co
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Chaîne de valeur */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-foreground)] mb-1">
          La mécanique de création de valeur
        </h2>
        <p className="text-sm text-[var(--color-foreground-muted)] mb-5">
          Comment les investissements se transforment en valeur économique durable.
        </p>

        <div className="flex flex-col gap-2">
          {valueChain.map((step, i) => (
            <div key={step.order} className="flex items-start gap-3">
              {/* Étape */}
              <div className="flex flex-col items-center shrink-0">
                <div className="w-7 h-7 rounded-full bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 flex items-center justify-center">
                  <span className="text-xs font-bold text-[var(--color-primary)]">{step.order}</span>
                </div>
                {i < valueChain.length - 1 && (
                  <div className="w-px h-6 bg-[var(--color-primary)]/20 my-1" />
                )}
              </div>

              <div className="pb-4 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm text-[var(--color-foreground)]">
                    {step.label}
                  </span>
                  {i < valueChain.length - 1 && (
                    <ArrowRight className="w-3.5 h-3.5 text-[var(--color-primary)] opacity-50" />
                  )}
                </div>
                <p className="text-sm text-[var(--color-foreground-muted)]">{step.description}</p>
                {step.precisionNote && (
                  <p className="text-xs text-amber-400/80 mt-1.5 italic">
                    ⚠ {step.precisionNote}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
