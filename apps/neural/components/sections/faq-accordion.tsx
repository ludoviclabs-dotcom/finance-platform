"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

import { useReveal } from "@/lib/use-reveal";

const faqs = [
  {
    q: "Quel niveau de verite publique appliquez-vous sur le site ?",
    a: "Chaque page publique est maintenant qualifiee comme live avec donnees reelles, demo orchestree ou en preparation. Le but est de montrer ce qui est deja prouve, sans presenter le reste comme deja opere.",
  },
  {
    q: "Que signifie exactement 'Chat public route via Vercel AI Gateway' ?",
    a: "Cela signifie que le chat public passe maintenant par une couche de routage unique, avec Claude Sonnet 4.6 comme modele principal et un fallback GPT-5.4 prepare. Cela remplace un branchement provider direct et pose une meilleure base pour l'observabilite.",
  },
  {
    q: "Quelle est la meilleure demo a regarder aujourd'hui ?",
    a: "Le noyau Luxe est la verticale la plus prouvee publiquement. Transport reste la meilleure demonstration d'orchestration, mais doit etre lu comme une demo et non comme un workflow completement industrialise.",
  },
  {
    q: "Pourquoi avoir retire certaines promesses techniques ?",
    a: "Des formulations comme SLA 99.9%, hebergement europeen, AES-256 ou claims generiques de conformite ont ete retirees du discours public tant qu'elles ne sont pas documentees ou demonstrables dans le produit.",
  },
  {
    q: "Que dois-je faire si je veux un cadrage concret ?",
    a: "Le plus utile est de partir d'une verticale ou d'un agent cible, puis d'organiser une demo guidee ou un cadrage court. La page Contact permet d'ouvrir directement une demande structuree.",
  },
];

export function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const sectionRef = useReveal();

  return (
    <section ref={sectionRef} className="section-raised px-8 py-28 md:px-12">
      <div className="mx-auto max-w-3xl">
        <div className="reveal mb-4 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-neural-violet">FAQ</span>
        </div>
        <div className="reveal mb-14 text-center" style={{ animationDelay: "0.05s" }}>
          <h2 className="font-display text-4xl font-extrabold tracking-tighter md:text-5xl">
            Questions frequentes
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <div
              key={faq.q}
              className="reveal overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] transition-colors hover:border-neural-violet/20"
              style={{ animationDelay: `${0.1 + index * 0.05}s` }}
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="flex w-full cursor-pointer items-center justify-between rounded-xl p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neural-violet/40"
              >
                <span className="pr-4 text-sm font-semibold">{faq.q}</span>
                <motion.span
                  animate={{ rotate: openIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-5 w-5 shrink-0 text-[var(--color-foreground-subtle)]" />
                </motion.span>
              </button>
              <AnimatePresence>
                {openIndex === index ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="border-t border-[var(--color-border)] px-5 pb-5 pt-3 text-sm leading-relaxed text-[var(--color-foreground-muted)]">
                      {faq.a}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
