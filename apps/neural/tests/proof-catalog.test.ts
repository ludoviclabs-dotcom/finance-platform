import { describe, expect, it } from "vitest";

import { getProofCatalog } from "@/lib/proof-catalog";

describe("proof catalog", () => {
  it("keeps public proof counters aligned with the audited NEURAL inventory", () => {
    const catalog = getProofCatalog();

    expect(catalog.counts.desktopNeuralWorkbooks).toBe(44);
    expect(catalog.counts.carbonWorkbooksExcluded).toBe(6);
    expect(catalog.counts.runtimeWorkbooks).toBe(35);
    expect(catalog.counts.liveAgentsWithExcel).toBe(27);
    expect(catalog.counts.liveCells).toBe(7);
    expect(catalog.counts.frameworkCells).toBe(42);
  });

  it("does not mark any current agent as client-ready by default", () => {
    const catalog = getProofCatalog();

    expect(catalog.counts.clientReady).toBe(0);
    expect(catalog.agentProofs.every((agent) => agent.proofScore < 4)).toBe(true);
  });

  it("exposes strict proof fields for flagship agents", () => {
    const catalog = getProofCatalog();
    const flagship = catalog.agentProofs.filter((agent) => agent.isFlagship);

    expect(catalog.counts.exportOrAudit).toBeGreaterThanOrEqual(5);
    expect(flagship.length).toBeGreaterThanOrEqual(5);
    expect(catalog.clientReadyCriteria).toContain("Supervision humaine explicite");
    expect(catalog.excludedWorkbooks[0]?.count).toBe(6);
    expect(
      flagship.every((agent) => agent.humanSupervision && agent.nextAction),
    ).toBe(true);
  });

  it("keeps the 168-agent number as target capacity only", () => {
    const catalog = getProofCatalog();

    expect(catalog.counts.frameworkTargetAgents).toBe(168);
    expect(catalog.counts.publicAgentPages).toBeLessThan(catalog.counts.frameworkTargetAgents);
  });
});
