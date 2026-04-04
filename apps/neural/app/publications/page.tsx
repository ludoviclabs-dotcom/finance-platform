"use client";

import Link from "next/link";
import { ArrowRight, Search, Clock, User, TrendingUp } from "lucide-react";

/* ─── Article Data ────────────────────────────────────────────────────────── */

const categories = ["Tous", "Analyse", "Benchmark", "Guide", "Case Study", "Perspective"] as const;

interface Article {
  slug: string;
  type: (typeof categories)[number];
  title: string;
  excerpt: string;
  readTime: string;
  audience: string;
  date: string;
  featured?: boolean;
}

const articles: Article[] = [
  {
    slug: "pourquoi-80-pourcent-projets-ia-echouent",
    type: "Benchmark",
    title: "Pourquoi 80% des projets IA n'atteignent jamais la production",
    excerpt:
      "Les 6 causes structurelles observées sur le terrain, et le framework pour les corriger avant qu'un POC ne dérive.",
    readTime: "10 min",
    audience: "Direction / Ops",
    date: "Avril 2026",
    featured: true,
  },
  {
    slug: "cadrer-agent-ia-sans-degrader-processus",
    type: "Guide",
    title: "Comment cadrer un agent IA sans dégrader les processus métier",
    excerpt:
      "Une méthode simple pour définir périmètre, ROI, gouvernance et critères de succès dès le départ.",
    readTime: "6 min",
    audience: "Ops",
    date: "Avril 2026",
  },
  {
    slug: "claude-en-entreprise-valeur-reelle",
    type: "Analyse",
    title: "Claude en entreprise : là où il crée vraiment de la valeur",
    excerpt:
      "Les usages les plus crédibles en 2026, loin des effets de mode et des démos vides.",
    readTime: "7 min",
    audience: "Direction",
    date: "Mars 2026",
  },
  {
    slug: "audit-support-client-3-deploiements-concrets",
    type: "Case Study",
    title: "De l'audit au support client : 3 déploiements concrets à ROI rapide",
    excerpt:
      "Ce qui a été automatisé, ce qui a été laissé à l'humain, et pourquoi cela a fonctionné.",
    readTime: "9 min",
    audience: "Finance / Ops",
    date: "Mars 2026",
  },
  {
    slug: "ia-supply-chain-luxe-tracabilite",
    type: "Perspective",
    title: "L'IA dans la supply chain luxe : de la traçabilité à l'avantage concurrentiel",
    excerpt:
      "Comment les agents IA transforment la conformité réglementaire en levier stratégique pour les maisons de luxe.",
    readTime: "8 min",
    audience: "Supply Chain / Direction",
    date: "Mars 2026",
  },
  {
    slug: "poc-ia-production-framework",
    type: "Guide",
    title: "Du POC à la production : un framework en 5 étapes",
    excerpt:
      "Les jalons concrets pour passer d'un prototype fonctionnel à un agent IA déployé et adopté par les équipes.",
    readTime: "7 min",
    audience: "Ops / Technique",
    date: "Février 2026",
  },
];

const featured = articles.find((a) => a.featured)!;
const rest = articles.filter((a) => !a.featured);

/* ─── Badge color per type ────────────────────────────────────────────────── */

function typeBadgeClasses(type: string) {
  switch (type) {
    case "Benchmark":
      return "bg-emerald-400/10 text-emerald-300 border-emerald-400/20";
    case "Guide":
      return "bg-violet-400/10 text-violet-300 border-violet-400/20";
    case "Analyse":
      return "bg-cyan-400/10 text-cyan-300 border-cyan-400/20";
    case "Case Study":
      return "bg-amber-400/10 text-amber-300 border-amber-400/20";
    case "Perspective":
      return "bg-rose-400/10 text-rose-300 border-rose-400/20";
    default:
      return "bg-white/5 text-white/70 border-white/10";
  }
}

/* ─── Page ────────────────────────────────────────────────────────────────── */

