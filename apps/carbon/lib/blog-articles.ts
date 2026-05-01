/**
 * Registre central des articles de blog CarbonCo.
 *
 * Chaque article est une route TSX statique sous `app/blog/[slug]/page.tsx`.
 * Cette source de vérité unique permet :
 *   - de générer la page d'index `/blog`,
 *   - d'alimenter le sitemap automatiquement,
 *   - d'afficher un "next read" cohérent en bas de chaque article.
 *
 * On a délibérément évité MDX pour ne pas ajouter de dépendance : chaque
 * article reste un composant React, ce qui est cohérent avec le reste du
 * code (illustrations, infographies, etc.).
 */

export interface BlogArticleMeta {
  slug: string;
  title: string;
  description: string;
  date: string;       // ISO yyyy-mm-dd
  readingTime: string; // ex "8 min"
  category: "CSRD" | "ESRS" | "Méthodologie" | "Réglementation" | "OTI";
  tags: string[];
}

export const BLOG_ARTICLES: BlogArticleMeta[] = [
  {
    slug: "csrd-2027-checklist",
    title: "Préparer son audit CSRD 2027 — checklist en 12 points",
    description:
      "Calendrier, périmètre, gouvernance, données, audit trail : tout ce qu'une ETI doit verrouiller avant la première vague d'assurance limitée 2027.",
    date: "2026-04-22",
    readingTime: "9 min",
    category: "CSRD",
    tags: ["CSRD", "Audit", "ETI", "Roadmap"],
  },
  {
    slug: "scope-3-categorie-11",
    title: "Scope 3 catégorie 11 : guide pratique de calcul",
    description:
      "L'utilisation des produits vendus pèse souvent 60 % du Scope 3. Méthode, hypothèses, facteurs ADEME et pièges à éviter.",
    date: "2026-04-12",
    readingTime: "11 min",
    category: "Méthodologie",
    tags: ["Scope 3", "GHG Protocol", "ADEME"],
  },
  {
    slug: "double-materialite",
    title: "Double matérialité : méthodologie ESRS pas à pas",
    description:
      "Identifier les enjeux financiers et d'impact, scorer, prioriser, documenter. Le b.a.-ba conforme ESRS 1 §3.",
    date: "2026-03-30",
    readingTime: "8 min",
    category: "ESRS",
    tags: ["Double matérialité", "ESRS 1", "Gouvernance"],
  },
  {
    slug: "audit-trail-oti",
    title: "Pourquoi l'audit trail SHA-256 est devenu un standard OTI",
    description:
      "Sans traçabilité cryptographique, votre rapport ESG ne passe pas l'assurance raisonnable. Comment le commissaire aux comptes vérifie la chaîne.",
    date: "2026-03-18",
    readingTime: "7 min",
    category: "OTI",
    tags: ["Audit trail", "SHA-256", "OTI", "Assurance"],
  },
  {
    slug: "taxonomie-verte-2026",
    title: "Taxonomie verte UE : ce qui change en 2026",
    description:
      "Nouveaux critères techniques, articulation avec la CSRD, KPIs financiers obligatoires. Le tour d'horizon des évolutions 2026 et leur impact opérationnel.",
    date: "2026-02-28",
    readingTime: "10 min",
    category: "Réglementation",
    tags: ["Taxonomie", "UE", "KPIs"],
  },
];

export function getArticle(slug: string): BlogArticleMeta | undefined {
  return BLOG_ARTICLES.find((a) => a.slug === slug);
}

export function getNextArticle(slug: string): BlogArticleMeta | undefined {
  const idx = BLOG_ARTICLES.findIndex((a) => a.slug === slug);
  if (idx === -1) return undefined;
  return BLOG_ARTICLES[(idx + 1) % BLOG_ARTICLES.length];
}
