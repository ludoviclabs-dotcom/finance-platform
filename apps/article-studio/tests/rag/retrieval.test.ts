import { describe, expect, it } from "vitest";
import { fuseRRF } from "@/lib/rag/retrieval";
import type { ChunkSearchResult } from "@/lib/vector-store/search";

function chunk(id: string, score = 0.8): ChunkSearchResult {
  return {
    id,
    sourceId: "src-1",
    orderIndex: 0,
    content: `content-${id}`,
    tokenCount: 100,
    heading: null,
    pageNumber: null,
    score,
  };
}

describe("fuseRRF", () => {
  it("returns single ranking when one query has results", () => {
    const fused = fuseRRF(["q1"], [[chunk("a"), chunk("b"), chunk("c")]], 5);
    expect(fused.map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(fused[0].rrfScore).toBeGreaterThan(fused[1].rrfScore);
  });

  it("ranks chunks that appear across multiple queries higher", () => {
    // Chunk "x" appears at rank 1 in q1 and rank 1 in q2 → should win.
    // Chunk "y" appears only at rank 1 in q1.
    const fused = fuseRRF(
      ["q1", "q2"],
      [
        [chunk("x"), chunk("y")],
        [chunk("x"), chunk("z")],
      ],
      5,
    );
    expect(fused[0].id).toBe("x");
    expect(fused[0].rrfScore).toBeGreaterThan(fused[1].rrfScore);
  });

  it("records per-query ranks for explainability", () => {
    const fused = fuseRRF(
      ["alpha", "beta"],
      [
        [chunk("a"), chunk("b")],
        [chunk("b"), chunk("a")],
      ],
      5,
    );
    const a = fused.find((c) => c.id === "a")!;
    const b = fused.find((c) => c.id === "b")!;
    expect(a.rankByQuery).toEqual({ alpha: 1, beta: 2 });
    expect(b.rankByQuery).toEqual({ alpha: 2, beta: 1 });
  });

  it("keeps the best per-query cosine score for display", () => {
    const fused = fuseRRF(
      ["q1", "q2"],
      [[chunk("a", 0.5)], [chunk("a", 0.9)]],
      5,
    );
    expect(fused[0].score).toBe(0.9);
  });

  it("respects topN", () => {
    const fused = fuseRRF(
      ["q"],
      [[chunk("a"), chunk("b"), chunk("c"), chunk("d"), chunk("e")]],
      3,
    );
    expect(fused.length).toBe(3);
  });

  it("handles empty queries gracefully", () => {
    expect(fuseRRF([], [], 5)).toEqual([]);
  });
});