export default function PublicationsPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-neural text-white">
      {/* Ambient effects */}
      <div className="absolute -left-40 -top-40 h-96 w-96 animate-pulse-slow rounded-full bg-neural-violet/12 blur-[120px]" />
      <div className="absolute -bottom-60 right-1/4 h-[500px] w-[500px] animate-pulse-slow rounded-full bg-neural-violet/6 blur-[140px]" />
      <div className="absolute top-1/3 right-0 h-64 w-64 animate-pulse-slow rounded-full bg-emerald-500/5 blur-[100px]" />

      <div className="relative mx-auto max-w-[1440px] px-8 pb-24 pt-28 md:px-12 lg:pt-36">

        {/* ═══ Header ═══ */}
        <header className="mb-14 space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-violet-300">
            <TrendingUp className="h-3.5 w-3.5" />
            Publications
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            Des analyses faites pour être lues,{" "}
            <span className="bg-gradient-to-r from-neural-violet-light to-neural-green bg-clip-text text-transparent">
              pas juste publiées.
            </span>
          </h1>
          <p className="max-w-3xl text-lg leading-relaxed text-white/65">
            Benchmarks, retours terrain, frameworks et points de vue sur l'IA en
            entreprise. Filtrable par secteur, branche et niveau de lecture.
          </p>
        </header>

        {/* ═══ Filters + Search ═══ */}
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
                  cat === "Tous"
                    ? "border-neural-violet/40 bg-neural-violet/15 text-violet-300"
                    : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white/80"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              type="text"
              placeholder="Rechercher un sujet..."
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/35 focus:border-neural-violet/40 focus:outline-none focus:ring-1 focus:ring-neural-violet/20"
            />
          </div>
        </div>

        {/* ═══ Featured Article + Sidebar ═══ */}
        <div className="mb-10 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          {/* Featured Card */}
          <Link
            href={`/publications/${featured.slug}`}
            className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] p-8 transition-all hover:border-white/15 hover:bg-white/[0.06]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-violet-500/5 opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative">
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${typeBadgeClasses(featured.type)}`}
              >
                Featured {featured.type}
              </span>
              <h2 className="mt-5 text-3xl font-bold leading-tight tracking-tight lg:text-4xl">
                {featured.title}
              </h2>
              <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/65">
                {featured.excerpt}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-white/45">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {featured.readTime}
                </span>
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  {featured.audience}
                </span>
                <span>{featured.date}</span>
              </div>

              {/* Visual placeholder */}
              <div className="mt-8 grid h-48 place-items-center rounded-[20px] border border-white/10 bg-gradient-to-br from-white/[0.06] to-violet-500/[0.08]">
                <div className="text-center">
                  <div className="text-6xl text-white/15">N</div>
                  <div className="mt-1 text-sm text-white/25">NEURAL Research</div>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-2 text-sm font-medium text-violet-300 transition-all group-hover:gap-3">
                Lire l'analyse complète
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </Link>

          {/* Sidebar cards */}
          <div className="grid gap-4">
            <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-6">
              <div className="text-sm font-medium text-violet-300">Stat clé</div>
              <div className="mt-3 font-display text-5xl font-bold">80%</div>
              <p className="mt-3 text-sm leading-relaxed text-white/55">
                des projets IA en entreprise n'atteignent pas leur ambition
                initiale.
              </p>
              <div className="mt-2 text-xs text-white/35">Source : RAND Corp. / McKinsey 2025</div>
            </div>
            <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-6">
              <div className="text-sm font-medium text-cyan-300">A lire ensuite</div>
              <p className="mt-3 text-lg font-semibold leading-snug">
                Comment transformer un POC IA en actif métier durable
              </p>
              <div className="mt-3 text-sm text-white/45">Guide pratique  ·  7 min</div>
            </div>
            <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-6">
              <div className="text-sm font-medium text-emerald-300">Newsletter NEURAL</div>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                Un condensé mensuel : benchmarks, retours terrain, nouveaux frameworks.
              </p>
              <div className="mt-4 rounded-xl bg-neural-violet/15 border border-neural-violet/30 px-4 py-2.5 text-center text-sm font-medium text-violet-300 cursor-pointer hover:bg-neural-violet/25 transition-colors">
                S'inscrire
              </div>
            </div>
          </div>
        </div>

        {/* ═══ Articles Grid ═══ */}
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {rest.map((article) => (
            <Link
              key={article.slug}
              href={`/publications/${article.slug}`}
              className="group rounded-[20px] border border-white/10 bg-white/[0.04] p-6 transition-all hover:border-white/15 hover:bg-white/[0.06]"
            >
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${typeBadgeClasses(article.type)}`}
              >
                {article.type}
              </span>
              <h3 className="mt-4 text-xl font-bold leading-snug tracking-tight transition-colors group-hover:text-white">
                {article.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-white/55">
                {article.excerpt}
              </p>
              <div className="mt-5 flex items-center justify-between text-xs text-white/40">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {article.readTime}
                  </span>
                  <span>{article.audience}</span>
                </div>
                <span>{article.date}</span>
              </div>
            </Link>
          ))}
        </div>

        {/* ═══ CTA Bottom ═══ */}
        <div className="mt-16 rounded-[24px] border border-white/10 bg-gradient-to-r from-neural-violet/10 via-transparent to-emerald-500/10 p-8 text-center md:p-12">
          <h3 className="font-display text-2xl font-bold md:text-3xl">
            Vous avez un cas d'usage IA à cadrer ?
          </h3>
          <p className="mx-auto mt-3 max-w-xl text-white/55">
            Réservez un audit rapide pour identifier les agents à fort potentiel
            dans votre organisation — ou recevez le benchmark complet.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/contact"
              className="rounded-xl bg-neural-violet px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-neural-violet/25 transition-all hover:bg-neural-violet-dark hover:shadow-xl"
            >
              Réserver un audit gratuit
            </Link>
            <Link
              href="/forfaits"
              className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-white/80 transition-all hover:border-white/25 hover:bg-white/10"
            >
              Voir les forfaits
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
