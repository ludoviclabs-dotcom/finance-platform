import Link from "next/link";
import { Mail, Sparkles, Calendar, ArrowRight } from "lucide-react";

import { SubscribeForm } from "@/components/newsletter/subscribe-form";
import changelogData from "@/content/changelog.json";

export const metadata = {
  title: "Newsletter — NEURAL",
  description:
    "Newsletter mensuelle NEURAL : cadrage AI Act, retours d'expérience secteurs régulés EU, nouveautés produit. Désinscription en 1 clic, pas de spam, données EU.",
};

const BENEFITS = [
  {
    title: "Veille AI Act + DORA + CSRD",
    description:
      "Une synthèse mensuelle des évolutions réglementaires qui impactent les opérateurs d'agents IA en EU.",
  },
  {
    title: "Retours d'expérience sectoriels",
    description:
      "Cadrages réels en banque, luxe, aéro, assurance — anonymisés. Ce qui a marché, ce qui a échoué, pourquoi.",
  },
  {
    title: "Nouveautés produit",
    description:
      "Les agents qui passent en runtime, les comparateurs ajoutés, les certifications avancées.",
  },
  {
    title: "Outils gratuits avant tout le monde",
    description:
      "AI Act Classifier, ROI Calculator, DPIA Generator, Operator Score — accès anticipé aux nouvelles versions.",
  },
];

export default function NewsletterPage() {
  // Use changelog as proxy for "newsletter archive" — chaque entry = 1 édition
  const recentEntries = changelogData.entries.slice(0, 6);

  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-emerald-500/8 blur-[120px]" />

      <section className="relative px-8 pb-12 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[920px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
            <Mail className="h-3.5 w-3.5" />
            Newsletter
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Une édition par mois, pas plus
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/68">
            Cadrage AI Act, retours d&apos;expérience secteurs régulés EU, nouveautés produit.
            Format dense (8-10 min de lecture). Pas de relance commerciale entre les éditions.
          </p>
        </div>
      </section>

      <section className="relative px-8 pb-12 md:px-12">
        <div className="mx-auto max-w-[920px]">
          <SubscribeForm />
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[920px]">
          <div className="flex items-center gap-2 text-violet-300">
            <Sparkles className="h-4 w-4" />
            <span className="text-[11px] uppercase tracking-[0.18em]">Au sommaire chaque mois</span>
          </div>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
            Quatre rubriques régulières
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {BENEFITS.map((b, i) => (
              <div
                key={b.title}
                className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6"
              >
                <p className="font-display text-3xl font-bold text-violet-300 tabular-nums">
                  0{i + 1}
                </p>
                <h3 className="mt-3 font-display text-lg font-bold tracking-tight text-white">
                  {b.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/65">{b.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[920px]">
          <div className="flex items-center gap-2 text-emerald-300">
            <Calendar className="h-4 w-4" />
            <span className="text-[11px] uppercase tracking-[0.18em]">Archive</span>
          </div>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
            Aperçu des éditions précédentes
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/65">
            Tirées du changelog public — un aperçu du type de contenu qu&apos;une édition contient.
          </p>
          <div className="mt-8 space-y-3">
            {recentEntries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-2xl border border-white/8 bg-white/[0.03] p-5"
              >
                <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em]">
                  <span className="text-emerald-300/70">{entry.category}</span>
                  <span className="text-white/30">·</span>
                  <span className="text-white/45">
                    {new Date(entry.date).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <p className="mt-2 font-display text-base font-semibold leading-snug text-white">
                  {entry.title}
                </p>
              </div>
            ))}
          </div>
          <Link
            href="/changelog"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-violet-200 hover:text-violet-100"
          >
            Voir le changelog complet <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
