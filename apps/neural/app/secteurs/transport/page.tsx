"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Landmark,
  Layers,
  Receipt,
  ShieldCheck,
  Sparkles,
  Truck,
  Workflow,
} from "lucide-react";

import { EvidenceCard } from "@/components/site/evidence-card";
import { LearnMoreBlock } from "@/components/site/learn-more-block";
import { ScopeCard } from "@/components/site/scope-card";
import { StatusBadge } from "@/components/site/status-badge";
import { getBranchEntry, getSectorEntry } from "@/lib/public-catalog";

const TransportWorkflowStepper = dynamic(
  () => import("@/components/workflow/TransportWorkflowStepper"),
  { ssr: false }
);

const transportEntry = getSectorEntry("transport");
const accountingEntry = getBranchEntry("comptabilite");

if (!transportEntry || !accountingEntry) {
  throw new Error("Missing public catalog entries for Transport.");
}

const transportCatalog = transportEntry;
const accountingCatalog = accountingEntry;

const demoAgents = [
  {
    title: "TVA Transport",
    subtitle: "Decision TVA, lignes CA3, exceptions transfrontalieres.",
    icon: Receipt,
    color: "text-sky-200",
    bg: "bg-sky-400/10",
    note: "Scenario de demo axe fiscalite transport et regles europeennes.",
  },
  {
    title: "Fleet Accounting",
    subtitle: "Amortissement composants, VNC, cession, impairment.",
    icon: Truck,
    color: "text-emerald-200",
    bg: "bg-emerald-400/10",
    note: "Demonstration metier pour actifs de flotte et logique IAS 16 / IAS 36.",
  },
  {
    title: "Concession Accounting",
    subtitle: "IFRIC 12, qualification contrat, cycle de vie de concession.",
    icon: Landmark,
    color: "text-violet-200",
    bg: "bg-violet-400/10",
    note: "Surface de demo normative, pas encore sortie publique liee au runtime.",
  },
  {
    title: "Orchestrateur",
    subtitle: "Route, sequence, valide et consolide les sorties.",
    icon: Workflow,
    color: "text-amber-200",
    bg: "bg-amber-400/10",
    note: "Valeur narrative forte pour la vision multi-agents et le HITL.",
  },
];

const transportMetrics = [
  { label: "Agents scenarises", value: "3", icon: Layers },
  { label: "Orchestrateur visible", value: "1", icon: Workflow },
  { label: "Niveau public", value: "Demo", icon: ShieldCheck },
  { label: "Sortie promise", value: "Cloture", icon: Sparkles },
];

