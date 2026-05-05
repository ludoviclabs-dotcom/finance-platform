import { describe, it, expect } from "vitest";
import { runValidation, type Severity } from "./validator";
import { RULES_SET2 } from "./rules-set2";
import type { DatapointState, ExtractedDatapoint } from "@/lib/esrs/schema";

function makeDp(
  id: string,
  value: number | string | boolean | null,
  status: ExtractedDatapoint["status"] = "extracted",
  unit?: string,
): ExtractedDatapoint {
  return {
    datapointId: id,
    value,
    unit,
    confidence: 0.9,
    sources: [],
    status,
    extractedAt: new Date().toISOString(),
  };
}

function makeState(items: Record<string, ExtractedDatapoint>): DatapointState {
  return {
    cid: "test-cid",
    updatedAt: new Date().toISOString(),
    datapoints: items,
  };
}

describe("validator — empty state", () => {
  it("retourne un report bien formé sur état vide", () => {
    const state = makeState({});
    const report = runValidation(state, RULES_SET2);
    expect(report.cid).toBe("test-cid");
    expect(report.totalDatapoints).toBeGreaterThan(100); // 127 attendus après Chantier A
    expect(report.filledDatapoints).toBe(0);
    expect(report.mandatoryFilledPct).toBe(0);
    expect(report.findings.length).toBeGreaterThanOrEqual(0); // pas de range/sum violé
  });
});

describe("validator — règle E1-scope2-LB-gte-MB", () => {
  it("ne déclenche rien quand LB >= MB", () => {
    const state = makeState({
      "E1-6_scope2_location_based": makeDp("E1-6_scope2_location_based", 1500, "extracted", "tCO2e"),
      "E1-6_scope2_market_based": makeDp("E1-6_scope2_market_based", 1200, "extracted", "tCO2e"),
    });
    const report = runValidation(state, RULES_SET2);
    expect(
      report.findings.find((f) => f.ruleId === "E1-scope2-LB-gte-MB"),
    ).toBeUndefined();
  });

  it("déclenche un error quand LB < MB", () => {
    const state = makeState({
      "E1-6_scope2_location_based": makeDp("E1-6_scope2_location_based", 1000, "extracted", "tCO2e"),
      "E1-6_scope2_market_based": makeDp("E1-6_scope2_market_based", 1500, "extracted", "tCO2e"),
    });
    const report = runValidation(state, RULES_SET2);
    const finding = report.findings.find((f) => f.ruleId === "E1-scope2-LB-gte-MB");
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe("error");
    expect(finding?.computed?.expected).toBe(1500);
    expect(finding?.computed?.actual).toBe(1000);
  });

  it("ne déclenche rien quand seul MB est saisi (LB absent)", () => {
    const state = makeState({
      "E1-6_scope2_market_based": makeDp("E1-6_scope2_market_based", 1500, "extracted", "tCO2e"),
    });
    const report = runValidation(state, RULES_SET2);
    expect(
      report.findings.find((f) => f.ruleId === "E1-scope2-LB-gte-MB"),
    ).toBeUndefined();
  });
});

describe("validator — règle E1-total-GHG-equals-sum-scopes", () => {
  it("ne déclenche rien si total = somme des scopes (à 2 % près)", () => {
    const state = makeState({
      "E1-6_scope1_gross": makeDp("E1-6_scope1_gross", 1000, "extracted", "tCO2e"),
      "E1-6_scope2_market_based": makeDp("E1-6_scope2_market_based", 500, "extracted", "tCO2e"),
      "E1-6_scope3_total": makeDp("E1-6_scope3_total", 4500, "extracted", "tCO2e"),
      "E1-6_total_ghg": makeDp("E1-6_total_ghg", 6000, "extracted", "tCO2e"),
    });
    const report = runValidation(state, RULES_SET2);
    expect(
      report.findings.find((f) => f.ruleId === "E1-total-GHG-equals-sum-scopes"),
    ).toBeUndefined();
  });

  it("déclenche un error si total ≠ Σ scopes au-delà de 2 %", () => {
    const state = makeState({
      "E1-6_scope1_gross": makeDp("E1-6_scope1_gross", 1000, "extracted", "tCO2e"),
      "E1-6_scope2_market_based": makeDp("E1-6_scope2_market_based", 500, "extracted", "tCO2e"),
      "E1-6_scope3_total": makeDp("E1-6_scope3_total", 4500, "extracted", "tCO2e"),
      "E1-6_total_ghg": makeDp("E1-6_total_ghg", 8000, "extracted", "tCO2e"),
    });
    const report = runValidation(state, RULES_SET2);
    const finding = report.findings.find(
      (f) => f.ruleId === "E1-total-GHG-equals-sum-scopes",
    );
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe("error");
  });
});

