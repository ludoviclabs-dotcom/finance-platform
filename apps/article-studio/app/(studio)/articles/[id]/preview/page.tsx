import { notFound } from "next/navigation";
import Link from "next/link";

import { env } from "@/lib/env";
import { exportArticle } from "@/lib/export";
import { ExportMenu } from "@/components/studio/export-menu";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ArticlePreviewPage({ params }: PageProps) {
  const { id } = await params;

  if (!env.database.ready) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold">Aperçu</h1>
        <p className="mt-3 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          <strong>DATABASE_URL non configurée.</strong>
        </p>
      </div>
    );
  }

  let html: string;
  try {
    // We re-use the HTML exporter to render the in-app preview — that way
    // what the user sees here is byte-for-byte what they'll get on download.
    const result = await exportArticle(id, "html");
    html = typeof result.body === "string" ? result.body : result.body.toString("utf8");
  } catch (err) {
    if (err instanceof Error && err.message.includes("introuvable")) {
      notFound();
    }
    throw err;
  }

  return (
    <div className="grid max-w-7xl gap-8 lg:grid-cols-[1fr_18rem]">
      <main className="space-y-4">
        <header className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Aperçu</h1>
          <Link
            href={`/articles/${id}/edit`}
            className="text-sm text-[color:var(--muted)] hover:text-white"
          >
            ← retour à l'éditeur
          </Link>
        </header>
        <div className="rounded border border-white/10 bg-white">
          <iframe
            title="Aperçu de l'article"
            srcDoc={html}
            className="h-[78vh] w-full rounded"
          />
        </div>
      </main>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <ExportMenu articleId={id} />
      </aside>
    </div>
  );
}
