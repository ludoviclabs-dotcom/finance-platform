"use client";

/**
 * Eau — ledger d'activités, permis, zones de stress et screening hydrique
 * (PR-08, BETA).
 *
 * Consomme `/water/*` + `/sites/geo`. États loading / schema_not_ready /
 * error / empty / data explicites — aucun fallback silencieux.
 *
 * Règles de présentation non négociables :
 *
 * 1. **Le risque et la confiance ne partagent jamais une carte.** Le risque
 *    (catégorie de stress des zones appariées) et la confiance (solidité du
 *    socle documentaire) sont rendus dans deux colonnes distinctes avec deux
 *    vocabulaires distincts.
 * 2. **La méthode géométrique est affichée telle quelle.**
 *    `geojson_point_in_polygon_v1` (bbox = pré-filtre) — représentation
 *    géographique SANS carte externe (aucun Mapbox, aucun PostGIS) : pas de
 *    domaine CSP à ouvrir, pas de méthode maquillée.
 * 3. **« Aucune zone appariée » n'est jamais rendu comme « risque nul ».**
 *    Le composant affiche « hors zones connues » + le warning backend.
 * 4. **`schema_not_ready` (503)** → « initialisation du schéma en cours » :
 *    la production déploie ce code AVANT l'application des migrations 036/037.
 * 5. **Licence avant affichage.** Une zone `value_withheld` montre la raison
 *    de licence, jamais un tiret ambigu ; l'attribution est affichée quand la
 *    source l'exige.
 */

import { useCallback, useEffect, useState } from "react";
import { FeatureStatusBadge } from "@/components/ui/feature-status-badge";
import {
  ACTIVITY_LABEL,
  REVIEW_LABEL,
  STRESS_LABEL,
  STRESS_TONE,
  SchemaNotReadyError,
  calculateWaterScreening,
  fetchSitesGeo,
  fetchWaterActions,
  fetchWaterActivities,
  fetchWaterPermits,
  fetchWaterRiskAreas,
  fetchWaterScreenings,
  fetchWaterTargets,
  flagScreeningForIro,
  formatM3,
  reviewWaterActivity,
  type SiteGeo,
  type WaterAction,
  type WaterActivity,
  type WaterPermit,
  type WaterRiskArea,
  type WaterScreeningSummary,
  type WaterTarget,
} from "@/lib/api/water";

type PageState = "loading" | "schema_not_ready" | "error" | "ready";

interface Bundle {
  sites: SiteGeo[];
  activities: WaterActivity[];
  permits: WaterPermit[];
  areas: WaterRiskArea[];
  screenings: WaterScreeningSummary[];
  targets: WaterTarget[];
  actions: WaterAction[];
}

const REVIEW_TONE: Record<string, string> = {
  pending: "text-amber-600 dark:text-amber-400",
  accepted: "text-emerald-600 dark:text-emerald-400",
  flagged: "text-red-600 dark:text-red-400",
};

function ReviewChip({ status }: { status: "pending" | "accepted" | "flagged" }) {
  return (
    <span
      className={`rounded border border-[var(--color-border)] px-2 py-0.5 text-xs ${REVIEW_TONE[status]}`}
      data-testid={`water-review-${status}`}
    >
      {REVIEW_LABEL[status]}
    </span>
  );
}

function MethodChip({ code }: { code: string }) {
  return (
    <span
      className="rounded border border-[var(--color-border)] px-2 py-0.5 font-mono text-xs text-[var(--color-muted-foreground)]"
      title="Méthode géométrique réellement exécutée — jamais PostGIS/ST_Intersects."
      data-testid="water-method-chip"
    >
      {code}
    </span>
  );
}

function Section({
  title,
  subtitle,
  children,
  testId,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <section className="mb-8" data-testid={testId}>
      <h2 className="text-lg font-semibold text-[var(--color-foreground)] mb-1">{title}</h2>
      {subtitle && (
        <p className="text-sm text-[var(--color-muted-foreground)] mb-3">{subtitle}</p>
      )}
      {children}
    </section>
  );
}

