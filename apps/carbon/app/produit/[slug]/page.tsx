import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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
import { PRODUCT_MODULES, getProductModule } from "@/lib/product-modules";

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

// Pré-génération SSG : 1 page par module au build, plus de SSR à chaque requête.
export function generateStaticParams() {
  return PRODUCT_MODULES.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const m = getProductModule(slug);
  if (!m) return {};
  return {
    title: `${m.title} — Module CarbonCo`,
    description: m.pitch,
    alternates: { canonical: `https://carbonco.fr/produit/${m.slug}` },
  };
}

export default async function ProductModulePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const m = getProductModule(slug);
  if (!m) notFound();

  const Illu = ILLUS[m.illustration];
  const idx = PRODUCT_MODULES.findIndex((x) => x.slug === m.slug);
  const next = PRODUCT_MODULES[(idx + 1) % PRODUCT_MODULES.length];

  return (
    <main className="bg-white min-h-screen">
      <div className="border-b border-neutral-200 bg-white sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-sm font-extrabold tracking-tighter text-black">
            Carbon<span className="text-green-600">&amp;</span>Co
          </Link>
          <Link href="/produit" className="text-sm text-neutral-600 hover:text-neutral-900">
            ← Tous les modules
          </Link>
        </div>
      </div>

      <article className="max-w-5xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-green-600 mb-4">
              Module produit
            </p>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-neutral-900 leading-tight mb-4">
              {m.title}
            </h1>
            <p className="text-lg text-neutral-600 leading-relaxed">{m.pitch}</p>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 p-12 flex items-center justify-center">
            <Illu className="w-32 h-32" />
          </div>
        </div>

        {/* Description */}
        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-neutral-900 mb-4">
            Comment ça marche
          </h2>
          <p className="text-base text-neutral-700 leading-relaxed">{m.description}</p>
        </section>

        {/* Bénéfices */}
        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-neutral-900 mb-6">
            Bénéfices
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {m.benefits.map((b) => (
              <div key={b.title} className="rounded-2xl border border-neutral-200 p-5">
                <p className="font-bold text-neutral-900 mb-2">{b.title}</p>
                <p className="text-sm text-neutral-600 leading-relaxed">{b.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Preuves */}
        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-neutral-900 mb-6">
            Preuves
          </h2>
          <ul className="space-y-3">
            {m.proofs.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <span className="text-green-600 mt-1">✓</span>
                <span className="text-base text-neutral-700">{p}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Cas d'usage */}
        <section className="mb-12 rounded-2xl bg-neutral-50 border border-neutral-200 p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">
            Cas d&apos;usage
          </p>
          <p className="font-bold text-neutral-900 mb-2">{m.useCase.who}</p>
          <p className="text-base text-neutral-700 leading-relaxed italic">
            « {m.useCase.story} »
          </p>
        </section>

        {/* CTA + module suivant */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-800 text-white p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-green-400 mb-2">
              Voir en démo
            </p>
            <p className="font-bold text-lg mb-3">30 minutes, sur invitation.</p>
            <Link
              href="mailto:contact@carbonco.fr?subject=Demande%20de%20démo%20CarbonCo"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-neutral-900 text-sm font-semibold hover:bg-neutral-100 transition-colors"
            >
              Demander une démo
            </Link>
          </div>
          <Link
            href={`/produit/${next.slug}`}
            className="group rounded-2xl border border-neutral-200 p-6 hover:border-green-500 transition-all"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2">
              Module suivant
            </p>
            <p className="font-bold text-lg text-neutral-900 group-hover:text-green-700 transition-colors">
              {next.title} →
            </p>
            <p className="text-sm text-neutral-500 mt-1 leading-snug">{next.pitch.split(".")[0]}.</p>
          </Link>
        </div>
      </article>
    </main>
  );
}
