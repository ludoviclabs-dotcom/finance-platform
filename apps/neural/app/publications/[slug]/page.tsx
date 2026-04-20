"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, User, Calendar, Share2 } from "lucide-react";

/* ─── Article Content Database ────────────────────────────────────────────── */

interface Section {
  title: string;
  text: string;
  callout?: { type: "signal" | "framework" | "retenir" | "objection"; text: string };
}

interface ArticleFull {
  slug: string;
  type: string;
  title: string;
  subtitle: string;
  readTime: string;
  audience: string;
  date: string;
  tldr: string[];
  sections: Section[];
  conclusion: string[];
  related: { title: string; type: string; readTime: string; slug: string }[];
}

const articlesDb: ArticleFull[] = [
  {
    slug: "pourquoi-80-pourcent-projets-ia-echouent",
    type: "Benchmark",
    title: "Pourquoi 80% des projets IA n'atteignent jamais la production",
    subtitle:
      "Les 6 causes les plus fréquentes, les signaux faibles à surveiller, et le framework pour remettre un projet sur des rails industriels.",
    readTime: "10 min",
    audience: "Direction / Ops",
    date: "08 avril 2026",
    tldr: [
      "Les échecs viennent moins des modèles que du cadrage et de l'intégration.",
      "Les POC souffrent d'un manque de sponsor, de KPI et de gouvernance claire.",
      "Un framework simple permet de reconnecter l'initiative à un vrai besoin métier.",
    ],
    sections: [
      {
        title: "Le vrai problème n'est pas l'IA, mais l'intégration",
        text: "Dans la majorité des cas, les initiatives échouent moins par faiblesse du modèle que par absence de cadrage, mauvaise orchestration ou promesse mal calibrée. Les entreprises confondent souvent démonstration technique et intégration métier. Un modèle qui fonctionne en démo n'est pas un produit déployable — et la distance entre les deux est systématiquement sous-estimée.",
        callout: {
          type: "signal",
          text: "Quand la démo impressionne plus que la feuille de route opérationnelle, le projet est déjà en risque.",
        },
      },
      {
        title: "1. Les POC naissent sans sponsor opérationnel clair",
        text: "Quand personne ne porte réellement l'usage, le projet reste théorique. L'équipe innovation lance, les métiers observent, et la mise en production devient secondaire. Sans sponsor métier identifié dès le jour 1, le POC n'a pas de destination — il finit en présentation PowerPoint.",
      },
      {
        title: "2. Le ROI est annoncé avant d'être défini",
        text: "Un ROI crédible ne se résume pas à une intuition. Il suppose des indicateurs, une fréquence de mesure, un scénario de référence et une cible réaliste. Trop souvent, le ROI est brandi comme argument de vente interne sans métrique associée — puis jamais mesuré.",
        callout: {
          type: "framework",
          text: "Sponsor métier + métrique unique + périmètre restreint + scénario de déploiement = base minimale avant industrialisation.",
        },
      },
      {
        title: "3. Le périmètre est trop large dès le départ",
        text: "Vouloir traiter toute la chaîne de valeur au premier projet est le moyen le plus sûr de ne rien livrer. Les déploiements qui réussissent commencent par un cas d'usage étroit, mesurable, et à fort levier — puis élargissent une fois les fondations validées.",
      },
      {
        title: "4. La gouvernance est absente ou floue",
        text: "Qui décide quoi ? Qui valide les outputs ? Qui arbitre les conflits entre IA et processus existants ? Sans gouvernance explicite, l'agent IA devient un corps étranger dans l'organisation — toléré mais jamais adopté.",
      },
      {
        title: "5. Les données ne sont pas prêtes",
        text: "L'IA ne compense pas un SI fragmenté. Si les données source sont incohérentes, dupliquées ou incomplètes, l'agent reproduit et amplifie les erreurs. Le chantier data est un prérequis, pas un flux parallèle.",
        callout: {
          type: "retenir",
          text: "La qualité des outputs d'un agent IA est plafonnée par la qualité des données qu'il consomme. Garbage in, garbage out — à la vitesse de l'inférence.",
        },
      },
      {
        title: "6. L'adoption humaine est négligée",
        text: "Un agent déployé mais non utilisé est un échec déguisé. L'accompagnement au changement — formation, documentation, feedback loops — n'est pas optionnel. Les meilleurs agents sont ceux que les équipes demandent à étendre, pas ceux qu'elles subissent.",
      },
    ],
    conclusion: [
      "Ne pas lancer sans sponsor métier.",
      "Définir le ROI avant la démo.",
      "Industrialiser par cas d'usage étroit.",
    ],
    related: [
      {
        title: "Comment cadrer un agent IA sans dégrader les processus métier",
        type: "Guide",
        readTime: "6 min",
        slug: "cadrer-agent-ia-sans-degrader-processus",
      },
      {
        title: "Du POC à la production : un framework en 5 étapes",
        type: "Guide",
        readTime: "7 min",
        slug: "poc-ia-production-framework",
      },
    ],
  },
];

