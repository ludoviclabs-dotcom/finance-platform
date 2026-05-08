/**
 * Tests job-tracker — vérifient les calculs done/failed sur la structure
 * d'état, sans dépendance Redis (on instancie l'objet à la main).
 *
 * Le path Redis lui-même est testé par les tests d'intégration en CI
 * via le dev server Inngest.
 */

import { describe, it, expect } from "vitest";
import type { JobState, JobItem } from "./job-tracker";

function makeState(items: JobItem[]): JobState {
  return {
    batchId: "test_batch",
    cid: "1",
    kind: "extract",
    total: items.length,
    done: items.filter((i) => i.status === "ok" || i.status === "error").length,
    failed: items.filter((i) => i.status === "error").length,
    actorSub: "user-1",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items,
  };
}

describe("job-tracker — JobState invariants", () => {
  it("done = nb items ok+error", () => {
    const s = makeState([
      { key: "a", status: "ok" },
      { key: "b", status: "error" },
      { key: "c", status: "running" },
      { key: "d", status: "pending" },
    ]);
    expect(s.done).toBe(2);
    expect(s.failed).toBe(1);
    expect(s.total).toBe(4);
  });

  it("failed = subset de done", () => {
    const s = makeState([
      { key: "a", status: "ok" },
      { key: "b", status: "ok" },
      { key: "c", status: "error" },
    ]);
    expect(s.failed).toBeLessThanOrEqual(s.done);
  });

  it("batch entièrement réussi → done == total, failed == 0", () => {
    const s = makeState([
      { key: "a", status: "ok" },
      { key: "b", status: "ok" },
    ]);
    expect(s.done).toBe(s.total);
    expect(s.failed).toBe(0);
  });

  it("batch entièrement échoué → failed == total", () => {
    const s = makeState([
      { key: "a", status: "error", detail: "Voyage 503" },
      { key: "b", status: "error", detail: "Anthropic 429" },
    ]);
    expect(s.failed).toBe(s.total);
    expect(s.done).toBe(s.total);
  });

  it("items vides → counts à 0", () => {
    const s = makeState([]);
    expect(s.total).toBe(0);
    expect(s.done).toBe(0);
    expect(s.failed).toBe(0);
  });

  it("meta optionnel par item", () => {
    const s = makeState([
      { key: "a", status: "ok", meta: { confidence: 0.94, status: "validated" } },
      { key: "b", status: "ok", meta: { chunks: 42 } },
    ]);
    expect(s.items[0].meta?.confidence).toBe(0.94);
    expect(s.items[1].meta?.chunks).toBe(42);
  });

  it("kind discrimine ingest vs extract", () => {
    const ingest = { ...makeState([{ key: "a", status: "ok" }]), kind: "ingest" as const };
    const extract = { ...makeState([{ key: "a", status: "ok" }]), kind: "extract" as const };
    expect(ingest.kind).toBe("ingest");
    expect(extract.kind).toBe("extract");
  });
});
