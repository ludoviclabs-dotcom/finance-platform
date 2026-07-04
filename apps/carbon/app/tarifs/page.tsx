import type { Metadata } from "next";
import Link from "next/link";

import { pricingPlans } from "@/lib/data";
import { CONTACT_EMAIL } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Tarifs — CarbonCo",
  description:
    "Tarifs indicatifs de CarbonCo (VSME, Business, Enterprise). Projet en programme pilote : " +
    "3 places gratuites pour l'exercice 2026. Sans carte bancaire, données en zone UE.",
  alternates: { canonical: "/tarifs" },
};

export default function TarifsPage() {
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
          Tarifs
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-neutral-900 mb-4">
          Un prix par livrable, pas par promesse.
        </h1>
        <p className="text-lg text-neutral-600 max-w-2xl mb-6 leading-relaxed">
          Du rapport VSME auditable au Scope 3 complet et à la consolidation multi-entités. Chaque
          offre n&apos;inclut que des fonctionnalités réellement livrées — le détail est public sur{" "}
          <Link href="/etat-du-produit" className="text-green-700 underline">l&apos;état du produit</Link>.
        </p>

        {/* Bandeau d'honnêteté : projet pilote, tarifs indicatifs */}
        <div className="rounded-2xl border border-green-200 bg-green-50 px-5 py-4 mb-12 text-sm text-green-900">
          <strong>Programme pilote — 3 places gratuites pour l&apos;exercice 2026.</strong>{" "}
          CarbonCo est un projet en cours de validation : les tarifs ci-dessous sont{" "}
          <strong>indicatifs</strong> et la facturation n&apos;est pas encore activée. Aucune carte
          bancaire requise.
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {pricingPlans.map((plan) => (
            <article
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                plan.highlighted
                  ? "border-green-500 shadow-lg shadow-green-500/10"
                  : "border-neutral-200"
              }`}
            >
              {plan.badge ? (
                <span className="absolute -top-3 left-6 rounded-full bg-green-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                  {plan.badge}
                </span>
              ) : null}
              <h2 className="text-xl font-extrabold text-neutral-900">{plan.name}</h2>
              <p className="mt-1 text-sm text-neutral-500 min-h-[40px]">{plan.description}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold tracking-tighter text-neutral-900">
                  {plan.price === "Sur devis" ? "Sur devis" : `${plan.price} €`}
                </span>
                {plan.period ? (
                  <span className="text-sm text-neutral-500">{plan.period}</span>
                ) : null}
              </div>
              <ul className="mt-6 flex flex-col gap-2.5 text-sm text-neutral-700">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                    </svg>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className={`mt-7 inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-bold transition-colors ${
                  plan.highlighted
                    ? "bg-neutral-900 text-white hover:bg-neutral-800"
                    : "border border-neutral-300 text-neutral-900 hover:bg-neutral-50"
                }`}
              >
                {plan.price === "Sur devis" ? "Nous contacter" : "Démarrer l'essai"}
              </Link>
            </article>
          ))}
        </div>

        <p className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-neutral-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="text-green-600">✓</span> Aucune carte bancaire
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-green-600">✓</span> Données métier en zone UE (Neon Postgres)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-green-600">✓</span> Preuve vérifiable par hash public
          </span>
        </p>

        {/* CTA pilote */}
        <section className="mt-12 rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-800 text-white p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-green-400 mb-2">
            Une question sur le périmètre ?
          </p>
          <p className="font-bold text-xl mb-3">Cadrons votre cas dans le programme pilote.</p>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Tarifs%20CarbonCo%20%E2%80%94%20programme%20pilote`}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-white text-neutral-900 text-sm font-semibold hover:bg-neutral-100 transition-colors"
          >
            Échanger avec nous
          </a>
        </section>
      </section>
    </main>
  );
}
