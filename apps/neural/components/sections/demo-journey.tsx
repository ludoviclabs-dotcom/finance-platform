"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { DEMO_JOURNEY } from "@/lib/public-catalog";
import { StatusBadge } from "@/components/site/status-badge";
import { useReveal } from "@/lib/use-reveal";

export function DemoJourney() {
  const sectionRef = useReveal();

  return (
    <section ref={sectionRef} className="px-8 py-24 md:px-12">
      <div className="mx-auto max-w-[1440px]">
        <div className="reveal text-center">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-neural-violet">
            Parcours public
          </span>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
            Accueil, preuve, export, contact
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-[var(--color-foreground-muted)]">
            Le site suit maintenant un seul chemin lisible. Un visiteur comprend en quelques
            secondes ce qui est live, ce qui sert de demo et ce qui reste en preparation.
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-5">
          {DEMO_JOURNEY.map((item, index) => (
            <Link
              key={item.step}
              href={item.href}
              className="reveal group rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-all hover:-translate-y-1 hover:border-neural-violet/20 hover:shadow-lg"
              style={{ animationDelay: `${0.1 + index * 0.05}s` }}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-3xl font-bold tracking-tight text-neural-violet">
                  {item.step}
                </span>
                <ArrowRight className="h-4 w-4 text-[var(--color-foreground-subtle)] transition-transform group-hover:translate-x-1" />
              </div>
              <h3 className="mt-6 font-display text-xl font-bold">{item.title}</h3>
              <div className="mt-3">
                <StatusBadge status={item.status} />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-[var(--color-foreground-muted)]">
                {item.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
