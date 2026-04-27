import Link from "next/link";
import { Plug, ArrowRight } from "lucide-react";

import catalogData from "@/content/connecteurs/catalog.json";
import { ConnectorCatalog } from "@/components/connecteurs/connector-catalog";

export const metadata = {
  title: "Connecteurs — NEURAL",
  description:
    "Catalogue des connecteurs EU NEURAL : ERP, CRM, RH, Banque, RegTech, Productivité, Data, Communication. Statuts honnêtes (live/beta/roadmap) et région documentée.",
};

export default function ConnecteursPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-cyan-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-emerald-500/8 blur-[120px]" />

      <section className="relative px-8 pb-12 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[1320px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
            <Plug className="h-3.5 w-3.5" />
            Connecteurs
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            50 connecteurs EU certifiés
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/68">
            Honnêteté assumée : nous ne courons pas après les 700+ connecteurs des iPaaS US.
            Notre stratégie est verticale et européenne — 50 connecteurs ciblés sur les SaaS et
            ERP réellement utilisés par les ETI françaises et européennes en secteur régulé.
          </p>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <ConnectorCatalog items={catalogData.items} categories={catalogData.categories} />
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="rounded-[28px] border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.10] via-white/[0.04] to-emerald-500/[0.06] p-8 md:p-12">
            <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                  Un connecteur manquant pour votre stack ?
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-white/65">
                  La priorité d&apos;un connecteur dépend de la traction client. Si une intégration
                  débloque votre cas, dites-nous — c&apos;est le meilleur signal pour la prioriser.
                </p>
              </div>
              <Link
                href="/contact?source=connecteurs"
                className="inline-flex items-center gap-2 rounded-full bg-neural-violet px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-neural-violet/20 transition-all hover:bg-neural-violet-dark"
              >
                Proposer un connecteur <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
