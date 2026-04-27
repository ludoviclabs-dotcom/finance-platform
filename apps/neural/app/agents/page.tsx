import Link from "next/link";
import { Bot, ArrowRight } from "lucide-react";

import { AGENT_ENTRIES } from "@/lib/public-catalog";
import { AgentCatalog } from "@/components/agents/agent-catalog";
import type { EnrichedAgent, AgentMeta } from "@/components/agents/agent-card";
import agentsMeta from "@/content/agents-meta.json";

export const metadata = {
  title: "Catalogue agents — NEURAL",
  description:
    "Catalogue filtrable des agents NEURAL : par branche, secteur, statut, classification AI Act. Statut live/demo/planifié honnête, niveau de preuve documenté.",
};

const META_MAP = agentsMeta.items as Record<string, AgentMeta>;

export default function AgentsPage() {
  // Enrich AGENT_ENTRIES with metadata; only keep those with metadata
  // (others would be displayed without filters context)
  const enriched: EnrichedAgent[] = AGENT_ENTRIES.filter((a) => META_MAP[a.slug]).map((a) => ({
    ...a,
    meta: META_MAP[a.slug],
  }));

  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-emerald-500/8 blur-[120px]" />

      <section className="relative px-8 pb-12 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[1320px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
            <Bot className="h-3.5 w-3.5" />
            Catalogue
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Catalogue des agents NEURAL
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/68">
            Tous les agents documentés publiquement, filtrables par branche, secteur, statut et
            classification AI Act. Honnêteté : seuls les agents avec une fiche metadata complète
            apparaissent ici.
          </p>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <AgentCatalog agents={enriched} />
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="rounded-[28px] border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.10] via-white/[0.04] to-emerald-500/[0.06] p-8 md:p-12">
            <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                  Un agent manquant pour votre cas d&apos;usage ?
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-white/65">
                  Le catalogue grandit selon la traction client. Si une brique sectorielle débloque
                  un cas critique chez vous, dites-nous — c&apos;est le meilleur signal pour la
                  prioriser.
                </p>
              </div>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-full bg-neural-violet px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-neural-violet/20 transition-all hover:bg-neural-violet-dark"
              >
                Proposer un agent <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
