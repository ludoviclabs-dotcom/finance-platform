import Link from "next/link";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

async function loadArticles() {
  if (!env.database.ready) return [];
  const rows = await db.article.findMany({
    orderBy: { updatedAt: "desc" },
    select: { id: true, slug: true, title: true, status: true, updatedAt: true },
    take: 100,
  });
  return rows;
}

export default async function ArticlesIndexPage() {
  const articles = await loadArticles();

  return (
    <div className="max-w-4xl space-y-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Articles</h1>
        <Link
          href="/articles/new"
          className="rounded bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-black hover:bg-emerald-400"
        >
          Nouvel article
        </Link>
      </header>

      {!env.database.ready ? (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          DATABASE_URL non configurée.
        </p>
      ) : articles.length === 0 ? (
        <p className="text-sm text-[color:var(--muted)]">
          Aucun article pour le moment. Démarre avec un brief.
        </p>
      ) : (
        <ul className="divide-y divide-white/5 rounded border border-white/10 bg-black/20">
          {articles.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1">
                <Link
                  href={`/articles/${a.id}/edit`}
                  className="block text-sm font-medium hover:underline"
                >
                  {a.title}
                </Link>
                <p className="text-xs text-[color:var(--muted)]">
                  {a.slug} · {a.status} · maj{" "}
                  {new Date(a.updatedAt).toLocaleString("fr-FR")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
