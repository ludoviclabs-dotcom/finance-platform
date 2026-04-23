/**
 * Tests unitaires AG-B006 BankEvidenceGuard — résolveur déterministe.
 */

import { describe, it, expect } from "vitest";

import {
  resolveEvidence,
  runResolverTestset,
} from "@/lib/ai/bank-evidence-guard";
import { EVIDENCE_RESOLVER_TESTSET } from "@/lib/data/bank-comms-catalog";

describe("AG-B006 BankEvidenceGuard — testset auditable", () => {
  it("testset intégré : toutes les queries passent le critère", () => {
    const results = runResolverTestset();
    expect(results).toHaveLength(EVIDENCE_RESOLVER_TESTSET.length);
    const failed = results.filter((r) => !r.passed);
    expect(failed).toEqual([]);
  });

  for (const test of EVIDENCE_RESOLVER_TESTSET) {
    it(`${test.query_id}: ${test.label}`, () => {
      const pkg = resolveEvidence(test.query);
      expect(pkg.sources.length).toBeGreaterThanOrEqual(test.expected_sources_min);
      for (const expected of test.expected_blockers) {
        expect(pkg.blockers).toContain(expected);
      }
    });
  }
});

describe("AG-B006 BankEvidenceGuard — comportements attendus", () => {
  it("verdict BLOCKED quand aucune source ne match", () => {
    const pkg = resolveEvidence({
      communication_type: "FINANCIAL_RESULTS",
      jurisdiction: "FR",
      subjects: ["totally_unknown_subject_xyz"],
      freshness_policy: "FRESH-STRICT",
      top_k: 10,
    });
    expect(pkg.verdict).toBe("BLOCKED");
    expect(pkg.sources).toHaveLength(0);
    expect(pkg.blockers).toContain("NO_SOURCE_MATCHED");
  });

  it("verdict READY quand 2+ sources fraîches matchent", () => {
    const pkg = resolveEvidence({
      communication_type: "FINANCIAL_RESULTS",
      jurisdiction: "FR",
      subjects: ["financial_results", "prudential_ratios", "ifrs"],
      freshness_policy: "FRESH-STRICT",
      top_k: 10,
    });
    expect(pkg.verdict).toBe("READY");
    expect(pkg.sources.length).toBeGreaterThanOrEqual(2);
    // Toutes les sources retournées doivent être ACTIVE.
    expect(pkg.sources.every((s) => s.status === "ACTIVE")).toBe(true);
  });

  it("sources triées par score décroissant", () => {
    const pkg = resolveEvidence({
      communication_type: "FINANCIAL_RESULTS",
      jurisdiction: "FR",
      subjects: ["financial_results", "prudential_ratios", "ifrs"],
      freshness_policy: "FRESH-STRICT",
      top_k: 10,
    });
    for (let i = 1; i < pkg.sources.length; i += 1) {
      expect(pkg.sources[i - 1].score).toBeGreaterThanOrEqual(pkg.sources[i].score);
    }
  });

  it("sources non-applicables rejetées avec motif explicite", () => {
    const pkg = resolveEvidence({
      communication_type: "CLIENT_NOTICE",
      jurisdiction: "FR",
      subjects: ["financial_results"],
      freshness_policy: "FRESH-CLIENT",
      top_k: 10,
    });
    expect(pkg.rejection_reasons.length).toBeGreaterThan(0);
    // Chaque rejet a un source_id + reason non-vide.
    for (const r of pkg.rejection_reasons) {
      expect(r.source_id).toMatch(/^SRC-/);
      expect(r.reason.length).toBeGreaterThan(0);
    }
  });

  it("policy FRESH-STRICT rejette sources > 365j", () => {
    // On exerce via une query qui exige juste FINANCIAL_RESULTS+FR.
    const strict = resolveEvidence({
      communication_type: "FINANCIAL_RESULTS",
      jurisdiction: "FR",
      subjects: ["financial_results"],
      freshness_policy: "FRESH-STRICT",
      top_k: 20,
    });
    const standard = resolveEvidence({
      communication_type: "FINANCIAL_RESULTS",
      jurisdiction: "FR",
      subjects: ["financial_results"],
      freshness_policy: "FRESH-STANDARD",
      top_k: 20,
    });
    // STANDARD doit accepter au moins autant de sources que STRICT.
    expect(standard.sources.length).toBeGreaterThanOrEqual(strict.sources.length);
  });

  it("rejette une query invalide via Zod", () => {
    expect(() =>
      resolveEvidence({
        communication_type: 42,
        jurisdiction: "FR",
        subjects: [],
      }),
    ).toThrow();
  });
});
