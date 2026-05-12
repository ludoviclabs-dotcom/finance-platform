import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Database,
  FileSpreadsheet,
  Route,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { SimulationStudio } from "@/components/simulation/SimulationStudio";
import { getProofCatalog } from "@/lib/proof-catalog";

export const metadata = {
  title: "Simulation Studio | NEURAL",
  description:
    "Parcours de simulation métier régulé autour des agents NEURAL avec données Excel, preuves, limites et statuts de maturité.",
};

export default function SimulationPage() {
  const catalog = getProofCatalog();
  const counts = {
    liveAgentsWithExcel: catalog.counts.liveAgentsWithExcel,
    runtimeWorkbooks: catalog.counts.runtimeWorkbooks,
    liveCells: catalog.counts.liveCells,
    frameworkCells: catalog.counts.frameworkCells,
    frameworkTargetAgents: catalog.counts.frameworkTargetAgents,
    clientReady: catalog.counts.clientReady,
  };

  const metrics = [
    {
      label: "Agents avec données Excel",
      value: counts.liveAgentsWithExcel,
      detail: "Périmètre prouvé aujourd'hui",
      icon: Sparkles,
    },
    {
      label: "Workbooks runtime",
      value: counts.runtimeWorkbooks,
      detail: "Embarqués dans le site",
      icon: Database,
    },
    {
      label: "Cellules alimentées",
      value: `${counts.liveCells}/${counts.frameworkCells}`,
      detail: "Secteur x branche",
      icon: BarChart3,
    },
    {
      label: "Capacité cible framework",
      value: counts.frameworkTargetAgents,
      detail: "Capacité cible, pas périmètre live",
      icon: FileSpreadsheet,
    },
    {
      label: "Client-ready",
      value: counts.clientReady,
      detail: "Critères stricts non franchis",
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-emerald-500/8 blur-[120px]" />

      <section className="relative px-5 pb-12 pt-28 sm:px-8 md:px-12 lg:pt-36">
        <div className="mx-0 w-full max-w-[350px] min-w-0 md:mx-auto md:max-w-[1320px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
            <Route className="h-3.5 w-3.5" />
            Simulation Studio
          </span>
          <h1 className="mt-6 max-w-5xl break-words font-display text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Simuler des parcours métier avant de parler production
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/68">
            NEURAL simule aujourd'hui des parcours métier autour de{" "}
            {counts.liveAgentsWithExcel} agents avec données Excel, dans une architecture conçue
            pour s'étendre progressivement vers {counts.frameworkTargetAgents} agents.
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/48">
            Cette page agrège les preuves déjà visibles dans la Proof Console, le Sandbox,
            l'Operator Gateway et le calculateur ROI. Elle ne crée pas une nouvelle plateforme :
            elle rend le niveau de maturité plus lisible pour un visiteur professionnel.
          </p>

          <div className="mt-8 flex flex-col gap-3 md:flex-row">
            <Link
              href="#studio"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-2xl shadow-violet-950/35 transition hover:bg-violet-400 md:w-auto"
            >
              Explorer les simulations
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/proof"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08] md:w-auto"
            >
              Vérifier la preuve produit
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-10 grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-5">
            {metrics.map((metric) => (
              <div key={metric.label} className="min-w-0 rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06]">
                  <metric.icon className="h-5 w-5 text-violet-200" />
                </div>
                <p className="mt-5 font-display text-4xl font-bold tracking-tight">
                  {metric.value}
                </p>
                <p className="mt-2 break-words text-sm font-semibold text-white">
                  {metric.label}
                </p>
                <p className="mt-1 break-words text-xs leading-relaxed text-white/45">
                  {metric.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="studio" className="relative border-t border-white/8 px-5 py-16 sm:px-8 md:px-12">
        <div className="mx-0 w-full max-w-[350px] min-w-0 md:mx-auto md:max-w-[1320px]">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="inline-flex items-center rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                3 scénarios professionnels
              </span>
              <h2 className="mt-3 max-w-3xl break-words font-display text-3xl font-bold tracking-tight md:text-4xl">
                Un parcours guidé, pas une promesse de production
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-white/48 md:text-right">
              Les scénarios ci-dessous pointent vers des pages existantes. Ils servent à qualifier
              une opportunité, cadrer un pilot et exposer les limites avant intégration client.
            </p>
          </div>

          <div className="mt-8">
            <SimulationStudio counts={counts} />
          </div>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-5 py-16 sm:px-8 md:px-12">
        <div className="mx-0 grid w-full max-w-[350px] min-w-0 gap-5 md:mx-auto md:max-w-[1320px] lg:grid-cols-4">
          <ResourceLink
            href="/sandbox"
            title="Sandbox"
            description="Tester les démos publiques sans login."
          />
          <ResourceLink
            href="/operator-gateway"
            title="Operator Gateway"
            description="Voir le routage, les politiques et les traces de contrôle."
          />
          <ResourceLink
            href="/outils/roi"
            title="ROI Calculator"
            description="Estimer une hypothèse de valeur avant pilot."
          />
          <ResourceLink
            href="/contact"
            title="Pilot 30 jours"
            description="Transformer une simulation en cadrage terrain."
          />
        </div>
      </section>
    </div>
  );
}

function ResourceLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 transition-colors hover:bg-white/[0.07]"
    >
      <p className="font-display text-xl font-bold tracking-tight text-white">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-white/58">{description}</p>
      <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-violet-200">
        Ouvrir
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}
