"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

import { useReveal } from "@/lib/use-reveal";

const posts = [
  {
    slug: "pourquoi-80-pourcent-projets-ia-echouent",
    title: "Pourquoi 80% des projets IA n'atteignent jamais la production",
    excerpt:
      "Les causes structurelles d'echec et les garde-fous qui rendent un projet plus credible en 2026.",
    date: "Avril 2026",
    category: "Benchmark",
  },
  {
    slug: "cadrer-agent-ia-sans-degrader-processus",
    title: "Comment cadrer un agent IA sans degrader les processus metier",
    excerpt:
      "Une methode simple pour definir perimetre, niveau de preuve et criteres de succes.",
    date: "Avril 2026",
    category: "Guide",
  },
  {
    slug: "claude-en-entreprise-valeur-reelle",
    title: "Claude en entreprise : la ou il cree vraiment de la valeur",
    excerpt:
      "Les usages les plus credibles en 2026, loin des demos vides et des promesses trop larges.",
    date: "Mars 2026",
    category: "Analyse",
  },
];

export function BlogPreview() {
  const sectionRef = useReveal();

  return (
    <section ref={sectionRef} className="px-8 py-28 md:px-12">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-14 flex items-end justify-between">
          <div>
            <div className="reveal mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-neural-violet">
                Publications
              </span>
            </div>
            <div className="reveal" style={{ animationDelay: "0.05s" }}>
              <h2 className="font-display text-4xl font-extrabold tracking-tighter md:text-5xl">
                Dernieres publications
              </h2>
              <p className="mt-3 text-[var(--color-foreground-muted)]">
                Analyses, guides et benchmarks sur l&apos;IA en entreprise
              </p>
            </div>
          </div>
          <Link
            href="/publications"
            className="hidden items-center gap-1 text-sm font-semibold text-neural-violet hover:underline md:flex"
          >
            Tout voir <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {posts.map((post, index) => (
            <div
              key={post.slug}
              className="reveal"
              style={{ animationDelay: `${0.1 + index * 0.08}s` }}
            >
              <Link href={`/publications/${post.slug}`} className="block h-full">
                <motion.div
                  whileHover={{ y: -4, boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15)" }}
                  transition={{ type: "spring", stiffness: 300, damping: 22 }}
                  className="card-interactive group h-full p-7"
                >
                  <span className="inline-flex items-center rounded-full bg-neural-violet/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-neural-violet">
                    {post.category}
                  </span>
                  <h3 className="mt-4 font-display text-base font-bold leading-snug transition-colors group-hover:text-neural-violet">
                    {post.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--color-foreground-muted)]">
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
