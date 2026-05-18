import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { ArticleBriefForm } from "@/components/studio/article-brief-form";

export const dynamic = "force-dynamic";

async function loadReadySources() {
  if (!env.database.ready) return [];
  const rows = await db.source.findMany({
    where: { status: "READY" },
    orderBy: { uploadedAt: "desc" },
    select: { id: true, filename: true, title: true, status: true },
    take: 100,
  });
  return rows;
}

export default async function NewArticlePage() {
  const sources = await loadReadySources();

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Nouvel article</h1>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Le brief définit l'angle, le ton, l'audience et le corpus RAG. Tout est
          modifiable ensuite depuis l'éditeur.
        </p>
      </header>

      {!env.database.ready && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          <strong>DATABASE_URL non configurée.</strong> La création d'article nécessite Neon.
        </div>
      )}

      <ArticleBriefForm sources={sources} />
    </div>
  );
}
