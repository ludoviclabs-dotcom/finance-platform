import type { Metadata } from "next";
import Link from "next/link";

import {
  integrationsBySection,
  type Integration,
  type IntegrationSection,
} from "@/lib/feature-registry";
import { FeatureStatusBadge } from "@/components/ui/feature-status-badge";

export const metadata: Metadata = {
  title: "Intégrations & imports — CarbonCo",
  description:
    "Ce que CarbonCo permet d'importer aujourd'hui (import Excel structuré, API REST) et ce qui " +
    "est planifié (imports fichiers AWS, GCP, Qonto, FEC) ou en roadmap (connecteurs ERP). " +
    "Statut honnête, sans promesse de connecteur non livré.",
  alternates: { canonical: "/integrations" },
};

const SECTIONS: { key: IntegrationSection; title: string; subtitle: string }[] = [
  {
    key: "disponible",
    title: "Disponible aujourd'hui",
    subtitle:
      "Ce qui correspond à du code en production. Aucun connecteur OAuth tiers n'est livré à ce jour — nous ne l'affichons donc pas comme disponible.",
  },
  {
    key: "imports-fichiers",
    title: "Imports fichiers (sans OAuth) — planifié",
    subtitle:
      "Des fichiers exportés manuellement par vous, parsés par CarbonCo. Pas d'OAuth, pas d'homologation : c'est la voie la plus rapide vers un Scope 3 monétaire. Planifié (tâches T4.3 / T5.4).",
  },
  {
    key: "roadmap",
    title: "Connecteurs natifs — roadmap",
    subtitle:
      "Connecteurs OAuth/API tiers, priorisés selon la demande client réelle. Aucune date garantie ; l'import fichier ci-dessus couvre l'essentiel du besoin sans attendre.",
  },
];

export default function IntegrationsPage() {
  const bySection = integrationsBySection();
  const liveCount = bySection.disponible.filter((i) => i.statut === "live").length;

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
          Intégrations &amp; imports
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-neutral-900 mb-4">
          Ce que vous pouvez brancher — vraiment.
        </h1>
        <p className="text-lg text-neutral-600 max-w-2xl mb-6 leading-relaxed">
          Nous préférons une page honnête à un mur de logos. Aujourd&apos;hui, CarbonCo s&apos;alimente
          par import Excel structuré et par API REST. Les imports fichiers et les connecteurs natifs
          sont planifiés — avec leur statut réel ci-dessous.
        </p>
        <p className="text-sm text-neutral-500 max-w-2xl mb-12">
          Le statut de chaque ligne provient du registre{" "}
          <Link href="/etat-du-produit" className="text-green-700 underline hover:text-green-800">
            état du produit
          </Link>
          . Rien n&apos;est affiché « disponible » sans code correspondant dans le dépôt.
        </p>

        {SECTIONS.map((section) => {
          const items = bySection[section.key];
          if (items.length === 0) return null;
          return (
            <section key={section.key} className="mb-14">
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-neutral-900 mb-2">
                {section.title}
              </h2>
              <p className="text-sm text-neutral-500 max-w-3xl mb-6 leading-relaxed">
                {section.subtitle}
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                {items.map((i) => (
                  <IntegrationCard key={i.id} integration={i} />
                ))}
              </div>
            </section>
          );
        })}

        {/* Custom integration */}
        <section className="mt-4 rounded-2xl bg-neutral-50 border border-neutral-200 p-8">
          <h2 className="text-2xl font-extrabold text-neutral-900 mb-2">
            Connecteur custom ou métier
          </h2>
          <p className="text-base text-neutral-700 mb-4 leading-relaxed">
            Vous utilisez un ERP propriétaire ou un système métier spécifique ? L&apos;API REST
            CarbonCo (documentée à{" "}
            <Link href="/dev" className="text-green-700 hover:underline">/dev</Link>) permet de lire
            les snapshots et le trail de preuve par programme. Parlons de votre cas dans le cadre du
            programme pilote.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dev"
              className="px-4 py-2 rounded-lg bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-800 transition-colors"
            >
              Voir la doc API
            </Link>
            <a
              href="mailto:ludoviclabs@gmail.com?subject=Connecteur%20custom%20CarbonCo"
              className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-900 text-sm font-semibold hover:bg-white transition-colors"
            >
              Décrire mon besoin
            </a>
          </div>
        </section>

        {/* CTA final */}
        <section className="mt-12 rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-800 text-white p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-green-400 mb-2">
            Programme pilote
          </p>
          <p className="font-bold text-xl mb-3">3 places pour l&apos;exercice 2026</p>
          <p className="text-sm text-neutral-300 mb-5">
            Nous équipons gratuitement trois organisations pour produire leur premier rapport VSME
            auditable. C&apos;est le meilleur moment pour cadrer ensemble vos sources de données.
          </p>
          <a
            href="mailto:ludoviclabs@gmail.com?subject=Programme%20pilote%20CarbonCo%20%E2%80%94%20exercice%202026"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-white text-neutral-900 text-sm font-semibold hover:bg-neutral-100 transition-colors"
          >
            Échanger sur le programme pilote
          </a>
        </section>
      </section>
    </main>
  );
}

function IntegrationCard({ integration: i }: { integration: Integration }) {
  return (
    <article className="rounded-2xl border border-neutral-200 p-5 hover:border-green-500 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-lg font-bold text-neutral-900">{i.name}</h3>
          <p className="text-xs text-neutral-500 mt-0.5">{i.category}</p>
        </div>
        <FeatureStatusBadge status={i.statut} size="sm" />
      </div>
      <p className="text-sm text-neutral-700 leading-relaxed">{i.description}</p>
      {i.preuve && i.statut === "live" && (
        <div className="pt-3 mt-3 border-t border-neutral-100 text-[11px] text-neutral-500">
          <strong className="text-neutral-700">Preuve :</strong>{" "}
          <code className="text-neutral-600">{i.preuve}</code>
        </div>
      )}
    </article>
  );
}
