"use client";

/**
 * Source Admin — liste des sources d'intelligence (PR-04, feature BETA).
 *
 * Consomme `GET /intelligence/sources` (PR-03). États loading / empty / error
 * explicites, aucun fallback silencieux. Lien vers le détail de chaque source
 * et vers la page de fraîcheur.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchSources, type IntelligenceSource } from "@/lib/api/intelligence";
import { FeatureStatusBadge } from "@/components/ui/feature-status-badge";

const TYPE_LABEL: Record<string, string> = {
  api: "API",
  file: "Fichier",
  webpage: "Page web",
  manual: "Manuel",
  licensed_feed: "Flux licencié",
};

export default function IntelligenceSourcesPage() {
  const [sources, setSources] = useState<IntelligenceSource[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSources({ limit: 200 }, signal);
      setSources(res.items);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-[var(--color-foreground)]">Sources d&apos;intelligence</h1>
            <FeatureStatusBadge status="beta" />
          </div>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Registre des sources, releases et licences (noyau de preuve). Gestion interne.
          </p>
        </div>
        <Link
          href="/intelligence/freshness"
          className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-semibold hover:border-emerald-500/50 transition"
        >
          Fraîcheur des sources →
        </Link>
      </header>

      {loading && <p className="text-sm text-[var(--color-muted-foreground)]" data-testid="sources-loading">Chargement…</p>}

      {error && !loading && (
        <div
          className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-300"
          role="alert"
          data-testid="sources-error"
        >
          <p className="font-semibold mb-1">Impossible de charger les sources.</p>
          <p className="text-rose-300/80">{error}</p>
          <button onClick={() => load()} className="mt-2 underline hover:no-underline">Réessayer</button>
        </div>
      )}

      {!loading && !error && sources && sources.length === 0 && (
        <div
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-6 text-sm text-[var(--color-muted-foreground)]"
          data-testid="sources-empty"
        >
          Aucune source enregistrée pour ce périmètre. Les sources globales (ex. le snapshot de démonstration)
          apparaissent ici une fois importées via le CLI d&apos;administration.
        </div>
      )}

      {!loading && !error && sources && sources.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]" data-testid="sources-table">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-muted)]/40">
              <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Éditeur</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Portée</th>
                <th className="px-4 py-3 font-semibold">Affichage</th>
                <th className="px-4 py-3 font-semibold">État</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{s.code}</td>
                  <td className="px-4 py-3">{s.publisher}</td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                    {TYPE_LABEL[s.source_type] ?? s.source_type}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
                      {s.company_id === null ? "Globale" : "Tenant"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={s.display_allowed ? "text-emerald-400" : "text-rose-400"}>
                      {s.display_allowed ? "Autorisé" : "Interdit"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={s.active ? "text-emerald-400" : "text-zinc-500"}>
                      {s.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/intelligence/sources/${s.id}`}
                      className="text-emerald-500 hover:underline font-medium"
                    >
                      Détail →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
