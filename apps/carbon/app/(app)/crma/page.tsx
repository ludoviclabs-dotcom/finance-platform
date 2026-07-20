"use client";

/**
 * CRMA — exposition matières critiques et aimants permanents (PR-07, BETA).
 *
 * Consomme `/crma/*`. États loading / error / empty / data explicites, aucun
 * fallback silencieux (même discipline que `/intelligence/sources`).
 *
 * Trois règles de présentation, non négociables :
 *
 * 1. **Le risque et la confiance ne partagent jamais une carte.** Deux blocs
 *    distincts, deux vocabulaires distincts (« niveau » vs « documentation »),
 *    pour qu'un lecteur pressé ne prenne jamais une confiance faible pour un
 *    risque faible.
 * 2. **La chaîne de valeur se lit étape par étape.** Chaque étape porte sa
 *    propre concentration ; aucune ligne « toutes étapes » n'existe, parce que
 *    l'extraction et le raffinage sont des marchés différents.
 * 3. **Aucun prix sans droit d'affichage.** Quand le backend renvoie
 *    `value_withheld`, la valeur n'a pas été transmise : on affiche la raison
 *    de licence, jamais un tiret qui laisserait croire à une donnée manquante.
 *
 * Note UI : `DataStatusBadge` (components/ui) est stylé pour les surfaces
 * SOMBRES du module /materials ; cette page vit dans le shell thémé `(app)`.
 * On réutilise donc sa fonction de mapping partagée `dataStatusToBadge`
 * (contrats §2 — une seule logique de vocabulaire) tout en rendant une pastille
 * thémée, pour ne pas régresser le contraste en thème clair.
 */

import { useCallback, useEffect, useState } from "react";
import { FeatureStatusBadge } from "@/components/ui/feature-status-badge";
import { dataStatusToBadge } from "@/components/ui/data-status-badge";
import {
  confidenceBand,
  fetchActions,
  fetchExposures,
  fetchExposureScore,
  fetchMarketObservations,
  fetchMaterialStatus,
  fetchRecyclingRoutes,
  fetchSubstitutes,
  fetchValueChain,
  formatPct,
  riskBand,
  type ExposureAnalysis,
  type MarketObservation,
  type MaterialExposure,
  type MaterialStatus,
  type MitigationAction,
  type RecyclingRoute,
  type Substitute,
  type ValueChain,
} from "@/lib/api/crma";

const DEFAULT_MATERIAL = "nd";

const MATURITY_LABEL: Record<string, string> = {
  research: "Recherche",
  pilot: "Pilote",
  commercial: "Commercial",
  mature: "Mature",
};

const STATUS_LABEL: Record<string, string> = {
  VERIFIED: "Vérifié",
  ESTIMATED: "Estimé",
  MANUAL: "Saisie manuelle",
  STALE: "Périmé",
};

const RISK_TONE: Record<string, string> = {
  unknown: "text-[var(--color-muted-foreground)]",
  low: "text-emerald-600 dark:text-emerald-400",
  moderate: "text-amber-600 dark:text-amber-400",
  high: "text-orange-600 dark:text-orange-400",
  severe: "text-red-600 dark:text-red-400",
};

interface Bundle {
  analysis: ExposureAnalysis;
  chain: ValueChain;
  status: MaterialStatus;
  substitutes: Substitute[];
  recycling: RecyclingRoute[];
  exposures: MaterialExposure[];
  actions: MitigationAction[];
  market: MarketObservation[];
}

