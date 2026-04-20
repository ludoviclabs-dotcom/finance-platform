"use client";

import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";

import { useReveal } from "@/lib/use-reveal";

export function CTASection() {
  const sectionRef = useReveal();

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-gradient-neural py-28 text-white">
      <div className="absolute inset-0 bg-grid-pattern opacity-10" />
      <div className="absolute -left-32 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-neural-violet/15 blur-[100px]" />
      <div className="absolute -right-32 bottom-0 h-64 w-64 rounded-full bg-neural-violet/10 blur-[80px]" />

      <div className="relative mx-auto max-w-4xl px-8 text-center md:px-12">
        <div className="reveal">
          <h2 className="font-display text-4xl font-extrabold tracking-tighter md:text-5xl">
            Passer de la visite a un{" "}
            <span className="bg-gradient-cta bg-clip-text text-transparent">cadrage reel</span>
          </h2>
        </div>
        <div className="reveal" style={{ animationDelay: "0.1s" }}>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-gray-300">
            On part du perimetre public actuel, on choisit la meilleure verticale a montrer, puis
            on cadre ensemble ce qui merite d&apos;etre live ensuite.
          </p>
        </div>
        <div
          className="reveal mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          style={{ animationDelay: "0.2s" }}
        >
          <Link
            href="/contact"
            className="group inline-flex items-center rounded-xl bg-neural-violet px-8 py-4 text-lg font-semibold text-white shadow-xl shadow-neural-violet/25 transition-all hover:scale-105 hover:bg-neural-violet-dark hover:text-white hover:shadow-2xl hover:shadow-neural-violet/30"
          >
            <Calendar className="mr-2 h-5 w-5" />
            Demander un cadrage
            <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/trust"
            className="inline-flex items-center rounded-xl border border-white/20 bg-white/5 px-8 py-4 text-lg font-semibold backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/10"
          >
            Voir la page trust
          </Link>
        </div>
      </div>
    </section>
  );
}
