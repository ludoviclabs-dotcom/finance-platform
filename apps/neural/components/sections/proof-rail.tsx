"use client";

import Link from "next/link";
import { ArrowRight, Database, Layers3, Radar, ShieldCheck } from "lucide-react";

import { PUBLIC_CLAIMS, PUBLIC_METRICS } from "@/lib/public-catalog";
import { useReveal } from "@/lib/use-reveal";

const cards = [
  {
    label: "Agents avec donnees reelles",
    value: `${PUBLIC_METRICS.liveAgents}`,
    detail: "issus de la source de verite centrale",
    icon: Layers3,
  },
  {
    label: "Cellules alimentees",
    value: `${PUBLIC_METRICS.liveCells}/${PUBLIC_METRICS.frameworkCells}`,
    detail: "sur la capacite totale du framework",
    icon: Radar,
  },
  {
    label: "Workbooks runtime",
    value: `${PUBLIC_METRICS.runtimeWorkbooks}`,
    detail: "embarques dans le runtime public",
    icon: Database,
  },
  {
    label: "Claims qualifies",
    value: `${PUBLIC_CLAIMS.filter((claim) => claim.status !== "retired").length}`,
    detail: "claims publics encore autorises",
    icon: ShieldCheck,
  },
];

export function ProofRail() {
  const sectionRef = useReveal();

  return (
    <section ref={sectionRef} className="border-y border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-18 md:px-12">
      <div className="mx-auto max-w-[1440px]">
        <div className="reveal flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-neural-violet">
              Rail de preuves
            </span>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight">
              Ce qui est visible aujourd&apos;hui
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--color-foreground-muted)]">
              NEURAL ne raconte plus une largeur theorique sans contexte. Chaque compteur et chaque
              claim affiches ici viennent de la source de verite publique branchee au site.
            </p>
          </div>
          <Link
            href="/trust"
            className="reveal inline-flex items-center gap-2 text-sm font-semibold text-neural-violet"
            style={{ animationDelay: "0.06s" }}
          >
            Voir la page trust <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card, index) => (
            <div
              key={card.label}
              className="reveal rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-5"
              style={{ animationDelay: `${0.12 + index * 0.06}s` }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neural-violet/10">
                <card.icon className="h-5 w-5 text-neural-violet" />
              </div>
              <p className="mt-5 font-display text-4xl font-bold tracking-tight">{card.value}</p>
              <p className="mt-2 text-sm font-semibold text-[var(--color-foreground)]">{card.label}</p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--color-foreground-muted)]">
                {card.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
