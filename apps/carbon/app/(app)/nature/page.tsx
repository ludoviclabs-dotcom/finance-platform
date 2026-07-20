"use client";

/**
 * Nature — biodiversité, TNFD LEAP, risques et opportunités nature (PR-09, BETA).
 *
 * Consomme `/nature/*`. États loading / schema_not_ready / error / ready
 * explicites — aucun fallback silencieux (même discipline que `/water`, PR-08).
 *
 * Règles de présentation non négociables :
 *
 * 1. **Locate est un FAIT, jamais une conclusion.** Une intersection montre
 *    `matched`/`method_code` tels quels — aucun habillage en « risque ».
 * 2. **Dépendances et impacts ne partagent JAMAIS une carte.** Deux sections
 *    visuellement distinctes, deux vocabulaires distincts (TNFD : dépendre
 *    d'un service écosystémique ≠ impacter un écosystème).
 * 3. **Risques et opportunités ne partagent JAMAIS une carte**, même
 *    discipline. `risk_score`/`opportunity_score`, `likelihood` et
 *    `confidence` sont rendus comme TROIS valeurs séparées, jamais combinées.
 * 4. **Le bandeau « brouillon, non certifié » reste visible en permanence**
 *    sur tout brouillon TNFD — jamais masquable, jamais conditionnel.
 * 5. **Masquage des zones sensibles.** Une ligne du référentiel
 *    `confidential`/`restricted` affiche « géométrie masquée », jamais une
 *    coordonnée approchée qui laisserait deviner la position réelle.
 * 6. **`schema_not_ready` (503)** → « initialisation du schéma en cours » :
 *    la production déploie ce code AVANT l'application des migrations 038/039.
 */

import { useCallback, useEffect, useState } from "react";
import { FeatureStatusBadge } from "@/components/ui/feature-status-badge";
import { fetchSitesGeo, type SiteGeo } from "@/lib/api/water";
import {
  ACTION_STATUS_LABEL,
  FEATURE_KIND_LABEL,
  IMPACT_KIND_LABEL,
  LEAP_PHASE_LABEL,
  QUALITATIVE_LABEL,
  QUALITATIVE_TONE,
  REVIEW_LABEL,
  SchemaNotReadyError,
  advanceLeapPhase,
  createLeapAssessment,
  fetchDisclosureDrafts,
  fetchLeapAssessments,
  fetchNatureActions,
  fetchNatureDependencies,
  fetchNatureFeatures,
  fetchNatureImpacts,
  fetchNatureOpportunities,
  fetchNatureRisks,
  locateSite,
  reviewLeapAssessment,
  reviewNatureDependency,
  reviewNatureImpact,
  type LeapAssessment,
  type LeapPhase,
  type NatureAction,
  type NatureDependency,
  type NatureFeature,
  type NatureImpact,
  type NatureOpportunitySummary,
  type NatureRiskSummary,
  type ReviewStatus,
  type TnfdDisclosureDraft,
} from "@/lib/api/nature";

type PageState = "loading" | "schema_not_ready" | "error" | "ready";

interface Bundle {
  features: NatureFeature[];
  sites: SiteGeo[];
  assessments: LeapAssessment[];
  dependencies: NatureDependency[];
  impacts: NatureImpact[];
  risks: NatureRiskSummary[];
  opportunities: NatureOpportunitySummary[];
  actions: NatureAction[];
  drafts: TnfdDisclosureDraft[];
}

const LEAP_PHASES: LeapPhase[] = ["locate", "evaluate", "assess", "prepare", "completed"];

const REVIEW_TONE: Record<ReviewStatus, string> = {
  pending: "text-amber-600 dark:text-amber-400",
  accepted: "text-emerald-600 dark:text-emerald-400",
  flagged: "text-red-600 dark:text-red-400",
};

function ReviewChip({ status }: { status: ReviewStatus }) {
  return (
    <span
      className={`rounded border border-[var(--color-border)] px-2 py-0.5 text-xs ${REVIEW_TONE[status]}`}
      data-testid={`nature-review-${status}`}
    >
      {REVIEW_LABEL[status]}
    </span>
  );
}

function QualitativeChip({ level }: { level: "low" | "medium" | "high" | "critical" | null }) {
  if (level === null) {
    return <span className="text-xs text-[var(--color-muted-foreground)]">n. d.</span>;
  }
  return <span className={`font-semibold ${QUALITATIVE_TONE[level]}`}>{QUALITATIVE_LABEL[level]}</span>;
}

