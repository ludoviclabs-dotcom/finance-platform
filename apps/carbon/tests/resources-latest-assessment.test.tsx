/**
 * P2 #137 — sélection du run le plus récent par ressource, et déduplication de la
 * comparaison des expositions.
 *
 * `current_only=true` n'exclut que les runs *superseded* d'un couple
 * (ressource, année) : une ressource évaluée sur plusieurs années renvoie donc
 * plusieurs runs non-superseded. Ces tests verrouillent le fait qu'aucun ancien
 * run ne peut écraser le plus récent, et qu'une ressource n'apparaît jamais deux
 * fois dans le classement.
 *
 * Assertions sans apostrophe (React échappe `'` → `&#x27;`).
 */

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: unknown; children: unknown }) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children as never}
    </a>
  ),
}));

import {
  selectLatestAssessmentPerResource,
  type ResourceAssessmentSummary,
} from "@/lib/api/resources";
import { ResourceRiskComparison } from "@/components/resources/resource-risk-comparison";

function run(p: Partial<ResourceAssessmentSummary>): ResourceAssessmentSummary {
  return {
    run_id: 1,
    resource_slug: "helium",
    resource_id: 1,
    assessment_year: 2025,
    status: "computed",
    risk_score: 64,
    confidence: 80,
    coverage_pct: 92,
    observed_hhi: 4111,
    missing_share_pct: 8,
    methodology_code: "CC-RESOURCE-EXPOSURE",
    methodology_version: "0.1.0",
    calculated_at: "2025-01-01T00:00:00Z",
    ...p,
  };
}

describe("selectLatestAssessmentPerResource", () => {
  it("une seule année : renvoie ce run", () => {
    const m = selectLatestAssessmentPerResource([run({ run_id: 7, assessment_year: 2024 })]);
    expect(m.size).toBe(1);
    expect(m.get("helium")?.run_id).toBe(7);
  });

  it("plusieurs années désordonnées : retient la plus récente", () => {
    const m = selectLatestAssessmentPerResource([
      run({ run_id: 1, assessment_year: 2023, risk_score: 10 }),
      run({ run_id: 2, assessment_year: 2025, risk_score: 90 }),
      run({ run_id: 3, assessment_year: 2024, risk_score: 50 }),
    ]);
    expect(m.get("helium")?.assessment_year).toBe(2025);
    expect(m.get("helium")?.risk_score).toBe(90);
  });

  it("aucun ancien run ne remplace le plus récent, quel que soit l ordre API", () => {
    const recent = run({ run_id: 2, assessment_year: 2025, risk_score: 90 });
    const old = run({ run_id: 1, assessment_year: 2023, risk_score: 10 });
    expect(selectLatestAssessmentPerResource([recent, old]).get("helium")?.run_id).toBe(2);
    expect(selectLatestAssessmentPerResource([old, recent]).get("helium")?.run_id).toBe(2);
  });

  it("deux runs de la MÊME année : départage par calculated_at décroissant", () => {
    const m = selectLatestAssessmentPerResource([
      run({ run_id: 1, assessment_year: 2025, calculated_at: "2025-01-01T00:00:00Z" }),
      run({ run_id: 2, assessment_year: 2025, calculated_at: "2025-06-01T00:00:00Z" }),
    ]);
    expect(m.get("helium")?.run_id).toBe(2);
  });

  it("calculated_at manquant ou illisible : ne gagne jamais par défaut", () => {
    const m = selectLatestAssessmentPerResource([
      run({ run_id: 5, assessment_year: 2025, calculated_at: "" }),
      run({ run_id: 6, assessment_year: 2025, calculated_at: "2025-03-01T00:00:00Z" }),
    ]);
    expect(m.get("helium")?.run_id).toBe(6);
  });

  it("horodatages identiques : départage stable par run_id", () => {
    const m = selectLatestAssessmentPerResource([
      run({ run_id: 4, assessment_year: 2025, calculated_at: "2025-03-01T00:00:00Z" }),
      run({ run_id: 9, assessment_year: 2025, calculated_at: "2025-03-01T00:00:00Z" }),
    ]);
    expect(m.get("helium")?.run_id).toBe(9);
  });

  it("aucune évaluation : map vide", () => {
    expect(selectLatestAssessmentPerResource([]).size).toBe(0);
  });

  it("plusieurs ressources : une entrée chacune", () => {
    const m = selectLatestAssessmentPerResource([
      run({ resource_slug: "helium", assessment_year: 2024 }),
      run({ resource_slug: "xenon", assessment_year: 2025 }),
    ]);
    expect(m.size).toBe(2);
  });
});

