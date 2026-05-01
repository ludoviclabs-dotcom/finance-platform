import type { Metadata } from "next";
import Link from "next/link";
import { BLOG_ARTICLES } from "@/lib/blog-articles";

export const metadata: Metadata = {
  title: "Blog CSRD & ESG — CarbonCo",
  description:
    "Articles fondateurs sur la CSRD, ESRS, Scope 1/2/3, audit OTI et taxonomie verte. " +
    "Une lecture par semaine pour les équipes RSE et DAF.",
  alternates: { canonical: "https://carbonco.fr/blog" },
};

const CATEGORIES = ["Tous", "CSRD", "ESRS", "Méthodologie", "OTI", "Réglementation"] as const;

export default function BlogIndexPage() {
  return (
    <main className="bg-white min-h-screen">
      {/* Top bar */}
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
          Blog · Édition CarbonCo
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-neutral-900 mb-4">
          Comprendre, anticiper, exécuter.
        </h1>
        <p className="text-lg text-neutral-600 max-w-2xl mb-10 leading-relaxed">
          La rédaction CarbonCo décrypte chaque mois les évolutions CSRD/ESRS et publie des
          guides méthodologiques utilisables tels quels par vos équipes RSE et DAF.
        </p>

        {/* Filtres catégories (visuels uniquement, statiques) */}
        <div className="flex flex-wrap gap-2 mb-10">
          {CATEGORIES.map((c) => (
            <span
              key={c}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                c === "Tous"
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-700"
              }`}
            >
              {c}
            </span>
          ))}
        </div>

        {/* Articles */}
        <div className="grid md:grid-cols-2 gap-6">
          {BLOG_ARTICLES.map((a) => (
            <Link
              key={a.slug}
              href={`/blog/${a.slug}`}
              className="group block rounded-2xl border border-neutral-200 p-6 hover:border-green-500 hover:shadow-lg transition-all"
            >
              <div className="flex items-center gap-2 mb-3 text-xs">
                <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-semibold">
                  {a.category}
                </span>
                <span className="text-neutral-500">
                  {new Date(a.date).toLocaleDateString("fr-FR", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="text-neutral-400">·</span>
                <span className="text-neutral-500">{a.readingTime}</span>
              </div>
              <h2 className="text-xl font-bold text-neutral-900 group-hover:text-green-700 transition-colors leading-snug mb-2">
                {a.title}
              </h2>
              <p className="text-sm text-neutral-600 leading-relaxed">{a.description}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {a.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 text-[10px] font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>

        {/* Newsletter footer */}
        <div className="mt-16 rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-800 text-white p-8">
          <div className="flex items-center justify-between gap-6 flex-wrap">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-green-400 mb-2">
                Newsletter mensuelle
              </p>
              <p className="font-bold text-xl mb-1">Une analyse, un cas concret, zéro spam.</p>
              <p className="text-sm text-neutral-300">
                Recevez le guide « Préparer son audit CSRD 2027 » dès l&apos;inscription.
              </p>
            </div>
            <Link
              href="/guide-csrd-2027"
              className="px-5 py-3 rounded-lg bg-green-500 text-white text-sm font-semibold hover:bg-green-400 transition-colors whitespace-nowrap"
            >
              Télécharger le guide
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
