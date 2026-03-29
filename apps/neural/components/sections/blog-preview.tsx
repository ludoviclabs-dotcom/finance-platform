"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useReveal } from "@/lib/use-reveal";

const posts = [
  {
    slug: "pourquoi-80-projets-ia-echouent",
    title: "Pourquoi 80% des projets IA échouent en entreprise",
    excerpt: "Analyse des 5 causes principales d'échec et comment les éviter avec une approche structurée.",
    date: "15 mars 2025",
    category: "Analyse",
  },
  {
    slug: "guide-roi-ia-entreprise",
    title: "Guide : Mesurer le ROI de l'IA en entreprise",
    excerpt: "Framework en 4 étapes pour quantifier l'impact réel de vos déploiements IA.",
    date: "8 mars 2025",
    category: "Guide",
  },
  {
    slug: "claude-vs-gpt-entreprise",
    title: "Claude vs GPT en entreprise : benchmark 2025",
    excerpt: "Comparaison objective sur 12 cas d'usage métier réels avec métriques de performance.",
    date: "28 février 2025",
    category: "Benchmark",
  },
];

export function BlogPreview() {
  const sectionRef = useReveal();

  return (
    <section ref={sectionRef} className="py-28 px-8 md:px-12">
      <div className="mx-auto max-w-[1440px]">
        <div className="flex items-end justify-between mb-14">
          <div>
            <div className="reveal mb-4">
              <span className="text-xs font-bold text-neural-violet uppercase tracking-widest">Publications</span>
            </div>
            <div className="reveal" style={{ animationDelay: "0.05s" }}>
              <h2 className="font-display font-extrabold text-4xl md:text-5xl tracking-tighter">
                Dernières publications
              </h2>
              <p className="mt-3 text-[var(--color-foreground-muted)]">
                Analyses, guides et benchmarks sur l&apos;IA en entreprise
              </p>
            </div>
          </div>
          <Link
            href="/resources/blog"
            className="hidden items-center gap-1 text-sm font-semibold text-neural-violet hover:underline md:flex"
          >
            Tout voir <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {posts.map((post, i) => (
            <div key={post.slug} className="reveal" style={{ animationDelay: `${0.1 + i * 0.08}s` }}>
              <Link href={`/resources/blog/${post.slug}`} className="block h-full">
                <motion.div
                  whileHover={{ y: -4, boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15)" }}
                  transition={{ type: "spring", stiffness: 300, damping: 22 }}
                  className="card-interactive p-7 h-full group"
                >
                  <span className="inline-flex items-center rounded-full bg-neural-violet/10 px-2.5 py-1 text-[10px] font-bold text-neural-violet uppercase tracking-wide">
                    {post.category}
                  </span>
                  <h3 className="mt-4 font-display font-bold text-base leading-snug group-hover:text-neural-violet transition-colors">
                    {post.title}
                  </h3>
                  <p className="mt-2 text-sm text-[var(--color-foreground-muted)] line-clamp-2 leading-relaxed">
                    {post.excerpt}
                  </p>
                  <p className="mt-4 text-xs text-[var(--color-foreground-subtle)]">{post.date}</p>
                </motion.div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
