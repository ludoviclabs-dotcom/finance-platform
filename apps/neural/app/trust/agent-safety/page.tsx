import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  FileText,
  LockKeyhole,
  Network,
  ShieldCheck,
} from "lucide-react";

import { AgentSafetyFlowchart } from "@/components/trust/agent-safety-flowchart";
import { AgentSafetyModelCard } from "@/components/trust/agent-safety-model-card";
import { AuditTrailTimeline } from "@/components/trust/audit-trail-timeline";
import { PolicyDecisionMatrix } from "@/components/trust/policy-decision-matrix";
import { SafetyDecisionDemo } from "@/components/trust/safety-decision-demo";
import { SafetyScenarioCards } from "@/components/trust/safety-scenario-cards";
import {
  agentSafetyProfiles,
  safetyReferences,
  usageModes,
} from "@/lib/data/agent-safety";

export const metadata: Metadata = {
  title: "Sécurité des agents IA — Trust NEURAL",
  description:
    "Comment NEURAL limite le périmètre d'action des agents IA : gates déterministes, Operator Gateway, human-in-the-loop, audit trail et Model Cards.",
};

export default function AgentSafetyPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <section className="relative border-b border-white/8 px-6 pb-14 pt-30 md:px-12 lg:pt-36">
        <div className="absolute inset-0 bg-grid-pattern opacity-40" />
        <div className="relative mx-auto max-w-[1320px]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-4 py-1.5 text-xs font-semibold text-emerald-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              Agent Safety
            </span>
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-white/65">
              Trust Center
            </span>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_0.72fr] lg:items-end">
            <div className="min-w-0">
              <h1 className="break-words font-display text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
                Pourquoi un agent NEURAL ne peut pas tout supprimer
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-relaxed text-white/70">
                NEURAL ne demande pas aux clients de faire confiance au modele.
                L&apos;agent propose, la gateway controle, les gates serveur gardent le
                dernier mot, et l&apos;humain valide quand l&apos;impact l&apos;exige.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/trust/agent-safety/deck"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#0A1628] transition-colors hover:bg-violet-100"
                >
                  Ouvrir le deck commercial
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/operator-gateway"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/[0.09]"
                >
                  Voir l&apos;Operator Gateway
                  <Network className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="min-w-0 rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
              <p className="font-mono text-xs text-white/42">Position de securite</p>
              <div className="mt-5 space-y-4">
                {[
                  "Pas d'acces direct, large et non supervise aux environnements critiques.",
                  "Pas d'action irreversible ou reglementee sans validation humaine.",
                  "Pas de decision finale du LLM quand une gate deterministe contredit la sortie.",
                ].map((item) => (
                  <div key={item} className="flex gap-3">
                    <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/[0.08]">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-200" />
                    </div>
                    <p className="text-sm leading-relaxed text-white/72">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/8 px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-violet-200">Flowchart securite</p>
            <h2 className="mt-3 font-display text-3xl font-bold">
              La chaine de controle avant toute sortie agent
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              Le LLM est une etape possible, pas le centre de gravite. Les controles
              sont appliques avant, apres, et au moment de livrer.
            </p>
          </div>
          <div className="mt-8">
            <AgentSafetyFlowchart />
          </div>
        </div>
      </section>

      <section className="border-b border-white/8 px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold text-violet-200">
                Les trois regimes d&apos;usage
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold">
                Assiste, automatise, agentique : ne jamais les confondre
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-white/65">
                La posture NEURAL consiste a rendre le changement de classe de
                risque visible et documente au lieu de le masquer dans une interface.
              </p>
            </div>
            <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04]">
              <div className="grid grid-cols-[0.7fr_1fr_1fr] gap-4 border-b border-white/8 px-5 py-4 text-xs font-semibold text-white/42">
                <span>Mode</span>
                <span>Risque</span>
                <span>Position NEURAL</span>
              </div>
              {usageModes.map((mode) => (
                <div
                  key={mode.id}
                  className="grid gap-4 border-b border-white/8 px-5 py-4 last:border-b-0 md:grid-cols-[0.7fr_1fr_1fr]"
                >
                  <div>
                    <p className="font-semibold text-white">{mode.label}</p>
                    <p className="mt-1 text-sm text-white/55">{mode.description}</p>
                  </div>
                  <p className="text-sm leading-relaxed text-white/65">
                    {mode.riskChange}
                  </p>
                  <p className="text-sm leading-relaxed text-white/78">
                    {mode.neuralPosition}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/8 px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-violet-200">
              Matrice des droits
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold">
              ALLOW, REVIEW ou BLOCK
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              Le verdict final est une decision de politique applicative, pas une
              impression du modele.
            </p>
          </div>
          <div className="mt-8">
            <PolicyDecisionMatrix />
          </div>
        </div>
      </section>

      <section className="border-b border-white/8 px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <SafetyDecisionDemo />
        </div>
      </section>

      <section className="border-b border-white/8 px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-violet-200">
              Workflows d&apos;incident evite
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold">
              Quatre cas qui montrent le controle en action
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              Ces scenarios sont volontairement concrets : autopublication,
              source manquante, claim ESG risque et export massif.
            </p>
          </div>
          <div className="mt-8">
            <SafetyScenarioCards />
          </div>
        </div>
      </section>

      <section className="border-b border-white/8 px-6 py-16 md:px-12">
        <div className="mx-auto grid max-w-[1320px] grid-cols-1 gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-sm font-semibold text-violet-200">
              Audit trail timeline
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold">
              Reconstruire une decision apres coup
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              Le bon niveau de confiance n&apos;est pas une promesse abstraite :
              c&apos;est la capacite a relire ce qui s&apos;est passe, qui a valide,
              quelle gate a bloque et quel pack a ete livre.
            </p>
            <Link
              href="/docs/audit-trail"
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.09]"
            >
              Lire la doc audit trail
              <BookOpen className="h-4 w-4" />
            </Link>
          </div>
          <AuditTrailTimeline />
        </div>
      </section>

      <section className="border-b border-white/8 px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-violet-200">
              Model Cards prioritaires
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold">
              Cinq agents avec perimetre, outils et limites visibles
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              Ces cartes rendent explicite ce qui est autorise, interdit et soumis
              a validation humaine.
            </p>
          </div>
          <div className="mt-8 space-y-5">
            {agentSafetyProfiles.map((profile) => (
              <AgentSafetyModelCard key={profile.agentId} profile={profile} compact />
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/8 px-6 py-16 md:px-12">
        <div className="mx-auto grid max-w-[1320px] grid-cols-1 gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-sm font-semibold text-violet-200">
              Limites assumees
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold">
              Professionnel ne veut pas dire magique
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              NEURAL montre ce qui est deja prouve et ce qui reste en trajectoire.
              C&apos;est plus solide qu&apos;un discours de certification premature.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: LockKeyhole,
                title: "Pas de zero risque",
                body: "Les controles reduisent le blast radius. Ils ne promettent pas l'infaillibilite.",
              },
              {
                icon: Network,
                title: "Gateway MVP",
                body: "La page Operator Gateway est encore en partie demo et roadmap.",
              },
              {
                icon: FileText,
                title: "Certifications",
                body: "SOC 2 et ISO sont affichees comme roadmap, pas comme acquises.",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.title}
                  className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5"
                >
                  <Icon className="h-5 w-5 text-amber-200" />
                  <h3 className="mt-4 text-lg font-semibold text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/62">
                    {item.body}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="rounded-[28px] border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.12] via-white/[0.04] to-emerald-500/[0.07] p-8 md:p-12">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
              <div>
                <h2 className="font-display text-3xl font-bold">
                  Prouver la securite avant de vendre l&apos;autonomie
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/68">
                  Le bon pilote NEURAL montre une sortie utile, une action bloquee,
                  une revue humaine et un export auditable.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/contact?subject=agent-safety"
                    className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#0A1628] transition-colors hover:bg-violet-100"
                  >
                    Demander une demo securite
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/trust/agent-safety/deck"
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/[0.09]"
                  >
                    Voir le deck
                    <FileText className="h-4 w-4" />
                  </Link>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-white/72">References citees</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {safetyReferences.map((reference) => (
                    <a
                      key={reference.href}
                      href={reference.href}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white/68 transition-colors hover:bg-white/[0.09] hover:text-white"
                    >
                      {reference.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
