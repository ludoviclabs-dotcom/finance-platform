import Link from "next/link";
import { ArrowRight, Calendar, Mail, Sparkles } from "lucide-react";

import { SubscribeForm } from "@/components/newsletter/subscribe-form";
import changelogData from "@/content/changelog.json";

export const metadata = {
  title: "Newsletter | NEURAL",
  description:
    "Préinscription newsletter NEURAL: veille AI Act, secteurs régulés EU et nouveautés produit, avec statut d'intégration transparent.",
};

const benefits = [
  {
    title: "Veille AI Act, DORA, CSRD",
    description:
      "Synthèse des évolutions réglementaires utiles aux opérateurs d'agents IA en Europe.",
  },
  {
    title: "Retours d'expérience sectoriels",
    description:
      "Cadrages en banque, luxe, aéronautique et assurance, avec limites et enseignements.",
  },
  {
    title: "Nouveautés produit",
    description:
      "Agents qui passent en runtime, preuves ajoutées, exports et critères de maturité.",
  },
  {
    title: "Outils gratuits",
    description:
      "Évolutions prévues autour du ROI Calculator, AI Act Classifier, DPIA Generator et Operator Score.",
  },
] as const;

export default function NewsletterPage() {
  const recentEntries = changelogData.entries.slice(0, 6);

  return (
    <main className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-emerald-500/8 blur-[120px]" />

      <section className="relative px-6 pb-12 pt-32 md:px-12">
        <div className="mx-auto max-w-[920px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
            <Mail className="h-3.5 w-3.5" />
            Newsletter
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Une newsletter prévue, pas encore industrialisée.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/68">
            NEURAL prépare une édition mensuelle sur l'IA gouvernée, les secteurs
            régulés EU et la preuve produit. La liste automatisée n'est pas encore
            branchée: la page reste volontairement transparente.
          </p>
        </div>
      </section>

      <section className="relative px-6 pb-12 md:px-12">
        <div className="mx-auto max-w-[920px]">
          <SubscribeForm />
        </div>
      </section>

      <section className="relative border-t border-white/8 px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[920px]">
          <div className="flex items-center gap-2 text-violet-300">
            <Sparkles className="h-4 w-4" />
            <span className="text-[11px] uppercase tracking-[0.18em]">
              Sommaire prévu
            </span>
          </div>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
            Quatre rubriques utiles
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {benefits.map((item, index) => (
              <div
                key={item.title}
                className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6"
              >
                <p className="font-display text-3xl font-bold text-violet-300 tabular-nums">
                  0{index + 1}
                </p>
                <h3 className="mt-3 font-display text-lg font-bold tracking-tight text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-6 py-16 md:px-12">
        <div className="mx-auto max-w-[920px]">
          <div className="flex items-center gap-2 text-emerald-300">
            <Calendar className="h-4 w-4" />
            <span className="text-[11px] uppercase tracking-[0.18em]">Archive</span>
          </div>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">
            Aperçu éditorial
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/65">
            Le changelog public donne un aperçu du type de contenu qui pourrait
            être transformé en newsletter.
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
    </main>
  );
}
