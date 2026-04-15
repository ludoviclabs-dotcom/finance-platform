"use client";

import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { SectionTitle } from "@/components/ui/section-title";
import { pricingPlans } from "@/lib/data";
import { pageVariants, staggerContainer, staggerItem } from "@/lib/animations";

export function PricingPage() {
  return (
    <motion.div {...pageVariants} className="p-6 space-y-6">
      <SectionTitle
        title="Nos offres"
        subtitle="Choisissez la formule adaptée à vos obligations ESG"
      />

      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
      >
        {pricingPlans.map((plan) => (
          <motion.div
            key={plan.id}
            variants={staggerItem}
            className={`relative rounded-xl border p-6 flex flex-col ${
              plan.highlighted
                ? "border-carbon-emerald bg-carbon-emerald/5 ring-1 ring-carbon-emerald/20"
                : "border-[var(--color-border)] bg-[var(--color-surface)]"
            }`}
          >
            {plan.badge && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-carbon-emerald text-white text-xs font-semibold">
                {plan.badge}
              </span>
            )}

            <div className="mb-4">
              <h3 className="font-display font-bold text-lg text-[var(--color-foreground)]">
                {plan.name}
              </h3>
              <p className="text-xs text-[var(--color-foreground-muted)] mt-1">{plan.description}</p>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-display font-bold text-[var(--color-foreground)]">
                  {plan.price}
                </span>
                {plan.price !== "Sur devis" && (
                  <span className="text-sm text-[var(--color-foreground-muted)]">€{plan.period}</span>
                )}
              </div>
            </div>

            <ul className="space-y-2.5 flex-1 mb-6">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-carbon-emerald flex-shrink-0 mt-0.5" />
                  <span className="text-[var(--color-foreground-muted)]">{feature}</span>
                </li>
              ))}
            </ul>

            <button
              className={`w-full py-2.5 rounded-lg font-medium text-sm transition-colors cursor-pointer ${
                plan.highlighted
                  ? "bg-carbon-emerald text-white hover:bg-carbon-emerald/90"
                  : "border border-[var(--color-border)] text-[var(--color-foreground)] hover:bg-[var(--color-surface-raised)]"
              }`}
            >
              {plan.price === "Sur devis" ? "Nous contacter" : "Démarrer"}
              {plan.highlighted && <Sparkles className="w-4 h-4 inline ml-2" />}
            </button>
          </motion.div>
        ))}
      </motion.div>

      {/* Trust section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center"
      >
        <p className="text-sm text-[var(--color-foreground-muted)]">
          Toutes nos offres incluent :{" "}
          <span className="text-[var(--color-foreground)]">chiffrement AES-256</span> ·{" "}
          <span className="text-[var(--color-foreground)]">RGPD natif</span> ·{" "}
          <span className="text-[var(--color-foreground)]">audit trail complet</span> ·{" "}
          <span className="text-[var(--color-foreground)]">mises à jour réglementaires</span>
        </p>
      </motion.div>
    </motion.div>
  );
}
