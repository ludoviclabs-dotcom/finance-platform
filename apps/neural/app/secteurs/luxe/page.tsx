"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Database,
  Download,
  Gem,
  Layers,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { EvidenceCard } from "@/components/site/evidence-card";
import { ScopeCard } from "@/components/site/scope-card";
import { StatusBadge } from "@/components/site/status-badge";
import {
  PUBLIC_METRICS,
  getBranchEntry,
  getSectorEntry,
} from "@/lib/public-catalog";

const luxeEntry = getSectorEntry("luxe");
const financeEntry = getBranchEntry("finance");
const rhEntry = getBranchEntry("rh");

if (!luxeEntry || !financeEntry || !rhEntry) {
  throw new Error("Missing public catalog entries for Luxe.");
}

const luxeCatalog = luxeEntry;
const financeCatalog = financeEntry;
const rhCatalog = rhEntry;

const branchCards = [
  {
    title: "Finance & comptabilite IFRS",
    href: financeCatalog.href,
    entry: financeCatalog,
    accent: "from-violet-500/20 via-violet-500/5 to-transparent",
    badgeClass: "text-violet-200",
    highlight: "1 agent live, exports visibles, preuves runtime reliees au Data Hub.",
  },
  {
    title: "Ressources humaines",
    href: rhCatalog.href,
    entry: rhCatalog,
    accent: "from-emerald-500/20 via-emerald-500/5 to-transparent",
    badgeClass: "text-emerald-200",
    highlight:
      "Workbooks RH presents, parcours de demonstration et surfaces agent encore en exposition.",
  },
];

const topMetrics = [
  { label: "Agents avec donnees reelles", value: String(PUBLIC_METRICS.liveAgents), icon: Layers },
  { label: "Workbooks runtime", value: String(PUBLIC_METRICS.runtimeWorkbooks), icon: Database },
  { label: "Branche live / demo", value: "1 / 1", icon: ShieldCheck },
  {
    label: "Cellules alimentees",
    value: `${PUBLIC_METRICS.liveCells}/${PUBLIC_METRICS.frameworkCells}`,
    icon: Sparkles,
  },
];

