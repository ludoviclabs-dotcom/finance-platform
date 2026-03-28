"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Info, X } from "lucide-react";
import { staggerItem } from "@/lib/animations";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  tooltip?: { source: string; updated: string; method: string };
}

export function ChartCard({ title, subtitle, children, className = "", tooltip }: ChartCardProps) {
  const [tipOpen, setTipOpen] = useState(false);

  return (
    <motion.div
      variants={staggerItem}
      className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display font-semibold text-[var(--color-foreground)]">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-[var(--color-foreground-muted)]">{subtitle}</p>
          )}
        </div>
        {tooltip && (
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setTipOpen(!tipOpen)}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--color-foreground-subtle)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
            {tipOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setTipOpen(false)} />
                <div className="absolute right-0 top-8 w-72 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl p-4 z-30 text-xs space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-[var(--color-foreground)]">À propos de cette donnée</span>
                    <button onClick={() => setTipOpen(false)} className="text-[var(--color-foreground-muted)] cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1.5 text-[var(--color-foreground-muted)]">
                    <p><span className="font-medium text-[var(--color-foreground)]">Source :</span> {tooltip.source}</p>
                    <p><span className="font-medium text-[var(--color-foreground)]">Mise à jour :</span> {tooltip.updated}</p>
                    <p><span className="font-medium text-[var(--color-foreground)]">Méthode :</span> {tooltip.method}</p>
                  </div>
                  <button className="text-carbon-emerald-light hover:underline cursor-pointer pt-1">
                    Voir la documentation →
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      {children}
    </motion.div>
  );
}
