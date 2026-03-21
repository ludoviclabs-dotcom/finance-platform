"use client";

import { FormMultiSteps } from "@/components/patrimoine-pl/form-steps";
import { KPICards } from "@/components/patrimoine-pl/kpi-cards";
import {
  ChartCotisations,
  ChartWaterfallFiscal,
  ChartProjection30ans,
  ChartTranchesIR,
  ChartGapPrevoyance,
} from "@/components/patrimoine-pl/charts";
import { useSimulateurStore } from "@/lib/store/simulateur-store";
import Link from "next/link";
import { ArrowLeft, Wallet } from "lucide-react";

export default function PatrimoinePLPage() {
  const { calculsDone } = useSimulateurStore();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <h1 className="text-3xl font-semibold text-foreground tracking-tight">
            Simulateur Patrimoine PL Sant\u00e9
          </h1>
          <p className="text-sm text-foreground-muted mt-1">
            Cotisations, fiscalit\u00e9, retraite, pr\u00e9voyance, PER, transmission — V3 Mars 2026
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider rounded bg-amber-500/15 text-amber-400 border border-amber-500/20">
            Simulation
          </span>
          <span className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
            V3
          </span>
        </div>
      </div>

      {/* Formulaire multi-\u00e9tapes */}
      <FormMultiSteps />

      {/* R\u00e9sultats — affich\u00e9s apr\u00e8s calcul */}
      {calculsDone && (
        <>
          {/* KPI Cards */}
          <section>
            <h2 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-400" />
              Indicateurs cl\u00e9s
            </h2>
            <KPICards />
          </section>

          {/* Graphiques */}
          <section>
            <h2 className="text-lg font-medium text-foreground mb-4">
              Analyses graphiques
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCotisations />
              <ChartWaterfallFiscal />
              <ChartProjection30ans />
              <ChartTranchesIR />
              <ChartGapPrevoyance />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
