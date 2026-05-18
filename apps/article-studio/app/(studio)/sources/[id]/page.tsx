import { notFound } from "next/navigation";
import Link from "next/link";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { Block } from "@/lib/types/source";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

function blocksFromMetadata(metadata: unknown): Block[] {
  if (
    metadata &&
    typeof metadata === "object" &&
    "blocks" in metadata &&
    Array.isArray((metadata as { blocks: unknown }).blocks)
  ) {
    return (metadata as { blocks: Block[] }).blocks;
  }
  return [];
}

export default async function SourceDetailPage({ params }: Props) {
  if (!env.database.ready) {
    return (
      <div className="max-w-3xl">
        <p className="text-sm text-amber-200">
          DATABASE_URL n'est pas configurée — impossible de charger cette source.
        </p>
      </div>
    );
  }

  const { id } = await params;
  const source = await db.source.findUnique({ where: { id } });
  if (!source) notFound();

  const blocks = blocksFromMetadata(source.metadata);

  return (
    <div className="max-w-4xl space-y-8">
      <header>
        <Link
          href="/sources"
          className="text-xs text-[color:var(--muted)] hover:underline"
        >
          ← Sources
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{source.title ?? source.filename}</h1>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          <span className="font-mono">{source.mimeType}</span> · {source.byteSize} octets ·
          statut{" "}
          <span
            className={
              source.status === "READY"
                ? "text-emerald-400"
                : source.status === "FAILED"
                ? "text-rose-400"
                : "text-[color:var(--muted)]"
            }
          >
            {source.status}
          </span>
        </p>
        {source.errorMessage && (
          <p className="mt-2 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {source.errorMessage}
          </p>
        )}
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-[color:var(--muted)]">
          Blocs parsés ({blocks.length})
        </h2>
        {blocks.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">Aucun bloc parsé.</p>
        ) : (
          <ol className="space-y-3">
            {blocks.map((b, i) => (
              <li
                key={i}
                className="rounded border border-[color:var(--border)] px-3 py-2 text-sm"
              >
                <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-widest text-[color:var(--muted)]">
                  <span>{b.kind}</span>
                  {b.level !== undefined && <span>H{b.level}</span>}
                  {b.page !== undefined && <span>p. {b.page}</span>}
                </div>
                <p
                  className={
                    b.kind === "heading"
                      ? "font-semibold"
                      : b.kind === "code"
                      ? "whitespace-pre-wrap font-mono text-xs"
                      : ""
                  }
                >
                  {b.text || <em className="text-[color:var(--muted)]">(vide)</em>}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
