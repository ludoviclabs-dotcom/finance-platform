"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import {
  CheckCircle,
  Clock,
  Circle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { SectionTitle } from "@/components/ui/section-title";
import { ChartCard } from "@/components/ui/chart-card";
import { esrsStandards, esrsRadialData } from "@/lib/data";
import { pageVariants, staggerContainer, staggerItem } from "@/lib/animations";

const statusConfig = {
  compliant: { label: "Conforme", icon: CheckCircle, color: "text-[var(--color-success)]", bg: "bg-[var(--color-success)]/15" },
  in_progress: { label: "En cours", icon: Clock, color: "text-[var(--color-warning)]", bg: "bg-[var(--color-warning)]/15" },
  not_started: { label: "Non démarré", icon: Circle, color: "text-[var(--color-foreground-subtle)]", bg: "bg-[var(--color-foreground-subtle)]/15" },
};

export function ESRSPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const avgProgress = Math.round(
    esrsStandards.reduce((acc, s) => acc + s.progress, 0) / esrsStandards.length
  );

  return (
    <motion.div {...pageVariants} className="p-6 space-y-6">
      <SectionTitle
        title="Normes ESRS / CSRD"
        subtitle="Suivi de conformité aux 12 normes European Sustainability Reporting Standards"
      />

      {/* Overview cards */}
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <motion.div
          variants={staggerItem}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-center"
        >
          <p className="text-sm text-[var(--color-foreground-muted)] mb-1">Conformité globale</p>
          <p className="text-3xl font-display font-bold text-carbon-emerald">{avgProgress}%</p>
        </motion.div>
        {(["compliant", "in_progress", "not_started"] as const).map((status) => {
          const count = esrsStandards.filter((s) => s.status === status).length;
          const cfg = statusConfig[status];
          const Icon = cfg.icon;
          return (
            <motion.div
              key={status}
              variants={staggerItem}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 flex items-center gap-3"
            >
              <Icon className={`w-5 h-5 ${cfg.color}`} />
              <div>
                <p className="text-2xl font-display font-bold text-[var(--color-foreground)]">{count}</p>
                <p className="text-xs text-[var(--color-foreground-muted)]">{cfg.label}</p>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Radar + List */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Radar chart */}
        <ChartCard title="Couverture ESRS" subtitle="Score par norme" className="lg:col-span-2">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={esrsRadialData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="var(--color-border)" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: "var(--color-foreground-muted)", fontSize: 11 }}
                />
                <Radar
                  name="Progression"
                  dataKey="value"
                  stroke="#059669"
                  fill="#059669"
                  fillOpacity={0.2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* ESRS list */}
        <div className="lg:col-span-3 space-y-2">
          {esrsStandards.map((standard) => {
            const isOpen = expanded === standard.id;
            const cfg = statusConfig[standard.status];
            const Icon = cfg.icon;

            return (
              <motion.div
                key={standard.id}
                variants={staggerItem}
                initial="initial"
                animate="animate"
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden"
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : standard.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer"
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-carbon-emerald">{standard.id}</span>
                      <span className="text-sm font-medium text-[var(--color-foreground)]">
                        {standard.name}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${standard.progress}%`,
                            backgroundColor:
                              standard.progress >= 80
                                ? "var(--color-success)"
                                : standard.progress >= 50
                                ? "var(--color-warning)"
                                : "var(--color-foreground-subtle)",
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono text-[var(--color-foreground-muted)] w-10 text-right">
                        {standard.progress}%
                      </span>
                    </div>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-[var(--color-foreground-muted)]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[var(--color-foreground-muted)]" />
                  )}
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-1 border-t border-[var(--color-border)]">
                        <p className="text-sm text-[var(--color-foreground-muted)] mb-3">
                          {standard.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-[var(--color-foreground-subtle)]">
                            Data points : {standard.completedPoints} / {standard.dataPoints}
                          </span>
                          <span className={cfg.color}>{cfg.label}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
