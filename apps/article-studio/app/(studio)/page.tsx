import Link from "next/link";

import { db } from "@/lib/db";
import { env, envReport } from "@/lib/env";

export const dynamic = "force-dynamic";

interface CorpusStats {
  sources: number;
  sourcesReady: number;
  chunks: number;
  articles: number;
  articlesReady: number;
}

async function loadStats(): Promise<CorpusStats | null> {
  if (!env.database.ready) return null;
  try {
    const [sources, sourcesReady, chunks, articles, articlesReady] = await Promise.all([
      db.source.count(),
      db.source.count({ where: { status: "READY" } }),
      db.chunk.count(),
      db.article.count(),
      db.article.count({ where: { status: "READY" } }),
    ]);
    return { sources, sourcesReady, chunks, articles, articlesReady };
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const report = envReport();
  const stats = await loadStats();
  const entries = Object.entries(report);
  const readyCount = entries.filter(([, v]) => v).length;

  const pipelineReady =
    report.database && report.embeddings_voyage || report.embeddings_openai;

  return (
    <div className="max-w-4xl space-y-10">
      <header>
        <h1 className="text-2xl font-semibold">Article Studio</h1>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Studio éditorial privé source-grounded — pipeline RAG × Claude API.
        </p>
      </header>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[color:var(--muted)]">
            Pipeline
          </h2>
          <span
            className={
              pipelineReady
                ? "rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300"
                : "rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200"
            }
          >
            {pipelineReady ? "prêt" : "configuration incomplète"}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <StatCard label="Sources" value={stats ? stats.sources : "—"} href="/sources" />
          <StatCard
            label="Sources indexées"
            value={stats ? `${stats.sourcesReady}/${stats.sources}` : "—"}
            href="/sources"
          />
          <StatCard label="Chunks" value={stats ? stats.chunks : "—"} />
          <StatCard
            label="Articles"
            value={
              stats ? `${stats.articlesReady}/${stats.articles}` : "—"
            }
            href="/articles"
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[color:var(--muted)]">
          État des capacités ({readyCount}/{entries.length})
        </h2>
        <ul className="mt-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
          {entries.map(([key, ready]) => (
            <li
              key={key}
              className="flex items-center justify-between rounded border border-[color:var(--border)] px-3 py-2"
            >
              <span className="font-mono text-xs">{key}</span>
              <span className={ready ? "text-emerald-400" : "text-[color:var(--muted)]"}>
                {ready ? "✓" : "—"}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-[color:var(--muted)]">
          Variables manquantes ? Voir <code className="font-mono">.env.example</code>{" "}
          puis <Link href="/settings" className="underline">/settings</Link>.
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[color:var(--muted)]">
          Prochain pas
        </h2>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          {stats && stats.sourcesReady === 0 ? (
            <>
              Aucune source indexée. Démarre avec{" "}
              <Link href="/sources" className="underline">/sources</Link>.
            </>
          ) : stats && stats.articles === 0 ? (
            <>
              {stats.sourcesReady} source(s) prêtes. Crée un{" "}
              <Link href="/articles/new" className="underline">
                nouvel article
              </Link>
              .
            </>
          ) : (
            <>
              Tout est en place. Continue sur{" "}
              <Link href="/articles" className="underline">/articles</Link>.
            </>
          )}
        </p>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: string | number;
  href?: string;
}) {
  const content = (
    <div className="rounded border border-[color:var(--border)] px-4 py-3">
      <div className="text-xs text-[color:var(--muted)]">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}
