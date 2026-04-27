import { BookOpen } from "lucide-react";

import termsData from "@/content/glossaire/terms.json";
import { GlossaireBoard } from "@/components/glossaire/glossaire-board";

export const metadata = {
  title: "Glossaire IA — NEURAL",
  description:
    "Glossaire des termes IA français : AI Act, RGPD, DORA, MCP, audit trail, agent IA, FRIA, ESRS, RAG, etc. 26 termes définis avec contexte NEURAL.",
};

export default function GlossairePage() {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-emerald-500/8 blur-[120px]" />

      <section className="relative px-8 pb-12 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[920px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
            <BookOpen className="h-3.5 w-3.5" />
            Glossaire IA
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Glossaire IA
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/68">
            {termsData.terms.length} termes IA définis en français : AI Act, DORA, RGPD, MCP,
            agents, audit trail, FRIA, ESRS, RAG, etc. Chaque définition inclut le contexte
            d&apos;application chez NEURAL et les termes liés.
          </p>
        </div>
      </section>

      <section className="relative px-8 pb-24 md:px-12">
        <div className="mx-auto max-w-[920px]">
          <GlossaireBoard terms={termsData.terms} categories={termsData.categories} />
        </div>
      </section>
    </div>
  );
}
