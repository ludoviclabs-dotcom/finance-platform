import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { SourceUploader } from "@/components/studio/source-uploader";
import { SourceList, type SourceListItem } from "@/components/studio/source-list";

export const dynamic = "force-dynamic";

async function loadSources(): Promise<{
  sources: SourceListItem[];
  dbReady: boolean;
}> {
  if (!env.database.ready) {
    return { sources: [], dbReady: false };
  }

  const rows = await db.source.findMany({
    orderBy: { uploadedAt: "desc" },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      byteSize: true,
      status: true,
      errorMessage: true,
      title: true,
      uploadedAt: true,
    },
  });

  return {
    sources: rows.map((r) => ({
      ...r,
      uploadedAt: r.uploadedAt.toISOString(),
    })),
    dbReady: true,
  };
}

export default async function SourcesPage() {
  const { sources, dbReady } = await loadSources();

  return (
    <div className="max-w-4xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Sources</h1>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Bibliothèque de documents indexés. Formats supportés : <code className="font-mono">.md</code>,{" "}
          <code className="font-mono">.pdf</code>, <code className="font-mono">.docx</code>.
        </p>
      </header>

      {!dbReady && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          <strong>DATABASE_URL non configurée.</strong> Provisionne une base Neon, active{" "}
          <code className="font-mono">CREATE EXTENSION vector;</code>, copie l'URL dans{" "}
          <code className="font-mono">.env.local</code>, puis lance{" "}
          <code className="font-mono">npm run db:migrate</code>.
        </div>
      )}

      <SourceUploader />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-[color:var(--muted)]">
          Bibliothèque ({sources.length})
        </h2>
        <SourceList sources={sources} />
      </section>
    </div>
  );
}
