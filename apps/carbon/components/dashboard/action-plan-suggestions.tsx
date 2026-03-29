"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Plus, MessageSquare, BarChart3, Zap } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface Action {
  id: string;
  priority: number;
  category: "Scope 1" | "Scope 2" | "Scope 3";
  title: string;
  effort: "Facile" | "Moyen" | "Complexe";
  potential: string;
  potentialNum: number;
  roi: string;
  confidence: number;
  reasoning: string;
  steps: string[];
}

const ACTIONS: Action[] = [
  {
    id: "a1",
    priority: 1,
    category: "Scope 2",
    title: "Passage au tarif 100% renouvelable (contrat GO)",
    effort: "Facile",
    potential: "−312 tCO₂e/an",
    potentialNum: 312,
    roi: "Rentable dès M+3",
    confidence: 94,
    reasoning: "Vos émissions Scope 2 représentent 28% de votre bilan. Un contrat de fourniture garantie d'origine (GO) avec votre fournisseur actuel EDF permettrait de les réduire à zéro comptablement, sans changer d'installation.",
    steps: ["Contacter votre fournisseur EDF pour un avenant GO", "Obtenir les certificats d'origine", "Recalculer automatiquement votre Scope 2 dans CarbonCo"],
  },
  {
    id: "a2",
    priority: 2,
    category: "Scope 1",
    title: "Électrification de 6 véhicules de flotte (catégorie B)",
    effort: "Moyen",
    potential: "−218 tCO₂e/an",
    potentialNum: 218,
    roi: "Rentable en 18 mois",
    confidence: 87,
    reasoning: "6 véhicules diesel avec plus de 150 000 km identifiés en fin de contrat LLD d'ici juin 2026. Le remplacement par des électriques (Tesla M3 ou Peugeot e-2008) permettrait une réduction significative sans impact sur la mobilité.",
    steps: ["Identifier les 6 véhicules éligibles via le rapport flotte", "Négocier avec Alphabet Fleet", "Déployer les bornes de recharge (subvention ADEME disponible)"],
  },
  {
    id: "a3",
    priority: 3,
    category: "Scope 3",
    title: "Programme Achats Responsables — Top 20 fournisseurs",
    effort: "Complexe",
    potential: "−454 tCO₂e/an",
    potentialNum: 454,
    roi: "Rentable en 36 mois",
    confidence: 71,
    reasoning: "Vos 20 premiers fournisseurs représentent 68% de vos émissions Scope 3 amont (catégorie 1). En envoyant des questionnaires carbone ciblés et en priorisant ceux avec un plan de réduction, vous pouvez améliorer significativement votre score ESRS E1.",
    steps: ["Envoyer les questionnaires NEURAL aux 20 fournisseurs", "Analyser les réponses et prioriser", "Intégrer les données dans CarbonCo"],
  },
];

const effortConfig = {
  Facile: "bg-[var(--color-success)]/10 text-[var(--color-success)]",
  Moyen: "bg-orange-50 text-orange-600",
  Complexe: "bg-red-50 text-red-600",
};

const categoryConfig = {
  "Scope 1": "bg-blue-50 text-blue-600",
  "Scope 2": "bg-purple-50 text-purple-600",
  "Scope 3": "bg-amber-50 text-amber-600",
};

