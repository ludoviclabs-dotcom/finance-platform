import { notFound } from "next/navigation";
import Link from "next/link";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
  articleBriefSchema,
  LENGTH_WORD_TARGETS,
  type ArticleLength,
} from "@/lib/types/article";
import { chartSpecSchema } from "@/lib/infographics/chart-spec";
import { ArticleEditor } from "@/components/studio/article-editor";
import { InfographicBlock } from "@/components/studio/infographic-block";
import { RetrievalDebugPanel } from "@/components/studio/retrieval-debug-panel";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditArticlePage({ params }: PageProps) {
  const { id } = await params;

  if (!env.database.ready) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold">Éditeur</h1>
        <p className="mt-3 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          <strong>DATABASE_URL non configurée.</strong>
        </p>
      </div>
    );
  }

  const article = await db.article.findUnique({
    where: { id },
    include: {
      citations: {
        orderBy: { position: "asc" },
        select: {
          position: true,
          sourceId: true,
          quote: true,
          source: { select: { title: true, filename: true, author: true } },
          chunk: { select: { heading: true, pageNumber: true, content: true } },
        },
      },
      infographics: { orderBy: { position: "asc" } },
    },
  });
  if (!article) notFound();

  const infographics = article.infographics
    .map((g) => {
      const parsed = chartSpecSchema.safeParse(g.spec);
      return parsed.success
        ? { id: g.id, spec: parsed.data, sourceCitationIds: g.sourceCitationIds }
        : null;
    })
    .filter((g): g is { id: string; spec: import("@/lib/infographics/chart-spec").ChartSpec; sourceCitationIds: string[] } => g !== null);

  const briefResult = articleBriefSchema.safeParse(article.brief);
  const brief = briefResult.success ? briefResult.data : null;

  const citationsForEditor = article.citations.map((c) => ({
    id: `S${c.position + 1}`,
    sourceId: c.sourceId,
    sourceTitle: c.source.title ?? "",
    sourceFilename: c.source.filename,
    sourceAuthor: c.source.author,
    heading: c.chunk?.heading ?? null,
    pageNumber: c.chunk?.pageNumber ?? null,
    quote: c.quote || (c.chunk?.content?.slice(0, 320) ?? ""),
  }));

  return (
    <div className="grid max-w-7xl gap-8 lg:grid-cols-[1fr_24rem]">
      <main className="space-y-6">
        <header className="space-y-2">
          <div className="flex items-center gap-3">
            <p className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
              Brouillon — {article.status}
            </p>
            <Link
              href={`/articles/${article.id}/preview`}
              className="ml-auto text-sm text-[color:var(--muted)] hover:text-white"
            >
              Aperçu &amp; export →
            </Link>
          </div>
          <h1 className="text-2xl font-semibold">{article.title}</h1>
          {brief && (
            <p className="text-sm text-[color:var(--muted)]">
              {brief.angle} · {brief.audience} ·{" "}
              {LENGTH_WORD_TARGETS[brief.length as ArticleLength]} mots ·{" "}
              {brief.selectedSourceIds.length} source(s)
            </p>
          )}
        </header>

        <ArticleEditor
          articleId={article.id}
          initialBodyMd={article.bodyMd}
          initialCitations={citationsForEditor}
        />

        {infographics.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[color:var(--muted)]">
              Infographies détectées
            </h2>
            {infographics.map((g) => (
              <InfographicBlock
                key={g.id}
                spec={g.spec}
                sourceCitationIds={g.sourceCitationIds}
              />
            ))}
          </section>
        )}
      </main>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <RetrievalDebugPanel articleId={article.id} />
      </aside>
    </div>
  );
}
