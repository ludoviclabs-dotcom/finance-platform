/**
 * Tests unitaires AG-B001 RegBankComms — gates déterministes.
 *
 * Contrat : exécuter chacun des 5 scénarios du testset et vérifier
 * que :
 *  - decision correspond à expected_verdict
 *  - chaque expected_blocker est présent dans blockers (au minimum)
 *  - les gates cassées sont non-PASS
 *
 * Les tests sont indépendants du LLM : on exerce runDeterministicGates()
 * directement sur les drafts figés.
 */

import { describe, it, expect } from "vitest";

import { runDeterministicGates } from "@/lib/ai/reg-bank-comms";
import { REG_BANK_SCENARIOS } from "@/lib/data/bank-comms-catalog";

describe("AG-B001 RegBankComms — testset 5 scénarios", () => {
  for (const scenario of REG_BANK_SCENARIOS) {
    it(`${scenario.scenario_id}: verdict ${scenario.expected_verdict}`, () => {
      const gates = runDeterministicGates(scenario.draft);
      expect(gates).toHaveLength(4);

      const blockedIds = gates
        .filter((g) => g.blocking && !g.passed)
        .map((g) => g.gate_id);

      // Vérifie que les blockers attendus sont tous présents.
      for (const expected of scenario.expected_blockers) {
        expect(blockedIds).toContain(expected);
      }

      // Vérifie la décision côté gates.
      const blocked = gates.some((g) => g.blocking && !g.passed);
      const anyFailed = gates.some((g) => !g.passed);
      const decision = blocked ? "BLOCK" : anyFailed ? "PASS_WITH_REVIEW" : "PASS";
      expect(decision).toBe(scenario.expected_verdict);
    });
  }
});

describe("AG-B001 RegBankComms — gates individuelles", () => {
  it("GATE-PRIV bloque si contains_privileged_info=true", () => {
    const draft = {
      title: "Test",
      period: "Q1 2026",
      body_fr: "Texte court.",
      numbers: [],
      cited_sources: [],
      contains_privileged_info: true,
    };
    const gates = runDeterministicGates(draft);
    const priv = gates.find((g) => g.gate_id === "GATE-PRIV");
    expect(priv?.passed).toBe(false);
    expect(priv?.blocking).toBe(true);
    expect(priv?.reason).toMatch(/privilégiée|privilegee|privilegiee/i);
  });

  it("GATE-NUM-VALIDATED bloque si un chiffre n'est pas validated", () => {
    const draft = {
      title: "Test",
      period: "Q1 2026",
      body_fr: "Résultats",
      numbers: [
        { label: "RN", value: "100 M€", status: "forecast" as const, source_id: null },
      ],
      cited_sources: [],
      contains_privileged_info: false,
    };
    const gates = runDeterministicGates(draft);
    const num = gates.find((g) => g.gate_id === "GATE-NUM-VALIDATED");
    expect(num?.passed).toBe(false);
    expect(num?.offending_refs).toContain("RN");
  });

  it("GATE-SOURCE-ACTIVE bloque si un chiffre n'a pas de source ACTIVE", () => {
    const draft = {
      title: "Test",
      period: "Q1 2026",
      body_fr: "Résultats",
      numbers: [
        {
          label: "PNB",
          value: "2000",
          status: "validated" as const,
          source_id: "SRC-UNKNOWN-999",
        },
      ],
      cited_sources: [],
      contains_privileged_info: false,
    };
    const gates = runDeterministicGates(draft);
    const src = gates.find((g) => g.gate_id === "GATE-SOURCE-ACTIVE");
    expect(src?.passed).toBe(false);
  });

  it("GATE-WORDING détecte au moins un terme restreint HIGH/CRITICAL", () => {
    const draft = {
      title: "Test",
      period: "Q1 2026",
      body_fr:
        "Cette performance exceptionnelle confirme notre croissance garantie et record historique.",
      numbers: [],
      cited_sources: [],
      contains_privileged_info: false,
    };
    const gates = runDeterministicGates(draft);
    const word = gates.find((g) => g.gate_id === "GATE-WORDING");
    expect(word?.passed).toBe(false);
    expect((word?.offending_refs.length ?? 0)).toBeGreaterThan(0);
  });

  it("gates toutes PASS sur un draft minimal propre", () => {
    const draft = {
      title: "Test",
      period: "Q1 2026",
      body_fr: "Résultats trimestriels sobres.",
      numbers: [],
      cited_sources: [],
      contains_privileged_info: false,
    };
    const gates = runDeterministicGates(draft);
    expect(gates.every((g) => g.passed)).toBe(true);
  });
});