export function ActionPlanSuggestions() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { toast } = useToast();

  const totalPotential = ACTIONS.reduce((a, b) => a + b.potentialNum, 0);
  const totalPct = ((totalPotential / 5980) * 100).toFixed(1); // base 5980 tCO2e

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-carbon-emerald" aria-hidden="true" />
          <h3 className="font-display font-semibold text-sm text-[var(--color-foreground)]">Plan d&apos;action IA recommandé</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-foreground-subtle)]">Généré par NEURAL</span>
        </div>
        <div className="text-right">
          <div className="text-sm font-extrabold text-[var(--color-success)]">−{totalPotential.toLocaleString("fr-FR")} tCO₂e</div>
          <div className="text-[10px] text-[var(--color-foreground-muted)]">−{totalPct}% du bilan total</div>
        </div>
      </div>

      <div className="divide-y divide-[var(--color-border)]">
        {ACTIONS.map((action) => {
          const isOpen = expanded === action.id;
          return (
            <div key={action.id}>
              {/* Summary row */}
              <button
                onClick={() => setExpanded(isOpen ? null : action.id)}
                aria-expanded={isOpen}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[var(--color-background)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:bg-[var(--color-background)]"
              >
                {/* Priority */}
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--color-background)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-foreground-muted)] flex items-center justify-center">
                  {action.priority}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold text-[var(--color-foreground)]">{action.title}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${categoryConfig[action.category]}`}>{action.category}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${effortConfig[action.effort]}`}>{action.effort}</span>
                    <span className="text-[10px] text-[var(--color-foreground-muted)]">{action.roi}</span>
                  </div>
                </div>

                <div className="flex-shrink-0 text-right mr-2">
                  <div className="text-sm font-bold text-[var(--color-success)]">{action.potential}</div>
                </div>

                {isOpen ? <ChevronUp className="w-4 h-4 text-[var(--color-foreground-muted)] flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-[var(--color-foreground-muted)] flex-shrink-0" />}
              </button>

              {/* Expanded content */}
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 space-y-4">
                      {/* Reasoning */}
                      <div className="bg-[var(--color-background)] rounded-lg p-3 border border-[var(--color-border)]">
                        <p className="text-xs font-semibold text-[var(--color-foreground-muted)] uppercase tracking-wide mb-2">Pourquoi cette recommandation ?</p>
                        <p className="text-sm text-[var(--color-foreground)] leading-relaxed">{action.reasoning}</p>
                      </div>

                      {/* Confiance */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-[var(--color-foreground-muted)]">Indice de confiance NEURAL</span>
                          <span className="text-xs font-bold text-[var(--color-foreground)]">{action.confidence}%</span>
                        </div>
                        <div className="h-1.5 bg-[var(--color-background)] rounded-full overflow-hidden border border-[var(--color-border)]">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${action.confidence}%` }}
                            transition={{ delay: 0.1, duration: 0.6 }}
                            className="h-full bg-carbon-emerald rounded-full"
                          />
                        </div>
                      </div>

                      {/* Étapes */}
                      <div>
                        <p className="text-xs font-semibold text-[var(--color-foreground-muted)] uppercase tracking-wide mb-2">Mise en œuvre</p>
                        <ol className="space-y-2">
                          {action.steps.map((step, i) => (
                            <li key={i} className="flex items-start gap-2.5">
                              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--color-success)]/10 text-[var(--color-success)] text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                              <span className="text-sm text-[var(--color-foreground)]">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>

                      {/* CTA boutons */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          onClick={() => toast(`"${action.title}" ajouté au plan d'action.`, "success")}
                          className="flex items-center gap-1.5 px-3 py-2 bg-[var(--color-success)] text-white rounded-lg text-xs font-semibold hover:bg-[var(--color-success)]/90 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carbon-emerald/60"
                        >
                          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                          Ajouter au plan
                        </button>
                        <button
                          onClick={() => toast("NEURAL prépare une analyse approfondie...", "info")}
                          className="flex items-center gap-1.5 px-3 py-2 border border-[var(--color-border)] rounded-lg text-xs font-medium text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-background)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carbon-emerald/60"
                        >
                          <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                          Demander des détails
                        </button>
                        <button
                          onClick={() => toast("Ouverture du simulateur d'impact carbone...", "info")}
                          className="flex items-center gap-1.5 px-3 py-2 border border-[var(--color-border)] rounded-lg text-xs font-medium text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-background)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carbon-emerald/60"
                        >
                          <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" />
                          Simuler
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
