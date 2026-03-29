"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Monitor,
  Users,
  Megaphone,
  MessageSquare,
  Calculator,
  TrendingUp,
  Truck,
} from "lucide-react";
import { useReveal } from "@/lib/use-reveal";

const branches = [
  { id: "si",            label: "Systèmes d'Information", icon: Monitor,       agents: 24, desc: "Automatisation IT, monitoring, migrations" },
  { id: "rh",            label: "Ressources Humaines",    icon: Users,         agents: 24, desc: "Recrutement, onboarding, gestion talents" },
  { id: "marketing",     label: "Marketing",              icon: Megaphone,     agents: 24, desc: "PLG analytics, content, attribution" },
  { id: "communication", label: "Communication",          icon: MessageSquare, agents: 24, desc: "RP, médias sociaux, communication interne" },
  { id: "comptabilite",  label: "Comptabilité",           icon: Calculator,    agents: 24, desc: "IFRS, clôtures, consolidation, audit" },
  { id: "finance",       label: "Finance",                icon: TrendingUp,    agents: 24, desc: "Trésorerie, risques, reporting financier" },
  { id: "supply-chain",  label: "Supply Chain",           icon: Truck,         agents: 24, desc: "Logistique, sourcing, traçabilité" },
];

export function BranchesGrid() {
  const sectionRef = useReveal();

  return (
    <section ref={sectionRef} className="py-28 px-8 md:px-12">
      <div className="mx-auto max-w-[1440px]">
        <div className="reveal text-center mb-4">
          <span className="text-xs font-bold text-neural-violet uppercase tracking-widest">Couverture</span>
        </div>
        <div className="reveal text-center" style={{ animationDelay: "0.05s" }}>
          <h2 className="font-display font-extrabold text-4xl md:text-5xl tracking-tighter">
            7 branches métier couvertes
          </h2>
          <p className="mt-4 text-lg text-[var(--color-foreground-muted)] max-w-2xl mx-auto">
            Des agents spécialisés pour chaque fonction de votre entreprise
          </p>
        </div>

        <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {branches.map((branch, i) => (
            <div key={branch.id} className="reveal" style={{ animationDelay: `${0.1 + i * 0.06}s` }}>
              <Link href={`/solutions/${branch.id}`} className="block h-full">
                <motion.div
                  whileHover={{ y: -4, boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15)" }}
                  transition={{ type: "spring", stiffness: 300, damping: 22 }}
                  className="card-interactive p-6 h-full"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neural-violet/10">
                    <branch.icon className="h-5 w-5 text-neural-violet" />
                  </div>
                  <h3 className="mt-3 font-display text-sm font-bold">
                    {branch.label}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--color-foreground-muted)] leading-relaxed">
                    {branch.desc}
                  </p>
                  <div className="mt-3 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-neural-green" />
                    <span className="text-[10px] font-medium text-[var(--color-foreground-subtle)]">
                      {branch.agents} agents actifs
                    </span>
                  </div>
                </motion.div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