/** Timeline LEAP — 4 phases visuellement étagées, la phase courante en évidence. */
function LeapTimeline({ phase }: { phase: LeapPhase }) {
  const currentIndex = LEAP_PHASES.indexOf(phase);
  return (
    <ol className="flex flex-wrap items-center gap-2" data-testid="nature-leap-timeline">
      {LEAP_PHASES.map((p, i) => {
        const isCurrent = p === phase;
        const isDone = i < currentIndex;
        return (
          <li key={p} className="flex items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                isCurrent
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                  : isDone
                    ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                    : "border-[var(--color-border)] text-[var(--color-muted-foreground)]"
              }`}
              data-testid={`nature-leap-phase-${p}`}
            >
              {LEAP_PHASE_LABEL[p]}
            </span>
            {i < LEAP_PHASES.length - 1 && (
              <span className="text-[var(--color-muted-foreground)]">→</span>
            )}
          </li>
        );
      })}
    </ol>
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
      {subtitle && <p className="text-sm text-[var(--color-muted-foreground)] mb-3">{subtitle}</p>}
      {children}
    </section>
  );
}

export default function NaturePage() {
  const [state, setState] = useState<PageState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [newAssessmentLabel, setNewAssessmentLabel] = useState("");
  const [locateSiteId, setLocateSiteId] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    setState("loading");
    setError(null);
    try {
      const [features, sites, assessments, dependencies, impacts, risks, opportunities, actions, drafts] =
        await Promise.all([
          fetchNatureFeatures(signal),
          fetchSitesGeo(signal),
          fetchLeapAssessments(signal),
          fetchNatureDependencies(signal),
          fetchNatureImpacts(signal),
          fetchNatureRisks(undefined, signal),
          fetchNatureOpportunities(undefined, signal),
          fetchNatureActions(undefined, signal),
          fetchDisclosureDrafts(undefined, signal),
        ]);
      setBundle({
        features: features.items,
        sites: sites.items,
        assessments: assessments.items,
        dependencies: dependencies.items,
        impacts: impacts.items,
        risks: risks.items,
        opportunities: opportunities.items,
        actions: actions.items,
        drafts: drafts.items,
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

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold text-[var(--color-foreground)]">
            Nature &amp; biodiversité (TNFD LEAP)
          </h1>
          <FeatureStatusBadge status="beta" />
        </div>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Localiser, évaluer, analyser et préparer — Locate/Evaluate/Assess/Prepare
          (LEAP) repris comme structuration de processus, jamais comme label de
          conformité officielle. Proximité géographique, dépendance, impact et
          risque restent des notions strictement distinctes.
        </p>
      </header>

      {state === "loading" && (
        <p data-testid="nature-loading" className="text-sm text-[var(--color-muted-foreground)]">
          Chargement du module nature…
        </p>
      )}

      {state === "schema_not_ready" && (
        <div
          data-testid="nature-schema-not-ready"
          className="rounded border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-400"
        >
          <p className="font-semibold">Initialisation du schéma en cours</p>
          <p>
            Les migrations de base de données du module nature (038/039) ne sont
            pas encore appliquées sur cet environnement. Le module s&apos;activera
            automatiquement dès qu&apos;elles le seront — aucune donnée n&apos;est perdue.
          </p>
        </div>
      )}

      {state === "error" && (
        <div
          data-testid="nature-error"
          className="rounded border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400"
        >
          <p className="font-semibold">Module nature indisponible</p>
          <p>{error}</p>
        </div>
      )}

      {state === "ready" && bundle && (
        <div data-testid="nature-content">
          {actionMessage && (
            <p
              data-testid="nature-action-message"
              className="mb-4 rounded border border-[var(--color-border)] p-3 text-sm text-[var(--color-foreground)]"
            >
              {actionMessage}
            </p>
          )}

          {/* ---- Référentiel nature_features : masquage par sensibilité ---- */}
          <Section
            testId="nature-features"
            title="Référentiel d'éléments naturels"
            subtitle="Aires protégées, zones clés pour la biodiversité (KBA), écosystèmes — toujours sourcés. Une ligne confidential/restricted masque sa géométrie précise, quel que soit le rôle consultant cette liste."
          >
            {bundle.features.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">Aucun élément enregistré.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                      <th className="py-2 pr-3">Code</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">Sensibilité</th>
                      <th className="py-2 pr-3">Géométrie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bundle.features.map((f) => (
                      <tr key={f.id} className="border-b border-[var(--color-border)]/60">
                        <td className="py-2 pr-3 text-[var(--color-foreground)]">{f.label} ({f.code})</td>
                        <td className="py-2 pr-3">{FEATURE_KIND_LABEL[f.feature_kind]}</td>
                        <td className="py-2 pr-3">{f.sensitivity}</td>
                        <td className="py-2 pr-3">
                          {f.geometry_withheld ? (
                            <span
                              className="text-xs text-amber-600 dark:text-amber-400"
                              title="Géométrie précise retirée côté serveur — réservée à un rôle élevé (GET .../geometry)."
                              data-testid="nature-geometry-withheld"
                            >
                              Masquée (donnée sensible)
                            </span>
                          ) : (
                            <span className="text-xs text-[var(--color-muted-foreground)]">Visible</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* ---- Dossiers LEAP : timeline + Locate ---- */}
          <Section
            testId="nature-leap-assessments"
            title="Dossiers LEAP"
            subtitle="Chaque dossier avance d'une phase à la fois, précondition vérifiée par le serveur — jamais une progression automatique."
          >
            <form
              className="mb-4 flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newAssessmentLabel.trim()) return;
                runAction(
                  () => createLeapAssessment(newAssessmentLabel.trim()),
                  "Dossier LEAP créé en phase « Localiser ».",
                );
                setNewAssessmentLabel("");
              }}
            >
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-[var(--color-muted-foreground)]">
                  Nouveau dossier LEAP
                </span>
                <input
                  value={newAssessmentLabel}
                  onChange={(e) => setNewAssessmentLabel(e.target.value)}
                  placeholder="Ex. Biodiversité — site principal 2026"
                  className="rounded border border-[var(--color-border)] bg-transparent px-3 py-1.5 text-sm text-[var(--color-foreground)]"
                  data-testid="nature-new-assessment-label"
                />
              </label>
              <button
                type="submit"
                disabled={!newAssessmentLabel.trim()}
                className="rounded border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-foreground)] disabled:opacity-50"
              >
                Créer le dossier
              </button>
            </form>

            {bundle.assessments.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]" data-testid="nature-assessments-empty">
                Aucun dossier LEAP.
              </p>
            ) : (
              <ul className="space-y-4">
                {bundle.assessments.map((a) => {
                  const nextPhase = LEAP_PHASES[LEAP_PHASES.indexOf(a.phase) + 1];
                  return (
                    <li
                      key={a.id}
                      className="rounded border border-[var(--color-border)] p-3"
                      data-testid={`nature-assessment-${a.id}`}
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-[var(--color-foreground)]">
                          #{a.id} — {a.label}
                        </span>
                        <span className="text-xs text-[var(--color-muted-foreground)]">
                          Statut de revue : {a.status}
                          {a.approved_by ? ` (approuvé par #${a.approved_by})` : ""}
                        </span>
                      </div>
                      <LeapTimeline phase={a.phase} />
                      <div className="mt-3 flex flex-wrap gap-2">
                        {nextPhase && (
                          <button
                            type="button"
                            className="rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-foreground)]"
                            onClick={() =>
                              runAction(
                                () => advanceLeapPhase(a.id, nextPhase),
                                `Dossier #${a.id} : passage en « ${LEAP_PHASE_LABEL[nextPhase]} ».`,
                              )
                            }
                          >
                            Passer en « {LEAP_PHASE_LABEL[nextPhase]} »
                          </button>
                        )}
                        {a.status !== "approved" && (
                          <button
                            type="button"
                            className="rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-foreground)]"
                            onClick={() =>
                              runAction(
                                () => reviewLeapAssessment(a.id, true),
                                `Dossier #${a.id} approuvé.`,
                              )
                            }
                          >
                            Approuver le dossier
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-4 border-t border-[var(--color-border)] pt-3">
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const siteId = Number(locateSiteId);
                  if (!siteId) return;
                  runAction(
                    () => locateSite(siteId),
                    "Locate exécuté — intersections calculées, en attente de revue.",
                  );
                }}
              >
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-[var(--color-muted-foreground)]">
                    Locate : intersecter un site avec le référentiel (position acceptée requise)
                  </span>
                  <select
                    value={locateSiteId}
                    onChange={(e) => setLocateSiteId(e.target.value)}
                    className="rounded border border-[var(--color-border)] bg-transparent px-3 py-1.5 text-sm text-[var(--color-foreground)]"
                    aria-label="Site à localiser"
                    data-testid="nature-locate-site"
                  >
                    <option value="">— choisir un site géocodé accepté —</option>
                    {bundle.sites
                      .filter((s) => s.position_usable)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  type="submit"
                  disabled={!locateSiteId}
                  className="rounded border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-foreground)] disabled:opacity-50"
                >
                  Lancer le Locate
                </button>
              </form>
            </div>
          </Section>

          {/* ---- Evaluate : dépendances et impacts, DEUX cartes séparées ---- */}
          <Section
            testId="nature-evaluate"
            title="Evaluate — dépendances et impacts"
            subtitle="Le TNFD distingue strictement dépendre d'un service écosystémique et impacter un écosystème : deux cartes, jamais une liste fusionnée."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div
                className="rounded border border-[var(--color-border)] p-3"
                data-testid="nature-dependencies-card"
              >
                <h3 className="mb-2 text-sm font-semibold text-[var(--color-foreground)]">
                  Dépendances ({bundle.dependencies.length})
                </h3>
                {bundle.dependencies.length === 0 ? (
                  <p className="text-xs text-[var(--color-muted-foreground)]">Aucune dépendance enregistrée.</p>
                ) : (
                  <ul className="space-y-2">
                    {bundle.dependencies.map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-[var(--color-foreground)]">
                          {d.ecosystem_service} — <QualitativeChip level={d.dependency_level} />
                        </span>
                        <span className="flex items-center gap-2">
                          <ReviewChip status={d.review_status} />
                          {d.review_status === "pending" && (
                            <button
                              type="button"
                              className="text-xs underline"
                              onClick={() =>
                                runAction(
                                  () => reviewNatureDependency(d.id, true),
                                  `Dépendance #${d.id} acceptée.`,
                                )
                              }
                            >
                              Accepter
                            </button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div
                className="rounded border border-[var(--color-border)] p-3"
                data-testid="nature-impacts-card"
              >
                <h3 className="mb-2 text-sm font-semibold text-[var(--color-foreground)]">
                  Impacts ({bundle.impacts.length})
                </h3>
                {bundle.impacts.length === 0 ? (
                  <p className="text-xs text-[var(--color-muted-foreground)]">Aucun impact enregistré.</p>
                ) : (
                  <ul className="space-y-2">
                    {bundle.impacts.map((i) => (
                      <li key={i.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-[var(--color-foreground)]">
                          {i.pressure_type} ({IMPACT_KIND_LABEL[i.impact_kind]}) —{" "}
                          <QualitativeChip level={i.magnitude_qualitative} />
                        </span>
                        <span className="flex items-center gap-2">
                          <ReviewChip status={i.review_status} />
                          {i.review_status === "pending" && (
                            <button
                              type="button"
                              className="text-xs underline"
                              onClick={() =>
                                runAction(
                                  () => reviewNatureImpact(i.id, true),
                                  `Impact #${i.id} accepté.`,
                                )
                              }
                            >
                              Accepter
                            </button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Section>

          {/* ---- Assess : risques et opportunités, DEUX cartes séparées ---- */}
          <Section
            testId="nature-assess"
            title="Assess — risques et opportunités"
            subtitle="risk_score/opportunity_score, aléa (likelihood) et confiance sont TROIS valeurs indépendantes — l'absence de donnée dégrade la confiance, jamais le score."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded border border-[var(--color-border)] p-3" data-testid="nature-risks-card">
                <h3 className="mb-2 text-sm font-semibold text-[var(--color-foreground)]">
                  Risques ({bundle.risks.length})
                </h3>
                {bundle.risks.length === 0 ? (
                  <p className="text-xs text-[var(--color-muted-foreground)]">Aucun risque calculé.</p>
                ) : (
                  <ul className="space-y-2">
                    {bundle.risks.map((r) => (
                      <li key={r.id} className="text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-[var(--color-foreground)]">{r.title}</span>
                          <ReviewChip status={r.review_status} />
                        </div>
                        <div className="text-xs text-[var(--color-muted-foreground)]">
                          Score : {r.risk_score !== null ? Math.round(r.risk_score) : "n. d. (aucune composante calculable)"}
                          {" · "}Aléa : {r.likelihood ? QUALITATIVE_LABEL[r.likelihood] : "n. d."}
                          {" · "}Confiance : {r.confidence !== null ? `${Math.round(r.confidence)}/100` : "n. d."}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div
                className="rounded border border-[var(--color-border)] p-3"
                data-testid="nature-opportunities-card"
              >
                <h3 className="mb-2 text-sm font-semibold text-[var(--color-foreground)]">
                  Opportunités ({bundle.opportunities.length})
                </h3>
                {bundle.opportunities.length === 0 ? (
                  <p className="text-xs text-[var(--color-muted-foreground)]">Aucune opportunité calculée.</p>
                ) : (
                  <ul className="space-y-2">
                    {bundle.opportunities.map((o) => (
                      <li key={o.id} className="text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-[var(--color-foreground)]">{o.title}</span>
                          <ReviewChip status={o.review_status} />
                        </div>
                        <div className="text-xs text-[var(--color-muted-foreground)]">
                          Score :{" "}
                          {o.opportunity_score !== null
                            ? Math.round(o.opportunity_score)
                            : "n. d. (aucune composante calculable)"}
                          {" · "}Aléa : {o.likelihood ? QUALITATIVE_LABEL[o.likelihood] : "n. d."}
                          {" · "}Confiance : {o.confidence !== null ? `${Math.round(o.confidence)}/100` : "n. d."}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Section>

          {/* ---- Prepare : actions + brouillon TNFD, bandeau permanent ---- */}
          <Section
            testId="nature-prepare"
            title="Prepare — actions et brouillon TNFD"
            subtitle="Une action déclarée n'est jamais soustraite automatiquement d'un score. Un brouillon de disclosure reste un brouillon, jamais une certification."
          >
            <div
              className="mb-3 rounded border border-[var(--color-border)] p-3"
              data-testid="nature-actions-list"
            >
              <h3 className="mb-2 text-sm font-semibold text-[var(--color-foreground)]">
                Actions ({bundle.actions.length})
              </h3>
              {bundle.actions.length === 0 ? (
                <p className="text-xs text-[var(--color-muted-foreground)]">Aucune action enregistrée.</p>
              ) : (
                <ul className="space-y-1">
                  {bundle.actions.map((a) => (
                    <li key={a.id} className="flex items-center justify-between text-sm">
                      <span className="text-[var(--color-foreground)]">
                        {a.title} — {ACTION_STATUS_LABEL[a.status]}
                        {a.expected_risk_reduction_pct !== null && (
                          <span className="text-xs text-[var(--color-muted-foreground)]">
                            {" "}
                            (intention : -{a.expected_risk_reduction_pct}%, jamais appliquée automatiquement)
                          </span>
                        )}
                      </span>
                      <ReviewChip status={a.review_status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {bundle.drafts.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]" data-testid="nature-drafts-empty">
                Aucun brouillon de disclosure TNFD.
              </p>
            ) : (
              <ul className="space-y-3">
                {bundle.drafts.map((d) => (
                  <li
                    key={d.id}
                    className="rounded border border-[var(--color-border)] p-3"
                    data-testid={`nature-draft-${d.id}`}
                  >
                    <div
                      className="mb-2 rounded border border-red-500/40 bg-red-500/5 p-2 text-xs font-semibold text-red-600 dark:text-red-400"
                      data-testid="nature-draft-disclaimer"
                    >
                      Brouillon — {d.is_official_tnfd_disclosure ? "ERREUR D'ÉTAT" : "PAS une disclosure TNFD officielle ni une certification"}
                    </div>
                    <div className="mb-1 font-medium text-[var(--color-foreground)]">{d.title}</div>
                    <p className="mb-2 text-xs text-[var(--color-muted-foreground)]">{d.disclaimer}</p>
                    <ul className="space-y-1 text-xs">
                      {d.sections.map((s) => (
                        <li key={s.section_code}>
                          <span className="font-medium text-[var(--color-foreground)]">{s.title} : </span>
                          <span className="text-[var(--color-muted-foreground)]">{s.content}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}
