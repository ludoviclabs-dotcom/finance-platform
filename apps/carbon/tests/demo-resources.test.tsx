/**
 * demo-resources.test.tsx — séquence « Dépendances industrielles étendues »
 * (MODULE 2, PR-M2D). Rendu serveur pur des beats (composants RÉELS du cockpit
 * alimentés par des données fictives) + garanties des données canoniques.
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

import { renderResourceBeat } from "@/components/demo/asterion/resources/resource-beat";
import { ASTERION_RESOURCES_TOUR } from "@/lib/demo/asterion-resources-tour";
import { SILICON_ASSESSMENT } from "@/lib/demo/asterion-resources-data";
import type { TourStep } from "@/lib/demo/asterion-motion-tour";

function beatStep(id: string): TourStep {
  const s = ASTERION_RESOURCES_TOUR.find((x) => x.beat === id);
  if (!s) throw new Error(`beat introuvable : ${id}`);
  return s;
}
function html(id: string): string {
  return renderToStaticMarkup(<>{renderResourceBeat(beatStep(id))}</>);
}

describe("séquence ressources — données canoniques", () => {
  it("risque et confiance sont deux grandeurs SÉPARÉES", () => {
    expect(SILICON_ASSESSMENT.risk_score).toBe(70.58);
    expect(SILICON_ASSESSMENT.confidence).toBe(79.4);
    expect(SILICON_ASSESSMENT.risk_score).not.toBe(SILICON_ASSESSMENT.confidence);
  });
  it("la substituabilité est une donnée manquante (jamais un risque nul)", () => {
    const sub = SILICON_ASSESSMENT.dimensions.find((d) => d.dimension_code === "substitutability");
    expect(sub?.available).toBe(false);
    expect(sub?.risk_value).toBeNull();
  });
  it("porte un disclaimer explicitement non officiel", () => {
    expect(SILICON_ASSESSMENT.disclaimer).toContain("PAS un score");
  });
  it("le parcours a 10 beats DISTINCTS", () => {
    expect(ASTERION_RESOURCES_TOUR).toHaveLength(10);
    const beats = ASTERION_RESOURCES_TOUR.map((s) => s.beat);
    expect(new Set(beats).size).toBe(10);
  });
});

describe("séquence ressources — beats rendus via les composants RÉELS", () => {
  it("beat « risque » : indice secondaire décomposé + risque‖confiance", () => {
    const h = html("risk");
    expect(h).toContain('data-testid="resource-index-card"');
    expect(h).toContain('data-testid="assessment-dimensions"');
    expect(h).toContain('data-testid="index-risk"');
    expect(h).toContain('data-testid="index-confidence"');
    expect(h).toContain('data-testid="resource-methodology-disclaimer"');
  });
  it("beat « données manquantes » affiche « Donnée manquante »", () => {
    expect(html("missing")).toContain("Donnée manquante");
  });
  it("beat « exposition » montre les trois origines : achat, BOM, activité", () => {
    const h = html("exposure");
    expect(h).toContain("purchase_line:842");
    expect(h).toContain("bom_item:501");
    expect(h).toContain("energy_activity:31");
  });
  it("beat « étape » montre la concentration par étape (jamais un agrégat)", () => {
    expect(html("stage")).toContain('data-testid="stage-concentration"');
  });
  it("beat « décision » est humaine et append-only", () => {
    const h = html("decision");
    expect(h).toContain('data-testid="res-beat-decision"');
    expect(h).toContain("append-only");
  });
});