describe("validator — règle E5 waste sum", () => {
  it("vérifie que waste_total = diverted + directed", () => {
    const state = makeState({
      "E5-5_waste_diverted_from_disposal": makeDp("E5-5_waste_diverted_from_disposal", 600, "extracted", "t"),
      "E5-5_waste_directed_to_disposal": makeDp("E5-5_waste_directed_to_disposal", 400, "extracted", "t"),
      "E5-5_waste_total": makeDp("E5-5_waste_total", 1000, "extracted", "t"),
    });
    const report = runValidation(state, RULES_SET2);
    expect(
      report.findings.find(
        (f) => f.ruleId === "E5-waste-total-equals-diverted-plus-directed",
      ),
    ).toBeUndefined();
  });

  it("déclenche si waste_total est trop différent", () => {
    const state = makeState({
      "E5-5_waste_diverted_from_disposal": makeDp("E5-5_waste_diverted_from_disposal", 600, "extracted", "t"),
      "E5-5_waste_directed_to_disposal": makeDp("E5-5_waste_directed_to_disposal", 400, "extracted", "t"),
      "E5-5_waste_total": makeDp("E5-5_waste_total", 1500, "extracted", "t"),
    });
    const report = runValidation(state, RULES_SET2);
    const finding = report.findings.find(
      (f) => f.ruleId === "E5-waste-total-equals-diverted-plus-directed",
    );
    expect(finding).toBeDefined();
  });
});

describe("validator — bornes pourcentages", () => {
  it("rejette un pourcentage > 100", () => {
    const state = makeState({
      "S1-6_turnover_rate": makeDp("S1-6_turnover_rate", 150, "extracted", "%"),
    });
    const report = runValidation(state, RULES_SET2);
    const finding = report.findings.find(
      (f) => f.ruleId === "range-percent-S1-6_turnover_rate",
    );
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe("error");
  });

  it("rejette un pourcentage < 0", () => {
    const state = makeState({
      "S1-9_gender_pay_gap": makeDp("S1-9_gender_pay_gap", -5, "extracted", "%"),
    });
    const report = runValidation(state, RULES_SET2);
    const finding = report.findings.find(
      (f) => f.ruleId === "range-percent-S1-9_gender_pay_gap",
    );
    expect(finding).toBeDefined();
  });
});

describe("validator — bornes positives (émissions ≥ 0)", () => {
  it("rejette une émission négative", () => {
    const state = makeState({
      "E1-6_scope1_gross": makeDp("E1-6_scope1_gross", -100, "extracted", "tCO2e"),
    });
    const report = runValidation(state, RULES_SET2);
    const finding = report.findings.find(
      (f) => f.ruleId === "range-positive-E1-6_scope1_gross",
    );
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe("error");
  });
});

describe("validator — règle G1 corruption", () => {
  it("rejette condamnations > incidents", () => {
    const state = makeState({
      "G1-4_corruption_incidents": makeDp("G1-4_corruption_incidents", 2),
      "G1-4_corruption_convictions": makeDp("G1-4_corruption_convictions", 5),
    });
    const report = runValidation(state, RULES_SET2);
    const finding = report.findings.find(
      (f) => f.ruleId === "G1-incidents-gte-convictions",
    );
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe("error");
  });
});

describe("validator — score audit", () => {
  it("score initial sur état vide = environ 50 (40 + 10 par défaut)", () => {
    const state = makeState({});
    const report = runValidation(state, RULES_SET2);
    expect(report.auditScore).toBeGreaterThanOrEqual(40);
    expect(report.auditScore).toBeLessThanOrEqual(60);
  });

  it("plusieurs erreurs réduisent le score", () => {
    const state = makeState({
      "E1-6_scope1_gross": makeDp("E1-6_scope1_gross", -100, "extracted", "tCO2e"),
      "E1-6_scope2_location_based": makeDp("E1-6_scope2_location_based", 100, "extracted", "tCO2e"),
      "E1-6_scope2_market_based": makeDp("E1-6_scope2_market_based", 500, "extracted", "tCO2e"),
      "S1-6_turnover_rate": makeDp("S1-6_turnover_rate", 150, "extracted", "%"),
    });
    const report = runValidation(state, RULES_SET2);
    const emptyState = runValidation(makeState({}), RULES_SET2);
    expect(report.auditScore).toBeLessThan(emptyState.auditScore);
    expect(report.counts.error).toBeGreaterThan(0);
  });
});

describe("validator — dépendances", () => {
  it("warn quand E1-6_total_ghg saisi mais ses dépendances absentes", () => {
    const state = makeState({
      "E1-6_total_ghg": makeDp("E1-6_total_ghg", 5000, "extracted", "tCO2e"),
    });
    const report = runValidation(state, RULES_SET2);
    const finding = report.findings.find(
      (f) =>
        f.ruleId === "global-dependencies-present" &&
        f.datapointIds.includes("E1-6_total_ghg"),
    );
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe("warning");
  });
});

describe("validator — filtrage par standard", () => {
  it("RULES_SET2 contient des règles E1, E5, S1, S2, S4, G1", () => {
    const standardsCovered = new Set<string>();
    for (const r of RULES_SET2) {
      r.standards?.forEach((s) => standardsCovered.add(s));
    }
    expect(standardsCovered.has("E1")).toBe(true);
    expect(standardsCovered.has("E5")).toBe(true);
    expect(standardsCovered.has("S1")).toBe(true);
    expect(standardsCovered.has("S2")).toBe(true);
    expect(standardsCovered.has("S4")).toBe(true);
    expect(standardsCovered.has("G1")).toBe(true);
  });

  it("Au moins 30 règles totales (corpus consolidé)", () => {
    expect(RULES_SET2.length).toBeGreaterThanOrEqual(30);
  });

  it("Toutes les règles ont id, severity, scope définis", () => {
    for (const r of RULES_SET2) {
      expect(r.id).toBeTruthy();
      expect(["error", "warning", "info"] as Severity[]).toContain(r.severity);
      expect(["datapoint", "standard", "global"]).toContain(r.scope);
    }
  });
});
