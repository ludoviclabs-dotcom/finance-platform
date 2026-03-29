"use client";

import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";
import { useReveal } from "@/lib/use-reveal";

export function CTASection() {
  const sectionRef = useReveal();

  return (
    <section ref={sectionRef} className="relative bg-gradient-neural py-28 text-white overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10" />
      <div className="absolute -left-32 top-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-neural-violet/15 blur-[100px]" />
      <div className="absolute -right-32 bottom-0 h-64 w-64 rounded-full bg-neural-violet/10 blur-[80px]" />

      <div className="relative mx-auto max-w-4xl px-8 text-center md:px-12">
        <div className="reveal">
          <h2 className="font-display font-extrabold text-4xl md:text-5xl tracking-tighter">
            Prêt à rejoindre les{" "}
            <span className="bg-gradient-cta bg-clip-text text-transparent">20%</span>{" "}
            qui réussissent ?
          </h2>
        </div>
        <div className="reveal" style={{ animationDelay: "0.1s" }}>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-300 leading-relaxed">
            Réservez un audit gratuit de 30 minutes. Nous analyserons votre
            maturité IA et identifierons les 3 premiers agents à déployer.
          </p>
        </div>
        <div className="reveal mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row" style={{ animationDelay: "0.2s" }}>
          <Link
            href="/contact"
            className="group inline-flex items-center rounded-xl bg-neural-violet px-8 py-4 text-lg font-semibold shadow-xl shadow-neural-violet/25 transition-all hover:bg-neural-violet-dark hover:shadow-2xl hover:shadow-neural-violet/30 hover:scale-105"
          >
            <Calendar className="mr-2 h-5 w-5" />
            Réserver mon audit gratuit
            <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/forfaits/simulateur"
            className="inline-flex items-center rounded-xl border border-white/20 bg-white/5 px-8 py-4 text-lg font-semibold backdrop-blur-sm transition-all hover:bg-white/10 hover:border-white/30"
          >
            Simuler mon ROI
          </Link>
        </div>
      </div>
    </section>
  );
}