/** Pastille de statut de donnée, thémée — vocabulaire partagé avec le module /materials. */
function StatusChip({ status }: { status: "verified" | "estimated" | "manual" | "inferred" }) {
  const resolved = dataStatusToBadge(status);
  const label = status === "inferred" ? "Inféré" : STATUS_LABEL[resolved];
  return (
    <span
      className="inline-flex items-center rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]"
      data-testid={`crma-status-${resolved.toLowerCase()}`}
    >
      {label}
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

export default function CrmaPage() {
  const [material, setMaterial] = useState(DEFAULT_MATERIAL);
  const [query, setQuery] = useState(DEFAULT_MATERIAL);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (materialId: string, signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const [analysis, chain, status, substitutes, recycling, exposures, actions, market] =
        await Promise.all([
          fetchExposureScore(materialId, {}, signal),
          fetchValueChain(materialId, {}, signal),
          fetchMaterialStatus(materialId, signal),
          fetchSubstitutes(materialId, signal),
          fetchRecyclingRoutes(materialId, signal),
          fetchExposures(materialId, signal),
          fetchActions({ materialId }, signal),
          fetchMarketObservations(materialId, signal),
        ]);
      setBundle({
        analysis,
        chain,
        status,
        substitutes: substitutes.items,
        recycling: recycling.items,
        exposures: exposures.items,
        actions: actions.items,
        market: market.items,
      });
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message);
        setBundle(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    load(material, ctrl.signal);
    return () => ctrl.abort();
  }, [load, material]);

  const score = bundle?.analysis.data;
  const risk = score ? riskBand(score.risk_score) : null;
  const confidence = score ? confidenceBand(score.confidence) : null;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold text-[var(--color-foreground)]">
            Matières critiques &amp; aimants permanents
          </h1>
          <FeatureStatusBadge status="beta" />
        </div>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Exposition aux matières critiques (CRMA), chaîne de valeur par étape et
          préparation du rapport Article 24.
        </p>
      </header>

      <form
        className="mb-6 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setMaterial(query.trim() || DEFAULT_MATERIAL);
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--color-muted-foreground)]">
            Identifiant matière
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="rounded border border-[var(--color-border)] bg-transparent px-3 py-1.5 text-sm text-[var(--color-foreground)]"
            aria-label="Identifiant matière"
          />
        </label>
        <button
          type="submit"
          className="rounded border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-foreground)]"
        >
          Analyser
        </button>
      </form>

      {loading && (
        <p data-testid="crma-loading" className="text-sm text-[var(--color-muted-foreground)]">
          Chargement de l&apos;analyse…
        </p>
      )}

      {!loading && error && (
        <div
          data-testid="crma-error"
          className="rounded border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400"
        >
          <p className="font-semibold">Analyse indisponible</p>
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && bundle && score && risk && confidence && (
        <div data-testid="crma-content">
          {/* ---- Statut réglementaire : critique et stratégique NON exclusifs ---- */}
          <Section
            testId="crma-status"
            title="Statut réglementaire"
            subtitle="Critique et stratégique ne s'excluent pas : une matière stratégique est aussi critique."
          >
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded border border-[var(--color-border)] px-3 py-1">
                Critique UE : <strong>{bundle.status.is_critical_eu ? "oui" : "non"}</strong>
              </span>
              <span className="rounded border border-[var(--color-border)] px-3 py-1">
                Stratégique UE : <strong>{bundle.status.is_strategic_eu ? "oui" : "non"}</strong>
              </span>
              {bundle.status.regulation_version && (
                <span className="rounded border border-[var(--color-border)] px-3 py-1">
                  Référentiel : <strong>{bundle.status.regulation_version}</strong>
                </span>
              )}
            </div>
            {bundle.status.strategic_not_critical && (
              <p
                data-testid="crma-status-inconsistent"
                className="mt-2 text-sm text-amber-600 dark:text-amber-400"
              >
                Incohérence de référentiel : cette matière est marquée stratégique sans être
                critique. Toute matière stratégique est aussi critique — à corriger dans le
                référentiel.
              </p>
            )}
          </Section>

          {/* ---- Risque et confiance : DEUX cartes, jamais une ---- */}
          <Section
            testId="crma-score"
            title="CarbonCo Material Exposure Score"
            subtitle="Méthode CarbonCo versionnée — ce n'est pas un score officiel de l'Union européenne."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded border border-[var(--color-border)] p-4" data-testid="crma-risk">
                <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                  Niveau de risque
                </p>
                <p className={`font-mono text-4xl ${RISK_TONE[risk.tone]}`}>
                  {score.risk_score === null ? "—" : score.risk_score.toFixed(0)}
                  {score.risk_score !== null && (
                    <span className="text-base text-[var(--color-muted-foreground)]"> / 100</span>
                  )}
                </p>
                <p className="text-sm text-[var(--color-foreground)]">{risk.label}</p>
              </div>

              <div
                className="rounded border border-[var(--color-border)] p-4"
                data-testid="crma-confidence"
              >
                <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                  Confiance dans la donnée
                </p>
                <p className="font-mono text-4xl text-[var(--color-foreground)]">
                  {score.confidence.toFixed(0)}
                  <span className="text-base text-[var(--color-muted-foreground)]"> / 100</span>
                </p>
                <p className="text-sm text-[var(--color-foreground)]">{confidence.label}</p>
                <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                  Mesure la qualité du socle documentaire. Une confiance faible ne signifie pas
                  un risque faible.
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
              Méthode {score.methodology_code} {score.methodology_version} · couverture{" "}
              {formatPct(score.coverage_pct)} des étapes
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]" data-testid="crma-disclaimer">
              {score.disclaimer}
            </p>

            {score.warnings.length > 0 && (
              <ul
                className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-600 dark:text-amber-400"
                data-testid="crma-warnings"
              >
                {score.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </Section>

          {/* ---- Chaîne de valeur : une ligne PAR étape ---- */}
          <Section
            testId="crma-value-chain"
            title="Chaîne de valeur par étape"
            subtitle="Chaque étape a son propre marché : l'extraction n'est jamais moyennée avec le raffinage ou la transformation."
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                    <th className="py-2 pr-3">Étape</th>
                    <th className="py-2 pr-3">Concentration (HHI)</th>
                    <th className="py-2 pr-3">Premier pays</th>
                    <th className="py-2 pr-3">Pays observés</th>
                    <th className="py-2 pr-3">Couverture</th>
                  </tr>
                </thead>
                <tbody>
                  {bundle.chain.stages.map((stage) => (
                    <tr
                      key={stage.stage_code}
                      className="border-b border-[var(--color-border)]"
                      data-testid={`crma-stage-${stage.stage_code}`}
                    >
                      <td className="py-2 pr-3 text-[var(--color-foreground)]">
                        {stage.stage_label ?? stage.stage_code}
                        {stage.is_upstream && (
                          <span className="ml-2 text-xs text-[var(--color-muted-foreground)]">
                            amont extractif
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3 font-mono">
                        {stage.hhi_pct === null ? (
                          <span className="text-[var(--color-muted-foreground)]">
                            aucune donnée
                          </span>
                        ) : (
                          formatPct(stage.hhi_pct)
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {stage.top_country_code
                          ? `${stage.top_country_code} · ${formatPct(stage.top_country_share_pct)}`
                          : "—"}
                      </td>
                      <td className="py-2 pr-3">{stage.country_count}</td>
                      <td className="py-2 pr-3">{formatPct(stage.observed_total_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
              {bundle.chain.stages_with_data} étape(s) documentée(s) sur{" "}
              {bundle.chain.stages_total}.
            </p>
          </Section>

          {/* ---- Composantes : inspectables une par une ---- */}
          <Section
            testId="crma-drivers"
            title="Composantes du score"
            subtitle="Chaque composante garde sa valeur, son poids et sa justification. Une composante sans donnée est exclue du calcul, jamais comptée comme risque nul."
          >
            <ul className="space-y-2">
              {score.components.map((component) => (
                <li
                  key={component.code}
                  className="rounded border border-[var(--color-border)] p-3"
                  data-testid={`crma-component-${component.code}`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-[var(--color-foreground)]">
                      {component.label}
                    </span>
                    {component.available ? (
                      <span className="font-mono text-sm text-[var(--color-foreground)]">
                        {component.risk_value?.toFixed(1)} · poids{" "}
                        {(component.weight * 100).toFixed(0)} %
                      </span>
                    ) : (
                      <span className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                        Donnée absente — exclue du calcul
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                    {component.rationale}
                  </p>
                </li>
              ))}
            </ul>
          </Section>

          {/* ---- Alternatives ---- */}
          <Section
            testId="crma-substitutes"
            title="Alternatives"
            subtitle="Substituts recensés, avec leur maturité et le coût technique de la substitution."
          >
            {bundle.substitutes.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                Aucun substitut recensé. Absence de donnée, pas absence de substitut.
              </p>
            ) : (
              <ul className="space-y-2">
                {bundle.substitutes.map((s) => (
                  <li key={s.id} className="rounded border border-[var(--color-border)] p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-[var(--color-foreground)]">
                        {s.substitute_material_id}
                      </span>
                      <span className="text-[var(--color-muted-foreground)]">
                        {MATURITY_LABEL[s.maturity] ?? s.maturity}
                      </span>
                      <StatusChip status={s.data_status} />
                    </div>
                    <p className="mt-1 text-[var(--color-muted-foreground)]">
                      {s.stage_code ? `Étape : ${s.stage_code}. ` : ""}
                      {s.performance_penalty_pct !== null
                        ? `Pénalité de performance : ${formatPct(s.performance_penalty_pct)}.`
                        : "Pénalité de performance non renseignée."}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* ---- Recyclage ---- */}
          <Section
            testId="crma-recycling"
            title="Filières de recyclage"
            subtitle="L'étape de réinjection compte : une boucle qui revient à la poudre ne réduit pas la dépendance à l'extraction comme une boucle revenant à la séparation."
          >
            {bundle.recycling.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                Aucune filière recensée. Absence de donnée, pas absence de filière.
              </p>
            ) : (
              <ul className="space-y-2">
                {bundle.recycling.map((r) => (
                  <li key={r.id} className="rounded border border-[var(--color-border)] p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-[var(--color-foreground)]">{r.label}</span>
                      <span className="text-[var(--color-muted-foreground)]">
                        {MATURITY_LABEL[r.maturity] ?? r.maturity}
                      </span>
                      <StatusChip status={r.data_status} />
                    </div>
                    <p className="mt-1 text-[var(--color-muted-foreground)]">
                      Réinjection à l&apos;étape « {r.output_stage_code ?? "non précisée"} » ·
                      contenu recyclé {formatPct(r.recycled_content_pct)} · taux de récupération{" "}
                      {formatPct(r.recovery_rate_pct)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* ---- Expositions et stocks ---- */}
          <Section
            testId="crma-exposures"
            title="Expositions et stocks"
            subtitle="Rattachement aux nomenclatures et aux fournisseurs. La couverture retenue par le score est la plus faible : c'est le maillon le plus court qui arrête la production."
          >
            {bundle.exposures.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                Aucune exposition déclarée pour cette matière.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                      <th className="py-2 pr-3">Étape</th>
                      <th className="py-2 pr-3">Masse annuelle</th>
                      <th className="py-2 pr-3">Part d&apos;appro.</th>
                      <th className="py-2 pr-3">Couverture stock</th>
                      <th className="py-2 pr-3">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bundle.exposures.map((e) => (
                      <tr key={e.id} className="border-b border-[var(--color-border)]">
                        <td className="py-2 pr-3">{e.stage_code ?? "—"}</td>
                        <td className="py-2 pr-3 font-mono">
                          {e.annual_mass_kg === null ? "n. d." : `${e.annual_mass_kg} kg`}
                        </td>
                        <td className="py-2 pr-3 font-mono">{formatPct(e.share_of_supply_pct)}</td>
                        <td className="py-2 pr-3 font-mono">
                          {e.stock_coverage_days === null
                            ? "n. d."
                            : `${e.stock_coverage_days} j`}
                        </td>
                        <td className="py-2 pr-3">
                          <StatusChip status={e.data_status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* ---- Marché : licence obligatoire ---- */}
          {bundle.market.length > 0 && (
            <Section
              testId="crma-market"
              title="Données de marché"
              subtitle="Affichées uniquement si la licence de la source l'autorise."
            >
              <ul className="space-y-2">
                {bundle.market.map((m) => (
                  <li
                    key={m.id}
                    className="rounded border border-[var(--color-border)] p-3 text-sm"
                    data-testid={`crma-market-${m.id}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-[var(--color-foreground)]">
                        {m.metric_code}
                      </span>
                      {m.value_withheld ? (
                        <span
                          className="text-[var(--color-muted-foreground)]"
                          data-testid="crma-market-withheld"
                        >
                          Valeur non communiquée — licence de la source
                        </span>
                      ) : (
                        <span className="font-mono text-[var(--color-foreground)]">
                          {m.numeric_value} {m.unit ?? ""}
                        </span>
                      )}
                      <StatusChip status={m.data_status} />
                    </div>
                    {m.value_withheld && m.license_reasons.length > 0 && (
                      <ul className="mt-1 list-disc pl-5 text-xs text-[var(--color-muted-foreground)]">
                        {m.license_reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    )}
                    {m.attribution_text && (
                      <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                        {m.attribution_text}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* ---- Actions d'atténuation ---- */}
          <Section
            testId="crma-actions"
            title="Actions d'atténuation"
            subtitle="Les réductions attendues sont des intentions déclarées : elles ne sont jamais soustraites du score."
          >
            {bundle.actions.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                Aucune action enregistrée pour cette matière.
              </p>
            ) : (
              <ul className="space-y-2">
                {bundle.actions.map((a) => (
                  <li key={a.id} className="rounded border border-[var(--color-border)] p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-[var(--color-foreground)]">{a.title}</span>
                      <span className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                        {a.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[var(--color-muted-foreground)]">
                      {a.action_type}
                      {a.target_stage_code ? ` · étape ${a.target_stage_code}` : ""}
                      {a.due_date ? ` · échéance ${a.due_date}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* ---- Preuves ---- */}
          <Section
            testId="crma-evidence"
            title="Preuves citées"
            subtitle="Références d'artefacts et de releases — jamais des URL directes."
          >
            {bundle.analysis.evidence.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                Aucune pièce de preuve rattachée aux observations de cette matière.
              </p>
            ) : (
              <ul className="space-y-1 text-sm text-[var(--color-muted-foreground)]">
                {bundle.analysis.evidence.map((ref, i) => (
                  <li key={i} className="font-mono text-xs">
                    artefact #{String(ref.artifact_id)} · source {String(ref.source_code ?? "—")} ·
                    release {String(ref.release_key ?? "—")} · étape {String(ref.stage_code ?? "—")}
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
