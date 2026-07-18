"use client";

/**
 * Source Admin — page de fraîcheur multi-sources (PR-04, BETA).
 *
 * Compose `GET /intelligence/sources` puis `GET /intelligence/sources/{id}/freshness`
 * (les endpoints du plan §7) pour un aperçu : âge de la dernière release,
 * péremption, anomalies de licence. Aucun fallback silencieux.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchSourceFreshness,
  fetchSources,
  type SourceFreshness,
} from "@/lib/api/intelligence";
import { DataStatusBadge } from "@/components/ui/data-status-badge";

export default function FreshnessPage() {
  const [rows, setRows] = useState<SourceFreshness[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchSources({ limit: 100 }, signal);
      const fresh = await Promise.all(
        list.items.map((s) => fetchSourceFreshness(s.id, signal).catch(() => null)),
      );
      setRows(fresh.filter((f): f is SourceFreshness => f !== null));
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

  const staleCount = rows?.filter((r) => r.is_stale).length ?? 0;
  const licenseAnomalies = rows?.filter((r) => !r.license_ok).length ?? 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <header className="mb-6">
        <Link href="/intelligence/sources" className="text-sm text-[var(--color-muted-foreground)] hover:underline">
          ← Sources
        </Link>
        <h1 className="text-2xl font-bold text-[var(--color-foreground)] mt-2">Fraîcheur des sources</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Dernière release par source, âge, statut et anomalies de licence.
        </p>
      </header>

      {loading && <p className="text-sm text-[var(--color-muted-foreground)]" data-testid="freshness-loading">Chargement…</p>}

      {error && !loading && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-300" role="alert">
          <p className="font-semibold mb-1">Impossible de charger la fraîcheur.</p>
          <p className="text-rose-300/80">{error}</p>
          <button onClick={() => load()} className="mt-2 underline">Réessayer</button>
        </div>
      )}

      {!loading && !error && rows && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Stat label="Sources" value={rows.length} />
            <Stat label="Périmées" value={staleCount} tone={staleCount ? "warn" : "ok"} />
            <Stat label="Anomalies licence" value={licenseAnomalies} tone={licenseAnomalies ? "bad" : "ok"} />
          </div>

          {rows.length === 0 ? (
            <p className="text-sm text-[var(--color-muted-foreground)]" data-testid="freshness-empty">
              Aucune source à évaluer.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]" data-testid="freshness-table">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-muted)]/40">
                  <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
                    <th className="px-4 py-3 font-semibold">Source</th>
                    <th className="px-4 py-3 font-semibold">Dernière release</th>
                    <th className="px-4 py-3 font-semibold">Âge</th>
                    <th className="px-4 py-3 font-semibold">Statut</th>
                    <th className="px-4 py-3 font-semibold">État</th>
                    <th className="px-4 py-3 font-semibold">Licence</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.source_id} className="border-t border-[var(--color-border)]">
                      <td className="px-4 py-3">
                        <Link href={`/intelligence/sources/${r.source_id}`} className="font-mono text-xs hover:underline">
                          {r.code}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                        {r.last_release_key ?? "—"}
                      </td>
                      <td className="px-4 py-3">{r.age_days == null ? "—" : `${r.age_days} j`}</td>
                      <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{r.last_release_status ?? "—"}</td>
                      <td className="px-4 py-3">
                        <DataStatusBadge status={r.is_stale ? "STALE" : "VERIFIED"} label={r.is_stale ? "Périmé" : "Frais"} />
                      </td>
                      <td className="px-4 py-3">
                        <span className={r.license_ok ? "text-emerald-400" : "text-rose-400"}>
                          {r.license_ok ? "OK" : "Anomalie"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "ok" }: { label: string; value: number; tone?: "ok" | "warn" | "bad" }) {
  const cls =
    tone === "bad" ? "text-rose-400" : tone === "warn" ? "text-amber-400" : "text-[var(--color-foreground)]";
  return (
    <div className="rounded-xl border border-[var(--color-border)] p-4">
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">{label}</p>
      <p className={`text-2xl font-bold ${cls}`}>{value}</p>
    </div>
  );
}
