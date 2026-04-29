"use client";

import Link from "next/link";
import {
  startTransition,
  useDeferredValue,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import type { PublicationSummary } from "@/lib/publications-contract";

type PublicationsRefonteProps = {
  publications: PublicationSummary[];
};

type ThemeCard = {
  id: string;
  label: string;
  count: number;
  kicker: string;
  matches: (publication: PublicationSummary) => boolean;
};

const FORMAT_FILTERS = [
  "Tous",
  "Analyse",
  "Benchmark",
  "Guide",
  "Case Study",
  "Perspective",
] as const;

const TAG_GROUPS: Array<{
  id: string;
  label: string;
  kicker: string;
  tags: string[];
}> = [
  {
    id: "gouvernance",
    label: "Gouvernance & conformité",
    kicker: "Cadrer la décision",
    tags: ["Gouvernance", "Conformité", "AI Act", "Sponsor", "Comitologie", "Réglementation"],
  },
  {
    id: "execution",
    label: "Exécution & mise en production",
    kicker: "Du POC au système",
    tags: ["Déploiement", "POC", "Industrialisation", "Architecture"],
  },
  {
    id: "roi",
    label: "ROI & valeur métier",
    kicker: "Mesurer ce qui compte",
    tags: ["ROI", "Cas d'usage", "LLM"],
  },
  {
    id: "sectoriel",
    label: "Lectures sectorielles",
    kicker: "Banque, Assurance, Luxe, SaaS, Aéronautique, Transport",
    tags: ["Luxe", "Banque", "SaaS", "Assurance", "Supply Chain", "CX", "Support", "Traçabilité"],
  },
];

function parseReadingTime(value: string): number {
  const match = value.match(/(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

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

function SearchIcon() {
  return (
    <svg
      className="npub-search-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function Hero() {
  return (
    <section className="npub-hero">
      <div className="npub-hero-grain" aria-hidden="true" />
      <div className="npub-hero-inner npub-container">
        <div className="npub-eyebrow">
          <span className="npub-dot" aria-hidden="true" /> Lectures · NEURAL Labs
        </div>

        <div className="npub-hero-grid">
          <div>
            <h1 className="npub-display npub-hero-title">
              Des analyses pensées pour&nbsp;<em>clarifier</em> les décisions, pas pour
              remplir un flux.
            </h1>
            <p className="npub-hero-lead">
              Benchmarks, guides, retours terrain et perspectives sur l&apos;IA en
              entreprise. Une lecture, une décision plus nette — sur le cadrage, le
              déploiement ou la valeur réelle d&apos;un cas d&apos;usage.
            </p>
            <div className="npub-hero-ctas">
              <Link className="npub-btn npub-btn-primary" href="#a-la-une">
                Lire la dernière analyse →
              </Link>
              <Link className="npub-btn npub-btn-ghost" href="#bibliotheque">
                Parcourir la bibliothèque
              </Link>
            </div>
          </div>

          <aside className="npub-hero-meta">
            <div className="npub-hero-meta-label">L&apos;éditorial NEURAL en bref</div>
            <dl>
              <div className="npub-hero-meta-row">
                <dt>Cadence</dt>
                <dd>
                  <strong>2 publications / mois</strong>
                  Pas de remplissage. Un sujet, une thèse.
                </dd>
              </div>
              <div className="npub-hero-meta-row">
                <dt>Auteurs</dt>
                <dd>
                  <strong>NEURAL Labs + Delivery</strong>
                  Les équipes qui déploient écrivent.
                </dd>
              </div>
              <div className="npub-hero-meta-row">
                <dt>Audience</dt>
                <dd>
                  <strong>Direction, DSI, Ops</strong>
                  Lectures pensées pour la décision, pas la veille.
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      </div>
    </section>
  );
}

function Stats({ publications }: { publications: PublicationSummary[] }) {
  const stats = useMemo(() => {
    const total = publications.length;
    const readingMinutes = publications
      .map((publication) => parseReadingTime(publication.readingTime))
      .filter((minutes) => minutes > 0);
    const avg =
      readingMinutes.length > 0
        ? Math.round(
            readingMinutes.reduce((sum, minutes) => sum + minutes, 0) /
              readingMinutes.length,
          )
        : 0;
    return {
      total,
      avg,
      sectors: 6,
    };
  }, [publications]);

  return (
    <section className="npub-stats">
      <div className="npub-container npub-stats-grid">
        <div className="npub-stat">
          <div className="npub-stat-k">{stats.total}</div>
          <div className="npub-stat-l">
            Analyses publiées sur le cadrage, le déploiement et la valeur
          </div>
        </div>
        <div className="npub-stat">
          <div className="npub-stat-k">
            {stats.avg}
            <span> min</span>
          </div>
          <div className="npub-stat-l">
            Temps de lecture moyen — assez court pour décider
          </div>
        </div>
        <div className="npub-stat">
          <div className="npub-stat-k">{stats.sectors}</div>
          <div className="npub-stat-l">
            Secteurs documentés : Banque, Assurance, Luxe, SaaS, Aéronautique, Transport
          </div>
        </div>
      </div>
    </section>
  );
}

function Featured({ publication }: { publication: PublicationSummary }) {
  const authorName =
    typeof publication.author === "object" && publication.author
      ? publication.author.name
      : "NEURAL Labs";

  return (
    <section className="npub-featured" id="a-la-une">
      <div className="npub-container">
        <div className="npub-featured-head">
          <div>
            <div className="npub-eyebrow">
              <span className="npub-dot" aria-hidden="true" /> À la une
            </div>
            <h2>
              <span className="npub-featured-italic">Lecture du moment</span>
              L&apos;analyse à laquelle on revient cette semaine.
            </h2>
          </div>
          <p>
            Une thèse argumentée sur ce qui fait — vraiment — réussir ou échouer un
            projet IA en entreprise. Cause structurelles, observées sur le terrain.
          </p>
        </div>

        <Link
          href={`/publications/${publication.slug}`}
          className="npub-featured-card"
        >
          <div className="npub-featured-body">
            <div>
              <span className="npub-featured-tag">
                {publication.category} · {publication.audience}
              </span>
              <h3 className="npub-featured-title">{publication.title}</h3>
              <p className="npub-featured-excerpt">{publication.excerpt}</p>
            </div>
            <div>
              <div className="npub-featured-foot" style={{ marginBottom: 24 }}>
                <span>
                  <strong>{publication.displayMonth}</strong>
                </span>
                <span>{publication.readingTime} de lecture</span>
                <span>
                  par <strong>{authorName}</strong>
                </span>
              </div>
              <span className="npub-featured-cta">Lire l&apos;analyse complète →</span>
            </div>
          </div>

          <div className="npub-featured-visual">
            <div className="npub-featured-visual-grid" aria-hidden="true" />
            <p className="npub-featured-quote">
              {publication.tldr[0] ??
                "L'échec d'un projet IA vient rarement du modèle. Il vient d'un sponsor flou, d'un périmètre élastique, d'une métrique manquante."}
            </p>
            <div className="npub-featured-meta">
              <span>NEURAL Labs · {publication.displayMonth}</span>
            </div>

            <div className="npub-featured-badge npub-featured-badge-tr">
              <div className="npub-fb-k">
                80<span>%</span>
              </div>
              <div className="npub-fb-l">de POC enlisés</div>
            </div>
            <div className="npub-featured-badge npub-featured-badge-bl">
              <div className="npub-fb-pulse" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className="npub-fb-l" style={{ margin: 0 }}>
                {publication.displayMonth}
              </div>
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
}

function Library({
  publications,
  leadSlug,
}: {
  publications: PublicationSummary[];
  leadSlug?: string;
}) {
  const [format, setFormat] = useState<string>("Tous");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const items = useMemo(
    () => publications.filter((publication) => publication.slug !== leadSlug),
    [publications, leadSlug],
  );

  const filtered = useMemo(() => {
    return items.filter((publication) => {
      if (format !== "Tous" && publication.category !== format) {
        return false;
      }
      return matchesQuery(publication, deferredQuery);
    });
  }, [items, format, deferredQuery]);

  const formatCount = (cat: string): number =>
    cat === "Tous"
      ? items.length
      : items.filter((publication) => publication.category === cat).length;

  return (
    <section className="npub-library" id="bibliotheque">
      <div className="npub-container">
        <div className="npub-library-head">
          <div>
            <div className="npub-eyebrow">
              <span className="npub-dot" aria-hidden="true" /> Bibliothèque
            </div>
            <h2>
              Toutes les <em>lectures</em>, classées par format.
            </h2>
          </div>
          <div className="npub-library-counter">
            <b>{filtered.length}</b>
            <span>/ {items.length} articles</span>
          </div>
        </div>

        <div className="npub-filters">
          <div className="npub-filter-row">
            <span className="npub-filter-label">Format</span>
            {FORMAT_FILTERS.map((value) => (
              <button
                key={value}
                className={`npub-chip${format === value ? " is-active" : ""}`}
                onClick={() => startTransition(() => setFormat(value))}
                type="button"
              >
                <span>{value}</span>
                <span className="npub-chip-count">{formatCount(value)}</span>
              </button>
            ))}
          </div>

          <label className="npub-search">
            <SearchIcon />
            <input
              type="search"
              value={query}
              placeholder="Chercher un sujet, un secteur, un tag…"
              onChange={(event) =>
                startTransition(() => setQuery(event.target.value))
              }
            />
          </label>
        </div>

        <div className="npub-grid">
          {filtered.length === 0 ? (
            <div className="npub-empty">
              <h3>Aucune lecture ne correspond.</h3>
              <p>
                Élargis le format ou réinitialise la recherche pour voir l&apos;ensemble.
              </p>
            </div>
          ) : (
            filtered.map((publication) => (
              <Link
                key={publication.slug}
                className="npub-card"
                href={`/publications/${publication.slug}`}
              >
                <div className="npub-card-top">
                  <span
                    className="npub-card-cat"
                    data-cat={publication.category}
                  >
                    {publication.category}
                  </span>
                  <span>{publication.displayMonth}</span>
                </div>
                <h3 className="npub-card-title">{publication.title}</h3>
                <p className="npub-card-sub">{publication.subtitle}</p>
                <div className="npub-card-foot">
                  <span>
                    {publication.readingTime} · {publication.audience}
                  </span>
                  <span className="npub-card-arrow">→</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function Themes({ publications }: { publications: PublicationSummary[] }) {
  const themes: ThemeCard[] = useMemo(() => {
    return TAG_GROUPS.map((group) => {
      const matches = (publication: PublicationSummary) =>
        publication.tags.some((tag) => group.tags.includes(tag));
      const count = publications.filter(matches).length;
      return {
        id: group.id,
        label: group.label,
        kicker: group.kicker,
        count,
        matches,
      };
    });
  }, [publications]);

  return (
    <section className="npub-themes npub-section-dark">
      <div className="npub-container">
        <div className="npub-themes-head">
          <div className="npub-eyebrow">
            <span className="npub-dot" aria-hidden="true" /> Lecture par sujet
          </div>
          <h2>
            Quatre angles de lecture, <em>pour aller</em> droit au sujet qui te
            concerne.
          </h2>
          <p>
            Plutôt que de scroller la chronologie, entre par le problème : cadrer,
            exécuter, mesurer, ou comprendre un secteur précis.
          </p>
        </div>

        <div className="npub-themes-grid">
          {themes.map((theme, index) => (
            <Link
              key={theme.id}
              className="npub-theme"
              href={`/publications#bibliotheque`}
            >
              <div className="npub-theme-num">
                0{index + 1} · {String(theme.count).padStart(2, "0")} articles
              </div>
              <h3 className="npub-theme-title">{theme.label}</h3>
              <div className="npub-theme-kicker">{theme.kicker}</div>
              <div className="npub-theme-foot">
                <span>Explorer</span>
                <span className="npub-theme-arrow">→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function NewsletterCTA() {
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <section className="npub-cta">
      <div className="npub-container npub-cta-inner">
        <div>
          <div className="npub-eyebrow">
            <span className="npub-dot" aria-hidden="true" /> Newsletter NEURAL
          </div>
          <h2>
            Une lecture <em>par mois</em>, qui change la décision de la semaine.
          </h2>
          <p className="npub-cta-lead">
            Pas de récap, pas de roundup. Une analyse signée NEURAL Labs, livrée le
            premier jeudi de chaque mois — si elle apporte quelque chose, sinon rien.
          </p>
          {submitted ? (
            <div className="npub-cta-sub" style={{ marginTop: 32 }}>
              Merci — votre inscription est prise en compte. Pour confirmer, rendez-vous
              sur <Link href="/newsletter" style={{ textDecoration: "underline" }}>
                /newsletter
              </Link>.
            </div>
          ) : (
            <form className="npub-cta-form" onSubmit={onSubmit}>
              <input
                type="email"
                placeholder="prenom@entreprise.com"
                aria-label="Adresse email"
                required
              />
              <button type="submit" className="npub-btn npub-btn-primary">
                S&apos;abonner →
              </button>
            </form>
          )}
          <div className="npub-cta-sub">
            Désabonnement en un clic · 0 spam · contenu rédigé par les équipes
            delivery
          </div>
        </div>

        <aside className="npub-cta-aside">
          <div className="npub-cta-aside-label">Pourquoi cette newsletter</div>
          <p className="npub-cta-aside-quote">
            Une analyse argumentée sur l&apos;IA en entreprise, pas un agrégat de
            liens. Lecture courte, thèse claire, sans hype.
          </p>
          <div className="npub-cta-aside-author">
            <div className="npub-cta-aside-avatar" aria-hidden="true">
              N
            </div>
            <div className="npub-cta-aside-meta">
              <strong>NEURAL Labs</strong>
              <span>Équipe éditoriale &amp; delivery</span>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

export function PublicationsRefonte({ publications }: PublicationsRefonteProps) {
  const featured = useMemo(
    () =>
      publications.find((publication) => publication.featured) ??
      publications[0] ??
      null,
    [publications],
  );

  return (
    <div className="npub-root">
      <Hero />
      <Stats publications={publications} />
      {featured ? <Featured publication={featured} /> : null}
      <Library
        publications={publications}
        leadSlug={featured?.slug}
      />
      <Themes publications={publications} />
      <NewsletterCTA />
    </div>
  );
}
