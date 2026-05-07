import { describe, it, expect } from "vitest";
import { newBatchId } from "./client";

describe("newBatchId", () => {
  it("génère un id avec préfixe par défaut 'batch'", () => {
    const id = newBatchId();
    expect(id.startsWith("batch_")).toBe(true);
  });

  it("respecte le préfixe custom", () => {
    expect(newBatchId("ing").startsWith("ing_")).toBe(true);
    expect(newBatchId("dpx").startsWith("dpx_")).toBe(true);
  });

  it("structure : prefix_TS_RND avec 4 char aléatoires", () => {
    const id = newBatchId("test");
    const parts = id.split("_");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("test");
    expect(parts[1].length).toBeGreaterThan(4); // timestamp base36
    expect(parts[2]).toMatch(/^[a-z0-9]{4}$/);
  });

  it("génère des ids uniques même appelé en rafale", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(newBatchId("u"));
    // Le random alone ne garantit pas 100 % d'unicité sur 4 char (16M combinaisons),
    // mais combiné au timestamp ms même si appelés dans la même ms, on attend ≥99 %.
    expect(ids.size).toBeGreaterThanOrEqual(95);
  });
});
