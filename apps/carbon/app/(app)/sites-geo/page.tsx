"use client";

/**
 * Sites & géocodage — revue humaine des positions de sites (PR-08, BETA).
 *
 * Consomme `/sites/geo` + `/sites/{id}/geocode-candidates`. Représentation
 * géographique SANS carte externe (coordonnées, précision, statut de revue) :
 * aucun Mapbox, aucun domaine CSP à ouvrir, aucun PostGIS.
 *
 * Gate non négociable, visible dans l'UI : une coordonnée proposée — y compris
 * une saisie MANUELLE (`manual_coordinates_v1`) — n'est jamais utilisable tant
 * qu'un analyste ne l'a pas explicitement ACCEPTÉE. Un candidat revu ne se
 * modifie plus (append-only) : corriger = proposer un nouveau candidat.
 *
 * `schema_not_ready` (503) → « initialisation du schéma en cours » (la
 * production déploie ce code avant l'application de la migration 036).
 */

import { useCallback, useEffect, useState } from "react";
import { FeatureStatusBadge } from "@/components/ui/feature-status-badge";
import {
  REVIEW_LABEL,
  SchemaNotReadyError,
  fetchGeocodeCandidates,
  fetchSitesGeo,
  proposeGeocodeCandidate,
  reviewGeocodeCandidate,
  type GeocodeCandidate,
  type GeocodePrecision,
  type SiteGeo,
} from "@/lib/api/water";

type PageState = "loading" | "schema_not_ready" | "error" | "ready";

const REVIEW_TONE: Record<string, string> = {
  pending: "text-amber-600 dark:text-amber-400",
  accepted: "text-emerald-600 dark:text-emerald-400",
  flagged: "text-red-600 dark:text-red-400",
};

const CANDIDATE_LABEL: Record<string, string> = {
  proposed: "Proposé",
  accepted: "Accepté",
  rejected: "Rejeté",
};

