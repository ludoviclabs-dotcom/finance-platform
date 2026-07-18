"use client";

/**
 * Source Admin — détail d'une source (PR-04, BETA).
 *
 * Source + licence évaluée + fraîcheur + releases (EvidenceList) + nombre
 * d'observations. Transitions de release (validate/publish/supersede) réservées
 * aux admins (l'API renvoie 403 sinon — surfacé comme erreur, pas masqué).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  fetchObservations,
  fetchSource,
  fetchSourceFreshness,
  fetchSourceReleases,
  publishRelease,
  supersedeRelease,
  validateRelease,
  type IntelligenceSource,
  type Release,
  type SourceFreshness,
} from "@/lib/api/intelligence";
import { EvidenceList } from "@/components/intelligence/evidence-list";
import { LicenseWarning } from "@/components/intelligence/license-warning";
import { StalenessWarning } from "@/components/intelligence/staleness-warning";

type Action = "validate" | "publish" | "supersede";

export default function SourceDetailPage() {
  const params = useParams<{ id: string }>();
  const sourceId = Number(params.id);

  const [source, setSource] = useState<IntelligenceSource | null>(null);
  const [freshness, setFreshness] = useState<SourceFreshness | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [obsTotal, setObsTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const src = await fetchSource(sourceId, signal);
      setSource(src);
      const rel = await fetchSourceReleases(sourceId, { limit: 100 }, signal);
      setReleases(rel.items);
      // Fraîcheur = enrichissement : un échec ne casse pas la page.
      try {
        setFreshness(await fetchSourceFreshness(sourceId, signal));
      } catch {
        setFreshness(null);
      }
      try {
        const obs = await fetchObservations({ limit: 1 }, signal);
        setObsTotal(obs.total);
      } catch {
        setObsTotal(null);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [sourceId]);

  useEffect(() => {
    if (!Number.isFinite(sourceId)) return;
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load, sourceId]);

  const runAction = useCallback(
    async (releaseId: number, action: Action) => {
      setBusy(true);
      setActionError(null);
      try {
        if (action === "validate") await validateRelease(releaseId, true);
        else if (action === "publish") await publishRelease(releaseId);
        else await supersedeRelease(releaseId);
        await load();
      } catch (e) {
        setActionError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  if (!Number.isFinite(sourceId)) {
    return <div className="p-6 text-sm text-rose-400">Identifiant de source invalide.</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/intelligence/sources" className="text-sm text-[var(--color-muted-foreground)] hover:underline">
        ← Toutes les sources
      </Link>

      {loading && <p className="mt-4 text-sm text-[var(--color-muted-foreground)]" data-testid="detail-loading">Chargement…</p>}

      {error && !loading && (
        <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-300" role="alert">
          <p className="font-semibold mb-1">Source introuvable ou hors périmètre.</p>
          <p className="text-rose-300/80">{error}</p>
        </div>
      )}

      {!loading && !error && source && (
        <>
          <header className="mt-4 mb-6">
            <h1 className="text-2xl font-bold text-[var(--color-foreground)]">{source.title}</h1>
            <p className="text-sm text-[var(--color-muted-foreground)] mt-1">
              <span className="font-mono">{source.code}</span> · {source.publisher} ·{" "}
              {source.company_id === null ? "source globale" : "source tenant"}
            </p>
          </header>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-xl border border-[var(--color-border)] p-4">
              <h2 className="text-sm font-semibold mb-3">Licence</h2>
              <LicenseWarning
                licenseOk={freshness ? freshness.license_ok : source.active && source.automated_access_allowed && source.storage_allowed}
                allowDisplay={freshness ? freshness.allow_display : source.display_allowed}
                allowDerivedUse={freshness ? freshness.allow_derived_use : source.derived_use_allowed}
                reasons={freshness?.license_reasons}
                warnings={freshness?.license_warnings}
              />
              {source.attribution_text && (
                <p className="mt-3 text-[11px] text-[var(--color-muted-foreground)] border-t border-[var(--color-border)] pt-2">
                  {source.attribution_text}
                </p>
              )}
            </section>

            <section className="rounded-xl border border-[var(--color-border)] p-4">
              <h2 className="text-sm font-semibold mb-3">Fraîcheur</h2>
              {freshness ? (
                <>
                  <StalenessWarning
                    isStale={freshness.is_stale}
                    ageDays={freshness.age_days}
                    lastReleaseAt={freshness.last_release_at}
                  />
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-[10px] uppercase text-[var(--color-muted-foreground)]">Releases publiées</dt>
                      <dd className="font-semibold">{freshness.published_release_count}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase text-[var(--color-muted-foreground)]">Releases totales</dt>
                      <dd className="font-semibold">{freshness.total_release_count}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase text-[var(--color-muted-foreground)]">Observations</dt>
                      <dd className="font-semibold">{obsTotal ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase text-[var(--color-muted-foreground)]">Dernier statut</dt>
                      <dd className="font-semibold">{freshness.last_release_status ?? "—"}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <p className="text-sm text-[var(--color-muted-foreground)]">Fraîcheur indisponible.</p>
              )}
            </section>
          </div>

          <section className="mt-6 rounded-xl border border-[var(--color-border)] p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Releases</h2>
              {actionError && <span className="text-[11px] text-rose-400">{actionError}</span>}
            </div>
            <EvidenceList releases={releases} />

            {releases.length > 0 && (
              <div className="mt-4 border-t border-[var(--color-border)] pt-3">
                <p className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)] mb-2">
                  Transitions (admin) — dernière release #{releases[0].id} ({releases[0].status})
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={busy}
                    onClick={() => runAction(releases[0].id, "validate")}
                    className="rounded-lg border border-sky-500/40 text-sky-300 px-3 py-1.5 text-xs font-semibold hover:bg-sky-500/10 disabled:opacity-40"
                  >
                    Valider
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => runAction(releases[0].id, "publish")}
                    className="rounded-lg border border-emerald-500/40 text-emerald-300 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500/10 disabled:opacity-40"
                  >
                    Publier
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => runAction(releases[0].id, "supersede")}
                    className="rounded-lg border border-zinc-500/40 text-zinc-300 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-500/10 disabled:opacity-40"
                  >
                    Superséder
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
