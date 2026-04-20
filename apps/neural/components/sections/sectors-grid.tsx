"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { StatusBadge } from "@/components/site/status-badge";
import { SECTOR_ENTRIES } from "@/lib/public-catalog";
import { useReveal } from "@/lib/use-reveal";

export function SectorsGrid() {
  const sectionRef = useReveal();

  return (
    <section ref={sectionRef} className="section-raised px-8 py-28 md:px-12">
      <div className="mx-auto max-w-[1440px]">
        <div className="reveal mb-4 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-neural-violet">
            Expertise sectorielle
          </span>
        </div>
        <div className="reveal text-center" style={{ animationDelay: "0.05s" }}>
          <h2 className="font-display text-4xl font-extrabold tracking-tighter md:text-5xl">
            6 secteurs, un statut clair par verticale
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--color-foreground-muted)]">
            Chaque carte montre le statut public, les donnees utilisees et le livrable visible
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SECTOR_ENTRIES.map((sector, index) => (
            <div
              key={sector.slug}
              className="reveal"
              style={{ animationDelay: `${0.1 + index * 0.06}s` }}
            >
              <Link href={sector.href} className="block h-full">
                <motion.div
                  whileHover={{ y: -4, boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15)" }}
                  transition={{ type: "spring", stiffness: 300, damping: 22 }}
                  className="card-interactive h-full p-7"
                >
                  <StatusBadge status={sector.status} proofLevel={sector.proofLevel} />
                  <h3 className="mt-5 font-display text-2xl font-bold">{sector.label}</h3>
                  <p className="mt-2 text-sm font-medium text-neural-violet">{sector.tagline}</p>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--color-foreground-muted)]">
                    {sector.description}
                  </p>

                  <div className="mt-5 grid gap-3">
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-foreground-subtle)]">
                        Donnees utilisees
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-[var(--color-foreground-muted)]">
                        {sector.dataUsed}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-foreground-subtle)]">
                        Livrable genere
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-[var(--color-foreground-muted)]">
                        {sector.deliverable}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-neural-violet">
                    {sector.ctaLabel}
                    <ArrowRight className="h-4 w-4" />
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--color-foreground-subtle)]">
                    {sector.readyNow}
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
