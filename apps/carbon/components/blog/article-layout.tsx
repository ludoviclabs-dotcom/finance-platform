/**
 * Layout commun pour les articles de blog CarbonCo.
 *
 * Pourquoi un layout dédié plutôt que le layout racine :
 *   - le blog cible l'inbound SEO (lecture longue) et requiert un wrapper
 *     `<article>` avec `prose`-like styling — radicalement différent de
 *     l'app interne.
 *   - on veut un footer "Article suivant" cohérent piloté par le registre
 *     `lib/blog-articles.ts`.
 *
 * Les composants <P>, <H2>, <H3>, <Quote>, <Aside>, <List>, <Code> ci-dessous
 * sont les seules primitives autorisées dans les articles : cela garantit une
 * mise en page homogène sans avoir besoin d'un système MDX/Tailwind Typography.
 */

import Link from "next/link";
import type { BlogArticleMeta } from "@/lib/blog-articles";
import { getNextArticle } from "@/lib/blog-articles";

export function ArticleLayout({
  article,
  children,
}: {
  article: BlogArticleMeta;
  children: React.ReactNode;
}) {
  const next = getNextArticle(article.slug);
  return (
    <main className="bg-white min-h-screen">
      {/* Top bar minimal */}
      <div className="border-b border-neutral-200 bg-white sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-sm font-extrabold tracking-tighter text-black">
            Carbon<span className="text-green-600">&amp;</span>Co
          </Link>
          <Link href="/blog" className="text-sm text-neutral-600 hover:text-neutral-900">
            ← Tous les articles
          </Link>
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-4 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-green-50 text-green-700 font-semibold">
              {article.category}
            </span>
            <span className="text-neutral-500">
              {new Date(article.date).toLocaleDateString("fr-FR", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
            <span className="text-neutral-400">·</span>
            <span className="text-neutral-500">{article.readingTime} de lecture</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-neutral-900 leading-tight mb-4">
            {article.title}
          </h1>
          <p className="text-lg text-neutral-600 leading-relaxed">{article.description}</p>
        </header>

        {/* Body */}
        <div className="text-neutral-800 leading-relaxed space-y-5">{children}</div>

        {/* Tags */}
        <div className="mt-12 pt-6 border-t border-neutral-200 flex flex-wrap gap-2">
          {article.tags.map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-600 text-xs font-medium"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* CTA newsletter */}
        <div className="mt-10 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-green-700 mb-2">
            Aller plus loin
          </p>
          <p className="font-bold text-neutral-900 mb-1">
            Recevez l&apos;essentiel CSRD chaque mois
          </p>
          <p className="text-sm text-neutral-600 mb-4">
            Une analyse, un cas concret, zéro spam. Désabonnement en un clic.
          </p>
          <Link
            href="/guide-csrd-2027"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors"
          >
            Télécharger le guide CSRD 2027
          </Link>
        </div>

        {/* Next article */}
        {next && (
          <div className="mt-10 pt-6 border-t border-neutral-200">
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2">
              Article suivant
            </p>
            <Link
              href={`/blog/${next.slug}`}
              className="block group"
            >
              <p className="text-xl font-bold text-neutral-900 group-hover:text-green-700 transition-colors">
                {next.title} →
              </p>
              <p className="text-sm text-neutral-600 mt-1">{next.description}</p>
            </Link>
          </div>
        )}
      </article>
    </main>
  );
}

/* —————— Primitives de mise en page —————— */

export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-base leading-relaxed">{children}</p>;
}

export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-neutral-900 mt-10 mb-3">
      {children}
    </h2>
  );
}

export function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-lg md:text-xl font-bold text-neutral-900 mt-6 mb-2">
      {children}
    </h3>
  );
}

export function Quote({
  children,
  cite,
}: {
  children: React.ReactNode;
  cite?: string;
}) {
  return (
    <blockquote className="border-l-4 border-green-500 pl-5 py-2 my-4 italic text-neutral-700">
      {children}
      {cite && <footer className="mt-2 text-xs not-italic text-neutral-500">— {cite}</footer>}
    </blockquote>
  );
}

export function Aside({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <aside className="my-6 rounded-xl border border-neutral-200 bg-neutral-50 p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">
        {title}
      </p>
      <div className="text-sm text-neutral-700 leading-relaxed">{children}</div>
    </aside>
  );
}

export function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2 ml-5 list-disc marker:text-green-600">
      {items.map((item, i) => (
        <li key={i} className="leading-relaxed">{item}</li>
      ))}
    </ul>
  );
}

export function Numbered({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-2 ml-5 list-decimal marker:text-green-600 marker:font-bold">
      {items.map((item, i) => (
        <li key={i} className="leading-relaxed pl-1">{item}</li>
      ))}
    </ol>
  );
}
