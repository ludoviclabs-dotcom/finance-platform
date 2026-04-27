import Link from "next/link";
import {
  ArrowRight,
  ArrowLeft,
  Cpu,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  Bot,
  Sparkles,
  BarChart3,
  Users,
} from "lucide-react";

import { StatusBadge } from "@/components/site/status-badge";
import { getSectorEntry } from "@/lib/public-catalog";

export const metadata = {
  title: "SaaS / Tech — NEURAL",
  description:
    "Verticale SaaS NEURAL : positionnement, cas d'usage typiques (RevOps, Customer Success, CSRD SaaS, RGPD), agents potentiels. Pas encore de runtime live.",
};

const useCases = [
  {
    icon: TrendingUp,
    title: "Revenue Operations",
    description:
      "Analyse churn, scoring opportunités, qualification leads inbound, automatisation des relances.",
    challenges: [
      "Données dispersées CRM / billing / analytics",
      "Volume d'opportunités vs capacité commerciale",
      "Forecasting peu fiable",
    ],
  },
  {
    icon: Users,
    title: "Customer Success automation",
    description:
      "Détection signaux churn, briefing CSM avant call, génération QBR automatisée, escalade health score.",
    challenges: [
      "Health scoring manuel",
      "Préparation QBR chronophage",
      "Détection churn trop tardive",
    ],
  },
  {
    icon: BarChart3,
    title: "MRR / Métriques SaaS",
    description:
      "Consolidation MRR/ARR multi-sources, attribution churn, expansion ARR tracking, cohort analysis.",
    challenges: [
      "Calculs MRR/ARR éparpillés Excel + Stripe + HubSpot",
      "Pas de cohort analysis automatisée",
      "Reporting board chronophage",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Conformité SaaS B2B EU",
    description:
      "DPA automatisés client par client, gestion sub-processors, registre RGPD article 30, conformité AI Act si SaaS IA.",
    challenges: [
      "DPA négociés au cas par cas",
      "Sub-processors non publics",
      "Conformité AI Act non préparée",
    ],
  },
];

const potentialAgents = [
  {
    name: "MRR Consolidator",
    role: "Calcul MRR/ARR multi-sources avec audit trail signé",
    status: "planned" as const,
    horizon: "T4 2026",
  },
  {
    name: "Churn Signal Detector",
    role: "Détection signaux churn early-warning sur usage produit + support",
    status: "planned" as const,
    horizon: "T4 2026",
  },
  {
    name: "QBR Auto-Brief",
    role: "Génération de brief QBR à partir de données usage + tickets support",
    status: "planned" as const,
    horizon: "T1 2027",
  },
  {
    name: "Customer Health Scorer",
    role: "Health scoring déterministe + override LLM sur cas atypiques",
    status: "planned" as const,
    horizon: "T1 2027",
  },
  {
    name: "DPA Generator SaaS",
    role: "Génération de DPA personnalisés avec sub-processors auto-mis-à-jour",
    status: "planned" as const,
    horizon: "T1 2027",
  },
  {
    name: "AI Act Readiness Assistant",
    role: "Assistant pour SaaS IA en route vers conformité AI Act 2027",
    status: "planned" as const,
    horizon: "T2 2027",
  },
];

export default function SaasSectorPage() {
  const sectorEntry = getSectorEntry("saas");
  if (!sectorEntry) {
    throw new Error("Missing public catalog entry for SaaS.");
  }
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-cyan-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-violet-500/8 blur-[120px]" />

      <div className="relative border-b border-amber-400/15 bg-amber-400/[0.04] px-8 py-3 md:px-12">
        <div className="mx-auto flex max-w-[1320px] items-start gap-3">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-400" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-amber-100/80">
            <span className="font-semibold">Verticale planifiée</span> — la SaaS reste visible
            comme angle d&apos;offre, mais elle n&apos;est pas encore une preuve produit comparable
            au noyau Luxe. Cette page expose le positionnement et les agents potentiels, pas un
            runtime live.
          </p>
        </div>
      </div>

      <section className="relative px-8 pb-12 pt-20 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <Link
            href="/secteurs/luxe"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200 hover:text-violet-100"
          >
            <ArrowLeft className="h-3 w-3" />
            Tous les secteurs
          </Link>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
              <Cpu className="h-3.5 w-3.5" />
              Verticale · SaaS / Tech
            </span>
            <StatusBadge
              status={sectorEntry.status}
              proofLevel={sectorEntry.proofLevel}
            />
          </div>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            NEURAL pour les SaaS
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/68">
            {sectorEntry.description}
          </p>
        </div>
      </section>

      {/* ── Cas d'usage typiques ─────────────────────────────────────────── */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-400/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200">
            <Sparkles className="h-3 w-3" />
            Cas d&apos;usage typiques
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
            Quatre angles d&apos;entrée SaaS
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/65">
            Quatre catégories de cas d&apos;usage où NEURAL peut accélérer un éditeur SaaS B2B
            mid-market ou scale-up. Ces angles sont méthodologiquement définis — pas encore
            tous outillés.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {useCases.map((u) => {
              const Icon = u.icon;
              return (
                <div
                  key={u.title}
                  className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-400/[0.10] text-violet-200">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-bold tracking-tight text-white">
                        {u.title}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-white/65">{u.description}</p>
                    </div>
                  </div>
                  <div className="mt-4 border-t border-white/8 pt-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-amber-300/70">
                      Douleurs typiques
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {u.challenges.map((c) => (
                        <li key={c} className="flex gap-2 text-xs text-white/55">
                          <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-amber-400/70" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Agents potentiels ────────────────────────────────────────────── */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
            <Bot className="h-3 w-3" />
            Roadmap agents
          </span>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
            Six agents SaaS roadmap 2026-2027
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/65">
            Liste des agents que NEURAL prévoit pour la verticale SaaS, avec horizon de
            disponibilité. La priorisation sera ajustée selon la traction client réelle.
          </p>
          <div className="mt-8 space-y-3">
            {potentialAgents.map((agent) => (
              <div
                key={agent.name}
                className="flex flex-col gap-3 rounded-[20px] border border-white/8 bg-white/[0.03] p-5 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-violet-400/25 bg-violet-400/[0.08] text-violet-200">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-display text-base font-semibold text-white">
                      {agent.name}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-white/65">{agent.role}</p>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-3">
                  <StatusBadge status={agent.status} />
                  <span className="text-[11px] uppercase tracking-[0.18em] text-violet-200">
                    {agent.horizon}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="rounded-[28px] border border-cyan-400/20 bg-gradient-to-br from-cyan-500/[0.10] via-white/[0.04] to-violet-500/[0.06] p-8 md:p-12">
            <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                  SaaS B2B et besoin d&apos;un agent prioritaire ?
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-white/65">
                  La priorisation de la verticale SaaS dépend de la traction. Si un cas d&apos;usage
                  débloque votre roadmap (RevOps, Customer Success, CSRD, conformité AI Act),
                  c&apos;est le meilleur signal pour avancer le calendrier.
                </p>
              </div>
              <Link
                href="/contact?source=secteur-saas"
                className="inline-flex items-center gap-2 rounded-full bg-neural-violet px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-neural-violet/20 transition-all hover:bg-neural-violet-dark"
              >
                Cadrer un cas d&apos;usage <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