/* Fallback article for slugs not yet in DB */
function getArticle(slug: string): ArticleFull {
  const found = articlesDb.find((a) => a.slug === slug);
  if (found) return found;
  return {
    slug,
    type: "Analyse",
    title: slug
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    subtitle: "Cet article sera bientôt disponible.",
    readTime: "—",
    audience: "—",
    date: "—",
    tldr: ["Contenu en cours de rédaction."],
    sections: [
      {
        title: "Article en préparation",
        text: "Cette publication est actuellement en cours de rédaction et sera disponible prochainement. Revenez bientôt pour découvrir l'analyse complète.",
      },
    ],
    conclusion: [],
    related: [],
  };
}

/* ─── Callout Component ───────────────────────────────────────────────────── */

function Callout({ type, text }: { type: string; text: string }) {
  const config: Record<string, { label: string; border: string; bg: string; labelColor: string }> = {
    signal:    { label: "Signal faible", border: "border-cyan-400/20",    bg: "bg-cyan-400/8",    labelColor: "text-cyan-300" },
    framework: { label: "Framework NEURAL", border: "border-emerald-400/20", bg: "bg-emerald-400/8", labelColor: "text-emerald-300" },
    retenir:   { label: "A retenir",      border: "border-amber-400/20",  bg: "bg-amber-400/8",   labelColor: "text-amber-300" },
    objection: { label: "Objection courante", border: "border-rose-400/20", bg: "bg-rose-400/8",  labelColor: "text-rose-300" },
  };
  const c = config[type] ?? config.signal;

  return (
    <div className={`rounded-[18px] border ${c.border} ${c.bg} p-5`}>
      <div className={`text-sm font-medium ${c.labelColor}`}>{c.label}</div>
      <p className="mt-2 text-[15px] leading-7 text-white/80">{text}</p>
    </div>
  );
}

/* ─── Badge color per type ────────────────────────────────────────────────── */

function typeBadgeClasses(type: string) {
  switch (type) {
    case "Benchmark":  return "bg-emerald-400/10 text-emerald-300";
    case "Guide":      return "bg-violet-400/10 text-violet-300";
    case "Analyse":    return "bg-cyan-400/10 text-cyan-300";
    case "Case Study": return "bg-amber-400/10 text-amber-300";
    case "Perspective":return "bg-rose-400/10 text-rose-300";
    default:           return "bg-white/5 text-white/70";
  }
}

/* ─── Page ────────────────────────────────────────────────────────────────── */

