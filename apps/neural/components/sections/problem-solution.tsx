"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useReveal } from "@/lib/use-reveal";

const problems = [
  ["POC qui ne passent jamais en production", "Investissement perdu, équipes démoralisées"],
  ["Adoption faible par les équipes", "Outils déployés mais jamais utilisés au quotidien"],
  ["ROI impossible à mesurer", "Aucun KPI défini en amont, pas de données de comparaison"],
  ["Coûts qui explosent sans valeur tangible", "Budgets IA consommés sans impact métier démontrable"],
];

const solutions = [
  ["Agents intégrés dans vos processus existants", "Zéro rupture — l'IA s'insère dans vos outils actuels"],
  ["Formation et accompagnement au changement", "Adoption mesurée à chaque étape du déploiement"],
  ["KPIs définis avant le déploiement", "ROI contractualisé : heures, erreurs, satisfaction"],
  ["Forfaits prévisibles, ROI mesuré mensuellement", "Dashboard temps réel + rapport mensuel chiffré"],
];

export function ProblemSolution() {
  const sectionRef = useReveal();

  return (
    <section ref={sectionRef} className="py-28 px-8 md:px-12">
      <div className="mx-auto max-w-[1440px]">
        <div className="reveal text-center mb-4">
          <span className="text-xs font-bold text-neural-violet uppercase tracking-widest">Le constat</span>
        </div>
        <div className="reveal text-center mb-16" style={{ animationDelay: "0.05s" }}>
          <h2 className="font-display font-extrabold text-4xl md:text-5xl tracking-tighter">
            Pourquoi <span className="text-[var(--color-danger)]">80%</span> des projets IA échouent ?
          </h2>
          <p className="mt-4 text-lg text-[var(--color-foreground-muted)] max-w-2xl mx-auto">
            Les chiffres sont implacables. Mais l&apos;échec n&apos;est jamais une fatalité quand l&apos;approche est structurée.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Problems */}
          <div className="reveal rounded-2xl border border-[var(--color-danger)]/20 bg-[var(--color-danger-bg)] p-8" style={{ animationDelay: "0.1s" }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-[var(--color-danger)]/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-[var(--color-danger)]" />
              </div>
              <h3 className="font-display text-xl font-bold text-[var(--color-danger)]">Le constat</h3>
            </div>
            <ul className="space-y-4">
              {problems.map(([title, sub]) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--color-danger)]" />
                  <div>
                    <div className="text-sm font-semibold text-[var(--color-foreground)]">{title}</div>
                    <div className="text-xs text-[var(--color-danger)]/70 mt-0.5">{sub}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Solutions */}
          <div className="reveal rounded-2xl border border-[var(--color-success)]/20 bg-[var(--color-success-bg)] p-8 relative overflow-hidden" style={{ animationDelay: "0.2s" }}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-success)]/5 rounded-full -translate-x-4 -translate-y-8" />
            <div className="flex items-center gap-3 mb-6 relative">
              <div className="w-10 h-10 rounded-full bg-[var(--color-success)]/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-[var(--color-success)]" />
              </div>
              <h3 className="font-display text-xl font-bold text-[var(--color-success)]">L&apos;approche NEURAL</h3>
            </div>
            <ul className="space-y-4 relative">
              {solutions.map(([title, sub]) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--color-success)]" />
                  <div>
                    <div className="text-sm font-semibold text-[var(--color-foreground)]">{title}</div>
                    <div className="text-xs text-[var(--color-success)]/70 mt-0.5">{sub}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
