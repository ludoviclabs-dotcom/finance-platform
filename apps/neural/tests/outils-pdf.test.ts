import { describe, expect, it } from "vitest";

import { signReceipt, verifyUrl, shortHash } from "@/lib/outils/sign";
import { computeAiActResult } from "@/lib/outils/compute/ai-act-classifier";
import { buildAiActPdfInput } from "@/lib/outils/adapters/ai-act-classifier";
import { computeRoi, type RoiInputs } from "@/lib/outils/compute/roi-calculator";
import { buildRoiPdfInput } from "@/lib/outils/adapters/roi-calculator";
import { computeMaturityResult } from "@/lib/outils/compute/maturity-quiz";
import { buildMaturityPdfInput } from "@/lib/outils/adapters/maturity-quiz";
import { buildOutilsPdf } from "@/lib/outils/pdf-builder";

describe("signReceipt", () => {
  it("is deterministic for the same input + timestamp", () => {
    const ts = "2026-05-15T10:00:00.000Z";
    const a = signReceipt("ai-act-classifier", { foo: "bar" }, ts);
    const b = signReceipt("ai-act-classifier", { foo: "bar" }, ts);
    expect(a.hash).toBe(b.hash);
    expect(a.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("yields different hashes for different payloads", () => {
    const ts = "2026-05-15T10:00:00.000Z";
    const a = signReceipt("ai-act-classifier", { foo: "bar" }, ts);
    const b = signReceipt("ai-act-classifier", { foo: "baz" }, ts);
    expect(a.hash).not.toBe(b.hash);
  });

  it("yields the same hash regardless of object key order", () => {
    const ts = "2026-05-15T10:00:00.000Z";
    const a = signReceipt("ai-act-classifier", { foo: "1", bar: "2" }, ts);
    const b = signReceipt("ai-act-classifier", { bar: "2", foo: "1" }, ts);
    expect(a.hash).toBe(b.hash);
  });

  it("changes the hash when the timestamp changes", () => {
    const a = signReceipt("ai-act-classifier", { x: 1 }, "2026-05-15T10:00:00.000Z");
    const b = signReceipt("ai-act-classifier", { x: 1 }, "2026-05-15T11:00:00.000Z");
    expect(a.hash).not.toBe(b.hash);
  });

  it("exposes a verify URL and short hash helper", () => {
    const r = signReceipt("ai-act-classifier", {}, "2026-05-15T10:00:00.000Z");
    expect(verifyUrl(r.hash)).toBe(`https://neural-ai.fr/verify/outil/${r.hash}`);
    expect(shortHash(r.hash)).toMatch(/^[a-f0-9]{8}…[a-f0-9]{8}$/);
  });
});

describe("computeAiActResult", () => {
  it("returns 'interdit' if any answer carries that weight", () => {
    // From the JSON: question "manipulation" has options with weight 'interdit'.
    const r = computeAiActResult({ manipulation: "oui" });
    expect(r.class).toBe("interdit");
  });

  it("returns 'haut' for Annexe III contexts (e.g. RH)", () => {
    const r = computeAiActResult({ context: "rh" });
    expect(r.class).toBe("haut");
  });

  it("returns 'limite' for marketing context", () => {
    const r = computeAiActResult({ context: "marketing" });
    expect(r.class).toBe("limite");
  });

  it("returns 'minimal' for internal productivity", () => {
    const r = computeAiActResult({ context: "interne" });
    expect(r.class).toBe("minimal");
  });

  it("priority interdit > haut > limite > minimal", () => {
    const r = computeAiActResult({
      context: "interne",
      manipulation: "oui",
    });
    expect(r.class).toBe("interdit");
  });

  it("always returns the documented shape", () => {
    const r = computeAiActResult({ context: "rh" });
    expect(r.label).toBeTruthy();
    expect(r.summary.length).toBeGreaterThan(20);
    expect(r.obligations.length).toBeGreaterThan(0);
  });
});

describe("buildAiActPdfInput", () => {
  it("produces sections covering answers + obligations + next steps", () => {
    const { input, receipt } = buildAiActPdfInput(
      { context: "rh", manipulation: "non" },
      "2026-05-15T10:00:00.000Z",
    );
    expect(receipt.hash).toMatch(/^[a-f0-9]{64}$/);
    const headings = input.sections.map((s) => s.heading);
    expect(headings).toContain("Vos réponses");
    expect(headings).toContain("Obligations applicables");
    expect(headings).toContain("Prochaines étapes");
    expect(input.title).toMatch(/AI Act/);
    expect(input.resultHeadline).toBe(receipt.payload.result.label);
  });

  it("includes the recommended NEURAL agent when present", () => {
    const { input } = buildAiActPdfInput({ context: "rh" }, "2026-05-15T10:00:00.000Z");
    const hasAgent = input.sections.some((s) => s.heading === "Agent NEURAL recommandé");
    if (input.receipt.payload.result.neuralAgent) {
      expect(hasAgent).toBe(true);
    } else {
      expect(hasAgent).toBe(false);
    }
  });
});

describe("buildOutilsPdf", () => {
  it("returns a non-empty buffer starting with the PDF magic header", async () => {
    const { input } = buildAiActPdfInput(
      { context: "rh", manipulation: "non" },
      "2026-05-15T10:00:00.000Z",
    );
    const bytes = await buildOutilsPdf(input);
    expect(bytes.byteLength).toBeGreaterThan(1000);
    const head = new TextDecoder().decode(bytes.slice(0, 4));
    expect(head).toBe("%PDF");
  });

  it("produces a valid PDF for the ROI calculator", async () => {
    const inputs: RoiInputs = {
      sector: "luxe",
      branches: ["finance", "marketing"],
      users: 500,
      frequency: "regulier",
    };
    const { input } = buildRoiPdfInput(inputs, "2026-05-15T10:00:00.000Z");
    const bytes = await buildOutilsPdf(input);
    expect(bytes.byteLength).toBeGreaterThan(1000);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF");
  });

  it("produces a valid PDF for the maturity quiz", async () => {
    const answers: Record<string, number> = { q1: 2, q2: 3, q3: 1, q4: 2 };
    const { input } = buildMaturityPdfInput(answers, {}, "2026-05-15T10:00:00.000Z");
    const bytes = await buildOutilsPdf(input);
    expect(bytes.byteLength).toBeGreaterThan(1000);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF");
  });
});

describe("computeRoi", () => {
  const baseInputs: RoiInputs = {
    sector: "luxe",
    branches: ["finance"],
    users: 250,
    frequency: "regulier",
  };

  it("picks the Starter tier under 500 users", () => {
    const r = computeRoi({ ...baseInputs, users: 250 });
    expect(r.tier.label).toMatch(/^Starter/);
  });

  it("picks the Business tier between 500 and 2000 users", () => {
    const r = computeRoi({ ...baseInputs, users: 1000 });
    expect(r.tier.label).toMatch(/^Business/);
  });

  it("picks the Enterprise tier at 2000+ users", () => {
    const r = computeRoi({ ...baseInputs, users: 5000 });
    expect(r.tier.label).toMatch(/^Enterprise/);
  });

  it("returns POSITIVE_INFINITY payback when monthly ROI is negative", () => {
    // Tiny users + occasional usage on a single low-impact branche -> savings < cost.
    const r = computeRoi({ ...baseInputs, users: 10, frequency: "occasionnel", branches: ["si"] });
    expect(r.paybackMonths).toBe(Number.POSITIVE_INFINITY);
  });

  it("scales hours saved linearly with branche count when impact is similar", () => {
    const single = computeRoi({ ...baseInputs, branches: ["marketing"] });
    const triple = computeRoi({ ...baseInputs, branches: ["marketing", "communication", "rh"] });
    expect(triple.hoursSavedMonth).toBeGreaterThan(single.hoursSavedMonth * 2);
  });
});

describe("computeMaturityResult", () => {
  it("returns the explorer tier for low totals", () => {
    const r = computeMaturityResult({ q1: 0, q2: 0, q3: 1 });
    expect(r.tier.id).toBe("explorer");
  });

  it("returns the leader tier for max totals (12 questions × 3)", () => {
    const answers: Record<string, number> = {};
    for (let i = 1; i <= 12; i += 1) answers[`q${i}`] = 3;
    const r = computeMaturityResult(answers);
    expect(r.tier.id).toBe("leader");
    expect(r.totalPct).toBe(100);
  });

  it("provides per-axis breakdown with pct in [0,100]", () => {
    const r = computeMaturityResult({ q1: 2, q2: 1 });
    for (const axis of r.axisScores) {
      expect(axis.pct).toBeGreaterThanOrEqual(0);
      expect(axis.pct).toBeLessThanOrEqual(100);
    }
  });
});
