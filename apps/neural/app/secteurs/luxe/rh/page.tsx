"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Gem,
  Globe,
  GraduationCap,
  Layers,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

import { EvidenceCard } from "@/components/site/evidence-card";
import { ScopeCard } from "@/components/site/scope-card";
import { StatusBadge } from "@/components/site/status-badge";
import { getAgentEntry, getBranchEntry } from "@/lib/public-catalog";

const TalentWorkflowDiagram = dynamic(
  () => import("@/components/workflow/TalentWorkflowDiagram"),
  { ssr: false }
);

const rhEntry = getBranchEntry("rh");
const artisanEntry = getAgentEntry("artisan-talent");
const benchmarkEntry = getAgentEntry("comp-benchmark");
const onboardingEntry = getAgentEntry("onboarding");

if (!rhEntry || !artisanEntry || !benchmarkEntry || !onboardingEntry) {
  throw new Error("Missing public catalog entries for Luxe RH.");
}

const rhCatalog = rhEntry;
const artisanCatalog = artisanEntry;
const benchmarkCatalog = benchmarkEntry;
const onboardingCatalog = onboardingEntry;

const rhAgents = [
  {
    title: "Artisan Talent",
    href: "/agents/artisan-talent",
    entry: artisanCatalog,
    icon: UserCheck,
    iconClass: "bg-emerald-400/10 text-emerald-200",
    summary: "Cartographie des metiers rares, gaps critiques et plans de succession.",
  },
  {
    title: "Comp & Benchmark",
    href: "/agents/comp-benchmark",
    entry: benchmarkCatalog,
    icon: BarChart3,
    iconClass: "bg-sky-400/10 text-sky-200",
    summary: "Grille salariale, benchmark sectoriel et equite interne multi-pays.",
  },
  {
    title: "Onboarding Luxe",
    href: "/agents/onboarding",
    entry: onboardingCatalog,
    icon: GraduationCap,
    iconClass: "bg-violet-400/10 text-violet-200",
    summary: "Parcours d'integration, culture maison, jalons et evaluation continue.",
  },
];

const rhStats = [
  { label: "Agents RH visibles", value: String(rhAgents.length), icon: Layers },
  { label: "Niveau public", value: "Demo", icon: ShieldCheck },
  { label: "Pays couverts", value: "7", icon: Globe },
  { label: "Metiers rares", value: "30+", icon: Gem },
];

export default function LuxeRHPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-foreground)]">
      <section className="relative overflow-hidden border-b border-[var(--color-border)] px-6 pb-16 pt-32 md:px-12">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/8 via-transparent to-transparent" />
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-violet-500/8 blur-[100px]" />

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
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-200">
              Branche RH
            </p>
            <StatusBadge status={rhCatalog.status} proofLevel={rhCatalog.proofLevel} className="mt-4" />
            <h1 className="mt-6 font-display text-5xl font-extrabold tracking-[-0.05em] text-white md:text-6xl">
              Des donnees RH pretes, une surface encore en demonstration.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/68">
              La branche RH reste visible parce qu&apos;elle est strategiquement forte pour le
              luxe, mais elle est volontairement presentee comme demo : datasets presents,
              narration produit claire, industrialisation publique encore en cours.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.15 }}
            className="mt-12 grid gap-4 md:grid-cols-4"
          >
            {rhStats.map((item) => (
              <div
                key={item.label}
                className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.06]">
                  <item.icon className="h-4 w-4 text-emerald-200" />
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
          <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-emerald-200">
            Artisan Talent
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-white/30" />
          <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1.5 text-sky-200">
            Comp & Benchmark
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-white/30" />
          <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1.5 text-violet-200">
            Onboarding Luxe
          </span>
          <p className="w-full pt-2 text-sm text-white/52">
            Les trois briques restent publiques, mais avec un statut uniforme de demonstration.
          </p>
        </div>
      </section>

      <section className="px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1440px]">
          <div className="mb-10 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">
              Surfaces agent
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
              Une meme grammaire de preuve pour les trois outils RH.
            </h2>
            <p className="mt-3 text-base leading-relaxed text-white/62">
              Chaque carte rappelle le statut, la source de donnees et le livrable vise, sans
              laisser croire a un niveau de preparation egal a la branche Finance.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {rhAgents.map((agent, index) => (
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
                <p className="mt-3 text-sm leading-relaxed text-white/66">{agent.summary}</p>

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
            title="Ce que la branche RH prouve deja"
            dataUsed={rhCatalog.dataUsed}
            deliverable={rhCatalog.deliverable}
            status={rhCatalog.status}
            proofLevel={rhCatalog.proofLevel}
          />
          <ScopeCard title="Perimetre public RH" does={rhCatalog.scopeNow} doesnt={rhCatalog.notYet} />
        </div>
      </section>

      <section className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-12 md:px-12">
        <div className="mx-auto max-w-[1440px]">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-200">
                Positionnement public
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white">
                Une surface commerciale utile, pas une sur-promesse.
              </h2>
              <p className="mt-3 text-base leading-relaxed text-white/62">
                Cette branche reste tres utile pour raconter le positionnement RH de NEURAL
                dans le luxe. Le travail prioritaire maintenant est de relier au moins un
                de ces agents a une sortie publique aussi tangible qu&apos;un export Finance.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/trust"
                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/[0.09]"
              >
                Voir la truth layer
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition-transform hover:-translate-y-0.5"
              >
                Demander une demo RH
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--color-border)] bg-gradient-to-b from-[#0A1628] to-[#080F1E] px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1440px]">
          <TalentWorkflowDiagram />
        </div>
      </section>
    </div>
  );
}
