import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck2,
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

/**
 * NEURAL — page `/contact`.
 *
 * Sprint P0 (avril 2026) — remplace l'ancienne page non déployée.
 * Server component : le `<ContactForm />` (client) gère le POST /api/contact.
 *
 * Contenu aligné sur PR3 (retrait des claims non prouvés) : les seuls chiffres
 * affichés viennent de PUBLIC_METRICS, donc du catalogue réel.
 */

export const metadata: Metadata = {
  title: "Contact — NEURAL",
  description:
    "Organiser une démo guidée ou un cadrage avec NEURAL. Réponse sous 24 h ouvrées, France, travail à distance.",
};

const proofPoints = [
  {
    label: "Agents avec données réelles",
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
    body: "Je reçois votre message directement, sans passer par un CRM ni un back-office commercial.",
  },
  {
    icon: MessageSquare,
    title: "Je reviens sous 24 h ouvrées",
    body: "Premier angle de cadrage : secteur à viser, niveau de preuve attendu, verticale publique à montrer.",
  },
  {
    icon: CalendarCheck2,
    title: "On fixe 30 minutes",
    body: "Appel focalisé. À l'issue : un compte rendu écrit et, si pertinent, un périmètre de pilote.",
  },
] as const;

const faqItems = [
  {
    q: "Quel format d'échange est le plus utile ?",
    a: "Un call de 30 minutes, caméra optionnelle. L'objectif est de cadrer votre besoin, pas de dérouler un pitch. Je partage mon écran si une démo verticale est pertinente.",
  },
  {
    q: "Que préparer avant le rendez-vous ?",
    a: "Rien d'obligatoire. Un contexte écrit (secteur, processus visé, contrainte de délai ou de conformité) rend l'échange plus dense. Sinon on déroule à partir de votre première intention.",
  },
  {
    q: "Sous combien de temps ai-je une réponse ?",
    a: "Sous 24 h ouvrées, systématiquement. Si le besoin est hors scope, je le dis clairement et redirige vers une ressource ou un confrère pertinent.",
  },
  {
    q: "Mes informations sont-elles stockées ?",
    a: "Les données du formulaire sont acheminées par Resend (serveurs UE) jusqu'à mon inbox. Aucun CRM automatisé, aucune séquence de relance, aucun retargeting publicitaire.",
  },
] as const;

export default function ContactPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-neural text-white">
      {/* Ambient effects — cohérents avec /publications */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 animate-pulse-slow rounded-full bg-neural-violet/12 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-60 right-1/4 h-[500px] w-[500px] animate-pulse-slow rounded-full bg-neural-violet/6 blur-[140px]" />
      <div className="pointer-events-none absolute right-0 top-1/3 h-64 w-64 animate-pulse-slow rounded-full bg-emerald-500/5 blur-[100px]" />

      <div className="relative mx-auto max-w-[1440px] px-8 pb-24 pt-28 md:px-12 lg:pt-36">
        {/* ═══ Header ═══ */}
        <header className="mb-14 max-w-3xl space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-violet-300">
            <Sparkles className="h-3.5 w-3.5" />
            Contact
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            Organiser une démo,{" "}
            <span className="bg-gradient-to-r from-neural-violet-light to-neural-green bg-clip-text text-transparent">
              un cadrage, une conversation.
            </span>
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-white/65">
            Un formulaire, une réponse sous 24 h ouvrées, et un appel court pour
            décider si un pilote a du sens. Pas de back-office commercial imposé,
            pas de relance automatisée.
          </p>
        </header>

        {/* ═══ Grid principale : contexte | formulaire ═══ */}
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          {/* ── Colonne contexte ── */}
          <div className="space-y-8">
            {/* Proof points */}
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

            {/* Ce qui se passe ensuite — stepper */}
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
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="font-display text-xs font-bold text-white/35">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <h3 className="text-base font-semibold text-white">
                            {step.title}
                          </h3>
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

            {/* Canal direct */}
            <div className="rounded-[24px] border border-white/10 bg-gradient-to-br from-white/[0.04] to-emerald-500/[0.04] p-6">
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-5 w-5 text-emerald-300" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">
                    Canal direct
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-white/60">
                    Si le formulaire ne convient pas, écrire à{" "}
                    <a
                      href="mailto:ludoviclabs@gmail.com"
                      className="font-medium text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
                    >
                      ludoviclabs@gmail.com
                    </a>
                    . Même engagement : réponse sous 24 h ouvrées.
                  </p>
                </div>
              </div>
            </div>

            {/* Trust line */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-white/55">
              <span className="flex items-center gap-2">
                <MapPinned className="h-4 w-4 text-white/45" />
                France · travail à distance
              </span>
              <span className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-white/45" />
                Réponse sous 24 h ouvrées
              </span>
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-white/45" />
                Données acheminées en UE
              </span>
            </div>
          </div>

          {/* ── Colonne formulaire ── */}
          <div className="space-y-5">
            <ContactForm />
            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-xs leading-relaxed text-white/55">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              <p>
                Envoi direct par e-mail. Pas de CRM automatisé, pas de séquence
                de relance, pas de partage avec des tiers. Vous recevez un mot
                nominatif, pas un template.
              </p>
            </div>
          </div>
        </div>

        {/* ═══ FAQ ═══ */}
        <section className="mt-24">
          <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-cyan-300">
                <FileText className="h-3.5 w-3.5" />
                Questions fréquentes
              </div>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-tight md:text-4xl">
                Avant d'envoyer le formulaire
              </h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-white/55">
              Quatre points qui évitent les allers-retours et posent un cadre
              clair dès le premier échange.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {faqItems.map((item) => (
              <div
                key={item.q}
                className="rounded-[20px] border border-white/10 bg-white/[0.04] p-6"
              >
                <h3 className="text-base font-semibold leading-snug text-white">
                  {item.q}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-white/60">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ Alt CTA ═══ */}
        <section className="mt-20 rounded-[24px] border border-white/10 bg-gradient-to-r from-neural-violet/10 via-transparent to-emerald-500/10 p-8 md:p-12">
          <div className="grid gap-6 md:grid-cols-[1.3fr_1fr] md:items-center">
            <div>
              <h3 className="font-display text-2xl font-bold md:text-3xl">
                Pas encore prêt à échanger ?
              </h3>
              <p className="mt-3 text-white/60">
                La preuve produit la plus avancée est publique. Les publications
                éclairent la méthode, et la page Trust explique ce qui est live,
                démo ou encore en préparation.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:justify-end">
              <Link
                href="/secteurs/luxe/finance"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-neural-violet px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-neural-violet/25 transition-all hover:bg-neural-violet-dark hover:shadow-xl"
              >
                Voir la preuve Luxe Finance
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/publications"
                className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white/85 transition-all hover:border-white/25 hover:bg-white/10"
              >
                Lire les publications
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
