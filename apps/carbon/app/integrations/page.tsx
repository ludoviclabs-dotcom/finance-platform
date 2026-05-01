import type { Metadata } from "next";
import Link from "next/link";
import {
  INTEGRATIONS,
  getIntegrationsByCategory,
  type IntegrationCategory,
} from "@/lib/integrations";

export const metadata: Metadata = {
  title: "Intégrations ERP, comptabilité et énergie — CarbonCo",
  description:
    "Connectez CarbonCo à vos systèmes existants : Sage, Cegid, SAP, EDF, Engie, AWS, GCP. " +
    "OAuth 2.0 ou API Key, mise en route en 15 à 60 minutes.",
  alternates: { canonical: "https://carbonco.fr/integrations" },
};

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  live: { label: "Disponible", tone: "bg-green-100 text-green-800" },
  beta: { label: "Bêta", tone: "bg-amber-100 text-amber-800" },
  soon: { label: "Roadmap", tone: "bg-neutral-100 text-neutral-700" },
};

const CATEGORY_ORDER: IntegrationCategory[] = [
  "ERP",
  "Comptabilité",
  "Énergie",
  "Cloud",
  "RH",
];

export default function IntegrationsPage() {
  const byCategory = getIntegrationsByCategory();
  const liveCount = INTEGRATIONS.filter((i) => i.status === "live").length;

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
          Intégrations
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-neutral-900 mb-4">
          {liveCount} connecteurs prêts à l&apos;emploi.
        </h1>
        <p className="text-lg text-neutral-600 max-w-2xl mb-12 leading-relaxed">
          ERP, comptabilité, fournisseurs d&apos;énergie, cloud, RH. CarbonCo se branche
          sur vos systèmes existants en 15 à 60 minutes — sans casser les workflows en place.
        </p>

        {/* Stats globales */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          <Stat label="Connecteurs disponibles" value={String(liveCount)} />
          <Stat label="ERP couverts" value={String(byCategory.ERP?.length ?? 0)} />
          <Stat label="Fournisseurs énergie" value={String(byCategory["Énergie"]?.length ?? 0)} />
          <Stat label="Mise en route" value="≤ 1h" />
        </div>

        {/* Catalogue par catégorie */}
        {CATEGORY_ORDER.map((cat) => {
          const items = byCategory[cat] ?? [];
          if (items.length === 0) return null;
          return (
            <section key={cat} className="mb-12">
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-neutral-900 mb-6">
                {cat}
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {items.map((i) => {
                  const status = STATUS_LABEL[i.status];
                  return (
                    <article
                      key={i.id}
                      className="rounded-2xl border border-neutral-200 p-5 hover:border-green-500 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-neutral-900">{i.name}</h3>
                          <p className="text-xs text-neutral-500 mt-0.5">{i.vendor}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${status.tone}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-700 mb-4 leading-relaxed">{i.pitch}</p>
                      <ul className="space-y-1.5 mb-4">
                        {i.what.map((w) => (
                          <li key={w} className="flex items-start gap-2 text-xs text-neutral-600">
                            <span className="text-green-600 mt-0.5">✓</span>
                            <span>{w}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
                        <span><strong className="text-neutral-700">Auth :</strong> {i.authMethod}</span>
                        <span><strong className="text-neutral-700">Setup :</strong> {i.setupTime}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* Custom integration */}
        <section className="mt-12 rounded-2xl bg-neutral-50 border border-neutral-200 p-8">
          <h2 className="text-2xl font-extrabold text-neutral-900 mb-2">
            Connecteur custom ou métier
          </h2>
          <p className="text-base text-neutral-700 mb-4 leading-relaxed">
            Vous utilisez un ERP propriétaire ou un système métier spécifique ? L&apos;API REST
            CarbonCo (documentée à <Link href="/dev" className="text-green-700 hover:underline">/dev</Link>)
            permet une intégration en 1 à 2 jours. 13 endpoints, authentification JWT,
            rate-limiting standard, conformité OpenAPI 3.0.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dev"
              className="px-4 py-2 rounded-lg bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-800 transition-colors"
            >
              Voir la doc API
            </Link>
            <a
              href="mailto:contact@carbonco.fr?subject=Connecteur%20custom%20CarbonCo"
              className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-900 text-sm font-semibold hover:bg-white transition-colors"
            >
              Demander un connecteur
            </a>
          </div>
        </section>

        {/* CTA final */}
        <section className="mt-12 rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-800 text-white p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-green-400 mb-2">
            Prêt à tester
          </p>
          <p className="font-bold text-xl mb-3">Démo 30 minutes — branchement live</p>
          <p className="text-sm text-neutral-300 mb-5">
            Lors d&apos;une démo CarbonCo, on connecte en direct un de vos ERP test pour
            mesurer concrètement la mise en route.
          </p>
          <a
            href="mailto:contact@carbonco.fr?subject=Démo%20CarbonCo%20avec%20intégration%20live"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-white text-neutral-900 text-sm font-semibold hover:bg-neutral-100 transition-colors"
          >
            Demander une démo
          </a>
        </section>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 p-4">
      <p className="text-3xl font-extrabold text-neutral-900">{value}</p>
      <p className="text-xs text-neutral-500 mt-1 uppercase tracking-wider">{label}</p>
    </div>
  );
}
