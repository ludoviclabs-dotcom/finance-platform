"use client";

import { motion } from "framer-motion";
import { TrendingDown, TrendingUp } from "lucide-react";
import { AnimatedCounter } from "./animated-counter";
import { staggerItem } from "@/lib/animations";

interface KpiCardProps {
  label: string;
  value: number;
  unit: string;
  change: number;
  icon: React.ReactNode;
}

export function KpiCard({ label, value, unit, change, icon }: KpiCardProps) {
  const isPositive = change >= 0;

  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ scale: 1.02, boxShadow: "0 8px 30px rgba(0,0,0,0.18)" }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 cursor-default"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-[var(--color-foreground-muted)]">{label}</span>
        <div className="w-9 h-9 rounded-lg bg-carbon-emerald/10 flex items-center justify-center text-carbon-emerald">
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-display font-bold text-[var(--color-foreground)]">
          <AnimatedCounter value={value} />
        </span>
        <span className="text-sm text-[var(--color-foreground-muted)]">{unit}</span>
      </div>
      <div className="mt-2 flex items-center gap-1 text-sm">
        {isPositive ? (
          <TrendingUp className="w-4 h-4 text-[var(--color-danger)]" />
        ) : (
          <TrendingDown className="w-4 h-4 text-[var(--color-success)]" />
        )}
        <span className={isPositive ? "text-[var(--color-danger)]" : "text-[var(--color-success)]"}>
          {isPositive ? "+" : ""}{change}%
        </span>
        <span className="text-[var(--color-foreground-subtle)]">vs. 2023</span>
      </div>
    </motion.div>
  );
}
