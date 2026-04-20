"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Coins,
  Download,
  Globe,
  Layers,
  Package,
  Receipt,
  ShieldCheck,
} from "lucide-react";

import { EvidenceCard } from "@/components/site/evidence-card";
import { ScopeCard } from "@/components/site/scope-card";
import { StatusBadge } from "@/components/site/status-badge";
import { getAgentEntry, getBranchEntry } from "@/lib/public-catalog";
import { useNeural } from "@/lib/neural-hub/context";

const LuxeWorkflowDiagram = dynamic(
  () => import("@/components/workflow/LuxeWorkflowDiagram"),
  { ssr: false }
);

const financeEntry = getBranchEntry("finance");
const consolidationEntry = getAgentEntry("consolidation");
const inventoryEntry = getAgentEntry("inventaire-luxe");
const currencyEntry = getAgentEntry("multi-currency");
const royaltyEntry = getAgentEntry("royalty");

if (!financeEntry || !consolidationEntry || !inventoryEntry || !currencyEntry || !royaltyEntry) {
  throw new Error("Missing public catalog entries for Luxe Finance.");
}

const financeCatalog = financeEntry;
const consolidationCatalog = consolidationEntry;
const inventoryCatalog = inventoryEntry;
const currencyCatalog = currencyEntry;
const royaltyCatalog = royaltyEntry;

const financeAgents = [
  {
    title: "Consolidation Groupe",
    href: "/agents/consolidation",
    entry: consolidationCatalog,
    icon: Building2,
    iconClass: "bg-violet-400/10 text-violet-200",
    norms: ["IFRS 10", "IFRS 3", "IAS 36", "IAS 21"],
    description:
      "Agent le plus mature publiquement : il alimente la branche Finance avec des donnees runtime et un export visible.",
    kpiLabel: "CA consolide",
  },
  {
    title: "Inventaire Luxe",
    href: "/agents/inventaire-luxe",
    entry: inventoryCatalog,
    icon: Package,
    iconClass: "bg-emerald-400/10 text-emerald-200",
    norms: ["IAS 2", "IFRS 15", "IAS 36"],
    description:
      "Surface de demonstration appuyee sur un workbook runtime, encore en attente d'une exposition publique complete.",
    kpiLabel: "Statut public",
    kpiValue: "Demo",
  },
  {
    title: "Multi-Currency IAS 21",
    href: "/agents/multi-currency",
    entry: currencyCatalog,
    icon: Globe,
    iconClass: "bg-sky-400/10 text-sky-200",
    norms: ["IAS 21", "IFRS 9", "IAS 39"],
    description:
      "Brique devise deja presente dans le runtime, exposee ici comme capacite du framework et non comme simulateur final.",
    kpiLabel: "Preuve",
    kpiValue: "Runtime",
  },
  {
    title: "Royalty Accounting",
    href: "/agents/royalty",
    entry: royaltyCatalog,
    icon: Receipt,
    iconClass: "bg-amber-400/10 text-amber-200",
    norms: ["IAS 38", "IFRS 15", "IAS 24", "Pilier 2"],
    description:
      "Brique normative prete a etre mieux emballee. La page la montre comme demonstration de profondeur finance.",
    kpiLabel: "Preuve",
    kpiValue: "Runtime",
  },
];

const branchStats = [
  { label: "Surfaces finance", value: String(financeAgents.length), icon: Layers },
  {
    label: "Agents live",
    value: String(financeAgents.filter((item) => item.entry.status === "live").length),
    icon: ShieldCheck,
  },
  { label: "Devises gerees", value: "7", icon: Coins },
  { label: "Entites consolidees", value: "8", icon: Building2 },
];

