import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  DatabaseZap,
  FileCheck2,
  Fingerprint,
  ShieldCheck,
} from "lucide-react";

const NEURAL_PROOF_URL = "https://neural-five.vercel.app/proof";

export const metadata: Metadata = {
  title: "Proof Twin public - CarbonCo",
  description:
    "Point d'accès public aux preuves CarbonCo : audit trail, hash SHA-256, Evidence Pack et Proof Console NEURAL.",
  alternates: { canonical: "https://carbonco.fr/proof" },
};

const proofSignals = [
  {
    icon: FileCheck2,
    title: "Audit trail CarbonCo",
    text: "Chaque chiffre garde son origine, sa méthode de calcul, son statut de validation et son historique exploitable par un auditeur.",
  },
  {
    icon: Fingerprint,
    title: "Hash SHA-256",
    text: "Les exports et packages de preuve peuvent être reliés à une empreinte vérifiable pour détecter toute modification après génération.",
  },
  {
    icon: DatabaseZap,
    title: "Proof Console NEURAL",
    text: "La console NEURAL expose la couche produit unifiée : actifs disponibles, données parsées, briques vendables et score de preuve.",
  },
];

const publicChecks = [
  "Route CarbonCo /proof publique et indexable",
  "Lien direct vers la Proof Console NEURAL déjà en production",
  "Sitemap CarbonCo mis à jour pour la découverte publique",
];

export default function ProofPage() {
  return (
    <main className="min-h-screen bg-white text-neutral-950">
      <div className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-sm font-extrabold tracking-tighter text-black">
            Carbon<span className="text-green-600">&amp;</span>Co
          </Link>
          <Link href="/produit" className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-600 transition-colors hover:text-neutral-950">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Modules produit
          </Link>
        </div>
      </div>

      <section className="bg-neutral-950 px-6 py-20 text-white md:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-emerald-200">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Proof Twin public
            </div>
            <h1 className="max-w-3xl text-4xl font-extrabold tracking-tighter md:text-6xl">
              Preuves, audit trail et console NEURAL au même endroit.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-neutral-300 md:text-lg">
              CarbonCo expose ici le point d'entrée public vers la couche de preuve : ce qui est déjà traçable dans CarbonCo, ce qui est vérifiable par hash, et la console NEURAL qui documente l'état réel des briques de preuve.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={NEURAL_PROOF_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-extrabold text-neutral-950 transition-colors hover:bg-neutral-100"
              >
                Ouvrir la Proof Console NEURAL
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <Link
                href="/etat-du-produit"
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
              >
                Voir l'état produit
              </Link>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-5 shadow-2xl">
            <div className="rounded-2xl border border-emerald-400/15 bg-neutral-950 p-5">
              <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Statut public</p>
                  <p className="mt-1 text-sm text-neutral-400">CarbonCo + NEURAL</p>
                </div>
                <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">
                  Live-ready
                </span>
              </div>
              <ul className="space-y-4">
                {publicChecks.map((check) => (
                  <li key={check} className="flex gap-3 text-sm leading-relaxed text-neutral-200">
                    <BadgeCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300" aria-hidden="true" />
                    <span>{check}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-16 md:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-green-600">Couche de preuve</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tighter text-neutral-950 md:text-4xl">
              Ce que la page rend accessible.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-neutral-600">
              CarbonCo et NEURAL restent deux surfaces distinctes du même dépôt, mais cette page donne une adresse simple et publique pour retrouver les incrémentations liées au proof twin.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {proofSignals.map((signal) => {
              const Icon = signal.icon;
              return (
                <article key={signal.title} className="rounded-2xl border border-neutral-200 p-6 transition-shadow hover:shadow-lg">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-green-200 bg-green-50 text-green-700">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-extrabold tracking-tight text-neutral-950">{signal.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-neutral-600">{signal.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-neutral-200 bg-neutral-50 px-6 py-14">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-neutral-500">Accès public</p>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-neutral-950 md:text-3xl">
              Une adresse stable pour éviter les décalages de version.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-neutral-600">
              Les déploiements CarbonCo et NEURAL peuvent pointer vers le même commit GitHub tout en exposant des applications différentes. Cette page sert de pont public entre les deux expériences.
            </p>
          </div>
          <a
            href={NEURAL_PROOF_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-neutral-950 px-6 py-3 text-sm font-extrabold text-white transition-colors hover:bg-neutral-800"
          >
            Consulter la console
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </section>
    </main>
  );
}
