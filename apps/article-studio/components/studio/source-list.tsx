import Link from "next/link";

export type SourceListItem = {
  id: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  status: string;
  errorMessage: string | null;
  title: string | null;
  uploadedAt: string;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function shortMime(mime: string): string {
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("wordprocessingml")) return "docx";
  if (mime.includes("markdown")) return "md";
  return mime;
}

export function SourceList({ sources }: { sources: SourceListItem[] }) {
  if (sources.length === 0) {
    return (
      <p className="text-sm text-[color:var(--muted)]">
        Aucune source indexée pour l'instant. Dépose des fichiers ci-dessus.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[color:var(--border)] rounded border border-[color:var(--border)]">
      {sources.map((s) => (
        <li key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
          <div className="min-w-0 flex-1">
            <Link
              href={`/sources/${s.id}`}
              className="block truncate font-medium hover:underline"
            >
              {s.title ?? s.filename}
            </Link>
            <p className="mt-0.5 truncate text-xs text-[color:var(--muted)]">
              <span className="font-mono">{shortMime(s.mimeType)}</span> ·{" "}
              {formatBytes(s.byteSize)} · {new Date(s.uploadedAt).toLocaleString("fr-FR")}
            </p>
            {s.errorMessage && (
              <p className="mt-1 text-xs text-rose-300">{s.errorMessage}</p>
            )}
          </div>
          <span
            className={
              s.status === "READY"
                ? "ml-3 text-emerald-400"
                : s.status === "FAILED"
                ? "ml-3 text-rose-400"
                : "ml-3 text-[color:var(--muted)]"
            }
          >
            {s.status}
          </span>
        </li>
      ))}
    </ul>
  );
}
