"use client";

import { startTransition, useDeferredValue, useState } from "react";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock3, Search, Sparkles } from "lucide-react";

import { getPublicationTheme } from "@/lib/publication-ui";
import type { PublicationSummary } from "@/lib/publications-contract";

type PublicationsExplorerProps = {
  publications: PublicationSummary[];
};

function matchesQuery(publication: PublicationSummary, query: string): boolean {
  if (!query) {
    return true;
  }

  const haystack = [
    publication.title,
    publication.subtitle,
    publication.excerpt,
    publication.category,
    publication.audience,
    publication.tags.join(" "),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

export function PublicationsExplorer({
  publications,
}: PublicationsExplorerProps) {
  const [activeCategory, setActiveCategory] = useState("Tous");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const categories = ["Tous", ...new Set(publications.map((publication) => publication.category))];
  const publicationLookup = new Map(
    publications.map((publication) => [publication.slug, publication]),
  );

  const filteredPublications = publications.filter((publication) => {
    const matchesCategory =
      activeCategory === "Tous" || publication.category === activeCategory;

    return matchesCategory && matchesQuery(publication, deferredQuery);
  });

  const leadPublication =
    filteredPublications.find((publication) => publication.featured) ??
    filteredPublications[0] ??
    null;
  const listPublications = filteredPublications.filter(
    (publication) => publication.slug !== leadPublication?.slug,
  );
  const nextRead =
    leadPublication?.relatedSlugs
      .map((slug) => publicationLookup.get(slug))
      .find((publication): publication is PublicationSummary => Boolean(publication)) ??
    listPublications[0] ??
    publications.find((publication) => publication.slug !== leadPublication?.slug) ??
    null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-28 top-24 h-72 w-72 rounded-full bg-violet-500/10 blur-[120px]" />
      <div className="absolute right-[-12%] top-[22%] h-[32rem] w-[32rem] rounded-full bg-cyan-400/6 blur-[150px]" />
      <div className="absolute bottom-[-12rem] left-1/3 h-[26rem] w-[26rem] rounded-full bg-emerald-400/6 blur-[150px]" />

      <div className="relative mx-auto max-w-[1480px] px-8 pb-24 pt-28 md:px-12 lg:pt-36">
        <header className="grid gap-10 border-b border-white/10 pb-12 lg:grid-cols-[minmax(0,1.2fr)_360px]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-violet-300">
              <Sparkles className="h-3.5 w-3.5" />
              Publications
            </div>
            <h1 className="mt-6 max-w-4xl font-display text-4xl font-bold tracking-tight text-white md:text-6xl">
              Des analyses pensées pour{" "}
              <span className="bg-gradient-to-r from-white via-violet-200 to-emerald-200 bg-clip-text text-transparent">
                clarifier les décisions
              </span>
              , pas pour remplir un flux.
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-white/62">
              Benchmarks, guides, retours terrain et perspectives sur l&apos;IA en entreprise.
              Chaque lecture vise le même objectif : donner un cadre plus net pour arbitrer un
              cas d&apos;usage, prioriser un déploiement ou comprendre ce qui crée vraiment de la
              valeur.
            </p>
          </div>

          <div className="border-l border-white/10 pl-0 lg:pl-8">
            <div className="text-sm uppercase tracking-[0.18em] text-white/38">
              Ce que vous trouverez ici
            </div>
            <div className="mt-5 space-y-5 text-sm leading-7 text-white/62">
              <p>
                Des articles orientés usage, rédigés pour les dirigeants, les équipes
                opérationnelles et les responsables de transformation.
              </p>
              <p>
                Des formats variés pour aller vite selon le besoin : benchmark pour prendre du
                recul, guide pour cadrer, cas concret pour comparer, perspective pour ouvrir le
                champ.
              </p>
              <p>
                Un même fil conducteur : séparer les promesses vagues des décisions qui peuvent
                réellement être prises sur le terrain.
              </p>
            </div>
          </div>
        </header>

        <section className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => {
                  const count =
                    category === "Tous"
                      ? publications.length
                      : publications.filter((publication) => publication.category === category)
                          .length;

                  const isActive = category === activeCategory;

                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => startTransition(() => setActiveCategory(category))}
                      className={[
                        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "border-violet-400/28 bg-violet-400/14 text-violet-200"
                          : "border-white/10 bg-white/5 text-white/62 hover:border-white/18 hover:text-white/80",
                      ].join(" ")}
                    >
                      <span>{category}</span>
                      <span className="text-xs text-white/42">{count}</span>
                    </button>
                  );
                })}
              </div>

              <label className="relative block w-full max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) =>
                    startTransition(() => setQuery(event.target.value))
                  }
                  placeholder="Rechercher un sujet, un secteur ou un tag..."
                  className="w-full rounded-full border border-white/10 bg-[#09111F] py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/35 focus:border-violet-400/30 focus:outline-none"
                />
              </label>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
            <div className="text-sm uppercase tracking-[0.16em] text-white/38">
              Vue active
            </div>
            <div className="mt-4 text-3xl font-display font-semibold text-white">
              {filteredPublications.length}
            </div>
            <p className="mt-3 text-sm leading-7 text-white/58">
              {activeCategory === "Tous"
                ? "articles disponibles"
                : `${activeCategory} actuellement filtré`}
            </p>
            {(query || activeCategory !== "Tous") && (
              <button
                type="button"
                onClick={() =>
                  startTransition(() => {
                    setQuery("");
                    setActiveCategory("Tous");
                  })
                }
                className="mt-5 text-sm font-medium text-violet-300 transition-colors hover:text-violet-200"
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>
        </section>

        {leadPublication ? (
          <>
            <section className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_320px]">
              <Link
                href={`/publications/${leadPublication.slug}`}
                className="group overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04] transition-colors hover:border-white/18 hover:bg-white/[0.05]"
              >
                <div className="grid min-h-full lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.82fr)]">
                  <div className="flex flex-col justify-between p-8 md:p-10">
                    <div>
                      <span
                        className={[
                          "inline-flex rounded-full border px-3 py-1 text-sm font-medium",
                          getPublicationTheme(leadPublication.category).badge,
                        ].join(" ")}
                      >
                        À la une · {leadPublication.category}
                      </span>
                      <h2 className="mt-6 max-w-3xl font-display text-3xl font-semibold leading-tight tracking-tight text-white md:text-5xl">
                        {leadPublication.title}
                      </h2>
                      <p className="mt-5 max-w-2xl text-base leading-8 text-white/64 md:text-lg">
                        {leadPublication.excerpt}
                      </p>
                    </div>

                    <div className="mt-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/46">
                        <span>{leadPublication.displayMonth}</span>
                        <span className="flex items-center gap-1.5">
                          <Clock3 className="h-3.5 w-3.5" />
                          {leadPublication.readingTime}
                        </span>
                        <span>{leadPublication.audience}</span>
                      </div>
                      <div className="inline-flex items-center gap-2 text-sm font-medium text-violet-300 transition-transform group-hover:translate-x-1">
                        Lire l&apos;article
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>
                  </div>

                  <div className="relative min-h-[280px] border-t border-white/10 bg-[#09111F] lg:min-h-full lg:border-l lg:border-t-0">
                    {leadPublication.coverImage ? (
                      <Image
                        src={leadPublication.coverImage}
                        alt={leadPublication.coverAlt ?? leadPublication.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 1024px) 100vw, 480px"
                      />
                    ) : (
                      <div className="absolute inset-0 overflow-hidden">
                        <div
                          className={[
                            "absolute inset-0 bg-linear-to-br",
                            getPublicationTheme(leadPublication.category).glow,
                          ].join(" ")}
                        />
                        <div className="absolute inset-6 rounded-[28px] border border-white/10 bg-black/15" />
                        <div className="absolute left-10 top-10 right-10">
                          <div className="text-xs uppercase tracking-[0.18em] text-white/38">
                            Lecture recommandée
                          </div>
                          <div className="mt-4 max-w-xs font-playfair text-3xl leading-tight text-white/84">
                            {leadPublication.category}
                          </div>
                        </div>
                        <div className="absolute bottom-10 left-10 right-10">
                          <div
                            className={[
                              "h-px w-full bg-linear-to-r",
                              getPublicationTheme(leadPublication.category).line,
                            ].join(" ")}
                          />
                          <p className="mt-4 max-w-xs text-sm leading-7 text-white/55">
                            Une lecture conçue pour aller à l&apos;essentiel sans perdre la nuance,
                            même sur des sujets techniques ou stratégiques.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Link>

              <div className="space-y-4">
                <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
                  <div className="text-sm uppercase tracking-[0.16em] text-white/38">
                    À lire ensuite
                  </div>
                  {nextRead ? (
                    <Link
                      href={`/publications/${nextRead.slug}`}
                      className="group mt-4 block"
                    >
                      <div className={["text-sm font-medium", getPublicationTheme(nextRead.category).accent].join(" ")}>
                        {nextRead.category}
                      </div>
                      <h3 className="mt-3 font-display text-2xl font-semibold leading-tight text-white transition-colors group-hover:text-violet-200">
                        {nextRead.title}
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-white/58">
                        {nextRead.excerpt}
                      </p>
                    </Link>
                  ) : (
                    <p className="mt-4 text-sm leading-7 text-white/58">
                      Aucun autre article disponible pour le moment.
                    </p>
                  )}
                </div>

                <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
                  <div className="text-sm uppercase tracking-[0.16em] text-white/38">
                    Tags du lead
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {leadPublication.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/65"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-16">
              <div className="flex flex-col gap-3 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="text-sm uppercase tracking-[0.16em] text-white/38">
                    Lecture continue
                  </div>
                  <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white">
                    Articles disponibles
                  </h2>
                </div>
                <p className="max-w-xl text-sm leading-7 text-white/56">
                  Parcours les analyses par angle, par niveau de maturité ou par type de
                  décision à prendre.
                </p>
              </div>

              <div className="divide-y divide-white/10">
                {(listPublications.length > 0 ? listPublications : [leadPublication]).map(
                  (publication) => {
                    const theme = getPublicationTheme(publication.category);

                    return (
                      <Link
                        key={publication.slug}
                        href={`/publications/${publication.slug}`}
                        className="group grid gap-6 py-7 transition-colors hover:bg-white/[0.025] md:grid-cols-[180px_minmax(0,1fr)_180px]"
                      >
                        <div className="flex items-start md:justify-start">
                          <span
                            className={[
                              "inline-flex rounded-full border px-3 py-1 text-sm font-medium",
                              theme.badge,
                            ].join(" ")}
                          >
                            {publication.category}
                          </span>
                        </div>

                        <div>
                          <h3 className="font-display text-2xl font-semibold leading-tight text-white transition-colors group-hover:text-violet-200">
                            {publication.title}
                          </h3>
                          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60 md:text-base">
                            {publication.excerpt}
                          </p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {publication.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="text-xs uppercase tracking-[0.14em] text-white/36">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col items-start gap-3 md:items-end">
                          <div className="text-sm text-white/42">{publication.displayMonth}</div>
                          <div className="flex items-center gap-1.5 text-sm text-white/52">
                            <Clock3 className="h-3.5 w-3.5" />
                            {publication.readingTime}
                          </div>
                          <div className="text-sm font-medium text-violet-300 transition-transform group-hover:translate-x-1">
                            Ouvrir
                          </div>
                        </div>
                      </Link>
                    );
                  },
                )}
              </div>
            </section>
          </>
        ) : (
          <section className="mt-14 rounded-[32px] border border-dashed border-white/14 bg-white/[0.03] p-8 text-center">
            <h2 className="font-display text-3xl font-semibold text-white">
              Aucun article ne correspond à cette sélection
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/58">
              Essaie une autre catégorie ou réinitialise la recherche pour élargir la vue.
            </p>
          </section>
        )}

        <section className="mt-18 rounded-[32px] border border-white/10 bg-linear-to-r from-violet-500/12 via-transparent to-emerald-400/12 p-8 md:p-10">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
            <div>
              <div className="text-sm uppercase tracking-[0.16em] text-violet-300">
                Passer de la lecture à l&apos;action
              </div>
              <h2 className="mt-4 max-w-3xl font-display text-3xl font-semibold leading-tight text-white md:text-4xl">
                Transformer une intuition IA en décision claire, puis en plan d&apos;exécution.
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/62 md:text-base">
                Si un article fait écho à un sujet concret chez toi, l&apos;étape utile ensuite est
                souvent simple : cadrer le problème, définir le périmètre et identifier où la
                valeur peut apparaître rapidement.
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:items-end">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-full bg-neural-violet px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neural-violet-dark"
              >
                Réserver un audit
              </Link>
              <Link
                href="/publications/poc-ia-production-framework"
                className="inline-flex items-center justify-center rounded-full border border-white/14 bg-white/5 px-6 py-3 text-sm font-medium text-white/76 transition-colors hover:border-white/22 hover:bg-white/8"
              >
                Découvrir notre approche
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
