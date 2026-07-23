/**
 * Import handoff Claude Design — nuage risque × confiance et concentration
 * pays agrégée sur /resources (composants purs, données réelles uniquement).
 *
 * Assertions sans apostrophe (React échappe `'` → `&#x27;`).
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { aggregateCountryConcentration } from "@/lib/resources-viz";
import { RiskConfidenceScatter } from "@/components/resources/viz/risk-confidence-scatter";
import { AggregateConcentrationPanel } from "@/components/resources/viz/aggregate-concentration-panel";
import type { ResourceAssessmentSummary } from "@/lib/api/resources";

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

// ---------------------------------------------------------------------------
// aggregateCountryConcentration — pure
// ---------------------------------------------------------------------------

describe("aggregateCountryConcentration", () => {
  it("cumule les parts entre ressources (une étape déterminante chacune)", () => {
    const out = aggregateCountryConcentration([
      [{ country_code: "CN", share_pct: 40 }, { country_code: "FR", share_pct: 10 }],
      [{ country_code: "CN", share_pct: 20 }],
    ]);
    const cn = out.find((o) => o.countryCode === "CN")!;
    const fr = out.find((o) => o.countryCode === "FR")!;
    // CN = (40+20)/70 = 85.7% ; FR = 10/70 = 14.3%
    expect(cn.sharePct).toBeCloseTo(85.71, 1);
    expect(fr.sharePct).toBeCloseTo(14.29, 1);
  });

  it("classe par part décroissante", () => {
    const out = aggregateCountryConcentration([
      [{ country_code: "A", share_pct: 10 }, { country_code: "B", share_pct: 90 }],
    ]);
    expect(out.map((o) => o.countryCode)).toEqual(["B", "A"]);
  });

  it("regroupe au-delà de topN dans un bucket Autres — jamais une omission silencieuse", () => {
    const shares = ["A", "B", "C", "D", "E", "F", "G"].map((c, i) => [{ country_code: c, share_pct: 10 - i }]);
    const out = aggregateCountryConcentration(shares, 3);
    expect(out).toHaveLength(3);
    expect(out[2].countryCode).toBe("Autres");
    const total = out.reduce((s, o) => s + o.sharePct, 0);
    expect(total).toBeCloseTo(100, 1); // rien n'est perdu dans le regroupement
  });

  it("aucune donnée : liste vide, jamais un graphique trompeur", () => {
    expect(aggregateCountryConcentration([])).toEqual([]);
    expect(aggregateCountryConcentration([[]])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// RiskConfidenceScatter
// ---------------------------------------------------------------------------

describe("RiskConfidenceScatter", () => {
  it("rend un point par run avec risque et confiance réels", () => {
    const html = renderToStaticMarkup(
      <RiskConfidenceScatter
        runs={[run({ resource_slug: "silicon-metal", risk_score: 71, confidence: 84, observed_hhi: 6240 })]}
        namesBySlug={new Map([["silicon-metal", "Silicium métal"]])}
        testId="scatter"
      />,
    );
    expect(html).toContain('data-testid="scatter"');
    expect(html).toContain("<svg");
    expect(html).toContain("Silicium métal");
  });

  it("exclut du graphique un run sans risque ou confiance calculé, et le signale", () => {
    const html = renderToStaticMarkup(
      <RiskConfidenceScatter
        runs={[
          run({ resource_slug: "hydrogen", risk_score: null }),
          run({ resource_slug: "helium", risk_score: 64, confidence: 80 }),
        ]}
        namesBySlug={new Map()}
      />,
    );
    expect(html).toContain('data-testid="scatter-skipped-note"');
    expect(html).toContain("1 ressource");
  });

  it("aucun run : aucun rendu", () => {
    expect(renderToStaticMarkup(<RiskConfidenceScatter runs={[]} namesBySlug={new Map()} />)).toBe("");
  });

  it("ne dessine aucune zone de danger a seuil code en dur", () => {
    // Le seuil 66.0 n'existe que dans du texte libre backend — jamais parse ici.
    const html = renderToStaticMarkup(
      <RiskConfidenceScatter
        runs={[run({ resource_slug: "xenon", risk_score: 66.67, confidence: 75 })]}
        namesBySlug={new Map()}
      />,
    );
    expect(html).not.toContain("66.0");
    expect(html).not.toContain("risque élevé");
  });
});

// ---------------------------------------------------------------------------
// AggregateConcentrationPanel
// ---------------------------------------------------------------------------

describe("AggregateConcentrationPanel", () => {
  it("rend les barres classées et le HHI moyen réel", () => {
    const html = renderToStaticMarkup(
      <AggregateConcentrationPanel
        shares={[{ countryCode: "CN", sharePct: 41.2 }, { countryCode: "US", sharePct: 15.3 }]}
        avgHhi={3947}
        testId="agg"
      />,
    );
    expect(html).toContain('data-testid="agg"');
    expect(html).toContain("CN");
    expect(html).toContain("41 %");
    expect(html).toContain("3947");
  });

  it("masque la note HHI si aucune moyenne n est calculable", () => {
    const html = renderToStaticMarkup(
      <AggregateConcentrationPanel shares={[{ countryCode: "CN", sharePct: 100 }]} avgHhi={null} />,
    );
    expect(html).not.toContain("HHI moyen");
  });

  it("aucune part : aucun rendu", () => {
    expect(renderToStaticMarkup(<AggregateConcentrationPanel shares={[]} avgHhi={null} />)).toBe("");
  });
});
