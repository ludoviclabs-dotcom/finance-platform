"use client";

/**
 * Cockpit Ressources — fiche détaillée (Module 2, PR-M2C, BETA).
 *
 * Réunit tout ce que le brief exige de montrer, DÉCOMPOSÉ (jamais une jauge
 * opaque) : statut réglementaire versionné + année, concentration par étape,
 * concentration pays, dépendance hors UE, concentration fournisseur,
 * substituabilité, qualité des preuves, confiance, données manquantes,
 * provenance, et liens vers CRMA / Eau / Énergie / Achats.
 *
 * Réutilise DataStatusBadge, SourceDrawer, StalenessWarning, LicenseWarning
 * (composants intelligence) et les paliers risque/confiance CRMA.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FeatureStatusBadge } from "@/components/ui/feature-status-badge";
import { dataStatusToBadge } from "@/components/ui/data-status-badge";
import { SourceDrawer, type SourceProvenance } from "@/components/intelligence/source-drawer";
import { StalenessWarning } from "@/components/intelligence/staleness-warning";
import { LicenseWarning } from "@/components/intelligence/license-warning";
import { ResourceSection, ResourceCard, KeyValue, EmptyNote } from "@/components/resources/section";
import { ResourceNav } from "@/components/resources/resource-nav";
import { ResourceDataStatus } from "@/components/resources/resource-data-status";
import { ResourceIndexCard } from "@/components/resources/resource-index-card";
import { AssessmentDimensionsPanel } from "@/components/resources/assessment-dimensions-panel";
import { StageConcentrationPanel } from "@/components/resources/stage-concentration-panel";
import { RegulatoryStatusPanel } from "@/components/resources/regulatory-status-panel";
import { ModuleLinks } from "@/components/resources/module-links";
import {
  ALIAS_KIND_LABEL,
  FAMILY_LABEL,
  SchemaNotReadyError,
  buildStageConcentration,
  createResourceAssessment,
  deriveSupplyStaleness,
  fetchResourceAliases,
  fetchResourceAssessment,
  fetchResourceAssessments,
  fetchResourceDetail,
  fetchResourceRegulations,
  fetchResourceSupply,
  fetchResourceUses,
  type ResourceAlias,
  type ResourceAssessmentDetail,
  type ResourceAssessmentSummary,
  type ResourceCatalogDetail,
  type ResourceRegulatoryStatus,
  type ResourceSectorUse,
  type ResourceSupplyObservation,
} from "@/lib/api/resources";

type PageState = "loading" | "schema_not_ready" | "error" | "ready";

interface Bundle {
  detail: ResourceCatalogDetail;
  aliases: ResourceAlias[];
  regulations: ResourceRegulatoryStatus[];
  uses: ResourceSectorUse[];
  observations: ResourceSupplyObservation[];
  current: ResourceAssessmentSummary | null;
  run: ResourceAssessmentDetail | null;
}

function pickCurrent(runs: ResourceAssessmentSummary[]): ResourceAssessmentSummary | null {
  if (runs.length === 0) return null;
  return [...runs].sort(
    (a, b) =>
      b.assessment_year - a.assessment_year ||
      new Date(b.calculated_at).getTime() - new Date(a.calculated_at).getTime(),
  )[0];
}

export default function ResourceDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = decodeURIComponent(String(params?.slug ?? ""));

  const [state, setState] = useState<PageState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [computing, setComputing] = useState(false);
  const [computeError, setComputeError] = useState<string | null>(null);

  const load = useCallback(async (s: string, signal?: AbortSignal) => {
    setState("loading");
    setError(null);
    try {
      const [detail, aliases, regulations, uses, supply, assessments] = await Promise.all([
        fetchResourceDetail(s, signal),
        fetchResourceAliases(s, signal),
        fetchResourceRegulations(s, {}, signal),
        fetchResourceUses(s, signal),
        fetchResourceSupply(s, {}, signal),
        fetchResourceAssessments({ resource_slug: s, current_only: true }, signal),
      ]);
      const current = pickCurrent(assessments.items);
      const run = current ? await fetchResourceAssessment(current.run_id, signal) : null;
      setBundle({
        detail,
        aliases: aliases.items,
        regulations: regulations.items,
        uses: uses.items,
        observations: supply.items,
        current,
        run,
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
    if (!slug) return;
    const ctrl = new AbortController();
    load(slug, ctrl.signal);
    return () => ctrl.abort();
  }, [load, slug]);

  const asOfYear = new Date().getFullYear();
  const stages = useMemo(
    () => (bundle ? buildStageConcentration(bundle.observations) : []),
    [bundle],
  );
  const staleness = useMemo(
    () => (bundle ? deriveSupplyStaleness(bundle.observations, asOfYear) : null),
    [bundle, asOfYear],
  );

  const runAssessment = useCallback(async () => {
    if (!bundle) return;
    setComputing(true);
    setComputeError(null);
    try {
      const year = staleness?.lastReferenceYear ?? asOfYear;
      const run = await createResourceAssessment({ resource_slug: slug, assessment_year: year });
      setBundle((b) =>
        b
          ? {
              ...b,
              run,
              current: {
                run_id: run.run_id,
                resource_slug: run.resource_slug,
                resource_id: run.resource_id,
                assessment_year: run.assessment_year,
                status: run.status,
                risk_score: run.risk_score,
                confidence: run.confidence,
                coverage_pct: run.coverage_pct,
                observed_hhi: run.observed_hhi,
                missing_share_pct: run.missing_share_pct,
                methodology_code: run.methodology_code,
                methodology_version: run.methodology_version,
                calculated_at: run.calculated_at,
              },
            }
          : b,
      );
    } catch (e) {
      setComputeError((e as Error).message);
    } finally {
      setComputing(false);
    }
  }, [bundle, slug, staleness, asOfYear]);

  // Concern licence dérivé de la composante `license_access` du run courant.
  const licenseConcern = useMemo(() => {
    const dim = bundle?.run?.dimensions.find((d) => d.dimension_code === "license_access");
    if (!dim || dim.raw_value == null || dim.raw_value >= 1) return null;
    return { ok: dim.raw_value >= 0.5, reason: dim.rationale ?? "Donnée de marché bloquée par licence." };
  }, [bundle]);

  const provenance: SourceProvenance | null = useMemo(() => {
    if (!bundle) return null;
    const { detail } = bundle;
    const isStale = staleness?.isStale ?? false;
    return {
      title: detail.name_fr ?? detail.name,
      code: detail.slug,
      publisher: null,
      releaseKey: detail.source_release_id != null ? `release #${detail.source_release_id}` : null,
      badgeStatus: dataStatusToBadge(detail.data_status, isStale),
      badgeLabel: detail.data_status === "inferred" && !isStale ? "Inféré" : undefined,
      isStale,
      ageDays: staleness?.ageDays ?? null,
      lastReleaseAt: staleness?.lastReleaseAt ?? null,
      attribution: null,
      checksum: null,
      license: licenseConcern
        ? { ok: licenseConcern.ok, reasons: licenseConcern.ok ? [] : [licenseConcern.reason], warnings: licenseConcern.ok ? [licenseConcern.reason] : [] }
        : null,
    };
  }, [bundle, staleness, licenseConcern]);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <Link
        href="/resources"
        className="text-sm text-[var(--color-muted-foreground)] hover:underline"
      >
        ← Retour au catalogue
      </Link>

      <ResourceNav active="catalog" />

      {state === "loading" && (
        <p data-testid="resource-loading" className="text-sm text-[var(--color-muted-foreground)]">
          Chargement de la fiche…
        </p>
      )}

      {state === "schema_not_ready" && (
        <div
          data-testid="resource-schema-not-ready"
          className="rounded border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-400"
        >
          <p className="font-semibold">Initialisation du schéma en cours</p>
          <p>Les migrations du module Ressources (042/043) ne sont pas encore appliquées.</p>
        </div>
      )}

      {state === "error" && (
        <div
          data-testid="resource-error"
          className="rounded border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400"
        >
          <p className="font-semibold">Fiche indisponible</p>
          <p>{error}</p>
        </div>
      )}

      {state === "ready" && bundle && (
        <div data-testid="resource-content">
          <header className="mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-[var(--color-foreground)]">
                {bundle.detail.name_fr ?? bundle.detail.name}
              </h1>
              <FeatureStatusBadge status="beta" />
              <ResourceDataStatus status={bundle.detail.data_status} isStale={staleness?.isStale} size="sm" />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
              <span className="font-mono">{bundle.detail.slug}</span>
              <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-xs">
                {FAMILY_LABEL[bundle.detail.primary_family]}
              </span>
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                data-testid="resource-provenance-button"
                className="rounded border border-[var(--color-border)] px-2 py-0.5 text-xs hover:border-emerald-500/50"
              >
                Provenance
              </button>
            </div>
            {bundle.detail.description && (
              <p className="mt-2 max-w-3xl text-sm text-[var(--color-foreground)]/80">
                {bundle.detail.description}
              </p>
            )}
          </header>

          {staleness && (
            <StalenessWarning
              isStale={staleness.isStale}
              ageDays={staleness.ageDays}
              lastReleaseAt={staleness.lastReleaseAt}
              className="mb-6"
            />
          )}

          {/* Indice d'exposition — secondaire & décomposable */}
          <ResourceSection
            title="Indice d'exposition"
            subtitle="Un run immuable, risque et confiance séparés. Indice décomposé ci-dessous."
            testId="resource-assessment"
            actions={
              <button
                type="button"
                onClick={runAssessment}
                disabled={computing}
                data-testid="resource-run-assessment"
                className="rounded border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-foreground)] hover:border-emerald-500/50 disabled:opacity-50"
              >
                {computing ? "Calcul…" : bundle.run ? "Recalculer" : "Lancer un assessment"}
              </button>
            }
          >
            {computeError && (
              <p className="mb-3 rounded border border-red-500/40 bg-red-500/5 p-2 text-xs text-red-600 dark:text-red-400" data-testid="resource-compute-error">
                {computeError} — le calcul d&apos;un run requiert le rôle analyste.
              </p>
            )}
            {bundle.run ? (
              <div className="space-y-4">
                <ResourceIndexCard
                  riskScore={bundle.run.risk_score}
                  confidence={bundle.run.confidence}
                  observedHhi={bundle.run.observed_hhi}
                  coveragePct={bundle.run.coverage_pct}
                  missingSharePct={bundle.run.missing_share_pct}
                  methodologyCode={bundle.run.methodology_code}
                  methodologyVersion={bundle.run.methodology_version}
                  assessmentYear={bundle.run.assessment_year}
                  calculatedAt={bundle.run.calculated_at}
                  disclaimer={bundle.run.disclaimer}
                  detailHref="#dimensions"
                />
                {licenseConcern && !licenseConcern.ok && (
                  <LicenseWarning
                    licenseOk={false}
                    allowDerivedUse={false}
                    reasons={[licenseConcern.reason]}
                  />
                )}
                {bundle.run.warnings.length > 0 && (
                  <ul className="space-y-1" data-testid="resource-run-warnings">
                    {bundle.run.warnings.map((w, i) => (
                      <li key={i} className="text-xs text-amber-600 dark:text-amber-400">
                        ⚠ {w}
                      </li>
                    ))}
                  </ul>
                )}
                <div id="dimensions">
                  <AssessmentDimensionsPanel
                    dimensions={bundle.run.dimensions}
                    riskScore={bundle.run.risk_score}
                    confidence={bundle.run.confidence}
                  />
                </div>
              </div>
            ) : (
              <EmptyNote testId="resource-no-run">
                Aucun assessment courant. Lancez un run pour décomposer l&apos;exposition (risque,
                confiance, composantes, provenance).
              </EmptyNote>
            )}
          </ResourceSection>

          {/* Chaîne de valeur — concentration par étape */}
          <ResourceSection
            title="Chaîne de valeur — concentration par étape"
            subtitle="HHI (0-10000) calculé par étape, géographie observée, part hors UE. Jamais de moyenne inter-étapes."
            testId="resource-value-chain"
          >
            <StageConcentrationPanel stages={stages} />
          </ResourceSection>

          {/* Statut réglementaire versionné */}
          <ResourceSection
            title="Statut réglementaire"
            subtitle="Statuts non exclusifs (une ligne par régime), versionnés et datés. Sourcé-ou-avoué."
            testId="resource-regulations"
          >
            <RegulatoryStatusPanel statuses={bundle.regulations} />
          </ResourceSection>

          {/* Usages sectoriels */}
          <ResourceSection
            title="Usages sectoriels"
            subtitle="Classification supply-chain seulement — aucun contenu technique."
            testId="resource-uses"
          >
            {bundle.uses.length === 0 ? (
              <EmptyNote testId="resource-uses-empty">Aucun usage sectoriel renseigné.</EmptyNote>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {bundle.uses.map((u) => (
                  <li key={u.id} className="rounded-lg border border-[var(--color-border)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-[var(--color-foreground)]">
                        {u.use_label}
                      </span>
                      <ResourceDataStatus status={u.data_status} />
                    </div>
                    {u.sector_code && (
                      <p className="mt-0.5 font-mono text-xs text-[var(--color-muted-foreground)]">
                        {u.sector_code}
                      </p>
                    )}
                    {u.criticality_note && (
                      <p className="mt-1 text-xs text-[var(--color-foreground)]/80">{u.criticality_note}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </ResourceSection>

          {/* Identifiants & alias legacy */}
          <ResourceSection
            title="Identifiants & alias"
            subtitle="Le pont legacy (material_id historique, CAS, HS/CN…) — aucun identifiant supprimé (D-2)."
            testId="resource-aliases"
          >
            {bundle.aliases.length === 0 ? (
              <EmptyNote testId="resource-aliases-empty">Aucun alias enregistré.</EmptyNote>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {bundle.aliases.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs"
                  >
                    <span className="text-[var(--color-muted-foreground)]">{ALIAS_KIND_LABEL[a.alias_kind]} : </span>
                    <span className="font-mono text-[var(--color-foreground)]">{a.alias_value}</span>
                  </li>
                ))}
              </ul>
            )}
          </ResourceSection>

          {/* Exposition environnementale — via modules liés (D-4) */}
          <ResourceSection
            title="Exposition environnementale & modules liés"
            subtitle="L'empreinte réelle se lit dans les modules dédiés — pas de recalcul carbone ici (D-4)."
            testId="resource-modules"
          >
            <ModuleLinks />
          </ResourceSection>

          <ResourceCard className="bg-[var(--color-muted)]/10">
            <KeyValue
              label="Compteurs"
              value={`${bundle.detail.regulations_count} statut(s) réglementaire(s) · ${bundle.detail.uses_count} usage(s) · ${bundle.detail.aliases_count} alias`}
            />
          </ResourceCard>
        </div>
      )}

      {provenance && <SourceDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} {...provenance} />}
    </div>
  );
}