function rows(html: string): string[] {
  return [...html.matchAll(/data-testid="comparison-row-([a-z0-9-]+)"/g)].map((m) => m[1]);
}

describe("ResourceRiskComparison — une ligne par ressource, ordre déterministe", () => {
  it("deux ressources : deux lignes, risque décroissant", () => {
    const html = renderToStaticMarkup(
      <ResourceRiskComparison
        runs={[
          run({ resource_slug: "coking-coal", risk_score: 55 }),
          run({ resource_slug: "silicon-metal", risk_score: 70 }),
        ]}
      />,
    );
    expect(rows(html)).toEqual(["silicon-metal", "coking-coal"]);
  });

  it("une ressource sur TROIS années : une seule ligne, score le plus récent", () => {
    const html = renderToStaticMarkup(
      <ResourceRiskComparison
        runs={[
          run({ resource_slug: "helium", assessment_year: 2023, risk_score: 10, run_id: 1 }),
          run({ resource_slug: "helium", assessment_year: 2025, risk_score: 88, run_id: 2 }),
          run({ resource_slug: "helium", assessment_year: 2024, risk_score: 40, run_id: 3 }),
        ]}
      />,
    );
    expect(rows(html)).toEqual(["helium"]);
    expect(html).toContain("88");
  });

  it("ordre API inversé : résultat identique", () => {
    const a = run({ resource_slug: "xenon", risk_score: 66 });
    const b = run({ resource_slug: "hydrogen", risk_score: 25 });
    const straight = rows(renderToStaticMarkup(<ResourceRiskComparison runs={[a, b]} />));
    const reversed = rows(renderToStaticMarkup(<ResourceRiskComparison runs={[b, a]} />));
    expect(straight).toEqual(reversed);
    expect(straight).toEqual(["xenon", "hydrogen"]);
  });

  it("scores identiques : départage par confiance puis slug", () => {
    const html = renderToStaticMarkup(
      <ResourceRiskComparison
        runs={[
          run({ resource_slug: "beta", risk_score: 50, confidence: 60 }),
          run({ resource_slug: "alpha", risk_score: 50, confidence: 60 }),
          run({ resource_slug: "gamma", risk_score: 50, confidence: 90 }),
        ]}
      />,
    );
    expect(rows(html)).toEqual(["gamma", "alpha", "beta"]);
  });

  it("valeurs nulles : Non calculé, classé en dernier", () => {
    const html = renderToStaticMarkup(
      <ResourceRiskComparison
        runs={[
          run({ resource_slug: "nul", risk_score: null, confidence: null }),
          run({ resource_slug: "plein", risk_score: 30 }),
        ]}
      />,
    );
    expect(rows(html)).toEqual(["plein", "nul"]);
    expect(html).toContain("Non calculé");
  });

  it("aucune clé dupliquée même avec plusieurs années", () => {
    const html = renderToStaticMarkup(
      <ResourceRiskComparison
        runs={[
          run({ resource_slug: "helium", assessment_year: 2024, run_id: 1 }),
          run({ resource_slug: "helium", assessment_year: 2025, run_id: 2 }),
          run({ resource_slug: "xenon", assessment_year: 2025, run_id: 3 }),
        ]}
      />,
    );
    const got = rows(html);
    expect(new Set(got).size).toBe(got.length);
    expect(got.length).toBe(2);
  });
});