export default function LuxeFinancePage() {
  const { results } = useNeural();
  const consolidatedRevenue = results.consolidation?.consolidatedRevenue;
  const revenueDisplay =
    typeof consolidatedRevenue === "number"
      ? consolidatedRevenue.toLocaleString("fr-FR")
      : "8 184";

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-foreground)]">
      <section className="relative overflow-hidden border-b border-[var(--color-border)] px-6 pb-16 pt-32 md:px-12">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-500/8 via-transparent to-transparent" />
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-violet-500/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-amber-500/8 blur-[100px]" />

        <div className="relative mx-auto max-w-[1440px]">
          <Link
            href="/secteurs/luxe"
            className="mb-8 inline-flex items-center gap-2 text-sm text-white/55 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au hub Luxe
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-4xl"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200">
              Branche Finance
            </p>
            <StatusBadge status={financeCatalog.status} proofLevel={financeCatalog.proofLevel} className="mt-4" />
            <h1 className="mt-6 font-display text-5xl font-extrabold tracking-[-0.05em] text-white md:text-6xl">
              La branche la plus tangible du runtime public.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/68">
              Luxe Finance ne promet pas quatre simulateurs egalement finalises. Elle montre
              un agent live, trois surfaces de demonstration branchees au runtime et des
              exports qui rendent la valeur visible.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.15 }}
            className="mt-12 grid gap-4 md:grid-cols-4"
          >
            {branchStats.map((item) => (
              <div
                key={item.label}
                className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.06]">
                  <item.icon className="h-4 w-4 text-violet-200" />
                </div>
                <p className="mt-4 font-display text-3xl font-bold tracking-tight text-white">
                  {item.value}
                </p>
                <p className="mt-1 text-sm text-white/58">{item.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-6 md:px-12">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-2 text-xs text-white/70">
          <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1.5 text-violet-200">
            Consolidation live
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-white/30" />
          <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-emerald-200">
            Inventaire demo
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-white/30" />
          <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1.5 text-sky-200">
            Multi-currency demo
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-white/30" />
          <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-amber-200">
            Royalty demo
          </span>
          <p className="w-full pt-2 text-sm text-white/52">
            Le visiteur voit clairement quelle brique est live et lesquelles restent en exposition.
          </p>
        </div>
      </section>

      <section className="px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1440px]">
          <div className="mb-10 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-200">
              Surfaces agent
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
              Chaque carte indique son vrai niveau de preparation.
            </h2>
            <p className="mt-3 text-base leading-relaxed text-white/62">
              Les badges, les livrables et les CTA suivent la meme logique partout :
              live avec donnees reelles, demo adossee au runtime ou readiness page.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {financeAgents.map((agent, index) => (
              <motion.div
                key={agent.title}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.06 * index }}
                className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${agent.iconClass}`}>
                  <agent.icon className="h-6 w-6" />
                </div>
                <StatusBadge status={agent.entry.status} proofLevel={agent.entry.proofLevel} className="mt-5" />
                <h3 className="mt-5 font-display text-2xl font-bold tracking-tight text-white">
                  {agent.title}
                </h3>
                <p className="mt-2 text-sm text-white/60">{agent.description}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {agent.norms.map((norm) => (
                    <span
                      key={norm}
                      className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-medium text-white/64"
                    >
                      {norm}
                    </span>
                  ))}
                </div>

                <div className="mt-6 grid gap-3">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">Donnees utilisees</p>
                    <p className="mt-2 text-sm text-white/70">{agent.entry.dataUsed}</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">Livrable genere</p>
                    <p className="mt-2 text-sm text-white/70">{agent.entry.deliverable}</p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">{agent.kpiLabel}</p>
                  <p className="mt-2 font-display text-3xl font-bold tracking-tight text-white">
                    {agent.entry.slug === "consolidation" ? revenueDisplay : agent.kpiValue}
                    {agent.entry.slug === "consolidation" ? (
                      <span className="ml-2 text-sm font-medium text-white/48">KEUR</span>
                    ) : null}
                  </p>
                </div>

                <Link
                  href={agent.href}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white transition-opacity hover:opacity-85"
                >
                  Ouvrir la page agent
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-20 md:px-12">
        <div className="mx-auto grid max-w-[1440px] gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <EvidenceCard
            title="Preuves visibles dans la branche Finance"
            dataUsed={financeCatalog.dataUsed}
            deliverable={financeCatalog.deliverable}
            status={financeCatalog.status}
            proofLevel={financeCatalog.proofLevel}
          />
          <ScopeCard title="Perimetre public Finance" does={financeCatalog.scopeNow} doesnt={financeCatalog.notYet} />
        </div>
      </section>

      <section className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-12 md:px-12">
        <div className="mx-auto max-w-[1440px]">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">
                Sorties visibles
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white">
                La preuve ne s&apos;arrete pas a l&apos;interface.
              </h2>
              <p className="mt-3 text-base leading-relaxed text-white/62">
                Cette branche expose deja des exports, ce qui aide a vendre une sortie metier
                concrete plutot qu&apos;une simple vitrine UI.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="/api/export/consolidation"
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition-transform hover:-translate-y-0.5"
              >
                <Download className="h-4 w-4" />
                Export consolidation
              </a>
              <a
                href="/api/export/full-pack"
                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/[0.09]"
              >
                <Download className="h-4 w-4" />
                Pack complet
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1440px]">
          <LuxeWorkflowDiagram />
        </div>
      </section>
    </div>
  );
}