export default function TransportPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-foreground)]">
      <section className="relative overflow-hidden border-b border-[var(--color-border)] px-6 pb-20 pt-32 md:px-12">
        <div className="absolute inset-0 bg-gradient-to-b from-sky-500/8 via-transparent to-transparent" />
        <div className="absolute -left-52 -top-52 h-[420px] w-[420px] rounded-full bg-sky-500/10 blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-violet-500/8 blur-[120px]" />

        <div className="relative mx-auto max-w-[1440px]">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="max-w-4xl"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10">
                <Truck className="h-5 w-5 text-sky-200" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-200">
                  Secteur Transport
                </p>
                <p className="text-sm text-white/55">Demonstration d&apos;orchestration metier</p>
              </div>
            </div>

            <StatusBadge status={transportCatalog.status} proofLevel={transportCatalog.proofLevel} />

            <h1 className="mt-6 max-w-4xl font-display text-5xl font-extrabold tracking-[-0.05em] text-white md:text-6xl lg:text-7xl">
              Une demo qui montre l&apos;ambition, pas un workflow deja opere.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/68 md:text-xl">
              Transport reste public parce qu&apos;il raconte tres bien la promesse NEURAL :
              agents specialises, orchestration et validation humaine. Mais cette page doit
              etre lue comme une demo orchestree, pas comme un runtime pleinement branche.
            </p>

            <div className="mt-8 rounded-[24px] border border-amber-300/15 bg-amber-300/[0.08] p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-200" />
                <div>
                  <p className="text-sm font-semibold text-amber-100">Lecture correcte de cette page</p>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">
                    La valeur ici est la demonstration du design produit, de la sequence de cloture
                    et des points de validation humaine. Les workbooks transport ne sont pas encore
                    exposes comme preuves runtime publiques au meme niveau que Luxe Finance.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.15 }}
            className="mt-12 grid gap-4 md:grid-cols-4"
          >
            {transportMetrics.map((item) => (
              <div
                key={item.label}
                className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.06]">
                  <item.icon className="h-4 w-4 text-sky-200" />
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
          <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1.5 text-sky-200">
            TVA Transport
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-white/30" />
          <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-emerald-200">
            Fleet Accounting
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-white/30" />
          <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1.5 text-violet-200">
            Concession Accounting
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-white/30" />
          <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-amber-200">
            Orchestrateur
          </span>
          <p className="w-full pt-2 text-sm text-white/52">
            Ce flux represente un parcours de demonstration, utile pour vendre la vision et
            clarifier le sequenceur HITL.
          </p>
        </div>
      </section>

      <section className="px-6 py-20 md:px-12">
        <div className="mx-auto max-w-[1440px]">
          <div className="mb-10 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-200">
              Briques de demo
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
              Quatre cartes de valeur, un seul message de maturite.
            </h2>
            <p className="mt-3 text-base leading-relaxed text-white/62">
              Chaque carte explique un usage metier, mais le statut reste uniforme : demo
              orchestree. Aucun visiteur ne doit confondre cette surface avec un workflow
              deja opere publiquement.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {demoAgents.map((agent, index) => (
              <motion.div
                key={agent.title}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.07 * index }}
                className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${agent.bg}`}>
                  <agent.icon className={`h-6 w-6 ${agent.color}`} />
                </div>
                <StatusBadge status="demo" proofLevel="ui_demo" className="mt-5" />
                <h3 className="mt-5 font-display text-2xl font-bold tracking-tight text-white">
                  {agent.title}
                </h3>
                <p className="mt-2 text-sm font-medium text-white/60">{agent.subtitle}</p>
                <p className="mt-4 text-sm leading-relaxed text-white/66">{agent.note}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-20 md:px-12">
        <div className="mx-auto grid max-w-[1440px] gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <EvidenceCard
            title="Pourquoi cette demo reste pertinente"
            dataUsed={transportCatalog.dataUsed}
            deliverable={transportCatalog.deliverable}
            status={transportCatalog.status}
            proofLevel={transportCatalog.proofLevel}
          />
          <ScopeCard
            title="Perimetre public Transport"
            does={transportCatalog.scopeNow}
            doesnt={transportCatalog.notYet}
          />
        </div>
      </section>

      <section className="relative overflow-hidden border-b border-[var(--color-border)] px-6 py-20 md:px-12">
        <div className="absolute inset-0 bg-gradient-to-b from-sky-500/[0.03] to-violet-500/[0.03]" />
        <div className="relative mx-auto max-w-[1440px]">
          <div className="mb-10 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-200">
              Sequence de demo
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
              Le workflow sert de preuve de design produit.
            </h2>
            <p className="mt-3 text-base leading-relaxed text-white/62">
              Cette visualisation reste volontairement publique car elle montre la logique
              d&apos;orchestration, la repartition des roles et les points de validation humaine.
            </p>
          </div>
          <TransportWorkflowStepper />
        </div>
      </section>

      <section className="px-6 py-20 md:px-12">
        <div className="mx-auto grid max-w-[1440px] gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-7">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">
              Prochaine etape utile
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white">
              Passer de la demo a la preuve runtime.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/62">
              Le chantier qui rendra cette verticale beaucoup plus credible n&apos;est pas un
              nouveau discours. C&apos;est le branchement d&apos;un premier workflow transport a
              une entree reelle, a une sortie visible et a un export public.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-7">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/44">CTA</p>
            <div className="mt-5 space-y-3">
              <Link
                href="/trust"
                className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-white/76 transition-colors hover:bg-white/[0.06]"
              >
                Voir la truth layer
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contact"
                className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-white/76 transition-colors hover:bg-white/[0.06]"
              >
                Demander un cadrage transport
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={accountingCatalog.href}
                className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-white/76 transition-colors hover:bg-white/[0.06]"
              >
                Voir la branche comptabilite
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <LearnMoreBlock
        subtitle="Comprendre la méthodologie NEURAL (cadrage outcome, premier agent en 90 jours) et le vocabulaire IA contextualisé."
        items={[
          {
            kind: "doc",
            label: "Démarrer avec NEURAL",
            description: "Cadrage outcome, choix du premier agent, cycle de déploiement 30/60/90 jours.",
            href: "/docs/getting-started",
          },
          {
            kind: "glossary",
            label: "Agent IA",
            description: "Système autonome qui perçoit, raisonne et agit pour atteindre un objectif métier.",
            href: "/glossaire/agent-ia",
          },
          {
            kind: "glossary",
            label: "LLM (Large Language Model)",
            description: "Le moteur de raisonnement utilisé par les agents — Claude Sonnet 4.6 chez NEURAL.",
            href: "/glossaire/llm",
          },
        ]}
      />
    </div>
  );
}
