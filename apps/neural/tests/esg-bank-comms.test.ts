/**
 * Tests unitaires AG-B003 ESGBankComms — 4 gates ESG.
 *
 * On teste via le fallback (qui est la vraie vérité du serveur puisque
 * le LLM est systématiquement overridé). Pour ça on appelle
 * checkEsgScenario avec env.ai.gatewayReady=false implicite (test
 * environment n'a pas AI_GATEWAY_API_KEY + VERCEL_ENV).
 */

import { describe, it, expect } from "vitest";

import { checkEsgScenario } from "@/lib/ai/esg-bank-comms";
import { ESG_SCENARIOS } from "@/lib/data/bank-comms-catalog";

describe("AG-B003 ESGBankComms — testset 5 scénarios", () => {
  for (const scenario of ESG_SCENARIOS) {
    it(`${scenario.scenario_id}: verdict ${scenario.expected_verdict}`, async () => {
      const out = await checkEsgScenario({
        scenarioId: scenario.scenario_id,
        userId: "test",
      });
      expect(out.ok).toBe(true);
      if (!out.ok) return;
      expect(out.result.gates).toHaveLength(4);
      expect(out.result.decision).toBe(scenario.expected_verdict);

      const blockedIds = out.result.gates
        .filter((g) => g.blocking && !g.passed)
        .map((g) => g.gate_id);
      for (const expected of scenario.expected_blockers) {
        expect(blockedIds).toContain(expected);
      }
    });
  }
});

describe("AG-B003 ESGBankComms — gates métier", () => {
  it("claim 'neutre en carbone' FR → BLOCK WORDING + JURISDICTION", async () => {
    const out = await checkEsgScenario({
      scenarioId: "ESG-NEUTRE-CARBONE",
      userId: "test",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.result.decision).toBe("BLOCK");
    expect(out.result.risk_class).toBe("CRITICAL");
    expect(out.result.blockers).toContain("GATE-ESG-WORDING");
    expect(out.result.blockers).toContain("GATE-ESG-JURISDICTION");
  });

  it("claim 'aligné taxonomie 18,3%' FR → PASS", async () => {
    const out = await checkEsgScenario({
      scenarioId: "ESG-ALIGNED-CHIFFRE",
      userId: "test",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.result.decision).toBe("PASS");
    expect(out.result.risk_class).toBe("LOW");
    expect(out.result.matched_patterns.length).toBeGreaterThan(0);
  });

  it("evidence STALE → BLOCK EVIDENCE", async () => {
    const out = await checkEsgScenario({
      scenarioId: "ESG-STALE-EVIDENCE",
      userId: "test",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.result.decision).toBe("BLOCK");
    expect(out.result.blockers).toContain("GATE-ESG-EVIDENCE");
  });

  it("claim sans match library → PASS_WITH_REVIEW (CLAIM-MATCH non-blocking)", async () => {
    const out = await checkEsgScenario({
      scenarioId: "ESG-UNKNOWN-PATTERN",
      userId: "test",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.result.decision).toBe("PASS_WITH_REVIEW");
    expect(out.result.warnings).toContain("GATE-ESG-CLAIM-MATCH");
  });
});
