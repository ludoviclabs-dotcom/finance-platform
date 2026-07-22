"use client";

/**
 * Cockpit Ressources — catalogue (Module 2, BETA).
 *
 * Consomme `/resources/catalog` + `/resources/alerts` (+ `/resources/assessments`
 * en enrichissement tolérant, pour les jauges de risque). États loading /
 * schema_not_ready / error / empty explicites — jamais de fallback silencieux.
 *
 * Refonte visuelle : bandeau de chiffres-clés (agrégats RÉELS), signaux en
 * barres honnêtes (score réel + bande), cartes à jauge de risque réelle. Aucune
 * donnée inventée — pas de tendance ni de sparkline (aucune série n'existe).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Boxes, FlaskConical, SearchX, ShieldAlert, Flame, ShieldCheck } from "lucide-react";
import { FeatureStatusBadge } from "@/components/ui/feature-status-badge";
import { ResourceNav } from "@/components/resources/resource-nav";
import { ResourceDataStatus } from "@/components/resources/resource-data-status";
import { DemoSessionBanner } from "@/components/resources/demo-session-banner";
import {
  ResourceEmptyState,
  resourcesEmptyStateKind,
} from "@/components/resources/resource-empty-state";
import { StatTile } from "@/components/resources/viz/stat-tile";
import { RadialGauge } from "@/components/resources/viz/radial-gauge";
import { useIsDemoSession } from "@/lib/hooks/auth-context";
import { BAND_HEX, riskToneHex, hhiTone, meanOrNull } from "@/lib/resources-viz";
import {
  ALERT_KIND_LABEL,
  FAMILY_LABEL,
  SEVERITY_TONE,
  SchemaNotReadyError,
  fetchResourceAlerts,
  fetchResourceAssessments,
  fetchResourceCatalog,
  riskBand,
  type ResourceAlert,
  type ResourceAssessmentSummary,
  type ResourceCatalogItem,
  type ResourceFamily,
} from "@/lib/api/resources";

type PageState = "loading" | "schema_not_ready" | "error" | "ready";

const FAMILY_OPTIONS: (ResourceFamily | "all")[] = [
  "all",
  "critical_raw_material",
  "industrial_gas",
  "energy_fuel",
  "biomass_fibre",
  "other",
];

export default function ResourcesCatalogPage() {
  const [state, setState] = useState<PageState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ResourceCatalogItem[]>([]);
  const [alerts, setAlerts] = useState<ResourceAlert[]>([]);
  const [assessments, setAssessments] = useState<Map<string, ResourceAssessmentSummary>>(new Map());
  const [family, setFamily] = useState<ResourceFamily | "all">("all");
  const [query, setQuery] = useState("");
  const isDemo = useIsDemoSession();

  const load = useCallback(
    async (fam: ResourceFamily | "all", signal?: AbortSignal) => {
      setState("loading");
      setError(null);
      try {
        const [catalog, alertList, assessList] = await Promise.all([
          fetchResourceCatalog(fam === "all" ? {} : { family: fam }, signal),
          fetchResourceAlerts(signal),
          // Enrichissement tolérant : si l'endpoint échoue, les jauges affichent
          // « n.c. » plutôt que de casser le catalogue.
          fetchResourceAssessments({ current_only: true }, signal).catch(() => null),
        ]);
        setItems(catalog.items);
        setAlerts(alertList.items);
        setAssessments(new Map((assessList?.items ?? []).map((a) => [a.resource_slug, a])));
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
    },
    [],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    load(family, ctrl.signal);
    return () => ctrl.abort();
  }, [load, family]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.slug.toLowerCase().includes(q) ||
        i.name.toLowerCase().includes(q) ||
        (i.name_fr ?? "").toLowerCase().includes(q),
    );
  }, [items, query]);

  const resetFilters = useCallback(() => {
    setFamily("all");
    setQuery("");
  }, []);

  const emptyKind = resourcesEmptyStateKind({
    itemsLength: items.length,
    filteredLength: filtered.length,
    family,
    query,
    isDemo,
  });

  // Chiffres-clés RÉELS sur la vue courante (respecte les filtres actifs).
  const hero = useMemo(() => {
    const visible = filtered
      .map((i) => assessments.get(i.slug))
      .filter((a): a is ResourceAssessmentSummary => a !== undefined);
    const risks = visible
      .map((a) => a.risk_score)
      .filter((r): r is number => typeof r === "number");
    const slugs = new Set(filtered.map((i) => i.slug));
    const highAlerts = alerts.filter(
      (a) => (a.severity === "high" || a.severity === "critical") && slugs.has(a.resource_slug),
    ).length;
    return {
      count: filtered.length,
      highAlerts,
      maxRisk: risks.length ? Math.max(...risks) : null,
      avgConfidence: meanOrNull(visible.map((a) => a.confidence)),
    };
  }, [filtered, assessments, alerts]);

  const showHero = state === "ready" && items.length > 0 && emptyKind === "grid";

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6">
        <div className="mb-1 flex items-center gap-2">
          <h1 className="text-2xl font-bold text-[var(--color-foreground)]">Ressources stratégiques</h1>
          <FeatureStatusBadge status="beta" />
        </div>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Dépendances industrielles étendues — matières critiques, gaz industriels, combustibles,
          biomasse. Statut réglementaire versionné, concentration par étape, risque et confiance
          séparés.
        </p>
      </header>

      {isDemo && <DemoSessionBanner />}

      <ResourceNav active="catalog" />

      {state === "loading" && (
        <p data-testid="resources-loading" className="text-sm text-[var(--color-muted-foreground)]">
          Chargement du catalogue…
        </p>
      )}

      {state === "schema_not_ready" && (
        <div
          data-testid="resources-schema-not-ready"
          className="rounded border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-400"
        >
          <p className="font-semibold">Initialisation du schéma en cours</p>
          <p>
            Les migrations du module Ressources (042/043) ne sont pas encore appliquées en base. La
            page s&apos;activera dès leur déploiement.
          </p>
        </div>
      )}

      {state === "error" && (
        <div
          data-testid="resources-error"
          className="rounded border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400"
        >
          <p className="font-semibold">Module Ressources indisponible</p>
          <p>{error}</p>
        </div>
      )}

      {state === "ready" && (
        <div data-testid="resources-content">
          {showHero && (
            <section
              className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
              data-testid="resources-hero"
            >
              <StatTile
                testId="resources-hero-count"
                label="Ressources suivies"
                value={hero.count}
                icon={<Boxes className="h-5 w-5" />}
                accent="var(--color-foreground)"
              />
              <StatTile
                testId="resources-hero-alerts"
                label="Signaux élevés"
                value={hero.highAlerts}
                icon={<ShieldAlert className="h-5 w-5" />}
                accent={hero.highAlerts > 0 ? BAND_HEX.severe : "var(--color-foreground)"}
              />
              <StatTile
                testId="resources-hero-maxrisk"
                label="Exposition max"
                value={hero.maxRisk}
                decimals={1}
                icon={<Flame className="h-5 w-5" />}
                accent={riskToneHex(hero.maxRisk)}
                context={hero.maxRisk !== null ? riskBand(hero.maxRisk).label : "Non calculé"}
              />
              <StatTile
                testId="resources-hero-confidence"
                label="Confiance moyenne"
                value={hero.avgConfidence}
                suffix=" %"
                decimals={0}
                icon={<ShieldCheck className="h-5 w-5" />}
                accent="var(--color-foreground)"
                context="Qualité du socle documentaire"
              />
            </section>
          )}

          {alerts.length > 0 && (
            <section className="mb-6" data-testid="resources-alerts">
              <h2 className="mb-2 text-lg font-semibold text-[var(--color-foreground)]">Signaux</h2>
              <ul className="space-y-2">
                {alerts.map((a, i) => {
                  const risk = assessments.get(a.resource_slug)?.risk_score ?? null;
                  const band = riskBand(risk);
                  return (
                    <li
                      key={`${a.kind}-${a.resource_slug}-${i}`}
                      className="rounded-lg border border-[var(--color-border)] px-3 py-2.5"
                      data-testid={`resources-signal-${a.resource_slug}`}
                    >
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SEVERITY_TONE[a.severity]}`}
                        >
                          {a.severity}
                        </span>
                        <span className="font-medium text-[var(--color-foreground)]">
                          {ALERT_KIND_LABEL[a.kind]}
                        </span>
                        <Link
                          href={`/resources/${encodeURIComponent(a.resource_slug)}`}
                          className="font-mono text-xs text-[var(--color-muted-foreground)] hover:underline"
                        >
                          {a.resource_slug}
                        </Link>
                        <span className="text-[var(--color-muted-foreground)]">— {a.message}</span>
                      </div>
                      {risk !== null && (
                        <div className="mt-2 flex items-center gap-3">
                          <div
                            className="relative h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-raised)]"
                            role="img"
                            aria-label={`Exposition ${Math.round(risk)} sur 100 — ${band.label}`}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${Math.min(100, risk)}%`, background: riskToneHex(risk), transition: "width .5s ease" }}
                            />
                          </div>
                          <span className="w-24 shrink-0 text-right text-xs tabular-nums text-[var(--color-muted-foreground)]">
                            {Math.round(risk)}/100 · {band.label}
                          </span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-[var(--color-muted-foreground)]">
              Famille
              <select
                data-testid="resources-family-filter"
                value={family}
                onChange={(e) => setFamily(e.target.value as ResourceFamily | "all")}
                className="rounded border border-[var(--color-border)] bg-transparent px-3 py-1.5 text-sm text-[var(--color-foreground)]"
              >
                {FAMILY_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f === "all" ? "Toutes" : FAMILY_LABEL[f]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1 text-xs text-[var(--color-muted-foreground)]">
              Recherche
              <input
                data-testid="resources-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Slug ou nom…"
                className="rounded border border-[var(--color-border)] bg-transparent px-3 py-1.5 text-sm text-[var(--color-foreground)]"
              />
            </label>
          </div>

          {emptyKind === "no-results" ? (
            <ResourceEmptyState
              testId="resources-empty-no-results"
              icon={<SearchX className="h-6 w-6" />}
              title="Aucun résultat pour ces filtres"
              description="Aucune ressource ne correspond à la famille ou au terme recherché. Réinitialisez pour revoir tout le catalogue."
              actions={[
                {
                  label: "Réinitialiser les filtres",
                  onClick: resetFilters,
                  variant: "ghost",
                  testId: "resources-reset-filters",
                },
              ]}
            />
          ) : emptyKind === "empty-demo" ? (
            <ResourceEmptyState
              testId="resources-empty-demo"
              icon={<FlaskConical className="h-6 w-6" />}
              title="Le scénario Asterion n'est pas encore initialisé"
              description="Les données synthétiques doivent être chargées via le workflow protégé de démonstration avant d'explorer le cockpit."
              actions={[
                {
                  label: "Voir le parcours guidé",
                  href: "/demo/asterion-resources",
                  variant: "primary",
                  testId: "resources-empty-demo-tour",
                },
              ]}
            />
          ) : emptyKind === "empty-real" ? (
            <ResourceEmptyState
              testId="resources-empty-real"
              icon={<Boxes className="h-6 w-6" />}
              title="Aucune dépendance encore cartographiée"
              description="Importez une nomenclature, reliez vos achats ou configurez les ressources que votre organisation souhaite surveiller."
              actions={[
                {
                  label: "Importer des données",
                  href: "/imports",
                  variant: "primary",
                  testId: "resources-empty-real-import",
                },
                {
                  label: "Configurer les sources",
                  href: "/resources/methodology",
                  variant: "ghost",
                  testId: "resources-empty-real-sources",
                },
              ]}
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="resources-grid">
              {filtered.map((r) => {
                const assess = assessments.get(r.slug);
                const risk = assess?.risk_score ?? null;
                const band = riskBand(risk);
                const hhi = assess?.observed_hhi ?? null;
                return (
                  <li key={r.id}>
                    <Link
                      href={`/resources/${encodeURIComponent(r.slug)}`}
                      data-testid={`resource-card-${r.slug}`}
                      className="flex h-full flex-col rounded-xl border border-[var(--color-border)] p-4 transition-all hover:-translate-y-0.5 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="block font-semibold text-[var(--color-foreground)]">
                            {r.name_fr ?? r.name}
                          </span>
                          <p className="mt-0.5 font-mono text-xs text-[var(--color-muted-foreground)]">{r.slug}</p>
                        </div>
                        <RadialGauge
                          value={risk}
                          size={54}
                          stroke={5}
                          color={riskToneHex(risk)}
                          bandLabel={band.label}
                          ariaTitle={`Exposition ${r.name_fr ?? r.name}`}
                          testId={`resource-gauge-${r.slug}`}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[var(--color-muted-foreground)]">
                          {FAMILY_LABEL[r.primary_family]}
                        </span>
                        <span
                          className="rounded-full px-2 py-0.5 font-medium"
                          style={{ color: riskToneHex(risk), background: `${riskToneHex(risk)}1f` }}
                        >
                          {band.label}
                        </span>
                        {hhi !== null && (
                          <span
                            className="rounded-full px-2 py-0.5"
                            style={{ color: BAND_HEX[hhiTone(hhi)], background: `${BAND_HEX[hhiTone(hhi)]}1f` }}
                          >
                            HHI {Math.round(hhi)}
                          </span>
                        )}
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-2 text-xs">
                        <ResourceDataStatus status={r.data_status} />
                        <span
                          className={r.has_source ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--color-muted-foreground)]"}
                        >
                          {r.has_source ? "● sourcé" : "○ non sourcé"}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
