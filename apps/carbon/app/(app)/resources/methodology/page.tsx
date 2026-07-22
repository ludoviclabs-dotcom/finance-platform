/**
 * Cockpit Ressources — méthodologie (Module 2, PR-M2C, BETA).
 *
 * Page documentaire (aucune donnée à charger). Décrit la méthode CarbonCo
 * versionnée `CC-RESOURCE-EXPOSURE 0.1.0` — composantes, poids, barème HHI,
 * analyse de sensibilité — et rappelle sans ambiguïté que ce n'est PAS une
 * notation officielle de l'Union européenne. Les poids ci-dessous sont le
 * miroir de `services/resources/scoring.py`.
 */

import { FeatureStatusBadge } from "@/components/ui/feature-status-badge";
import { ResourceNav } from "@/components/resources/resource-nav";
import { MethodologyDisclaimer } from "@/components/resources/methodology-disclaimer";
import {
  DIMENSION_LABEL,
  RESOURCE_METHODOLOGY_CODE,
  RESOURCE_METHODOLOGY_VERSION,
} from "@/lib/api/resources";

const RISK_COMPONENTS: { code: string; weight: number; mandatory?: boolean }[] = [
  { code: "stage_concentration", weight: 0.35, mandatory: true },
  { code: "third_country_dependency", weight: 0.2 },
  { code: "supplier_dependency", weight: 0.2 },
  { code: "substitutability", weight: 0.15 },
  { code: "stock_coverage", weight: 0.1 },
];

const CONFIDENCE_COMPONENTS: { code: string; weight: number }[] = [
  { code: "market_coverage", weight: 0.3 },
  { code: "data_quality", weight: 0.2 },
  { code: "component_coverage", weight: 0.15 },
  { code: "evidence_coverage", weight: 0.15 },
  { code: "freshness", weight: 0.1 },
  { code: "license_access", weight: 0.1 },
];

const PRINCIPLES: { title: string; body: string }[] = [
  {
    title: "Risque ≠ confiance",
    body: "Deux grandeurs distinctes, jamais multipliées ni fusionnées. Une donnée absente, périmée ou bloquée par licence dégrade la CONFIANCE — jamais le risque.",
  },
  {
    title: "Manquant ≠ zéro",
    body: "Une composante sans donnée est marquée « manquante », exclue du calcul, et les poids restants renormalisés. Elle n'est jamais comptée comme un risque nul.",
  },
  {
    title: "Concentration par étape",
    body: "Le HHI se calcule étape par étape (extraction, raffinage…). Jamais de moyenne inter-étapes : l'indice retient l'étape la plus concentrée et le signale.",
  },
  {
    title: "Pas d'indice inventé",
    body: "Si la concentration par étape (obligatoire) est absente, l'indice de risque global n'est pas produit (« Non calculé »). Un chiffre inventé serait pire qu'une absence.",
  },
  {
    title: "Sourcé-ou-avoué",
    body: "Chaque composante porte sa provenance (source_release_id). Une donnée non sourcée est affichée comme telle, jamais présentée comme confirmée officiellement.",
  },
  {
    title: "Reproductibilité",
    body: "Chaque run est immuable et porte une empreinte déterministe (input_hash) : deux calculs de mêmes entrées donnent le même résultat.",
  },
];

function WeightTable({
  title,
  rows,
  testId,
}: {
  title: string;
  rows: { code: string; weight: number; mandatory?: boolean }[];
  testId: string;
}) {
  return (
    <div data-testid={testId}>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-foreground)]">
        {title}
      </h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left text-[11px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
            <th scope="col" className="py-2 pr-4 font-semibold">Composante</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Poids nominal</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code} className="border-b border-[var(--color-border)]/60">
              <td className="py-2 pr-4 text-[var(--color-foreground)]">
                {DIMENSION_LABEL[r.code] ?? r.code}
                {r.mandatory && (
                  <span className="ml-2 rounded-full border border-amber-500/40 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                    obligatoire
                  </span>
                )}
              </td>
              <td className="py-2 pr-4 font-mono text-[var(--color-foreground)]">
                {Math.round(r.weight * 100)} %
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ResourceMethodologyPage() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <header className="mb-6">
        <div className="mb-1 flex items-center gap-2">
          <h1 className="text-2xl font-bold text-[var(--color-foreground)]">Méthodologie</h1>
          <FeatureStatusBadge status="beta" />
        </div>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {RESOURCE_METHODOLOGY_CODE} {RESOURCE_METHODOLOGY_VERSION} — méthode CarbonCo versionnée
          d&apos;exposition aux ressources stratégiques.
        </p>
      </header>

      <ResourceNav active="methodology" />

      <MethodologyDisclaimer className="mb-8" />

      <section className="mb-8" data-testid="methodology-principles">
        <h2 className="mb-3 text-lg font-semibold text-[var(--color-foreground)]">Principes structurants</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {PRINCIPLES.map((p) => (
            <li key={p.title} className="rounded-xl border border-[var(--color-border)] p-4">
              <h3 className="text-sm font-semibold text-[var(--color-foreground)]">{p.title}</h3>
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{p.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-8 grid gap-8 lg:grid-cols-2">
        <WeightTable title="Composantes de risque" rows={RISK_COMPONENTS} testId="methodology-risk-weights" />
        <WeightTable
          title="Composantes de confiance"
          rows={CONFIDENCE_COMPONENTS}
          testId="methodology-confidence-weights"
        />
      </section>

      <section className="mb-8" data-testid="methodology-hhi">
        <h2 className="mb-3 text-lg font-semibold text-[var(--color-foreground)]">
          Barème de concentration (HHI)
        </h2>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          La concentration géographique se mesure par l&apos;indice Herfindahl-Hirschman au barème
          canonique du Département de la Justice américain (DOJ), de 0 à 10 000 : un monopole vaut
          10 000, quatre parts égales valent 2 500. Paliers de lecture : &lt; 1 500 peu concentré,
          1 500-2 500 modérément concentré, 2 500-5 000 concentré, &gt; 5 000 très concentré. En
          dessous de 50 % de marché documenté à l&apos;étape retenue, le HHI est publié mais signalé
          (la confiance baisse, le risque non).
        </p>
      </section>

      <section className="mb-8" data-testid="methodology-sensitivity">
        <h2 className="mb-3 text-lg font-semibold text-[var(--color-foreground)]">
          Analyse de sensibilité
        </h2>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Chaque poids de composante disponible est perturbé de ±20 % (one-at-a-time), avec
          renormalisation identique au composite, pour mesurer le déplacement de l&apos;indice. La
          bande de sensibilité montre la fragilité du score — elle ne valide pas le modèle.
        </p>
      </section>

      <section className="mb-8" data-testid="methodology-sources">
        <h2 className="mb-3 text-lg font-semibold text-[var(--color-foreground)]">
          Sources & licences
        </h2>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Les données ouvertes et réutilisables (USGS, JRC RMIS, Eurostat, FAOSTAT, World Bank WGI,
          Euratom ESA) alimentent le calcul. Les sources propriétaires ou bloquées par licence
          (IEA, BGS, agences de prix, rapports gaz industriels) <span className="font-semibold text-[var(--color-foreground)]">dégradent la confiance, jamais le risque</span> :
          une valeur dont la licence interdit l&apos;usage dérivé n&apos;est pas transmise, et le
          score le reflète par une confiance plus basse.
        </p>
      </section>
    </div>
  );
}
