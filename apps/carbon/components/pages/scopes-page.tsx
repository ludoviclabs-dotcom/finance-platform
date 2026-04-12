"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Factory, Zap, Truck, TrendingDown, TrendingUp, ChevronRight } from "lucide-react";
import { SectionTitle } from "@/components/ui/section-title";
import { ChartCard } from "@/components/ui/chart-card";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { scopeDetails } from "@/lib/data";
import { pageVariants, staggerContainer, staggerItem } from "@/lib/animations";
import { useCarbonSnapshot } from "@/lib/hooks/use-carbon-snapshot";

const scopeIcons = [
  <Factory key="s1" className="w-6 h-6" />,
  <Zap key="s2" className="w-6 h-6" />,
  <Truck key="s3" className="w-6 h-6" />,
];

const scopeColors = ["#059669", "#0891B2", "#7C3AED"];

export function ScopesPage() {
  const [selectedScope, setSelectedScope] = useState(0);
  const snapshot = useCarbonSnapshot();

  const pick = (live: number | null | undefined, fallback: number) =>
    typeof live === "number" && live > 0 ? live : fallback;

  const liveCarbon = snapshot.status === "ready" ? snapshot.data.carbon : null;
  const scope1Total = pick(liveCarbon?.scope1Tco2e, scopeDetails[0].total);
  const scope2Total = pick(liveCarbon?.scope2LbTco2e, scopeDetails[1].total);
  const scope3Total = pick(liveCarbon?.scope3Tco2e, scopeDetails[2].total);
  const liveTotals = [scope1Total, scope2Total, scope3Total];

  const scope = scopeDetails[selectedScope];

  return (
    <motion.div {...pageVariants} className="p-6 space-y-6">
      <SectionTitle
        title="Analyse Scopes 1-2-3"
        subtitle="Détail de vos émissions par périmètre GHG Protocol"
      />

      {/* Scope selector cards */}
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {scopeDetails.map((s, i) => (
          <motion.button
            key={s.id}
            variants={staggerItem}
            onClick={() => setSelectedScope(i)}
            className={`p-5 rounded-xl border text-left transition-all cursor-pointer ${
              selectedScope === i
                ? "border-carbon-emerald bg-carbon-emerald/5"
                : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]"
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${scopeColors[i]}20`, color: scopeColors[i] }}
              >
                {scopeIcons[i]}
              </div>
              <div>
                <h3 className="font-display font-semibold text-[var(--color-foreground)]">
                  {s.name}
                </h3>
                <p className="text-xs text-[var(--color-foreground-muted)]">{s.description}</p>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-display font-bold text-[var(--color-foreground)]">
                <AnimatedCounter value={liveTotals[i]} />
              </span>
              <span className="text-sm text-[var(--color-foreground-muted)]">{s.unit}</span>
            </div>
            <div className="mt-1 flex items-center gap-1 text-sm">
              {s.trend < 0 ? (
                <TrendingDown className="w-4 h-4 text-[var(--color-success)]" />
              ) : (
                <TrendingUp className="w-4 h-4 text-[var(--color-danger)]" />
              )}
              <span className={s.trend < 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}>
                {s.trend > 0 ? "+" : ""}
                {s.trend}%
              </span>
            </div>
          </motion.button>
        ))}
      </motion.div>

      {/* Detail section */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedScope}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        >
          {/* Bar chart breakdown */}
          <ChartCard
            title={`Répartition ${scope.name}`}
            subtitle="Émissions par catégorie"
          >
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scope.categories} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis type="number" stroke="var(--color-foreground-muted)" fontSize={12} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="var(--color-foreground-muted)"
                    fontSize={12}
                    width={130}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "8px",
                      color: "var(--color-foreground)",
                    }}
                    formatter={(val: number) => [`${val} tCO₂e`, ""]}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {scope.categories.map((cat, i) => (
                      <Cell key={i} fill={cat.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          {/* Categories list */}
          <ChartCard title="Détail par catégorie" subtitle="Part et volume de chaque source">
            <div className="space-y-3">
              {scope.categories.map((cat) => {
                const pct = ((cat.value / liveTotals[selectedScope]) * 100).toFixed(1);
                return (
                  <div
                    key={cat.name}
                    className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)]"
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-[var(--color-foreground)]">
                          {cat.name}
                        </span>
                        <span className="text-sm text-[var(--color-foreground-muted)]">
                          {cat.value.toLocaleString("fr-FR")} tCO₂e
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-[var(--color-foreground-subtle)]">
                      <span>{pct}%</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  </div>
                );
              })}
            </div>
          </ChartCard>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
