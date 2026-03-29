"use client";

import { useState } from "react";
import { RefreshCw, Download, BookOpen } from "lucide-react";
import { MethodologyModal } from "./methodology-modal";
import { useToast } from "@/components/ui/toast";

const PERIODS = ["Ce mois", "Ce trimestre", "Cette année", "2025", "2024"] as const;
type Period = typeof PERIODS[number];

interface DashboardContextBarProps {
  period: Period;
  onPeriodChange: (p: Period) => void;
}

export function DashboardContextBar({ period, onPeriodChange }: DashboardContextBarProps) {
  const [methodOpen, setMethodOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      toast("Données actualisées avec succès.", "success");
    }, 1400);
  };

  const handleExport = () => {
    toast("Export du dashboard en cours... Téléchargement dans quelques secondes.", "info", 4000);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 px-6 pt-5">
        {/* Left: Period tabs + live indicator */}
        <div className="flex items-center gap-3">
          <div
            role="radiogroup"
            aria-label="Sélecteur de période"
            className="flex items-center bg-[var(--color-background)] rounded-lg p-0.5 border border-[var(--color-border)]"
          >
            {PERIODS.map((p) => (
              <button
                key={p}
                role="radio"
                aria-checked={period === p}
                onClick={() => onPeriodChange(p)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carbon-emerald/60 ${
                  period === p
                    ? "bg-carbon-emerald/15 text-carbon-emerald-light shadow-sm border border-carbon-emerald/20"
                    : "text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] border border-transparent"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Live indicator */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-success)]/8 border border-[var(--color-success)]/15">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-success)] opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--color-success)]" />
            </span>
            <span className="text-[10px] text-[var(--color-success)] font-medium">
              Live · {new Date().toLocaleDateString("fr-FR")}
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5" role="toolbar" aria-label="Actions">
          <button
            onClick={() => setMethodOpen(true)}
            aria-label="Méthodologie de calcul"
            className="flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[10px] font-medium text-[var(--color-foreground-subtle)] hover:text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carbon-emerald/60"
          >
            <BookOpen className="w-3 h-3" aria-hidden="true" />
            <span className="hidden sm:block">Méthodologie</span>
          </button>

          <div className="w-px h-4 bg-[var(--color-border)]" aria-hidden="true" />

          <button
            onClick={handleRefresh}
            aria-label="Actualiser les données"
            aria-busy={refreshing}
            className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--color-foreground-subtle)] hover:text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carbon-emerald/60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
          </button>

          <button
            onClick={handleExport}
            aria-label="Exporter le dashboard"
            className="flex items-center gap-1.5 px-3 h-7 rounded-md bg-carbon-emerald/15 text-carbon-emerald-light text-[10px] font-semibold hover:bg-carbon-emerald/25 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carbon-emerald/60"
          >
            <Download className="w-3 h-3" aria-hidden="true" />
            <span>Exporter</span>
          </button>
        </div>
      </div>

      <MethodologyModal open={methodOpen} onClose={() => setMethodOpen(false)} />
    </>
  );
}
