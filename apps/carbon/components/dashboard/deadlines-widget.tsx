"use client";

import { motion } from "framer-motion";
import { Calendar, AlertTriangle, CheckCircle, Clock } from "lucide-react";

const DEADLINES = [
  {
    title: "Rapport ESRS E1 — Changement climatique",
    date: "2026-04-12",
    daysLeft: 15,
    completion: 72,
    urgency: "high" as const,
    tag: "CSRD",
  },
  {
    title: "Filing CBAM — Déclaration trimestrielle",
    date: "2026-05-02",
    daysLeft: 35,
    completion: 40,
    urgency: "medium" as const,
    tag: "CBAM",
  },
  {
    title: "Rapport GHG Protocol — Scope 3",
    date: "2026-06-30",
    daysLeft: 93,
    completion: 18,
    urgency: "low" as const,
    tag: "GHG",
  },
  {
    title: "Taxonomie verte — Alignement activités",
    date: "2026-07-15",
    daysLeft: 108,
    completion: 5,
    urgency: "low" as const,
    tag: "Taxonomie",
  },
];

const urgencyConfig = {
  high: { color: "text-red-500", bg: "bg-red-50", border: "border-red-200", bar: "bg-red-500", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  medium: { color: "text-orange-500", bg: "bg-orange-50", border: "border-orange-200", bar: "bg-orange-400", icon: <Clock className="w-3.5 h-3.5" /> },
  low: { color: "text-[var(--color-foreground-muted)]", bg: "bg-[var(--color-background)]", border: "border-[var(--color-border)]", bar: "bg-[var(--color-success)]", icon: <Calendar className="w-3.5 h-3.5" /> },
};

export function DeadlinesWidget() {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-semibold text-sm text-[var(--color-foreground)]">Échéances réglementaires</h3>
          <p className="text-xs text-[var(--color-foreground-muted)] mt-0.5">4 délais à suivre</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-red-500 font-semibold">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span>1 urgent</span>
        </div>
      </div>

      <div className="space-y-3">
        {DEADLINES.map((d, i) => {
          const cfg = urgencyConfig[d.urgency];
          return (
            <motion.div
              key={d.title}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07 }}
              className={`rounded-lg border ${cfg.border} ${cfg.bg} p-3`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-start gap-2 min-w-0">
                  <span className={`mt-0.5 flex-shrink-0 ${cfg.color}`}>{cfg.icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[var(--color-foreground)] leading-tight truncate">{d.title}</p>
                    <p className="text-[10px] text-[var(--color-foreground-muted)] mt-0.5">
                      {new Date(d.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className={`text-sm font-bold ${cfg.color}`}>{d.daysLeft}j</span>
                  <span className="block text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-foreground-muted)] font-medium mt-1">
                    {d.tag}
                  </span>
                </div>
              </div>

              {/* Barre de complétion */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-[var(--color-background)] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${d.completion}%` }}
                    transition={{ delay: 0.3 + i * 0.07, duration: 0.6, ease: "easeOut" }}
                    className={`h-full ${cfg.bar} rounded-full`}
                  />
                </div>
                <span className="text-[10px] text-[var(--color-foreground-muted)] font-medium w-7 text-right">{d.completion}%</span>
                {d.completion === 100 && <CheckCircle className="w-3 h-3 text-[var(--color-success)]" />}
              </div>
            </motion.div>
          );
        })}
      </div>

      <button className="mt-4 w-full text-xs text-carbon-emerald-light hover:underline text-center py-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carbon-emerald/60 rounded">
        Voir le calendrier complet →
      </button>
    </div>
  );
}
