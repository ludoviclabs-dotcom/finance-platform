import type { Metadata } from "next";

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  CornerDownRight,
  User2,
} from "lucide-react";

import { ArticleShareButton } from "@/components/publications/article-share-button";
import { getAuthorInitials, getPublicationTheme } from "@/lib/publication-ui";
import {
  getAllPublications,
  getPublicationBySlug,
  getPublicationImage,
  getPublicationUrl,
  getRelatedPublications,
} from "@/lib/publications";
import { SITE_URL } from "@/lib/site-config";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const publications = await getAllPublications();

  return publications.map((publication) => ({
    slug: publication.slug,
  }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublicationBySlug(slug);

  if (!article) {
    return {
      title: "Publication introuvable",
    };
  }

  const url = getPublicationUrl(article.slug);
  const image = getPublicationImage(article.coverImage);

  return {
    title: article.seoTitle,
    description: article.seoDescription,
    keywords: article.tags,
    authors: [{ name: article.author.name }],
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "article",
      url,
      title: article.seoTitle,
      description: article.seoDescription,
      publishedTime: article.date,
      modifiedTime: article.updatedAt,
      authors: [article.author.name],
      tags: article.tags,
      images: [
        {
          url: image,
          alt: article.coverAlt ?? article.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: article.seoTitle,
      description: article.seoDescription,
      images: [image],
    },
  };
}

export default async function PublicationPage({ params }: PageProps) {
  const { slug } = await params;
  const article = await getPublicationBySlug(slug);

  if (!article) {
    notFound();
  }

  const theme = getPublicationTheme(article.category);
  const relatedArticles = await getRelatedPublications(article.relatedSlugs);
  const articleUrl = article.url;
  const articleImage = getPublicationImage(article.coverImage);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.seoDescription,
    datePublished: article.date,
    dateModified: article.updatedAt,
    image: [articleImage],
    mainEntityOfPage: articleUrl,
    author: {
      "@type": "Person",
      name: article.author.name,
    },
    publisher: {
      "@type": "Organization",
      name: "NEURAL",
      url: SITE_URL,
    },
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-32 top-24 h-80 w-80 rounded-full bg-violet-500/10 blur-[130px]" />
      <div className="absolute right-[-12%] top-[18%] h-[30rem] w-[30rem] rounded-full bg-cyan-400/7 blur-[150px]" />
      <div className="absolute bottom-[-10rem] left-1/3 h-[24rem] w-[24rem] rounded-full bg-emerald-400/6 blur-[140px]" />

      <div className="relative mx-auto max-w-[1480px] px-8 pb-24 pt-28 md:px-12 lg:pt-36">
        <Link
          href="/publications"
          className="inline-flex items-center gap-2 text-sm font-medium text-white/50 transition-colors hover:text-white/78"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux publications
        </Link>

        <header className="mt-8 grid gap-10 border-b border-white/10 pb-12 lg:grid-cols-[minmax(0,1.08fr)_380px]">
          <div>
            <span
              className={[
                "inline-flex rounded-full border px-3 py-1 text-sm font-medium",
                theme.badge,
              ].join(" ")}
            >
              {article.category}
            </span>
            <h1 className="mt-6 max-w-4xl font-display text-4xl font-semibold tracking-tight text-white md:text-6xl">
              {article.title}
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-white/64">
              {article.subtitle}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-white/48">
              <span className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Publié le {article.displayDate}
              </span>
              <span className="flex items-center gap-2">
                <Clock3 className="h-4 w-4" />
                {article.readingTime}
              </span>
              <span className="flex items-center gap-2">
                <User2 className="h-4 w-4" />
                {article.audience}
              </span>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-white/52"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="relative min-h-[280px] overflow-hidden rounded-[32px] border border-white/10 bg-[#09111F]">
            {article.coverImage ? (
              <Image
                src={article.coverImage}
                alt={article.coverAlt ?? article.title}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 380px"
                priority
              />
            ) : (
              <div className="absolute inset-0 overflow-hidden">
                <div className={["absolute inset-0 bg-linear-to-br", theme.glow].join(" ")} />
                <div className="absolute inset-6 rounded-[26px] border border-white/10 bg-black/10" />
                <div className="absolute left-8 right-8 top-8">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/40">
                    Publication NEURAL
                  </div>
                  <div className="mt-5 max-w-xs font-playfair text-4xl leading-tight text-white/86">
                    Une lecture conçue pour nourrir une décision, pas seulement une opinion.
                  </div>
                </div>
                <div className="absolute bottom-8 left-8 right-8">
                  <div className={["h-px w-full bg-linear-to-r", theme.line].join(" ")} />
                  <p className="mt-4 text-sm leading-7 text-white/56">
                    Des analyses rédigées pour rester lisibles, concrètes et directement
                    exploitables par une équipe.
                  </p>
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(280px,0.28fr)]">
          <aside className="order-1 space-y-5 lg:order-2 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5 font-display text-lg font-semibold text-white">
                  {getAuthorInitials(article.author.name)}
                </div>
                <div>
                  <div className="text-sm uppercase tracking-[0.16em] text-white/38">
                    Auteur
                  </div>
                  <div className="mt-1 font-semibold text-white">{article.author.name}</div>
                  <div className="text-sm text-white/50">{article.author.role}</div>
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-white/58">{article.author.bio}</p>
            </div>

            {article.headings.length > 0 ? (
              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
                <div className="text-sm uppercase tracking-[0.16em] text-violet-300">
                  Table de lecture
                </div>
                <div className="mt-4 space-y-2">
                  {article.headings.map((heading) => (
                    <a
                      key={`${heading.level}-${heading.slug}`}
                      href={`#${heading.slug}`}
                      className={[
                        "block text-sm leading-7 text-white/58 transition-colors hover:text-white",
                        heading.level === 3 ? "pl-4" : "",
                      ].join(" ")}
                    >
                      {heading.level === 3 ? <CornerDownRight className="mr-2 inline h-3.5 w-3.5" /> : null}
                      {heading.title}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
              <div className="text-sm uppercase tracking-[0.16em] text-cyan-300">
                Partager cette lecture
              </div>
              <p className="mt-3 text-sm leading-7 text-white/58">
                Si ce sujet peut aider un collègue, un associé ou une équipe, partage
                simplement l&apos;article.
              </p>
              <div className="mt-5">
                <ArticleShareButton title={article.title} url={articleUrl} />
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-linear-to-r from-violet-500/10 via-transparent to-emerald-400/10 p-6">
              <div className="text-sm uppercase tracking-[0.16em] text-violet-300">
                Passer à l&apos;action
              </div>
              <p className="mt-3 text-sm leading-7 text-white/58">
                Besoin de transformer ce sujet en audit, en feuille de route ou en cas d&apos;usage
                concret ?
              </p>
              <Link
                href="/contact"
                className="mt-5 inline-flex items-center justify-center rounded-full bg-neural-violet px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-neural-violet-dark"
              >
                Réserver un audit
              </Link>
            </div>
          </aside>

          <article className="order-2 lg:order-1">
            {article.tldr.length > 0 ? (
              <section className="rounded-[28px] border border-violet-400/18 bg-violet-400/8 p-6 md:p-7">
                <div className="text-sm uppercase tracking-[0.16em] text-violet-300">
                  En 30 secondes
                </div>
                <ul className="mt-5 space-y-3">
                  {article.tldr.map((item) => (
                    <li key={item} className="flex gap-3 text-[15px] leading-7 text-white/80">
                      <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-violet-300" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div className="mt-10 space-y-8">{article.content}</div>
          </article>
        </div>

        {relatedArticles.length > 0 ? (
          <section className="mt-18 border-t border-white/10 pt-10">
            <div className="text-sm uppercase tracking-[0.16em] text-white/38">
              À lire ensuite
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {relatedArticles.map((relatedArticle) => (
                <Link
                  key={relatedArticle.slug}
                  href={`/publications/${relatedArticle.slug}`}
                  className="group rounded-[28px] border border-white/10 bg-white/[0.04] p-6 transition-colors hover:border-white/18 hover:bg-white/[0.05]"
                >
                  <span
                    className={[
                      "inline-flex rounded-full border px-3 py-1 text-sm font-medium",
                      getPublicationTheme(relatedArticle.category).badge,
                    ].join(" ")}
                  >
                    {relatedArticle.category}
                  </span>
                  <h2 className="mt-5 font-display text-2xl font-semibold leading-tight text-white transition-colors group-hover:text-violet-200">
                    {relatedArticle.title}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-white/58">
                    {relatedArticle.excerpt}
                  </p>
                  <div className="mt-5 flex items-center gap-4 text-sm text-white/42">
                    <span>{relatedArticle.displayMonth}</span>
                    <span>{relatedArticle.readingTime}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}
