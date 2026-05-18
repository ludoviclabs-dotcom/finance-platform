"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type UploadResult = {
  id?: string;
  filename: string;
  status: string;
  blockCount?: number;
  errorMessage?: string;
  deduped?: boolean;
};

const ACCEPT = ".md,.markdown,.pdf,.docx";

export function SourceUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArr = Array.from(files);
      if (fileArr.length === 0) return;

      setBusy(true);
      setError(null);
      setResults([]);

      const formData = new FormData();
      for (const f of fileArr) formData.append("file", f);

      try {
        const res = await fetch("/api/ingest", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? `Erreur ${res.status}`);
        } else {
          setResults(data.sources ?? []);
          router.refresh();
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Erreur réseau lors de l'upload.",
        );
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      if (busy) return;
      uploadFiles(e.dataTransfer.files);
    },
    [busy, uploadFiles],
  );

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={[
          "cursor-pointer rounded border border-dashed p-8 text-center text-sm transition",
          dragOver
            ? "border-[color:var(--accent)] bg-white/5"
            : "border-[color:var(--border)]",
          busy ? "pointer-events-none opacity-60" : "",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
        <p className="text-[color:var(--foreground)]">
          {busy
            ? "Parsing en cours…"
            : "Dépose un ou plusieurs fichiers .md / .pdf / .docx, ou clique pour parcourir."}
        </p>
        <p className="mt-2 text-xs text-[color:var(--muted)]">
          Taille max : 20 MB par fichier · dédup par hash du contenu parsé.
        </p>
      </div>

      {error && (
        <div className="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <ul className="space-y-2 text-sm">
          {results.map((r, i) => (
            <li
              key={r.id ?? `${r.filename}-${i}`}
              className="flex items-center justify-between rounded border border-[color:var(--border)] px-3 py-2"
            >
              <div>
                <span className="font-mono text-xs">{r.filename}</span>
                {r.deduped && (
                  <span className="ml-2 rounded bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-widest">
                    déjà indexé
                  </span>
                )}
                {r.errorMessage && (
                  <p className="mt-1 text-xs text-rose-300">{r.errorMessage}</p>
                )}
              </div>
              <span
                className={
                  r.status === "READY"
                    ? "text-emerald-400"
                    : r.status === "FAILED"
                    ? "text-rose-400"
                    : "text-[color:var(--muted)]"
                }
              >
                {r.status}
                {r.blockCount !== undefined ? ` · ${r.blockCount} blocs` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
