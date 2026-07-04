/**
 * Tests cohérence catalogue Aéronautique / Communications & Affaires publiques.
 *
 * Contrat : le TS catalogue est la source de vérité unique pour la branche
 * Comms corporate aéro (statut démo UI, pas encore runtime). On vérifie
 * cohérence structurelle (IDs uniques, agents référencés par les scénarios,
 * sources non vides, sommaire aligné).
 */
import { describe, expect, it } from "vitest";

import {
  AERO_COMMS_AGENTS,
  AERO_COMMS_PROBLEMS,
  AERO_COMMS_SCENARIOS,
  AERO_COMMS_SOURCES,
  AERO_COMMS_SUMMARY,
} from "@/lib/data/aero-comms-catalog";

describe("Aéro Comms — catalogue cohérence", () => {
  it("4 agents avec slugs uniques", () => {
    expect(AERO_COMMS_AGENTS.length).toBe(4);
    const slugs = AERO_COMMS_AGENTS.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("chaque agent a mission, owner, primaryRule, et ≥ 1 KPI", () => {
    for (const a of AERO_COMMS_AGENTS) {
      expect(a.id).toMatch(/^AC-A\d{3}$/);
      expect(a.mission.length).toBeGreaterThan(40);
      expect(a.owner.length).toBeGreaterThan(0);
      expect(a.primaryRule.length).toBeGreaterThan(0);
      expect(a.kpis.length).toBeGreaterThan(0);
    }
  });

  it("sources : IDs uniques, autorité/domaine non vides, impact détaillé", () => {
    const ids = AERO_COMMS_SOURCES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of AERO_COMMS_SOURCES) {
      expect(s.id).toMatch(/^AC-S\d{3}$/);
      expect(s.authority.length).toBeGreaterThan(0);
      expect(s.domain.length).toBeGreaterThan(0);
      expect(s.impact.length).toBeGreaterThan(30);
    }
  });

  it("scénarios : 1 par agent, verdict ∈ {OK, WARN, KO}, métriques non vides", () => {
    expect(AERO_COMMS_SCENARIOS.length).toBeGreaterThanOrEqual(AERO_COMMS_AGENTS.length);
    const slugs = new Set(AERO_COMMS_AGENTS.map((a) => a.slug));
    for (const s of AERO_COMMS_SCENARIOS) {
      expect(s.id).toMatch(/^SCN-AC-\d{3}$/);
      expect(slugs.has(s.agentSlug)).toBe(true);
      expect(["OK", "WARN", "KO"]).toContain(s.verdict);
      expect(s.metrics.length).toBeGreaterThan(0);
      for (const m of s.metrics) {
        expect(m.label.length).toBeGreaterThan(0);
        expect(m.before.length).toBeGreaterThan(0);
        expect(m.after.length).toBeGreaterThan(0);
      }
    }
  });

  it("chaque agent a au moins un scénario associé", () => {
    for (const agent of AERO_COMMS_AGENTS) {
      const matching = AERO_COMMS_SCENARIOS.filter((s) => s.agentSlug === agent.slug);
      expect(matching.length).toBeGreaterThan(0);
    }
  });

  it("problèmes : 1 par agent, référence un agent_id existant", () => {
    expect(AERO_COMMS_PROBLEMS.length).toBe(AERO_COMMS_AGENTS.length);
    const ids = new Set(AERO_COMMS_AGENTS.map((a) => a.id));
    for (const p of AERO_COMMS_PROBLEMS) {
      expect(ids.has(p.agent)).toBe(true);
      expect(p.problem.length).toBeGreaterThan(20);
      expect(p.solution.length).toBeGreaterThan(40);
    }
  });

  it("AERO_COMMS_SUMMARY reflète les compteurs réels", () => {
    expect(AERO_COMMS_SUMMARY.agents).toBe(AERO_COMMS_AGENTS.length);
    expect(AERO_COMMS_SUMMARY.sources).toBe(AERO_COMMS_SOURCES.length);
    expect(AERO_COMMS_SUMMARY.scenarios).toBe(AERO_COMMS_SCENARIOS.length);
    expect(AERO_COMMS_SUMMARY.rules).toBeGreaterThan(0);
    expect(AERO_COMMS_SUMMARY.veilleDate).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
});
