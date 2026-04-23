/**
 * Tests unitaires AG-B002 BankCrisisComms — gates crise + SLA clock.
 */

import { describe, it, expect } from "vitest";

import { runCrisisGates } from "@/lib/ai/bank-crisis-comms";
import { BANK_CRISIS_SCENARIOS } from "@/lib/data/bank-comms-catalog";

describe("AG-B002 BankCrisisComms — testset 4 scénarios", () => {
  for (const scenario of BANK_CRISIS_SCENARIOS) {
    it(`${scenario.scenario_id}: verdict ${scenario.expected_verdict}`, () => {
      const { gates, sla } = runCrisisGates(scenario);
      expect(gates).toHaveLength(4);

      const blockedIds = gates
        .filter((g) => g.blocking && !g.passed)
        .map((g) => g.gate_id);

      for (const expected of scenario.expected_blockers) {
        expect(blockedIds).toContain(expected);
      }

      const blocked = gates.some((g) => g.blocking && !g.passed);
      const anyFailed = gates.some((g) => !g.passed);
      const decision = blocked ? "BLOCK" : anyFailed ? "PASS_WITH_REVIEW" : "PASS";
      expect(decision).toBe(scenario.expected_verdict);

      // Cohérence SLA
      expect(sla.severity).toBe(scenario.severity);
      expect(sla.elapsed_minutes).toBe(scenario.draft.minutes_since_incident);
      expect(sla.deadline_minutes).toBeGreaterThan(0);
      expect(sla.overdue).toBe(sla.elapsed_minutes > sla.deadline_minutes);
    });
  }
});

describe("AG-B002 BankCrisisComms — gates ciblées", () => {
  it("GATE-CRISIS-ROOT-CAUSE bloque si root_cause_stated=true", () => {
    const scenario = {
      scenario_id: "X",
      label: "x",
      incident_type: "CYBER" as const,
      severity: "SEV1" as const,
      expected_verdict: "BLOCK" as const,
      expected_blockers: [],
      draft: {
        title: "t",
        body_fr: "b",
        root_cause_stated: true,
        uses_approved_message: true,
        matched_statement_id: "HLD-CYBER-001",
        regulator_coord_confirmed: true,
        remediation_commitment: null,
        minutes_since_incident: 30,
      },
    };
    const { gates } = runCrisisGates(scenario);
    const rc = gates.find((g) => g.gate_id === "GATE-CRISIS-ROOT-CAUSE");
    expect(rc?.passed).toBe(false);
  });

  it("GATE-CRISIS-REMEDIATION bloque si engagement sans coord régulateur", () => {
    const scenario = {
      scenario_id: "X",
      label: "x",
      incident_type: "SERVICE_OUTAGE" as const,
      severity: "SEV2" as const,
      expected_verdict: "BLOCK" as const,
      expected_blockers: [],
      draft: {
        title: "t",
        body_fr: "b",
        root_cause_stated: false,
        uses_approved_message: false,
        matched_statement_id: null,
        regulator_coord_confirmed: false,
        remediation_commitment: "rétabli avant 18h",
        minutes_since_incident: 30,
      },
    };
    const { gates } = runCrisisGates(scenario);
    const rem = gates.find((g) => g.gate_id === "GATE-CRISIS-REMEDIATION");
    expect(rem?.passed).toBe(false);
  });

  it("GATE-CRISIS-SLA overdue si elapsed > deadline (SEV0=60min)", () => {
    const scenario = {
      scenario_id: "X",
      label: "x",
      incident_type: "LIQUIDITY_RUMOR" as const,
      severity: "SEV0" as const,
      expected_verdict: "BLOCK" as const,
      expected_blockers: [],
      draft: {
        title: "t",
        body_fr: "b",
        root_cause_stated: false,
        uses_approved_message: true,
        matched_statement_id: "HLD-LIQ-001",
        regulator_coord_confirmed: true,
        remediation_commitment: null,
        minutes_since_incident: 120, // > 60 SEV0 → overdue
      },
    };
    const { gates, sla } = runCrisisGates(scenario);
    expect(sla.overdue).toBe(true);
    const slaGate = gates.find((g) => g.gate_id === "GATE-CRISIS-SLA");
    expect(slaGate?.passed).toBe(false);
  });
});
