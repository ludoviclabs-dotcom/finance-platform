"use client";

import { useState } from "react";

interface RerankedItem {
  id: string;
  sourceId: string;
  heading: string | null;
  pageNumber: number | null;
  score: number;
  rrfScore: number;
  rerankScore: number;
  rerankProvider: string;
  content: string;
}

interface RetrieveResponse {
  query: string;
  expansion: { original: string; variants: string[] };
  reranked: RerankedItem[];
  context: { tokenCount: number; trimmed: number; citations: unknown[] };
}

interface Props {
  articleId: string;
}

export function RetrievalDebugPanel({ articleId }: Props) {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<RetrieveResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runRetrieve() {
    setBusy(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/articles/${articleId}/retrieve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(query.trim() ? { query: query.trim() } : {}),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `Erreur ${res.status}`);
        return;
      }
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded border border-white/10 bg-black/20 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-[color:var(--muted)]">
        Retrieval debug
      </h2>
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Requête custom (laisse vide pour utiliser le brief)…"
        rows={2}
        className="input"
      />
      <button
        type="button"
        onClick={runRetrieve}
        disabled={busy}
        className="rounded bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
      >
        {busy ? "Recherche…" : "Lancer la recherche RAG"}
      </button>

      {error && (
        <div className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-xs text-rose-200">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-3 text-xs">
          <details open>
            <summary className="cursor-pointer text-[color:var(--muted)]">
              Expansion ({data.expansion.variants.length + 1} requêtes)
            </summary>
            <ul className="mt-1 space-y-0.5">
              <li>
                <span className="font-medium">original:</span> {data.expansion.original}
              </li>
              {data.expansion.variants.map((v, i) => (
                <li key={i}>
                  <span className="font-medium">{i + 1}:</span> {v}
                </li>
              ))}
            </ul>
          </details>

          <div className="text-[color:var(--muted)]">
            Contexte : {data.context.tokenCount} tokens · {data.context.citations.length}{" "}
            citations · {data.context.trimmed} chunk(s) tronqué(s)
          </div>

          <ul className="space-y-2">
            {data.reranked.map((r, i) => (
              <li
                key={r.id}
                className="rounded border border-white/10 bg-white/5 p-2"
              >
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[10px] text-emerald-400">
                    S{i + 1} · {r.rerankProvider}
                  </span>
                  <span className="text-[10px] text-[color:var(--muted)]">
                    rerank={r.rerankScore.toFixed(3)} · rrf=
                    {r.rrfScore.toFixed(3)} · cos={r.score.toFixed(3)}
                  </span>
                </div>
                {r.heading && (
                  <div className="text-[11px] font-medium">{r.heading}</div>
                )}
                <p className="line-clamp-3 text-[11px] leading-relaxed text-[color:var(--muted)]">
                  {r.content.slice(0, 280)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
