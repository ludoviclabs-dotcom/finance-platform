import type { Metadata } from "next";
import Link from "next/link";
import {
  CollecteIllustration,
  CalculIllustration,
  AuditIllustration,
  RapportIllustration,
  Scope1Illustration,
  Scope2Illustration,
  Scope3Illustration,
  OtiIllustration,
} from "@/components/landing/illustrations";
import { PRODUCT_MODULES } from "@/lib/product-modules";

export const metadata: Metadata = {
  title: "Modules produit — CarbonCo",
  description:
    "Les 8 modules de la plateforme CarbonCo : collecte, calcul, audit trail, rapport, Scope 1/2/3 et préparation OTI. Une page dédiée par module.",
  alternates: { canonical: "/produit" },
};

const ILLUS = {
  Collecte: CollecteIllustration,
  Calcul: CalculIllustration,
  Audit: AuditIllustration,
  Rapport: RapportIllustration,
  Scope1: Scope1Illustration,
  Scope2: Scope2Illustration,
  Scope3: Scope3Illustration,
  Oti: OtiIllustration,
};

export default function ProductIndexPage() {
  return (
    <main className="bg-white min-h-screen">
      <div className="border-b border-neutral-200 bg-white sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-sm font-extrabold tracking-tighter text-black">
            Carbon<span className="text-green-600">&amp;</span>Co
          </Link>
          <Link href="/" className="text-sm text-neutral-600 hover:text-neutral-900">
            ← Accueil
          </Link>
        </div>
      </div>

      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-green-600 mb-4">
          Modules produit
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-neutral-900 mb-4">
          8 modules, une plateforme.
        </h1>
        <p className="text-lg text-neutral-600 max-w-2xl mb-6 leading-relaxed">
          Chaque module est conçu pour s&apos;intégrer aux autres et offrir une couverture
          complète du reporting CSRD/ESRS, sans empilement d&apos;outils.
        </p>

        <Link
          href="/proof"
          className="mb-12 flex flex-col gap-4 rounded-2xl border border-green-200 bg-green-50/70 p-6 transition-all hover:border-green-500 hover:bg-green-50 md:flex-row md:items-center md:justify-between"
        >
          <span>
            <span className="block text-xs font-bold uppercase tracking-[0.24em] text-green-700">
              Proof Twin public
            </span>
            <span className="mt-2 block text-lg font-extrabold tracking-tight text-neutral-950">
              Audit trail, hash SHA-256 et Proof Console NEURAL
            </span>
            <span className="mt-2 block max-w-2xl text-sm leading-relaxed text-neutral-600">
              Un point d&apos;entrée public pour retrouver les incrémentations de preuve et éviter les décalages entre CarbonCo et NEURAL.
            </span>
          </span>
          <span className="text-sm font-extrabold text-green-700">Voir la page preuve →</span>
        </Link>

        <div className="grid md:grid-cols-2 gap-6">
          {PRODUCT_MODULES.map((m) => {
            const Illu = ILLUS[m.illustration];
            return (
              <Link
                key={m.slug}
                href={`/produit/${m.slug}`}
                className="group block rounded-2xl border border-neutral-200 p-6 hover:border-green-500 hover:shadow-lg transition-all"
              >
                <Illu className="mb-4" />
                <h2 className="text-xl font-bold text-neutral-900 group-hover:text-green-700 transition-colors mb-2">
                  {m.title}
                </h2>
                <p className="text-sm text-neutral-600 leading-relaxed">{m.pitch}</p>
                <p className="mt-4 text-xs font-semibold text-green-700">
                  Découvrir le module →
                </p>
              </Link>
            );
          })}
        </div>

        {/* Module d'exploration — hors workflow de conformité, même pattern que
            le callout Proof Twin ci-dessus, en sombre (signature /materials). */}
        <Link
          href="/materials"
          className="mt-12 flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-6 transition-all hover:border-zinc-600 md:flex-row md:items-center md:justify-between"
        >
          <span>
            <span className="block text-xs font-bold uppercase tracking-[0.24em] text-red-400">
              Module d&apos;exploration
            </span>
            <span className="mt-2 block text-lg font-extrabold tracking-tight text-white">
              Matières premières critiques — prix, dépendances, producteurs
            </span>
            <span className="mt-2 block max-w-2xl text-sm leading-relaxed text-zinc-400">
              Les 34 matières critiques UE cartographiées pour éclairer vos analyses
              Scope 3 et votre double matérialité. Snapshot hebdomadaire, chaque point daté.
            </span>
          </span>
          <span className="text-sm font-extrabold text-amber-400">Explorer les matières →</span>
        </Link>
      </section>
    </main>
  );
}
