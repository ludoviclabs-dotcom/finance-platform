"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { motion } from "framer-motion";

import { useReveal } from "@/lib/use-reveal";

const forfaits = [
  {
    name: "Starter",
    subtitle: "AI Essentials",
    price: "290 - 1 290",
    users: "1-50 users",
    features: ["1-2 branches", "Agents pre-configures", "Support email", "Dashboard basique"],
    highlighted: false,
  },
  {
    name: "Business",
    subtitle: "AI Accelerator",
    price: "4 900 - 16 500",
    users: "50-500 users",
    features: ["3-4 branches", "Agents customises", "Support prioritaire", "Analytics avances"],
    highlighted: true,
  },
  {
    name: "Enterprise",
    subtitle: "AI Transformation",
    price: "35 000 - 110 000",
    users: "500-5 000 users",
    features: ["5-7 branches", "Agents sur mesure", "CSM dedie", "Cadrage et preuves sur demande"],
    highlighted: false,
  },
];

export function PricingPreview() {
  const sectionRef = useReveal();

  return (
    <section ref={sectionRef} className="px-8 py-28 md:px-12">
      <div className="mx-auto max-w-[1440px]">
        <div className="reveal mb-4 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-neural-violet">
            Tarification
          </span>
        </div>
        <div className="reveal text-center" style={{ animationDelay: "0.05s" }}>
          <h2 className="font-display text-4xl font-extrabold tracking-tighter md:text-5xl">
            Des forfaits adaptes a votre ambition
          </h2>
          <p className="mt-4 text-lg text-[var(--color-foreground-muted)]">
            Du POC a la transformation complete
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {forfaits.map((forfait, index) => (
            <div key={forfait.name} className="reveal" style={{ animationDelay: `${0.1 + index * 0.08}s` }}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className={`relative rounded-2xl border bg-[var(--color-surface)] p-8 transition-shadow ${
                  forfait.highlighted
                    ? "border-neural-violet shadow-xl shadow-neural-violet/10"
                    : "border-[var(--color-border)] hover:border-neural-violet/30 hover:shadow-lg"
                }`}
              >
                {forfait.highlighted ? (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-neural-violet px-4 py-1.5 text-xs font-bold text-white shadow-lg shadow-neural-violet/25">
                    Populaire
                  </div>
                ) : null}

                <h3 className="font-display text-xl font-bold">{forfait.name}</h3>
                <p className="text-sm text-[var(--color-foreground-muted)]">{forfait.subtitle}</p>
                <p className="mt-5">
                  <span className="tabnum text-3xl font-bold text-neural-violet">{forfait.price}</span>
                  <span className="text-sm text-[var(--color-foreground-muted)]"> EUR / mois</span>
                </p>
                <p className="text-xs text-[var(--color-foreground-subtle)]">{forfait.users}</p>

                <ul className="mt-6 space-y-3">
                  {forfait.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2.5 text-sm text-[var(--color-foreground-muted)]"
                    >
                      <Check className="h-4 w-4 shrink-0 text-neural-green" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/forfaits"
                  className={`mt-8 flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold transition-all ${
                    forfait.highlighted
                      ? "bg-neural-violet text-white shadow-lg shadow-neural-violet/25 hover:bg-neural-violet-dark"
                      : "border border-neural-violet/30 text-neural-violet hover:bg-neural-violet hover:text-white"
                  }`}
                >
                  En savoir plus
                </Link>
              </motion.div>
            </div>
          ))}
        </div>

        <div className="reveal mt-10 text-center" style={{ animationDelay: "0.4s" }}>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 text-sm font-semibold text-neural-violet hover:underline"
          >
            Demander un cadrage personnalise
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
