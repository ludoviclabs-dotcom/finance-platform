import Link from "next/link";
import { ArrowRight, Clock3 } from "lucide-react";

import { getPublicationTheme } from "@/lib/publication-ui";
import { getAllPublications } from "@/lib/publications";

export async function BlogPreview() {
  const posts = (await getAllPublications()).slice(0, 3);

  return (
    <section className="px-8 py-28 md:px-12">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-14 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-neural-violet">
              Publications
            </span>
            <h2 className="mt-4 font-display text-4xl font-extrabold tracking-tighter md:text-5xl">
              Dernières publications
            </h2>
            <p className="mt-3 max-w-2xl text-[var(--color-foreground-muted)]">
              Un aperçu branché au contenu réel du hub éditorial NEURAL.
            </p>
          </div>
          <Link
            href="/publications"
            className="inline-flex items-center gap-1 text-sm font-semibold text-neural-violet hover:underline"
          >
            Tout voir <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="divide-y divide-white/10 rounded-[28px] border border-white/10 bg-white/[0.04]">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/publications/${post.slug}`}
              className="group grid gap-5 px-6 py-6 transition-colors hover:bg-white/[0.03] md:grid-cols-[180px_minmax(0,1fr)_140px]"
            >
              <div>
                <span
                  className={[
                    "inline-flex rounded-full border px-3 py-1 text-xs font-medium",
                    getPublicationTheme(post.category).badge,
                  ].join(" ")}
                >
                  {post.category}
                </span>
              </div>
              <div>
                <h3 className="font-display text-xl font-semibold leading-tight transition-colors group-hover:text-neural-violet">
                  {post.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-[var(--color-foreground-muted)]">
                  {post.excerpt}
                </p>
              </div>
              <div className="flex flex-col items-start gap-3 md:items-end">
                <div className="text-xs text-[var(--color-foreground-subtle)]">{post.displayMonth}</div>
                <div className="inline-flex items-center gap-1.5 text-sm text-[var(--color-foreground-muted)]">
                  <Clock3 className="h-3.5 w-3.5" />
                  {post.readingTime}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
