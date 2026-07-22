/**
 * Refonte visuelle du cockpit Ressources (feat/resources-cockpit-refonte).
 *
 * Fonctions pures + composants présentationnels au rendu serveur
 * (`renderToStaticMarkup`). Vérifie surtout l'HONNÊTETÉ des mappings (aucune
 * valeur inventée) et l'accessibilité (aria-label portant la valeur exacte).
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
  BAND_HEX,
  riskToneHex,
  confidenceToneHex,
  hhiTone,
  shareToAmber,
  isEu,
  meanOrNull,
  ISO_A2_TO_NUM,
} from "@/lib/resources-viz";
import { RadialGauge } from "@/components/resources/viz/radial-gauge";
import { StatTile } from "@/components/resources/viz/stat-tile";
import { ResourceRiskComparison } from "@/components/resources/resource-risk-comparison";
import { ConcentrationChoropleth } from "@/components/resources/viz/concentration-choropleth";
import type { ResourceAssessmentSummary } from "@/lib/api/resources";

// ---------------------------------------------------------------------------
// Helpers purs
// ---------------------------------------------------------------------------

describe("resources-viz — mappings honnêtes", () => {
  it("riskToneHex suit les bandes de risque (null → gris, jamais 0)", () => {
    expect(riskToneHex(null)).toBe(BAND_HEX.unknown);
    expect(riskToneHex(10)).toBe(BAND_HEX.low);
    expect(riskToneHex(30)).toBe(BAND_HEX.moderate);
    expect(riskToneHex(60)).toBe(BAND_HEX.high);
    expect(riskToneHex(80)).toBe(BAND_HEX.severe);
  });

  it("confidenceToneHex a son propre vocabulaire (solide/partielle/lacunaire)", () => {
    expect(confidenceToneHex(80)).toBe(BAND_HEX.low);
    expect(confidenceToneHex(50)).toBe(BAND_HEX.moderate);
    expect(confidenceToneHex(20)).toBe(BAND_HEX.severe);
    expect(confidenceToneHex(null)).toBe(BAND_HEX.unknown);
  });

  it("hhiTone suit le barème DOJ", () => {
    expect(hhiTone(null)).toBe("unknown");
    expect(hhiTone(1000)).toBe("low");
    expect(hhiTone(2000)).toBe("moderate");
    expect(hhiTone(3000)).toBe("high");
    expect(hhiTone(6000)).toBe("severe");
  });

  it("shareToAmber est une seule teinte, monotone, bornée", () => {
    expect(shareToAmber(0)).toBe("#8a6d16");
    expect(shareToAmber(100)).toBe("#fbbf24");
    expect(shareToAmber(150)).toBe("#fbbf24"); // clamp haut
    expect(shareToAmber(-5)).toBe("#8a6d16"); // clamp bas
  });

  it("isEu distingue UE / hors UE", () => {
    expect(isEu("FR")).toBe(true);
    expect(isEu("de")).toBe(true);
    expect(isEu("CN")).toBe(false);
    expect(isEu("US")).toBe(false);
  });

  it("meanOrNull ignore les null et rend null si rien", () => {
    expect(meanOrNull([70, 80])).toBe(75);
    expect(meanOrNull([null, 70, undefined])).toBe(70);
    expect(meanOrNull([null, null])).toBeNull();
    expect(meanOrNull([])).toBeNull();
  });

  it("ISO_A2_TO_NUM mappe les pays de la démo vers l ISO numérique", () => {
    expect(ISO_A2_TO_NUM.CN).toBe("156");
    expect(ISO_A2_TO_NUM.FR).toBe("250");
    expect(ISO_A2_TO_NUM.AU).toBe("036");
  });
});

// ---------------------------------------------------------------------------
// RadialGauge
// ---------------------------------------------------------------------------

describe("RadialGauge — jauge accessible", () => {
  it("porte la VRAIE valeur + la bande dans aria-label", () => {
    const html = renderToStaticMarkup(
      <RadialGauge value={70} color="#FB923C" bandLabel="Notable" ariaTitle="Exposition silicium" testId="g1" />,
    );
    expect(html).toContain('data-testid="g1"');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Exposition silicium : 70 — Notable"');
  });

  it("value=null affiche « n.c. » et « Non calculé » — jamais 0", () => {
    const html = renderToStaticMarkup(
      <RadialGauge value={null} color="#8A99B0" ariaTitle="Exposition xenon" testId="g2" />,
    );
    expect(html).toContain("n.c.");
    expect(html).toContain("Non calculé");
    expect(html).not.toContain(": 0 —");
  });
});

// ---------------------------------------------------------------------------
// StatTile
// ---------------------------------------------------------------------------

describe("StatTile — chiffre-clé honnête", () => {
  it("aria-label porte la valeur exacte (avec suffixe)", () => {
    const html = renderToStaticMarkup(
      <StatTile label="Confiance moyenne" value={62} suffix=" %" testId="t1" />,
    );
    expect(html).toContain('data-testid="t1"');
    expect(html).toContain('aria-label="Confiance moyenne : 62 %"');
  });

  it("value=null rend « — » sans inventer de chiffre", () => {
    const html = renderToStaticMarkup(<StatTile label="Exposition max" value={null} testId="t2" />);
    expect(html).toContain('aria-label="Exposition max : —"');
  });
});

// ---------------------------------------------------------------------------
// ResourceRiskComparison
// ---------------------------------------------------------------------------

function run(partial: Partial<ResourceAssessmentSummary>): ResourceAssessmentSummary {
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
    ...partial,
  };
}

describe("ResourceRiskComparison — barres classées, risque ≠ confiance", () => {
  it("classe par risque décroissant et sépare la confiance", () => {
    const html = renderToStaticMarkup(
      <ResourceRiskComparison
        runs={[
          run({ resource_slug: "coking-coal", risk_score: 55, confidence: 78 }),
          run({ resource_slug: "silicon-metal", risk_score: 70, confidence: 79 }),
        ]}
      />,
    );
    expect(html).toContain('data-testid="resource-risk-comparison"');
    // silicium (70) doit précéder coking-coal (55)
    expect(html.indexOf("silicon-metal")).toBeLessThan(html.indexOf("coking-coal"));
    expect(html).toContain("conf."); // confiance affichée séparément
  });

  it("un risque nul rend « Non calculé », jamais 0", () => {
    const html = renderToStaticMarkup(
      <ResourceRiskComparison runs={[run({ resource_slug: "hydrogen", risk_score: null })]} />,
    );
    expect(html).toContain("Non calculé");
  });

  it("liste vide → aucun rendu", () => {
    expect(renderToStaticMarkup(<ResourceRiskComparison runs={[]} />)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// ConcentrationChoropleth (carte offline)
// ---------------------------------------------------------------------------

describe("ConcentrationChoropleth — carte offline + vue tableau", () => {
  it("rend une carte SVG et une vue tableau des parts réelles", () => {
    const html = renderToStaticMarkup(
      <ConcentrationChoropleth
        shares={[
          { country_code: "CN", share_pct: 68 },
          { country_code: "FR", share_pct: 8 },
        ]}
        testId="choro"
      />,
    );
    expect(html).toContain('data-testid="choro"');
    expect(html).toContain("<svg");
    // vue tableau (jamais couleur seule) — parts réelles, triées
    expect(html).toContain("CN");
    expect(html).toContain("68 %");
    expect(html).toContain("FR");
  });

  it("aucune part → aucun rendu (absence de donnée, pas de carte vide trompeuse)", () => {
    expect(renderToStaticMarkup(<ConcentrationChoropleth shares={[]} />)).toBe("");
  });
});
