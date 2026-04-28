import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, FileText, ShieldCheck } from "lucide-react";

import {
  safetyDeckSlides,
  safetyReferences,
} from "@/lib/data/agent-safety";

export const metadata: Metadata = {
  title: "Deck sécurité agents IA — NEURAL",
  description:
    "Deck commercial imprimable : comment NEURAL encadre les agents IA par périmètre, gates, audit trail et validation humaine.",
};

export default function AgentSafetyDeckPage() {
  return (
    <div className="min-h-screen bg-[#071120] text-white">
      <section className="border-b border-white/8 px-6 py-8 md:px-12 print:hidden">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-4">
          <Link
            href="/trust/agent-safety"
            className="inline-flex items-center gap-2 text-sm font-semibold text-violet-200 hover:text-violet-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour a la preuve securite
          </Link>
          <Link
            href="/contact?subject=agent-safety-deck"
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#071120] transition-colors hover:bg-violet-100"
          >
            Preparer un pilote
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="px-6 py-12 md:px-12 print:p-0">
        <div className="mx-auto max-w-[1320px]">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4 print:hidden">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-400/[0.10] px-4 py-1.5 text-xs font-semibold text-violet-200">
                <FileText className="h-3.5 w-3.5" />
                Deck 10 slides
              </span>
              <h1 className="mt-5 font-display text-4xl font-bold md:text-5xl">
                Preuve de securite des agents IA
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/65">
                Version HTML imprimable pour rendez-vous client, due diligence RSSI/DPO
                ou support de demonstration.
              </p>
            </div>
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 font-mono text-xs text-white/55">
              NEURAL · Agent Safety · 2026
            </p>
          </div>

          <div className="grid gap-6 print:block">
            {safetyDeckSlides.map((slide, index) => (
              <article
                key={slide.id}
                className="relative min-h-[560px] overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-br from-[#0A1628] via-[#111D35] to-[#1a1040] p-8 shadow-2xl shadow-black/30 md:p-12 print:mb-0 print:min-h-screen print:rounded-none print:border-0 print:shadow-none"
              >
                <div className="absolute inset-0 bg-grid-pattern opacity-30" />
                <div className="relative flex min-h-[496px] flex-col print:min-h-[calc(100vh-96px)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-400/[0.10] px-4 py-1.5 text-xs font-semibold text-violet-200">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {slide.eyebrow}
                    </span>
                    <span className="font-mono text-xs text-white/35">
                      {String(index + 1).padStart(2, "0")} / {safetyDeckSlides.length}
                    </span>
                  </div>

                  <div className="mt-16 max-w-4xl">
                    <h2 className="font-display text-4xl font-bold leading-tight text-white md:text-6xl">
                      {slide.title}
                    </h2>
                    <p className="mt-6 max-w-3xl text-lg leading-relaxed text-white/68">
                      {slide.body}
                    </p>
                  </div>

                  <div className="mt-auto grid gap-3 md:grid-cols-3">
                    {slide.bullets.map((bullet) => (
                      <div
                        key={bullet}
                        className="rounded-2xl border border-white/10 bg-white/[0.05] p-4"
                      >
                        <p className="text-sm font-semibold text-white">{bullet}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>

          <section className="mt-8 rounded-[28px] border border-white/10 bg-white/[0.04] p-6 print:break-before-page print:rounded-none print:border-0">
            <h2 className="font-display text-2xl font-bold text-white">
              References
            </h2>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {safetyReferences.map((reference) => (
                <a
                  key={reference.href}
                  href={reference.href}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/68 transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                  {reference.label}
                </a>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
