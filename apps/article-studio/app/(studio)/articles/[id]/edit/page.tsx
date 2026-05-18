import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
  articleBriefSchema,
  LENGTH_WORD_TARGETS,
  type ArticleLength,
} from "@/lib/types/article";
import { ArticleEditor } from "@/components/studio/article-editor";
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
          source: { select: { title: true, filename: true } },
          chunk: { select: { heading: true } },
        },
      },
    },
  });
  if (!article) notFound();

  const briefResult = articleBriefSchema.safeParse(article.brief);
  const brief = briefResult.success ? briefResult.data : null;

  const citationsForEditor = article.citations.map((c) => ({
    id: `S${c.position + 1}`,
    sourceId: c.sourceId,
    heading: c.chunk?.heading ?? c.source.title ?? c.source.filename,
  }));

  return (
    <div className="grid max-w-7xl gap-8 lg:grid-cols-[1fr_24rem]">
      <main className="space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
            Brouillon — {article.status}
          </p>
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
      </main>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <RetrievalDebugPanel articleId={article.id} />
      </aside>
    </div>
  );
}
