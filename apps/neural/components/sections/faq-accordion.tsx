"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useReveal } from "@/lib/use-reveal";

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
  const sectionRef = useReveal();

  return (
    <section ref={sectionRef} className="section-raised py-28 px-8 md:px-12">
      <div className="mx-auto max-w-3xl">
        <div className="reveal text-center mb-4">
          <span className="text-xs font-bold text-neural-violet uppercase tracking-widest">FAQ</span>
        </div>
        <div className="reveal text-center mb-14" style={{ animationDelay: "0.05s" }}>
          <h2 className="font-display font-extrabold text-4xl md:text-5xl tracking-tighter">
            Questions fréquentes
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="reveal rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden transition-colors hover:border-neural-violet/20"
              style={{ animationDelay: `${0.1 + i * 0.05}s` }}
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="flex w-full items-center justify-between p-5 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neural-violet/40 rounded-xl"
              >
                <span className="font-semibold text-sm pr-4">{faq.q}</span>
                <motion.span
                  animate={{ rotate: openIndex === i ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-5 w-5 shrink-0 text-[var(--color-foreground-subtle)]" />
                </motion.span>
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="border-t border-[var(--color-border)] px-5 pb-5 pt-3 text-sm text-[var(--color-foreground-muted)] leading-relaxed">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