export default function LuxeHubPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-foreground)]">
      <section className="relative overflow-hidden border-b border-[var(--color-border)] px-6 pb-20 pt-32 md:px-12">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-500/8 via-transparent to-transparent" />
        <div className="absolute -left-52 -top-48 h-[420px] w-[420px] rounded-full bg-violet-500/10 blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-emerald-500/8 blur-[120px]" />

        <div className="relative mx-auto max-w-[1440px]">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="max-w-4xl"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-400/10">
                <Gem className="h-5 w-5 text-violet-200" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200">
                  Secteur Luxe
                </p>
                <p className="text-sm text-white/55">Framework multi-branches avec sous-ensemble deja live</p>
              </div>
            </div>

            <StatusBadge status={luxeCatalog.status} proofLevel={luxeCatalog.proofLevel} />

            <h1 className="mt-6 max-w-4xl font-display text-5xl font-extrabold tracking-[-0.05em] text-white md:text-6xl lg:text-7xl">
              Le noyau public le plus credible de NEURAL.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/68 md:text-xl">
              Luxe est aujourd&apos;hui la verticale la plus prouvee publiquement. Elle montre un
              framework multi-secteurs, un Data Hub branche au runtime actuel, une branche Finance
              live, une branche RH en demonstration et des livrables deja visibles.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/secteurs/luxe/finance"
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition-transform hover:-translate-y-0.5"
              >
                Voir la branche Finance
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/trust"
                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/[0.09]"
              >
                Consulter la truth layer
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.15 }}
            className="mt-12 grid gap-4 md:grid-cols-4"
          >
            {topMetrics.map((item) => (
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

      <section className="px-6 py-20 md:px-12">
        <div className="mx-auto max-w-[1440px]">
          <div className="mb-10 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-200">
              Branches visibles
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
              Meme langage produit, deux niveaux de maturite.
            </h2>
            <p className="mt-3 text-base leading-relaxed text-white/62">
              Finance et RH restent visibles cote a cote, mais avec un balisage clair : ce qui
              est live, ce qui est en demonstration et ce qui reste a industrialiser.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {branchCards.map((branch, index) => (
              <motion.div
                key={branch.title}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.08 * index }}
              >
                <Link
                  href={branch.href}
                  className="group block rounded-[28px] border border-white/10 bg-white/[0.04] p-7 transition-colors hover:border-white/18 hover:bg-white/[0.06]"
                >
                  <div className={`absolute inset-x-0 top-0 h-32 rounded-t-[28px] bg-gradient-to-b ${branch.accent} opacity-70`} />
                  <div className="relative">
                    <StatusBadge status={branch.entry.status} proofLevel={branch.entry.proofLevel} />
                    <h3 className="mt-5 font-display text-2xl font-bold tracking-tight text-white">
                      {branch.title}
                    </h3>
                    <p className={`mt-2 text-sm font-medium ${branch.badgeClass}`}>
                      {branch.entry.tagline}
                    </p>
                    <p className="mt-4 text-sm leading-relaxed text-white/64">
                      {branch.entry.description}
                    </p>

                    <div className="mt-6 grid gap-3">
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">Statut</p>
                        <p className="mt-2 text-sm text-white/72">{branch.highlight}</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">
                          Donnees utilisees
                        </p>
                        <p className="mt-2 text-sm text-white/72">{branch.entry.dataUsed}</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">
                          Livrable genere
                        </p>
                        <p className="mt-2 text-sm text-white/72">{branch.entry.deliverable}</p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">
                          Ce qui est deja operationnel
                        </p>
                        <p className="mt-2 text-sm text-white/72">{branch.entry.readyNow}</p>
                      </div>
                    </div>

                    <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white">
                      Ouvrir la branche
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-20 md:px-12">
        <div className="mx-auto grid max-w-[1440px] gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <EvidenceCard
            title="Neural Data Hub visible publiquement"
            dataUsed={luxeCatalog.dataUsed}
            deliverable={luxeCatalog.deliverable}
            status={luxeCatalog.status}
            proofLevel={luxeCatalog.proofLevel}
          />
          <ScopeCard title="Perimetre public Luxe" does={luxeCatalog.scopeNow} doesnt={luxeCatalog.notYet} />
        </div>
      </section>

      <section className="px-6 py-20 md:px-12">
        <div className="mx-auto max-w-[1440px]">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-7">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-200">
                Parcours de demo
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white">
                Accueil, branche, export, contact.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/62">
                La verticale Luxe sert de parcours public complet : on voit le secteur, on
                ouvre une branche, on observe un hub branche a des donnees reelles, puis on
                termine sur un export ou une prise de contact.
              </p>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-sm font-semibold text-white">1. Data Hub</p>
                  <p className="mt-2 text-sm text-white/62">
                    Workbooks embarques, API /api/data et preuves runtime.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-sm font-semibold text-white">2. Surface metier</p>
                  <p className="mt-2 text-sm text-white/62">
                    Branche Finance live, RH clairement balisee comme demo.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-sm font-semibold text-white">3. Sortie visible</p>
                  <p className="mt-2 text-sm text-white/62">
                    Export consolidation, pack complet et appel commercial sans rupture.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-7">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">
                Liens utiles
              </p>
              <div className="mt-5 space-y-3">
                <Link
                  href="/secteurs/luxe/finance"
                  className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-white/76 transition-colors hover:bg-white/[0.06]"
                >
                  Ouvrir la branche Finance
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/secteurs/luxe/rh"
                  className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-white/76 transition-colors hover:bg-white/[0.06]"
                >
                  Voir la branche RH
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="/api/export/consolidation"
                  className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-white/76 transition-colors hover:bg-white/[0.06]"
                >
                  Telecharger l&apos;export consolidation
                  <Download className="h-4 w-4" />
                </a>
                <Link
                  href="/contact"
                  className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-white/76 transition-colors hover:bg-white/[0.06]"
                >
                  Demander une demonstration
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
