"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useReveal } from "@/lib/use-reveal";

const sectors = [
  { id: "transport",    label: "Transport",    emoji: "\u{1F686}", desc: "Optimisation logistique, maintenance prédictive, conformité OIV" },
  { id: "luxe",         label: "Luxe",         emoji: "\u{1F45C}", desc: "Inventaire multi-maisons, ESG, recrutement haute couture" },
  { id: "aeronautique", label: "Aéronautique", emoji: "\u{2708}\u{FE0F}", desc: "Supply chain critique, conformité EASA, MRO intelligent" },
  { id: "saas",         label: "SaaS",         emoji: "\u{1F4BB}", desc: "PLG analytics, churn prediction, revenue intelligence" },
  { id: "banque",       label: "Banque",       emoji: "\u{1F3E6}", desc: "Risque crédit, conformité Bâle IV, KYC automatisé" },
  { id: "assurance",    label: "Assurance",    emoji: "\u{1F6E1}\u{FE0F}", desc: "IFRS 17, tarification dynamique, gestion sinistres" },
];

export function SectorsGrid() {
  const sectionRef = useReveal();

  return (
    <section ref={sectionRef} className="section-raised py-28 px-8 md:px-12">
      <div className="mx-auto max-w-[1440px]">
        <div className="reveal text-center mb-4">
          <span className="text-xs font-bold text-neural-violet uppercase tracking-widest">Expertise sectorielle</span>
        </div>
        <div className="reveal text-center" style={{ animationDelay: "0.05s" }}>
          <h2 className="font-display font-extrabold text-4xl md:text-5xl tracking-tighter">
            6 secteurs d&apos;expertise
          </h2>
          <p className="mt-4 text-lg text-[var(--color-foreground-muted)] max-w-2xl mx-auto">
            Des agents calibrés pour les spécificités réglementaires et métier de votre industrie
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sectors.map((sector, i) => (
            <div key={sector.id} className="reveal" style={{ animationDelay: `${0.1 + i * 0.06}s` }}>
              <Link href={`/secteurs/${sector.id}`} className="block h-full">
                <motion.div
                  whileHover={{ y: -4, boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15)" }}
                  transition={{ type: "spring", stiffness: 300, damping: 22 }}
                  className="card-interactive p-7 h-full"
                >
                  <span className="text-4xl">{sector.emoji}</span>
                  <h3 className="mt-4 font-display text-lg font-bold">
                    {sector.label}
                  </h3>
                  <p className="mt-2 text-sm text-[var(--color-foreground-muted)] leading-relaxed">
                    {sector.desc}
                  </p>
                </motion.div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
