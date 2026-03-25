import Link from "next/link";
import { ArrowRight } from "lucide-react";

const posts = [
  {
    slug: "pourquoi-80-projets-ia-echouent",
    title: "Pourquoi 80% des projets IA échouent en entreprise",
    excerpt: "Analyse des 5 causes principales d'échec et comment les éviter avec une approche structurée.",
    date: "2025-03-15",
    category: "Analyse",
  },
  {
    slug: "guide-roi-ia-entreprise",
    title: "Guide : Mesurer le ROI de l'IA en entreprise",
    excerpt: "Framework en 4 étapes pour quantifier l'impact réel de vos déploiements IA.",
    date: "2025-03-08",
    category: "Guide",
  },
  {
    slug: "claude-vs-gpt-entreprise",
    title: "Claude vs GPT en entreprise : benchmark 2025",
    excerpt: "Comparaison objective sur 12 cas d'usage métier réels avec métriques de performance.",
    date: "2025-02-28",
    category: "Benchmark",
  },
];

export function BlogPreview() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-display text-4xl font-bold">
              Dernières publications
            </h2>
            <p className="mt-2 text-foreground-muted">
              Analyses, guides et benchmarks sur l&apos;IA en entreprise
            </p>
          </div>
          <Link
            href="/resources/blog"
            className="hidden items-center gap-1 text-sm font-medium text-neural-violet hover:underline md:flex"
          >
            Tout voir <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/resources/blog/${post.slug}`}
              className="card group p-6 transition-all hover:border-neural-violet/30 hover:shadow-md"
            >
              <span className="badge badge-info">{post.category}</span>
              <h3 className="mt-3 font-display font-semibold group-hover:text-neural-violet">
                {post.title}
              </h3>
              <p className="mt-2 text-sm text-foreground-muted line-clamp-2">
                {post.excerpt}
              </p>
              <p className="mt-4 text-xs text-foreground-subtle">{post.date}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
