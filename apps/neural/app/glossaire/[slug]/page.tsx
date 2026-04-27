import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";

import termsData from "@/content/glossaire/terms.json";

export function generateStaticParams() {
  return termsData.terms.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const term = termsData.terms.find((t) => t.slug === slug);
  if (!term) return { title: "Glossaire — NEURAL" };
  return {
    title: `${term.term} — Glossaire IA NEURAL`,
    description: term.shortDefinition,
  };
}

export default async function GlossaireTermPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const term = termsData.terms.find((t) => t.slug === slug);
  if (!term) notFound();

  const category = termsData.categories.find((c) => c.id === term.category);
  const related = term.relatedTerms
    .map((relSlug) => termsData.terms.find((t) => t.slug === relSlug))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-emerald-500/8 blur-[120px]" />

      <section className="relative px-8 pb-12 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[920px]">
          <Link
            href="/glossaire"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200 hover:text-violet-100"
          >
            <ArrowLeft className="h-3 w-3" />
            Glossaire
          </Link>
          <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
            <BookOpen className="h-3.5 w-3.5" />
            {category?.label || term.category}
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            {term.term}
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/68">
            {term.shortDefinition}
          </p>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[920px] space-y-8">
          <article className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6 md:p-8">
            <h2 className="font-display text-xl font-bold tracking-tight text-white">
              Définition
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/75">{term.definition}</p>
          </article>

          {term.context ? (
            <div className="rounded-[24px] border border-violet-400/25 bg-violet-400/[0.06] p-6 md:p-8">
              <span className="text-[11px] uppercase tracking-[0.18em] text-violet-300/70">
                Contexte NEURAL
              </span>
              <p className="mt-3 text-base leading-relaxed text-white/85">{term.context}</p>
            </div>
          ) : null}

          {related.length > 0 ? (
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight text-white">
                Termes liés
              </h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {related.map((rel) => (
                  <Link
                    key={rel.slug}
                    href={`/glossaire/${rel.slug}`}
                    className="group flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-all hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.06] no-underline"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{rel.term}</p>
                      <p className="mt-0.5 text-xs text-white/55">{rel.shortDefinition}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 flex-shrink-0 text-violet-200 transition-transform group-hover:translate-x-1" />
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
