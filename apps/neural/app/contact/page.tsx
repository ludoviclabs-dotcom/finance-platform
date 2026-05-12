import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  Mail,
  MapPinned,
  MessageSquare,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { ContactForm } from "@/components/site/contact-form";
import { PUBLIC_METRICS } from "@/lib/public-catalog";

export const metadata: Metadata = {
  title: "Contact | NEURAL",
  description:
    "Organiser un cadrage NEURAL: Proof Audit, Agent Pack 30 jours ou sprint runtime gouverné.",
};

const proofPoints = [
  {
    label: "Agents avec données",
    value: `${PUBLIC_METRICS.liveAgents}`,
    hint: "Surfaces branchées aux workbooks runtime",
  },
  {
    label: "Workbooks embarqués",
    value: `${PUBLIC_METRICS.runtimeWorkbooks}`,
    hint: "Lisibles via l'API /api/data",
  },
  {
    label: "Cellules alimentées",
    value: `${PUBLIC_METRICS.liveCells}/${PUBLIC_METRICS.frameworkCells}`,
    hint: "Ratio live sur capacité du framework",
  },
] as const;

const nextSteps = [
  {
    icon: Mail,
    title: "Vous envoyez le formulaire",
    body: "Le message part vers l'inbox de contact NEURAL. L'email est obligatoire pour pouvoir répondre.",
  },
  {
    icon: MessageSquare,
    title: "Réponse sous 24 h ouvrées",
    body: "Premier cadrage: secteur, niveau de preuve attendu, données disponibles et risques à lever.",
  },
  {
    icon: FileText,
    title: "Proposition de pilote",
    body: "Si le cas est pertinent: périmètre 30 jours, critères de succès, livrable et limites explicites.",
  },
] as const;

export default function ContactPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-neural-violet/12 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-60 right-1/4 h-[500px] w-[500px] rounded-full bg-neural-violet/6 blur-[140px]" />

      <section className="relative mx-auto max-w-[1440px] px-6 pb-24 pt-28 md:px-12 lg:pt-36">
        <header className="mb-14 max-w-3xl space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-violet-300">
            <Sparkles className="h-3.5 w-3.5" />
            Contact
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            Organiser un cadrage NEURAL.
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-white/65">
            Un formulaire, une réponse sous 24 h ouvrées, puis un échange court
            pour décider si un Proof Audit, un Agent Pack 30 jours ou un sprint
            runtime gouverné a du sens.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-3">
              {proofPoints.map((point) => (
                <div
                  key={point.label}
                  className="rounded-[20px] border border-white/10 bg-white/[0.04] p-5"
                >
                  <p className="font-display text-3xl font-bold text-white">
                    {point.value}
                  </p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                    {point.label}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-white/45">
                    {point.hint}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
              <div className="mb-5 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
                  Ce qui se passe ensuite
                </span>
                <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
              </div>
              <ol className="space-y-5">
                {nextSteps.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <li key={step.title} className="flex gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neural-violet/30 bg-neural-violet/10">
                        <Icon className="h-4 w-4 text-violet-200" />
                      </div>
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="font-display text-xs font-bold text-white/35">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <h2 className="text-base font-semibold text-white">
                            {step.title}
                          </h2>
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-white/60">
                          {step.body}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-gradient-to-br from-white/[0.04] to-emerald-500/[0.04] p-6">
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-5 w-5 text-emerald-300" />
                <div>
                  <p className="text-sm font-semibold text-white">Canal direct</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/60">
                    Si le formulaire ne convient pas, écrivez à{" "}
                    <a
                      href="mailto:ludoviclabs@gmail.com"
                      className="font-medium text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
                    >
                      ludoviclabs@gmail.com
                    </a>
                    . Aucun lien Cal.com public n'est affiché tant qu'un slug
                    vérifié n'est pas branché.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-white/55">
              <span className="flex items-center gap-2">
                <MapPinned className="h-4 w-4 text-white/45" />
                France, travail à distance
              </span>
              <span className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-white/45" />
                Réponse sous 24 h ouvrées
              </span>
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-white/45" />
                Données de contact limitées
              </span>
            </div>
          </div>

          <div className="space-y-5">
            <ContactForm />
            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-xs leading-relaxed text-white/55">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              <p>
                Les données envoyées servent uniquement à répondre à la demande.
                Pas de prospection automatisée, pas de retargeting, pas de
                calendrier tiers tant qu'il n'est pas vérifié.
              </p>
            </div>
          </div>
        </div>

        <section className="mt-20 rounded-[24px] border border-white/10 bg-gradient-to-r from-neural-violet/10 via-transparent to-emerald-500/10 p-8 md:p-12">
          <div className="grid gap-6 md:grid-cols-[1.3fr_1fr] md:items-center">
            <div>
              <h2 className="font-display text-2xl font-bold md:text-3xl">
                Vous voulez vérifier la preuve avant d'échanger ?
              </h2>
              <p className="mt-3 text-white/60">
                La console de preuve expose les compteurs, les agents vitrines,
                les limites et les statuts de maturité sans présenter la capacité
                cible comme un produit fini.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:justify-end">
              <Link
                href="/proof"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-neural-violet px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-neural-violet/25 transition-all hover:bg-neural-violet-dark hover:shadow-xl"
              >
                Voir la Proof Console
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/forfaits"
                className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white/85 transition-all hover:border-white/25 hover:bg-white/10"
              >
                Voir les offres pilotes
              </Link>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
