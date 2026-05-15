import { describe, expect, it } from "vitest";

import {
  agentSafetyProfiles,
  getAgentSafetyProfile,
  type AgentSafetyProfile,
} from "@/lib/data/agent-safety";

describe("agentSafetyProfiles", () => {
  it("has at least 30 documented profiles (model-cards-30 target)", () => {
    expect(agentSafetyProfiles.length).toBeGreaterThanOrEqual(30);
  });

  it("covers the priority catalog-meta agents added in the model-cards-30 finalisation", () => {
    const meta = [
      "hedge-accounting",
      "pilier2-globe",
      "goodwill-ifrs3",
      "ifrs17-engine",
      "disclosure-ifrs17",
      "luxe-traceability",
      "anti-counterfeit-sc",
      "artisan-scout",
    ];
    for (const slug of meta) {
      const p = getAgentSafetyProfile(slug);
      expect(p, `missing safety profile for ${slug}`).toBeDefined();
    }
  });

  it("uses distinct routes for every profile", () => {
    const routes = agentSafetyProfiles.map((p) => p.route);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it("uses distinct agent ids for every profile", () => {
    const ids = agentSafetyProfiles.map((p) => p.agentId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each profile uses a valid riskLevel", () => {
    const allowed: AgentSafetyProfile["riskLevel"][] = ["minimal", "limited", "high"];
    for (const p of agentSafetyProfiles) {
      expect(allowed).toContain(p.riskLevel);
    }
  });

  it("each profile has non-empty allowed tools, forbidden actions and HITL requirements", () => {
    for (const p of agentSafetyProfiles) {
      expect(p.allowedTools.length).toBeGreaterThan(0);
      expect(p.forbiddenActions.length).toBeGreaterThan(0);
      expect(p.hitlRequiredFor.length).toBeGreaterThan(0);
    }
  });

  it("each profile declares at least one deterministic gate", () => {
    for (const p of agentSafetyProfiles) {
      expect(p.deterministicGates.length).toBeGreaterThan(0);
    }
  });

  it("each profile has at least one known limit (honest constraints)", () => {
    for (const p of agentSafetyProfiles) {
      expect(p.knownLimits.length).toBeGreaterThan(0);
    }
  });

  it("each profile declares a last testset reference", () => {
    for (const p of agentSafetyProfiles) {
      expect(p.lastTestset.length).toBeGreaterThan(0);
    }
  });

  it("each route follows /agents/<slug> convention", () => {
    for (const p of agentSafetyProfiles) {
      expect(p.route).toMatch(/^\/agents\/[a-z0-9-]+$/);
    }
  });

  it("covers the priority Bank Communication agents", () => {
    const banks = ["reg-bank-comms", "bank-crisis-comms", "esg-bank-comms", "client-bank-comms", "reg-watch-bank", "bank-evidence-guard"];
    for (const slug of banks) {
      const p = getAgentSafetyProfile(slug);
      expect(p, `missing safety profile for ${slug}`).toBeDefined();
    }
  });

  it("covers the priority Luxe Communication agents", () => {
    const luxe = ["maison-voice-guard", "luxe-press-agent", "luxe-event-comms", "heritage-comms", "green-claim-checker"];
    for (const slug of luxe) {
      const p = getAgentSafetyProfile(slug);
      expect(p, `missing safety profile for ${slug}`).toBeDefined();
    }
  });

  it("getAgentSafetyProfile returns undefined for unknown slugs", () => {
    expect(getAgentSafetyProfile("does-not-exist")).toBeUndefined();
    expect(getAgentSafetyProfile("")).toBeUndefined();
  });

  it("high-risk agents always require HITL on at least 3 distinct decisions", () => {
    const highs = agentSafetyProfiles.filter((p) => p.riskLevel === "high");
    expect(highs.length).toBeGreaterThan(0);
    for (const p of highs) {
      expect(p.hitlRequiredFor.length).toBeGreaterThanOrEqual(3);
    }
  });
});
