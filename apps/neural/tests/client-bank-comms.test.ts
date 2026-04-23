/**
 * Tests unitaires AG-B004 ClientBankComms — 4 gates client + Flesch FR.
 */

import { describe, it, expect } from "vitest";

import { checkClientScenario } from "@/lib/ai/client-bank-comms";
import { CLIENT_SCENARIOS } from "@/lib/data/bank-comms-catalog";

describe("AG-B004 ClientBankComms — testset 5 scénarios", () => {
  for (const scenario of CLIENT_SCENARIOS) {
    it(`${scenario.scenario_id}: verdict ${scenario.expected_verdict}`, async () => {
      const out = await checkClientScenario({
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

describe("AG-B004 ClientBankComms — gates ciblées", () => {
  it("SMS > 160 chars → BLOCK CANAL", async () => {
    const out = await checkClientScenario({
      scenarioId: "CLI-SMS-TOO-LONG",
      userId: "test",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.result.blockers).toContain("GATE-CLIENT-CANAL");
    expect(out.result.metrics.char_count).toBeGreaterThan(160);
    expect(out.result.metrics.char_limit).toBe(160);
  });

  it("hausse tarifs sans mentions légales → BLOCK MENTIONS", async () => {
    const out = await checkClientScenario({
      scenarioId: "CLI-TARIFS-NO-NOTICES",
      userId: "test",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.result.blockers).toContain("GATE-CLIENT-MENTIONS");
    expect(out.result.metrics.missing_notices.length).toBeGreaterThan(0);
  });

  it("fermeture agence avec ton promo → BLOCK TON", async () => {
    const out = await checkClientScenario({
      scenarioId: "CLI-AGENCE-TON",
      userId: "test",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.result.blockers).toContain("GATE-CLIENT-TON");
    expect(out.result.metrics.absolute_terms.length).toBeGreaterThan(0);
  });

  it("draft propre segment corporate → PASS", async () => {
    const out = await checkClientScenario({
      scenarioId: "CLI-INCIDENT-CORP",
      userId: "test",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.result.decision).toBe("PASS");
    expect(out.result.metrics.missing_notices).toEqual([]);
    expect(out.result.metrics.absolute_terms).toEqual([]);
  });

  it("métriques chars/limite toujours cohérentes", async () => {
    for (const s of CLIENT_SCENARIOS) {
      const out = await checkClientScenario({
        scenarioId: s.scenario_id,
        userId: "test",
      });
      if (!out.ok) continue;
      expect(out.result.metrics.char_count).toBe(s.draft.body_fr.length);
    }
  });
});
