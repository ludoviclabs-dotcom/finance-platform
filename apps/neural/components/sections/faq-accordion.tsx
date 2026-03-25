"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    q: "Pourquoi Claude AI plutôt qu'un autre LLM ?",
    a: "Claude excelle en raisonnement structuré, suivi d'instructions complexes et fiabilité en production. Pour les cas d'usage entreprise (conformité, finance, RH), ses performances surpassent les alternatives sur nos benchmarks internes.",
  },
  {
    q: "Combien de temps prend un déploiement ?",
    a: "Un POC sur 1 branche prend 2-4 semaines. Un déploiement Business (3-4 branches) prend 2-3 mois. Une transformation Enterprise complète se déploie en 6-12 mois avec un ramp-up progressif.",
  },
  {
    q: "Comment mesurez-vous le ROI ?",
    a: "Chaque agent a des KPIs définis avant le déploiement : heures économisées, taux d'erreur, temps de traitement, satisfaction utilisateur. Nous fournissons un dashboard temps réel et un rapport mensuel.",
  },
  {
    q: "Mes données sont-elles sécurisées ?",
    a: "Oui. Nous utilisons l'API Anthropic avec rétention zéro (vos données ne servent jamais à l'entraînement). Hébergement sur infrastructure européenne, chiffrement AES-256, conformité RGPD.",
  },
  {
    q: "Puis-je commencer par un seul agent ?",
    a: "Absolument. Notre forfait Starter permet de déployer 1-2 agents sur une branche. C'est la meilleure façon de valider l'approche avant de scaler.",
  },
];

export function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="bg-surface-raised py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center font-display text-4xl font-bold">
          Questions fréquentes
        </h2>

        <div className="mt-12 space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="card overflow-hidden">
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="flex w-full items-center justify-between p-5 text-left"
              >
                <span className="font-semibold">{faq.q}</span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-foreground-subtle transition-transform ${
                    openIndex === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              {openIndex === i && (
                <div className="border-t border-border px-5 pb-5 pt-3 text-sm text-foreground-muted leading-relaxed">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
