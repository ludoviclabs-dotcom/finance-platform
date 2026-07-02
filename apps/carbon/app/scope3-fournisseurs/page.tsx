/**
 * Landing SEO : collecte Scope 3 fournisseurs.
 *
 * Cible "questionnaire scope 3 fournisseur", "collecte données carbone fournisseurs",
 * "scope 3 achats". S'appuie exclusivement sur les capacités réelles du produit
 * (registre feature-status.json : questionnaire-fournisseurs-s3 = beta) : lien
 * tokenisé sans compte, campagnes de collecte avec suivi et relances, écran de
 * revue avant intégration.
 *
 * L'argument réglementaire « value chain cap » (plafond de la chaîne de valeur du
 * standard volontaire VS/VSME) est vérifié sur le projet d'acte délégué de mai 2026.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { NewsletterForm } from "@/components/landing/newsletter-form";

export const metadata: Metadata = {
  title: "Questionnaire Scope 3 fournisseurs : collecter sans friction | CarbonCo",
  description:
    "Collectez les données carbone de vos fournisseurs avec un questionnaire par lien sécurisé, sans " +
    "création de compte : campagnes avec deadline, suivi des réponses, relances et revue avant intégration " +
    "dans votre Scope 3. Et ce que le « value chain cap » du standard VSME/VS change pour vos demandes.",
  alternates: { canonical: "/scope3-fournisseurs" },
};

const STEPS_CLIENT = [
  {
    num: "01",
    title: "Créez la campagne",
    body: "Nommez la campagne (« Collecte fournisseurs 2026 »), fixez une date limite, sélectionnez ou importez vos fournisseurs (CSV). CarbonCo génère un lien unique et sécurisé par fournisseur.",
  },
  {
    num: "02",
    title: "Envoyez les liens et suivez les réponses",
    body: "Chaque fournisseur reçoit un lien à durée limitée — aucune création de compte, aucun mot de passe. Le tableau de suivi affiche qui a répondu, qui a ouvert sans terminer, qui n'a rien fait, et déclenche les relances à l'approche de l'échéance.",
  },
  {
    num: "03",
    title: "Revoyez, puis intégrez",
    body: "Les réponses n'entrent jamais telles quelles dans votre bilan : un écran de revue signale les valeurs incohérentes, et vous décidez ce qui alimente votre Scope 3 par catégorie. Chaque intégration reste traçable jusqu'à la réponse d'origine.",
  },
];

const SUPPLIER_VIEW = [
  "Un lien reçu par email, valable pour la durée de la campagne",
  "Un formulaire court : émissions (totales ou par scope), méthodologie, année de reporting, certifications (SBTi, ISO 14001, ISO 50001)",
  "Aucun compte à créer, utilisable sur mobile, soumission en quelques minutes",
];

const FAQ = [
  {
    q: "Que peut-on légalement demander à un fournisseur PME ?",
    a: "Le projet d'acte délégué du standard volontaire (VS, ex-VSME) publié en mai 2026 formalise un « plafond " +
      "de la chaîne de valeur » : les grands donneurs d'ordre ne peuvent pas exiger de leurs fournisseurs de " +
      "moins de 1 000 salariés des informations allant au-delà de ce standard. Concrètement : un questionnaire " +
      "aligné sur le VS est le maximum opposable — et c'est exactement le niveau que couvre le formulaire CarbonCo.",
  },
  {
    q: "Le fournisseur doit-il créer un compte ?",
    a: "Non. Chaque fournisseur reçoit un lien unique, sécurisé par un jeton aléatoire et limité dans le temps. " +
      "Il répond depuis n'importe quel navigateur, y compris mobile. C'est le principal facteur de taux de réponse.",
  },
  {
    q: "Comment les réponses alimentent-elles le Scope 3 ?",
    a: "Jamais automatiquement : les réponses passent par un écran de revue où les valeurs aberrantes sont " +
      "signalées (par exemple un total incohérent avec les scopes détaillés). Une fois validées, elles alimentent " +
      "vos catégories Scope 3 (achats, transport amont…) avec une traçabilité complète vers la réponse d'origine.",
  },
  {
    q: "Que faire des fournisseurs qui ne répondent pas ?",
    a: "C'est le cas majoritaire la première année. La bonne pratique : estimer ces fournisseurs en ratios " +
      "monétaires (dépense × facteur ADEME), qualité de donnée explicitement dégradée, puis remplacer " +
      "progressivement par de la donnée primaire au fil des campagnes. CarbonCo trace la qualité de chaque " +
      "donnée (1 à 5) pour rendre cette montée en gamme visible.",
  },
];

export default function Scope3FournisseursPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <main className="bg-white min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Toolbar */}
      <div className="border-b border-neutral-200 bg-white sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-sm font-extrabold tracking-tighter text-black">
            Carbon<span className="text-green-600">&amp;</span>Co
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/cbam" className="text-sm text-neutral-600 hover:text-neutral-900">
              CBAM
            </Link>
            <Link href="/blog" className="text-sm text-neutral-600 hover:text-neutral-900">
              Blog
            </Link>
          </div>
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="mb-10 pb-8 border-b border-neutral-200">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-green-600 mb-4">
            Scope 3 · Collecte fournisseurs
          </p>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-neutral-900 leading-tight mb-4">
            Vos fournisseurs ne répondront pas à un Excel en pièce jointe.
          </h1>
          <p className="text-lg text-neutral-600 leading-relaxed">
            Les catégories amont (achats, transport) concentrent l&apos;essentiel du Scope 3 — et
            reposent sur des données que vous ne possédez pas. CarbonCo remplace la relance manuelle
            de tableurs par des campagnes de collecte : lien sécurisé sans compte pour le
            fournisseur, suivi et relances pour vous, revue systématique avant intégration.
          </p>
        </header>

        {/* Étapes côté client */}
        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-neutral-900 mb-8">
            Comment ça marche
          </h2>
          <div className="space-y-8">
            {STEPS_CLIENT.map((p) => (
              <div key={p.num} className="grid grid-cols-[auto_1fr] gap-5">
                <div className="text-3xl font-extrabold tracking-tighter text-green-600">{p.num}</div>
                <div>
                  <p className="font-bold text-lg text-neutral-900 mb-1">{p.title}</p>
                  <p className="text-sm text-neutral-700 leading-relaxed">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Côté fournisseur */}
        <section className="rounded-2xl bg-neutral-50 border border-neutral-200 p-6 mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3">
            Vu du fournisseur
          </p>
          <ul className="space-y-2 ml-5 list-disc marker:text-green-600 text-sm text-neutral-700 leading-relaxed">
            {SUPPLIER_VIEW.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>

        {/* Value chain cap */}
        <section className="space-y-5 text-neutral-800 leading-relaxed">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-neutral-900">
            Le « value chain cap » : demandez le standard, pas plus
          </h2>
          <p>
            Le standard volontaire européen (VS, ex-VSME) n&apos;est pas qu&apos;un référentiel de
            reporting : son acte délégué formalise un <strong>plafond de la chaîne de valeur</strong>.
            Les donneurs d&apos;ordre soumis à la CSRD ne peuvent pas exiger de leurs fournisseurs de
            moins de 1 000 salariés des données allant au-delà de ce standard. Pour vous, deux
            conséquences pratiques : un questionnaire aligné sur le VS est à la fois
            <strong> suffisant</strong> (vos propres reportings) et <strong>proportionné</strong>
            (vous ne mettez pas vos fournisseurs en difficulté juridique ou opérationnelle).
          </p>
          <p>
            C&apos;est le parti pris du formulaire CarbonCo : émissions par scope, méthodologie,
            année de référence, certifications — rien d&apos;exotique, tout exploitable.
          </p>
        </section>

        {/* Encart produit */}
        <section className="mt-12 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-2">
            Disponible dans CarbonCo (beta)
          </p>
          <p className="text-sm text-neutral-800 leading-relaxed">
            Questionnaire fournisseur par lien tokenisé sans compte, campagnes de collecte avec date
            limite et import CSV, tableau de suivi des réponses, relances, écran de revue avant
            intégration au Scope 3 par catégorie. Chaque donnée intégrée reste traçable jusqu&apos;à
            la réponse d&apos;origine — c&apos;est la même chaîne de preuve que le reste de CarbonCo.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors"
            >
              Lancer une campagne
            </Link>
            <Link
              href="/etat-du-produit"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-green-300 text-green-800 text-sm font-semibold hover:bg-green-100 transition-colors"
            >
              Statut exact de chaque fonctionnalité
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-12">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-neutral-900 mb-6">
            Questions fréquentes
          </h2>
          <div className="space-y-6">
            {FAQ.map((item) => (
              <div key={item.q}>
                <p className="font-bold text-neutral-900 mb-1">{item.q}</p>
                <p className="text-sm text-neutral-700 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Newsletter */}
        <section className="mt-12">
          <NewsletterForm source="scope3-fournisseurs" />
        </section>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-neutral-200 text-xs text-neutral-500">
          <p>
            Le « plafond de la chaîne de valeur » est prévu par le projet d&apos;acte délégué du
            standard volontaire (VS) publié par la Commission européenne en mai 2026 — texte final
            attendu à l&apos;été 2026. Cette page est informative et ne constitue pas un conseil juridique.
          </p>
        </footer>
      </article>
    </main>
  );
}