export default function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const article = getArticle(resolvedParams.slug);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-neural text-white">
      {/* Ambient */}
      <div className="absolute -left-40 -top-40 h-96 w-96 animate-pulse-slow rounded-full bg-neural-violet/10 blur-[120px]" />
      <div className="absolute -bottom-60 right-1/4 h-[400px] w-[400px] animate-pulse-slow rounded-full bg-cyan-500/5 blur-[140px]" />

      <div className="relative mx-auto max-w-[1440px] px-8 pb-24 pt-28 md:px-12 lg:pt-36">

        {/* Back nav */}
        <Link
          href="/publications"
          className="mb-8 inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white/80"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux publications
        </Link>

        {/* ═══ Article Header ═══ */}
        <header className="mb-10 border-b border-white/10 pb-10">
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-white/50">
            <span className={`rounded-full px-3 py-1 font-medium ${typeBadgeClasses(article.type)}`}>
              {article.type}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {article.readTime}
            </span>
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" /> {article.audience}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Mis à jour le {article.date}
            </span>
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
            {article.title}
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/60">
            {article.subtitle}
          </p>
        </header>

        {/* ═══ Body: Article + Aside ═══ */}
        <div className="grid gap-10 lg:grid-cols-[0.72fr_0.28fr]">
          <article className="space-y-10">
            {/* TL;DR */}
            <div className="rounded-[20px] border border-violet-400/20 bg-violet-400/8 p-6">
              <div className="text-sm font-semibold uppercase tracking-[0.15em] text-violet-300">
                En 30 secondes
              </div>
              <ul className="mt-4 space-y-3">
                {article.tldr.map((item, i) => (
                  <li key={i} className="flex gap-3 text-[15px] leading-7 text-white/80">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-violet-400/60" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Sections */}
            {article.sections.map((section, i) => (
              <div key={i} className="space-y-5">
                <h2 className="text-2xl font-bold leading-tight">{section.title}</h2>
                <p className="max-w-3xl text-[17px] leading-8 text-white/70">
                  {section.text}
                </p>
                {section.callout && (
                  <Callout type={section.callout.type} text={section.callout.text} />
                )}
              </div>
            ))}

            {/* Conclusion */}
            {article.conclusion.length > 0 && (
              <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-7">
                <div className="text-sm font-medium text-white/45">
                  Conclusion opérationnelle
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {article.conclusion.map((item, i) => (
                    <div
                      key={i}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-relaxed text-white/75"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Related */}
            {article.related.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white/80">Articles liés</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {article.related.map((r) => (
                    <Link
                      key={r.slug}
                      href={`/publications/${r.slug}`}
                      className="group rounded-[18px] border border-white/10 bg-white/[0.04] p-5 transition-all hover:border-white/15 hover:bg-white/[0.06]"
                    >
                      <span className={`text-xs font-medium ${typeBadgeClasses(r.type)}`}>
                        {r.type}
                      </span>
                      <p className="mt-2 font-semibold leading-snug group-hover:text-white">
                        {r.title}
                      </p>
                      <div className="mt-2 text-xs text-white/40">{r.readTime}</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </article>

          {/* ═══ Aside ═══ */}
          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            {/* Author */}
            <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-5">
              <div className="text-sm text-white/45">Auteur</div>
              <div className="mt-2 text-lg font-semibold">NEURAL Labs</div>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                Analyses IA, structuration d'offres, frameworks et déploiement en
                environnement métier.
              </p>
            </div>

            {/* Table of contents */}
            <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-5">
              <div className="text-sm font-medium text-violet-300">Table de lecture</div>
              <div className="mt-3 space-y-2.5">
                {article.sections.map((s, i) => (
                  <div
                    key={i}
                    className="text-sm leading-snug text-white/55 transition-colors hover:text-white/80 cursor-pointer"
                  >
                    {s.title}
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-5">
              <div className="text-sm font-medium text-cyan-300">
                Passer à l'action
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                Réserver un audit rapide de votre cas d'usage IA ou recevoir le
                benchmark complet.
              </p>
              <Link
                href="/contact"
                className="mt-4 block rounded-xl bg-neural-violet px-4 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-neural-violet/25 transition-all hover:bg-neural-violet-dark"
              >
                Réserver un audit gratuit
              </Link>
            </div>

            {/* Share */}
            <button className="flex w-full items-center justify-center gap-2 rounded-[18px] border border-white/10 bg-white/[0.04] p-4 text-sm text-white/50 transition-all hover:border-white/15 hover:text-white/70">
              <Share2 className="h-4 w-4" />
              Partager cet article
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}
