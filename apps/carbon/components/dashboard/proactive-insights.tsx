"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, TrendingDown, AlertTriangle, Lightbulb, FileText, Zap, ArrowRight } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface Insight {
  id: string;
  type: "anomalie" | "opportunité" | "compliance" | "draft";
  title: string;
  description: string;
  metric?: string;
  metricLabel?: string;
  cta: string;
  timestamp: string;
  priority: "high" | "medium" | "low";
}

const INITIAL_INSIGHTS: Insight[] = [
  {
    id: "anom-1",
    type: "anomalie",
    title: "Pic d'émissions Scope 2 détecté",
    description: "Émissions électricité +34% en mars vs février — corrélé avec la ligne 4.",
    metric: "+34%",
    metricLabel: "Scope 2",
    cta: "Analyser",
    timestamp: "8 min",
    priority: "high",
  },
  {
    id: "opp-1",
    type: "opportunité",
    title: "Optimisation Scope 1 — Flotte véhicules",
    description: "3 véhicules éligibles à l'électrification. ROI estimé 18 mois.",
    metric: "−124",
    metricLabel: "tCO₂e/an",
    cta: "Plan d'action",
    timestamp: "32 min",
    priority: "medium",
  },
  {
    id: "comp-1",
    type: "compliance",
    title: "ESRS E1-6 — Données manquantes",
    description: "Divulgation Scope 3 cat. 11 (utilisation produits vendus) non complétée.",
    metric: "1",
    metricLabel: "point à compl.",
    cta: "Compléter",
    timestamp: "1h",
    priority: "high",
  },
  {
    id: "draft-1",
    type: "draft",
    title: "Rapport E1 pré-rédigé",
    description: "NEURAL a pré-rédigé le rapport ESRS E1 complet. Prêt à valider.",
    metric: "87%",
    metricLabel: "complété",
    cta: "Consulter",
    timestamp: "2h",
    priority: "medium",
  },
];

const typeConfig = {
  anomalie: {
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    label: "Anomalie",
    accentColor: "text-red-400",
    accentBg: "bg-red-400",
    pillBg: "bg-red-400/10 text-red-400",
    metricColor: "text-red-400",
  },
  opportunité: {
    icon: <TrendingDown className="w-3.5 h-3.5" />,
    label: "Opportunité",
    accentColor: "text-carbon-emerald-light",
    accentBg: "bg-carbon-emerald",
    pillBg: "bg-carbon-emerald/10 text-carbon-emerald-light",
    metricColor: "text-carbon-emerald-light",
  },
  compliance: {
    icon: <FileText className="w-3.5 h-3.5" />,
    label: "Compliance",
    accentColor: "text-amber-400",
    accentBg: "bg-amber-400",
    pillBg: "bg-amber-400/10 text-amber-400",
    metricColor: "text-amber-400",
  },
  draft: {
    icon: <Lightbulb className="w-3.5 h-3.5" />,
    label: "Brouillon IA",
    accentColor: "text-purple-400",
    accentBg: "bg-purple-400",
    pillBg: "bg-purple-400/10 text-purple-400",
    metricColor: "text-purple-400",
  },
};

export function ProactiveInsights() {
  const [insights, setInsights] = useState(INITIAL_INSIGHTS);
  const { toast } = useToast();

  const dismiss = (id: string) => {
    setInsights((prev) => prev.filter((i) => i.id !== id));
    toast("Insight ignoré.", "info", 3000);
  };

  const handleCta = (insight: Insight) => {
    toast(`Action : ${insight.cta}`, "success");
  };

  if (insights.length === 0) return null;

  return (
    <div className="mb-5">
      {/* Header row */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded-md bg-carbon-emerald/10 flex items-center justify-center">
          <Zap className="w-3 h-3 text-carbon-emerald-light" aria-hidden="true" />
        </div>
        <h3 className="text-xs font-semibold text-[var(--color-foreground)] uppercase tracking-wide">Insights NEURAL</h3>
        <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-carbon-emerald/10 text-carbon-emerald-light">{insights.length}</span>
        <div className="flex-1" />
        <span className="text-[10px] text-[var(--color-foreground-subtle)] flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-purple-400" aria-hidden="true" />
          Généré par IA
        </span>
      </div>

      {/* Cards grid */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {insights.map((insight) => {
            const cfg = typeConfig[insight.type];
            return (
              <motion.div
                key={insight.id}
                layout
                initial={{ opacity: 0, scale: 0.97, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, x: 50, scale: 0.96 }}
                transition={{ type: "spring", damping: 24, stiffness: 300 }}
                className="group relative rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden hover:border-[var(--color-border-strong)] transition-colors"
              >
                {/* Left accent bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${cfg.accentBg} rounded-l-lg`} aria-hidden="true" />

                <div className="pl-3.5 pr-3 py-3">
                  {/* Top: type pill + timestamp + dismiss */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${cfg.pillBg}`}>
                        {cfg.icon}
                        {cfg.label}
                      </span>
                      <span className="text-[10px] text-[var(--color-foreground-subtle)]">{insight.timestamp}</span>
                    </div>
                    <button
                      onClick={() => dismiss(insight.id)}
                      aria-label="Ignorer cet insight"
                      className="p-0.5 rounded opacity-0 group-hover:opacity-100 text-[var(--color-foreground-subtle)] hover:text-[var(--color-foreground)] transition-all cursor-pointer focus-visible:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-carbon-emerald/60"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Content: title + desc on left, metric on right */}
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[var(--color-foreground)] leading-snug mb-0.5 truncate">{insight.title}</p>
                      <p className="text-[11px] text-[var(--color-foreground-muted)] leading-relaxed line-clamp-2">{insight.description}</p>
                    </div>
                    {insight.metric && (
                      <div className="flex-shrink-0 text-right pl-2">
                        <div className={`text-base font-bold font-mono leading-none ${cfg.metricColor}`}>{insight.metric}</div>
                        <div className="text-[9px] text-[var(--color-foreground-subtle)] mt-0.5">{insight.metricLabel}</div>
                      </div>
                    )}
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => handleCta(insight)}
                    className={`mt-2.5 inline-flex items-center gap-1 text-[10px] font-semibold ${cfg.accentColor} hover:underline cursor-pointer focus-visible:outline-none transition-colors`}
                  >
                    {insight.cta}
                    <ArrowRight className="w-2.5 h-2.5" aria-hidden="true" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
