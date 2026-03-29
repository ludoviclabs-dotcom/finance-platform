"use client";

import Image from "next/image";
import { useReveal } from "@/lib/use-reveal";

const testimonials = [
  {
    quote:
      "NEURAL a déployé 3 agents en comptabilité qui nous font gagner 120h/mois. Le ROI était visible dès la semaine 3.",
    author: "Marie D.",
    role: "DAF",
    company: "Groupe Transport Île-de-France",
    metric: "120h",
    metricLabel: "économisées/mois",
    avatar: "/images/avatar-testimonial.png",
  },
  {
    quote:
      "L'approche structurée de NEURAL est ce qui manquait à nos précédentes tentatives. Enfin des agents IA que nos équipes utilisent vraiment.",
    author: "Thomas L.",
    role: "DSI",
    company: "Maison de luxe parisienne",
    metric: "94%",
    metricLabel: "d'adoption",
    avatar: "/images/avatar-testimonial.png",
  },
  {
    quote:
      "Le simulateur de prix nous a permis de budgéter précisément notre transformation IA. Zéro mauvaise surprise.",
    author: "Sophie R.",
    role: "Directrice Innovation",
    company: "Néo-banque B2B",
    metric: "+340%",
    metricLabel: "ROI an 1",
    avatar: "/images/avatar-testimonial.png",
  },
];

export function Testimonials() {
  const sectionRef = useReveal();

  return (
    <section ref={sectionRef} className="section-raised py-28 px-8 md:px-12">
      <div className="mx-auto max-w-[1440px]">
        <div className="reveal text-center mb-4">
          <span className="text-xs font-bold text-neural-violet uppercase tracking-widest">Témoignages</span>
        </div>
        <div className="reveal text-center" style={{ animationDelay: "0.05s" }}>
          <h2 className="font-display font-extrabold text-4xl md:text-5xl tracking-tighter">
            Ils nous font confiance
          </h2>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <div
              key={t.author}
              className="reveal rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-7 transition-all hover:border-neural-violet/20 hover:shadow-lg"
              style={{ animationDelay: `${0.1 + i * 0.08}s` }}
            >
              {/* Metric badge */}
              <div className="mb-5 inline-flex items-center gap-2 rounded-xl bg-neural-violet/10 px-3 py-2">
                <span className="font-display text-lg font-bold text-neural-violet">{t.metric}</span>
                <span className="text-xs text-[var(--color-foreground-muted)]">{t.metricLabel}</span>
              </div>

              {/* Quote */}
              <div className="relative">
                <span className="absolute -top-2 -left-1 text-4xl text-neural-violet/20 font-serif leading-none">&ldquo;</span>
                <p className="text-sm text-[var(--color-foreground-muted)] leading-relaxed pl-4">
                  {t.quote}
                </p>
              </div>

              {/* Author */}
              <div className="mt-6 pt-5 border-t border-[var(--color-border)]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border border-[var(--color-border)]">
                    <Image
                      src={t.avatar}
                      alt={t.author}
                      width={36}
                      height={36}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{t.author}</p>
                    <p className="text-xs text-[var(--color-foreground-subtle)]">
                      {t.role}, {t.company}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