export default function SitesGeoPage() {
  const [state, setState] = useState<PageState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [sites, setSites] = useState<SiteGeo[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [candidates, setCandidates] = useState<GeocodeCandidate[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({ latitude: "", longitude: "", precision: "manual" });

  const load = useCallback(async (signal?: AbortSignal) => {
    setState("loading");
    setError(null);
    try {
      const listing = await fetchSitesGeo(signal);
      setSites(listing.items);
      setState("ready");
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      if (e instanceof SchemaNotReadyError) {
        setState("schema_not_ready");
        return;
      }
      setError((e as Error).message);
      setState("error");
    }
  }, []);

  const loadCandidates = useCallback(async (siteId: number) => {
    try {
      const listing = await fetchGeocodeCandidates(siteId);
      setCandidates(listing.items);
    } catch (e) {
      if (e instanceof SchemaNotReadyError) {
        setState("schema_not_ready");
        return;
      }
      setMessage(`Refusé : ${(e as Error).message}`);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  useEffect(() => {
    if (selectedSiteId !== null) loadCandidates(selectedSiteId);
  }, [selectedSiteId, loadCandidates]);

  const refresh = useCallback(async () => {
    await load();
    if (selectedSiteId !== null) await loadCandidates(selectedSiteId);
  }, [load, loadCandidates, selectedSiteId]);

  const selected = sites.find((s) => s.id === selectedSiteId) ?? null;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold text-[var(--color-foreground)]">
            Sites &amp; géocodage
          </h1>
          <FeatureStatusBadge status="beta" />
        </div>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Position géographique des sites avec gate de revue humaine : aucune
          coordonnée — même saisie à la main — n&apos;entre dans un calcul avant
          d&apos;être explicitement acceptée par un analyste.
        </p>
      </header>

      {state === "loading" && (
        <p data-testid="sites-geo-loading" className="text-sm text-[var(--color-muted-foreground)]">
          Chargement des sites…
        </p>
      )}

      {state === "schema_not_ready" && (
        <div
          data-testid="sites-geo-schema-not-ready"
          className="rounded border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-400"
        >
          <p className="font-semibold">Initialisation du schéma en cours</p>
          <p>
            La migration géospatiale (036) n&apos;est pas encore appliquée sur cet
            environnement. La page s&apos;activera automatiquement dès qu&apos;elle le sera.
          </p>
        </div>
      )}

      {state === "error" && (
        <div
          data-testid="sites-geo-error"
          className="rounded border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400"
        >
          <p className="font-semibold">Page indisponible</p>
          <p>{error}</p>
        </div>
      )}

      {state === "ready" && (
        <div data-testid="sites-geo-content" className="grid gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-2 text-lg font-semibold text-[var(--color-foreground)]">Sites</h2>
            {sites.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                Aucun site — créez d&apos;abord vos implantations physiques.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {sites.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedSiteId(s.id)}
                      className={`w-full rounded border p-3 text-left ${
                        selectedSiteId === s.id
                          ? "border-[var(--color-foreground)]"
                          : "border-[var(--color-border)]"
                      }`}
                      data-testid={`sites-geo-site-${s.id}`}
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-[var(--color-foreground)]">{s.name}</span>
                        <span
                          className={`rounded border border-[var(--color-border)] px-2 py-0.5 text-xs ${REVIEW_TONE[s.geocode_review_status]}`}
                        >
                          {REVIEW_LABEL[s.geocode_review_status]}
                        </span>
                        {s.position_usable ? (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400">
                            Utilisable pour le screening
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--color-muted-foreground)]">
                            Hors calculs tant que non acceptée
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block font-mono text-xs text-[var(--color-muted-foreground)]">
                        {s.latitude !== null && s.longitude !== null
                          ? `${s.latitude.toFixed(5)}, ${s.longitude.toFixed(5)} (${s.geocode_precision ?? "précision inconnue"})`
                          : "Pas de coordonnées acceptées"}
                        {s.location && ` — ${s.location}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-[var(--color-foreground)]">
              Candidats de géocodage
              {selected && (
                <span className="ml-2 text-sm font-normal text-[var(--color-muted-foreground)]">
                  — {selected.name}
                </span>
              )}
            </h2>

            {message && (
              <p
                data-testid="sites-geo-message"
                className="mb-3 rounded border border-[var(--color-border)] p-2 text-sm text-[var(--color-foreground)]"
              >
                {message}
              </p>
            )}

            {selected === null ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                Sélectionnez un site pour voir l&apos;historique (append-only) de ses
                propositions de position.
              </p>
            ) : (
              <>
                <form
                  className="mb-4 flex flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const lat = Number(form.latitude);
                    const lon = Number(form.longitude);
                    if (Number.isNaN(lat) || Number.isNaN(lon)) {
                      setMessage("Refusé : latitude/longitude numériques requises.");
                      return;
                    }
                    setMessage(null);
                    proposeGeocodeCandidate(selected.id, {
                      latitude: lat,
                      longitude: lon,
                      precision: form.precision as GeocodePrecision,
                    })
                      .then(() => {
                        setMessage(
                          "Candidat proposé — il reste inutilisable tant qu'il n'est pas accepté.",
                        );
                        refresh();
                      })
                      .catch((err: Error) => {
                        if (err instanceof SchemaNotReadyError) setState("schema_not_ready");
                        else setMessage(`Refusé : ${err.message}`);
                      });
                  }}
                >
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-[var(--color-muted-foreground)]">Latitude</span>
                    <input
                      value={form.latitude}
                      onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                      className="w-28 rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-sm text-[var(--color-foreground)]"
                      aria-label="Latitude"
                      data-testid="sites-geo-lat"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-[var(--color-muted-foreground)]">Longitude</span>
                    <input
                      value={form.longitude}
                      onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                      className="w-28 rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-sm text-[var(--color-foreground)]"
                      aria-label="Longitude"
                      data-testid="sites-geo-lon"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-[var(--color-muted-foreground)]">Précision</span>
                    <select
                      value={form.precision}
                      onChange={(e) => setForm({ ...form, precision: e.target.value })}
                      className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-sm text-[var(--color-foreground)]"
                      aria-label="Précision"
                    >
                      <option value="exact">exact</option>
                      <option value="street">street</option>
                      <option value="city">city</option>
                      <option value="manual">manual</option>
                    </select>
                  </label>
                  <button
                    type="submit"
                    className="rounded border border-[var(--color-border)] px-3 py-1 text-sm font-medium text-[var(--color-foreground)]"
                    data-testid="sites-geo-propose"
                  >
                    Proposer (même gate que tout géocodeur)
                  </button>
                </form>

                {candidates.length === 0 ? (
                  <p className="text-sm text-[var(--color-muted-foreground)]">
                    Aucun candidat pour ce site.
                  </p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {candidates.map((c) => (
                      <li
                        key={c.id}
                        className="rounded border border-[var(--color-border)] p-3"
                        data-testid={`sites-geo-candidate-${c.id}`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[var(--color-foreground)]">
                            {c.latitude.toFixed(5)}, {c.longitude.toFixed(5)}
                          </span>
                          <span className="text-xs text-[var(--color-muted-foreground)]">
                            {c.precision ?? "précision inconnue"} · {c.provider}
                          </span>
                          <span className="rounded border border-[var(--color-border)] px-2 py-0.5 font-mono text-xs text-[var(--color-muted-foreground)]">
                            {c.method_code}
                          </span>
                          <span className={`text-xs ${REVIEW_TONE[c.status === "proposed" ? "pending" : c.status === "accepted" ? "accepted" : "flagged"]}`}>
                            {CANDIDATE_LABEL[c.status]}
                          </span>
                        </div>
                        {c.status === "proposed" && (
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              className="rounded border border-[var(--color-border)] px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400"
                              data-testid={`sites-geo-accept-${c.id}`}
                              onClick={() =>
                                reviewGeocodeCandidate(selected.id, c.id, true)
                                  .then(() => {
                                    setMessage("Candidat accepté — position promue sur le site.");
                                    refresh();
                                  })
                                  .catch((err: Error) => setMessage(`Refusé : ${err.message}`))
                              }
                            >
                              Accepter
                            </button>
                            <button
                              type="button"
                              className="rounded border border-[var(--color-border)] px-2 py-0.5 text-xs text-red-600 dark:text-red-400"
                              onClick={() =>
                                reviewGeocodeCandidate(selected.id, c.id, false)
                                  .then(() => {
                                    setMessage("Candidat rejeté — le site reste inchangé.");
                                    refresh();
                                  })
                                  .catch((err: Error) => setMessage(`Refusé : ${err.message}`))
                              }
                            >
                              Rejeter
                            </button>
                          </div>
                        )}
                        {c.review_note && (
                          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                            Note de revue : {c.review_note}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
