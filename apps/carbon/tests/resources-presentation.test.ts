/**
 * Ressources (Module 2, PR-M2C) — logique de présentation PURE + registre.
 *
 * Prouve les invariants côté client sans base : HHI par étape (jamais de mélange
 * inter-étapes), manquant ≠ zéro, risque ≠ confiance, fraîcheur dérivée, et
 * déclaration BETA de la feature dans feature-status.json.
 */

import { describe, it, expect } from "vitest";
import registry from "@/data/feature-status.json";
import {
  DIMENSION_LABEL,
  RESOURCE_DISCLAIMER,
  RESOURCE_METHODOLOGY_CODE,
  buildStageConcentration,
  confidenceBand,
  deriveSupplyStaleness,
  herfindahl,
  hhiBand,
  riskBand,
  type ResourceSupplyObservation,
} from "@/lib/api/resources";

function obs(partial: Partial<ResourceSupplyObservation>): ResourceSupplyObservation {
  return {
    id: 1,
    company_id: null,
    resource_id: 1,
    stage_code: "mining",
    country_code: "CN",
    metric_code: "production",
    share_pct: 100,
    volume_value: null,
    volume_unit: null,
    reference_year: 2024,
    data_status: "estimated",
    confidence: null,
    source_release_id: null,
    evidence_artifact_id: null,
    created_at: "2024-01-01T00:00:00Z",
    ...partial,
  };
}

describe("herfindahl (barème DOJ 0-10000)", () => {
  it("rend 10000 pour un monopole", () => {
    expect(herfindahl([100])).toBe(10000);
  });
  it("rend 2500 pour quatre parts égales", () => {
    expect(herfindahl([25, 25, 25, 25])).toBe(2500);
  });
  it("renormalise sur la somme observée (parts partielles)", () => {
    // deux parts égales, quel que soit le total observé → 5000
    expect(herfindahl([30, 30])).toBe(5000);
  });
  it("rend null sans aucune part positive", () => {
    expect(herfindahl([])).toBeNull();
    expect(herfindahl([0, 0])).toBeNull();
  });
});

describe("buildStageConcentration", () => {
  it("calcule HHI, premier pays, couverture et part hors UE par étape", () => {
    const stages = buildStageConcentration([
      obs({ stage_code: "mining", country_code: "CN", share_pct: 60 }),
      obs({ stage_code: "mining", country_code: "FR", share_pct: 20 }),
    ]);
    expect(stages).toHaveLength(1);
    const s = stages[0];
    expect(s.stage_code).toBe("mining");
    expect(s.top_country_code).toBe("CN");
    expect(s.country_count).toBe(2);
    expect(s.coverage_pct).toBe(80); // 60 + 20 observés
    expect(s.missing_share_pct).toBe(20);
    // 60 hors UE sur 80 observés = 75 %
    expect(s.non_eu_pct).toBe(75);
    expect(s.hhi).not.toBeNull();
  });

  it("ne mélange JAMAIS deux étapes dans un même HHI", () => {
    const stages = buildStageConcentration([
      obs({ stage_code: "mining", country_code: "CN", share_pct: 100 }),
      obs({ stage_code: "refining", country_code: "CN", share_pct: 50 }),
      obs({ stage_code: "refining", country_code: "JP", share_pct: 50 }),
    ]);
    expect(stages.map((s) => s.stage_code).sort()).toEqual(["mining", "refining"]);
    const refining = stages.find((s) => s.stage_code === "refining")!;
    expect(refining.hhi).toBe(5000); // deux parts égales, pas influencé par mining
  });

  it("laisse la couverture indéterminée pour des observations en volume", () => {
    const stages = buildStageConcentration([
      obs({ stage_code: "mining", share_pct: null, volume_value: 1000, volume_unit: "t" }),
    ]);
    expect(stages[0].is_share_based).toBe(false);
    expect(stages[0].coverage_pct).toBeNull();
    expect(stages[0].missing_share_pct).toBeNull();
  });
});

describe("hhiBand", () => {
  it("qualifie la concentration sans jamais rendre un HHI absent 'faible'", () => {
    expect(hhiBand(null).tone).toBe("unknown");
    expect(hhiBand(6000).tone).toBe("severe");
    expect(hhiBand(3000).tone).toBe("high");
    expect(hhiBand(2000).tone).toBe("moderate");
    expect(hhiBand(900).tone).toBe("low");
  });
});

describe("deriveSupplyStaleness", () => {
  it("marque STALE au-delà de 3 ans, pas en deçà", () => {
    const recent = deriveSupplyStaleness([obs({ reference_year: 2024 })], 2026);
    expect(recent.isStale).toBe(false);
    expect(recent.lastReferenceYear).toBe(2024);

    const old = deriveSupplyStaleness([obs({ reference_year: 2019 })], 2026);
    expect(old.isStale).toBe(true);
    expect(old.ageDays).toBeGreaterThan(0);
  });
  it("ne dérive rien sans observation (jamais STALE par défaut)", () => {
    const none = deriveSupplyStaleness([], 2026);
    expect(none.isStale).toBe(false);
    expect(none.ageDays).toBeNull();
  });
});

describe("risque ≠ confiance (paliers réutilisés de CRMA)", () => {
  it("ne présente jamais un risque absent comme faible", () => {
    expect(riskBand(null).tone).toBe("unknown");
    expect(riskBand(null).label).toBe("Non calculé");
  });
  it("utilise un vocabulaire de confiance distinct du risque", () => {
    expect(confidenceBand(80).label).toContain("Documentation");
    expect(riskBand(80).label).not.toContain("Documentation");
  });
});

describe("disclaimer & libellés", () => {
  it("le disclaimer nie explicitement un caractère officiel UE", () => {
    expect(RESOURCE_DISCLAIMER).toContain("PAS un score");
    expect(RESOURCE_DISCLAIMER).toContain(RESOURCE_METHODOLOGY_CODE);
  });
  it("chaque composante du moteur a un libellé FR", () => {
    for (const code of [
      "stage_concentration", "third_country_dependency", "supplier_dependency",
      "substitutability", "stock_coverage", "market_coverage", "data_quality",
      "component_coverage", "evidence_coverage", "freshness", "license_access",
    ]) {
      expect(DIMENSION_LABEL[code], `libellé manquant pour ${code}`).toBeTruthy();
    }
  });
});

describe("registre feature-status.json", () => {
  const feature = registry.features.find((f) => f.id === "resources-module");

  it("déclare la feature Ressources en BETA avec sa preuve", () => {
    expect(feature, "resources-module doit exister dans feature-status.json").toBeDefined();
    expect(feature?.statut).toBe("beta");
    expect(feature?.href).toBe("/resources");
    expect(feature?.preuve).toBeTruthy();
  });
  it("ne duplique aucun id de feature", () => {
    const ids = registry.features.map((f) => f.id);
    expect(new Set(ids).size, "ids de features dupliqués").toBe(ids.length);
  });
});