export default function WaterPage() {
  const [state, setState] = useState<PageState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [screeningSiteId, setScreeningSiteId] = useState<string>("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setState("loading");
    setError(null);
    try {
      const [sites, activities, permits, areas, screenings, targets, actions] =
        await Promise.all([
          fetchSitesGeo(signal),
          fetchWaterActivities(signal),
          fetchWaterPermits(signal),
          fetchWaterRiskAreas(signal),
          fetchWaterScreenings(signal),
          fetchWaterTargets(signal),
          fetchWaterActions(signal),
        ]);
      setBundle({
        sites: sites.items,
        activities: activities.items,
        permits: permits.items,
        areas: areas.items,
        screenings: screenings.items,
        targets: targets.items,
        actions: actions.items,
      });
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

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const runAction = useCallback(
    async (fn: () => Promise<unknown>, success: string) => {
      setActionMessage(null);
      try {
        await fn();
        setActionMessage(success);
        await load();
      } catch (e) {
        if (e instanceof SchemaNotReadyError) {
          setState("schema_not_ready");
          return;
        }
        setActionMessage(`Refusé : ${(e as Error).message}`);
      }
    },
    [load],
  );

  const usableSites = bundle?.sites.filter((s) => s.position_usable) ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold text-[var(--color-foreground)]">
            Eau &amp; stress hydrique
          </h1>
          <FeatureStatusBadge status="beta" />
        </div>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Prélèvements, consommations et rejets par site, permis, zones de stress
          hydrique sourcées et screening géographique auditable — sans PostGIS ni
          carte externe : la méthode exécutée est affichée telle quelle.
        </p>
      </header>

      {state === "loading" && (
        <p data-testid="water-loading" className="text-sm text-[var(--color-muted-foreground)]">
          Chargement du module eau…
        </p>
      )}

      {state === "schema_not_ready" && (
        <div
          data-testid="water-schema-not-ready"
          className="rounded border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-400"
        >
          <p className="font-semibold">Initialisation du schéma en cours</p>
          <p>
            Les migrations de base de données du module eau (036/037) ne sont pas
            encore appliquées sur cet environnement. Le module s&apos;activera
            automatiquement dès qu&apos;elles le seront — aucune donnée n&apos;est perdue.
          </p>
        </div>
      )}

      {state === "error" && (
        <div
          data-testid="water-error"
          className="rounded border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400"
        >
          <p className="font-semibold">Module eau indisponible</p>
          <p>{error}</p>
        </div>
      )}

      {state === "ready" && bundle && (
        <div data-testid="water-content">
          {actionMessage && (
            <p
              data-testid="water-action-message"
              className="mb-4 rounded border border-[var(--color-border)] p-3 text-sm text-[var(--color-foreground)]"
            >
              {actionMessage}
            </p>
          )}

          {/* ---- Screening : risque et confiance SÉPARÉS ---- */}
          <Section
            testId="water-screenings"
            title="Screenings hydriques"
            subtitle="Résultats versionnés et immuables. Le risque (zones appariées) et la confiance (solidité du socle : précision du géocodage, fraîcheur des données) sont deux axes distincts — jamais fusionnés."
          >
            <form
              className="mb-3 flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                const siteId = Number(screeningSiteId);
                if (!siteId) return;
                runAction(
                  () => calculateWaterScreening(siteId),
                  "Screening calculé — nouveau run enregistré.",
                );
              }}
            >
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-[var(--color-muted-foreground)]">
                  Site (position acceptée uniquement — gate de revue)
                </span>
                <select
                  value={screeningSiteId}
                  onChange={(e) => setScreeningSiteId(e.target.value)}
                  className="rounded border border-[var(--color-border)] bg-transparent px-3 py-1.5 text-sm text-[var(--color-foreground)]"
                  aria-label="Site à screener"
                  data-testid="water-screening-site"
                >
                  <option value="">— choisir un site géocodé accepté —</option>
                  {usableSites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={!screeningSiteId}
                className="rounded border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-foreground)] disabled:opacity-50"
              >
                Lancer un screening
              </button>
              {usableSites.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Aucun site n&apos;a de position acceptée : passez d&apos;abord par la
                  revue de géocodage (page « Sites &amp; géocodage »).
                </p>
              )}
            </form>

            {bundle.screenings.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]" data-testid="water-screenings-empty">
                Aucun screening enregistré.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                      <th className="py-2 pr-3">Site</th>
                      <th className="py-2 pr-3">Risque (zones appariées)</th>
                      <th className="py-2 pr-3">Confiance (documentation)</th>
                      <th className="py-2 pr-3">Méthode</th>
                      <th className="py-2 pr-3">Avertissements</th>
                      <th className="py-2 pr-3">Signal IRO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bundle.screenings.map((s) => (
                      <tr key={s.id} className="border-b border-[var(--color-border)]/60 align-top">
                        <td className="py-2 pr-3 text-[var(--color-foreground)]">
                          #{s.site_id}
                          <span className="block text-xs text-[var(--color-muted-foreground)]">
                            {new Date(s.calculated_at).toLocaleString("fr-FR")}
                          </span>
                        </td>
                        <td className="py-2 pr-3">
                          {s.risk_category ? (
                            <span className={`font-semibold ${STRESS_TONE[s.risk_category]}`}>
                              {STRESS_LABEL[s.risk_category]}
                            </span>
                          ) : (
                            <span
                              className="text-[var(--color-muted-foreground)]"
                              title="Aucune zone du référentiel n'apparie ce site — ce n'est PAS un risque nul."
                              data-testid="water-no-match"
                            >
                              Hors zones connues (≠ risque nul)
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-[var(--color-foreground)]">
                          {s.confidence !== null ? `${Math.round(s.confidence)} / 100` : "n. d."}
                        </td>
                        <td className="py-2 pr-3">
                          <MethodChip code={s.method_code} />
                        </td>
                        <td className="py-2 pr-3 text-xs text-amber-600 dark:text-amber-400">
                          {s.warnings.length === 0 ? "—" : (
                            <ul className="list-disc pl-4">
                              {s.warnings.map((w, i) => (
                                <li key={i}>{String(w)}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {s.iro_signal ? (
                            <span
                              className="text-xs text-purple-600 dark:text-purple-400"
                              title={s.iro_signal_rationale ?? undefined}
                              data-testid="water-iro-flagged"
                            >
                              À examiner comme IRO
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="rounded border border-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-foreground)]"
                              data-testid="water-iro-button"
                              onClick={() => {
                                const rationale = window.prompt(
                                  "Justification du signal IRO (obligatoire) — ce signal n'est PAS une décision de matérialité :",
                                );
                                if (!rationale) return;
                                runAction(
                                  () => flagScreeningForIro(s.id, rationale),
                                  "Signal IRO posé — la promotion en IRO reste un geste humain séparé.",
                                );
                              }}
                            >
                              Signaler comme IRO candidat
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* ---- Activités ---- */}
          <Section
            testId="water-activities"
            title="Activités eau"
            subtitle="Prélèvements, consommations, rejets — import CSV idempotent, chaque ligne gatée par revue humaine."
          >
            {bundle.activities.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">Aucune activité enregistrée.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                      <th className="py-2 pr-3">Site</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">Source</th>
                      <th className="py-2 pr-3">Volume</th>
                      <th className="py-2 pr-3">Période</th>
                      <th className="py-2 pr-3">Revue</th>
                      <th className="py-2 pr-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {bundle.activities.map((a) => (
                      <tr key={a.id} className="border-b border-[var(--color-border)]/60">
                        <td className="py-2 pr-3 text-[var(--color-foreground)]">#{a.site_id}</td>
                        <td className="py-2 pr-3 text-[var(--color-foreground)]">
                          {ACTIVITY_LABEL[a.activity_type]}
                        </td>
                        <td className="py-2 pr-3 text-[var(--color-muted-foreground)]">{a.source_type}</td>
                        <td className="py-2 pr-3 font-mono text-[var(--color-foreground)]">
                          {formatM3(a.quantity_m3)}
                        </td>
                        <td className="py-2 pr-3 text-[var(--color-muted-foreground)]">
                          {a.period_start} → {a.period_end}
                        </td>
                        <td className="py-2 pr-3">
                          <ReviewChip status={a.review_status} />
                        </td>
                        <td className="py-2 pr-3">
                          {a.review_status === "pending" && (
                            <span className="flex gap-1">
                              <button
                                type="button"
                                className="rounded border border-[var(--color-border)] px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400"
                                onClick={() =>
                                  runAction(
                                    () => reviewWaterActivity(a.id, true),
                                    "Activité acceptée.",
                                  )
                                }
                              >
                                Accepter
                              </button>
                              <button
                                type="button"
                                className="rounded border border-[var(--color-border)] px-2 py-0.5 text-xs text-red-600 dark:text-red-400"
                                onClick={() =>
                                  runAction(
                                    () => reviewWaterActivity(a.id, false),
                                    "Activité signalée.",
                                  )
                                }
                              >
                                Signaler
                              </button>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* ---- Permis ---- */}
          <Section
            testId="water-permits"
            title="Permis"
            subtitle="Autorisations administratives de prélèvement/rejet — la preuve est une pièce Evidence Kernel."
          >
            {bundle.permits.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">Aucun permis enregistré.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {bundle.permits.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center gap-2 rounded border border-[var(--color-border)] p-3"
                  >
                    <span className="font-medium text-[var(--color-foreground)]">
                      {p.permit_reference ?? `Permis #${p.id}`}
                    </span>
                    <span className="text-[var(--color-muted-foreground)]">
                      {p.permit_type} · site #{p.site_id}
                      {p.authorized_volume_m3 !== null && ` · ${formatM3(p.authorized_volume_m3)} autorisés`}
                      {p.valid_to && ` · valide jusqu'au ${p.valid_to}`}
                    </span>
                    <ReviewChip status={p.review_status} />
                    {p.evidence_artifact_id !== null ? (
                      <span className="text-xs text-[var(--color-muted-foreground)]">
                        Preuve : artefact #{p.evidence_artifact_id}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        Sans pièce justificative
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* ---- Zones de stress (référentiel sourcé, licence surfacée) ---- */}
          <Section
            testId="water-risk-areas"
            title="Zones de stress hydrique enregistrées"
            subtitle="Référentiel sourcé (Evidence Kernel) — ingestion par CLI d'administration uniquement, licence évaluée à l'usage."
          >
            {bundle.areas.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                Aucune zone enregistrée : le screening refusera explicitement un
                référentiel vide (ce ne serait pas un risque nul).
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {bundle.areas.map((z) => (
                  <li
                    key={z.id}
                    className="rounded border border-[var(--color-border)] p-3"
                    data-testid="water-area-row"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-[var(--color-foreground)]">{z.label}</span>
                      <span className="font-mono text-xs text-[var(--color-muted-foreground)]">{z.code}</span>
                      <span className="text-xs text-[var(--color-muted-foreground)]">
                        {z.area_kind} · scénario {z.scenario_code}
                        {z.company_id === null && " · référentiel partagé"}
                      </span>
                      {z.value_withheld ? (
                        <span
                          className="text-xs text-amber-600 dark:text-amber-400"
                          data-testid="water-area-withheld"
                          title={z.license_reasons.join(" ; ")}
                        >
                          Catégorie non affichable (licence de la source)
                        </span>
                      ) : (
                        z.baseline_stress_category && (
                          <span className={`text-xs font-semibold ${STRESS_TONE[z.baseline_stress_category]}`}>
                            Stress : {STRESS_LABEL[z.baseline_stress_category]}
                          </span>
                        )
                      )}
                    </div>
                    {z.attribution_text && (
                      <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                        Source : {z.attribution_text}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* ---- Cibles et actions ---- */}
          <Section
            testId="water-targets-actions"
            title="Cibles et actions eau"
            subtitle="Les réductions attendues sont des intentions déclarées — jamais soustraites automatiquement d'un résultat de screening."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-[var(--color-foreground)]">Cibles</h3>
                {bundle.targets.length === 0 ? (
                  <p className="text-sm text-[var(--color-muted-foreground)]">Aucune cible.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {bundle.targets.map((t) => (
                      <li key={t.id} className="rounded border border-[var(--color-border)] p-3">
                        <span className="font-medium text-[var(--color-foreground)]">{t.title}</span>
                        <span className="block text-xs text-[var(--color-muted-foreground)]">
                          {t.baseline_year ?? "?"} → {t.target_year ?? "?"} ·{" "}
                          {formatM3(t.baseline_value_m3)} → {formatM3(t.target_value_m3)}
                        </span>
                        <ReviewChip status={t.review_status} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-[var(--color-foreground)]">Actions</h3>
                {bundle.actions.length === 0 ? (
                  <p className="text-sm text-[var(--color-muted-foreground)]">Aucune action.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {bundle.actions.map((a) => (
                      <li key={a.id} className="rounded border border-[var(--color-border)] p-3">
                        <span className="font-medium text-[var(--color-foreground)]">{a.title}</span>
                        <span className="block text-xs text-[var(--color-muted-foreground)]">
                          {a.action_type} · {a.status}
                          {a.expected_reduction_m3 !== null &&
                            ` · effet attendu (déclaratif) : ${formatM3(a.expected_reduction_m3)}`}
                        </span>
                        <ReviewChip status={a.review_status} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
