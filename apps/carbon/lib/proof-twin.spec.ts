import { describe, expect, it } from "vitest";

import {
  filterProofTwinNodes,
  getProofTwinStatusCounts,
  isProofTwinLive,
  PROOF_TWIN_NODES,
  resolveProofTwinMetric,
} from "./proof-twin";
import type { ConsolidatedSnapshot } from "@/lib/api";

function makeSnapshot(total = 1200): ConsolidatedSnapshot {
  return {
    generatedAt: "2026-05-22T10:00:00.000Z",
    company: {
      name: "Acme Industrie",
      reportingYear: 2026,
      sectorActivity: "Industrie",
      fte: 250,
      revenueNetEur: 42_000_000,
    },
    carbon: {
      scope1Tco2e: 100,
      scope2LbTco2e: 200,
      scope3Tco2e: 900,
      totalS123Tco2e: total,
      intensityRevenueTco2ePerMEur: null,
      intensityFteTco2ePerFte: null,
      turnoverAlignedPct: null,
      capexAlignedPct: null,
      renewableSharePct: null,
      targetReductionS12Pct: null,
      estimatedCbamCostEur: null,
    },
    vsme: {
      scorePct: null,
      indicateursCompletes: null,
      totalIndicateurs: null,
      statut: null,
      effectifTotal: null,
      ltir: null,
      ecartSalaireHf: null,
      pctFemmesMgmt: null,
    },
    esg: {
      scoreGlobal: null,
      scoreE: null,
      scoreS: null,
      scoreG: null,
      enjeuxMateriels: null,
      statut: null,
    },
    finance: {
      expositionTotaleEur: null,
      greenCapexPct: null,
      statutAlignementParis: null,
      pai1_totalGes: null,
    },
    deltas: {
      totalS123Tco2e: null,
      totalS123Tco2ePct: null,
      scoreGlobal: null,
      scorePct: null,
      greenCapexPct: null,
    },
    health: {
      carbon: {
        available: true,
        stale: false,
        cachedAt: "2026-05-22T10:00:00.000Z",
        ageSeconds: 60,
      },
    },
    alerts: { totalActive: 0, firedSinceLastCheck: 0, domains: [] },
    rawCarbon: null,
    rawVsme: null,
    rawEsg: null,
    rawFinance: null,
  };
}

describe("proof-twin model", () => {
  it("filters by scope, ESRS standard and proof status", () => {
    const filtered = filterProofTwinNodes(PROOF_TWIN_NODES, {
      scope: "scope3",
      standard: "E1",
      status: "missing",
    });

    expect(filtered.map((node) => node.id)).toEqual(["suppliers", "digital"]);
  });

  it("uses live metrics before demo metrics", () => {
    const node = PROOF_TWIN_NODES.find((item) => item.id === "esrs-report");
    expect(node).toBeDefined();

    const metric = resolveProofTwinMetric(node!, makeSnapshot(1234));

    expect(metric).toEqual({ value: 1234, unit: "tCO2e", source: "live" });
  });

  it("falls back to explicit demo metrics when live data is absent", () => {
    const node = PROOF_TWIN_NODES.find((item) => item.id === "site");
    expect(node).toBeDefined();

    const metric = resolveProofTwinMetric(node!, null);

    expect(metric.source).toBe("demo");
    expect(metric.value).toBe(1336);
  });

  it("counts proof statuses for audit summaries", () => {
    expect(getProofTwinStatusCounts(PROOF_TWIN_NODES)).toEqual({
      complete: 1,
      review: 3,
      missing: 2,
    });
  });

  it("detects live proof state from health or carbon values", () => {
    expect(isProofTwinLive(makeSnapshot())).toBe(true);

    const empty = makeSnapshot(0);
    empty.health.carbon.available = false;
    expect(isProofTwinLive(empty)).toBe(false);
  });
});
