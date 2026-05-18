import { describe, expect, it } from "vitest";
import { buildSourcesContext } from "@/lib/rag/context-builder";
import type { RerankedChunk } from "@/lib/rag/rerank";

function reranked(over: Partial<RerankedChunk> = {}): RerankedChunk {
  return {
    id: over.id ?? "c1",
    sourceId: over.sourceId ?? "src-1",
    orderIndex: over.orderIndex ?? 0,
    content: over.content ?? "Texte d'exemple suffisamment long.",
    tokenCount: over.tokenCount ?? 50,
    heading: over.heading ?? null,
    pageNumber: over.pageNumber ?? null,
    score: over.score ?? 0.85,
    rrfScore: over.rrfScore ?? 0.02,
    rankByQuery: over.rankByQuery ?? {},
    rerankScore: over.rerankScore ?? 0.9,
    rerankProvider: over.rerankProvider ?? "cohere",
  };
}

describe("buildSourcesContext", () => {
  it("formats chunks as <source id=\"S1\"> blocks with provenance attrs", () => {
    const { sourcesBlock, citations } = buildSourcesContext([
      reranked({ id: "c1", heading: "Intro", pageNumber: 2, sourceId: "doc-a" }),
      reranked({ id: "c2", heading: null, pageNumber: null, sourceId: "doc-b" }),
    ]);
    expect(sourcesBlock).toContain('<source id="S1" heading="Intro" page="2" source="doc-a">');
    expect(sourcesBlock).toContain('<source id="S2" source="doc-b">');
    expect(citations).toHaveLength(2);
    expect(citations[0].id).toBe("S1");
    expect(citations[0].chunkId).toBe("c1");
    expect(citations[1].id).toBe("S2");
  });

  it("trims chunks when token budget is exceeded", () => {
    // Force a very tight budget so only the first chunk fits.
    const longContent = "Phrase. ".repeat(400);
    const { citations, trimmed } = buildSourcesContext(
      [
        reranked({ id: "c1", content: longContent }),
        reranked({ id: "c2", content: longContent }),
        reranked({ id: "c3", content: longContent }),
      ],
      { maxContextTokens: 600 },
    );
    expect(citations.length).toBeLessThan(3);
    expect(trimmed).toBeGreaterThan(0);
  });

  it("caps each chunk's content by perChunkCharCap", () => {
    const huge = "x".repeat(5000);
    const { sourcesBlock } = buildSourcesContext(
      [reranked({ content: huge })],
      { perChunkCharCap: 500, maxContextTokens: 10000 },
    );
    expect(sourcesBlock.length).toBeLessThan(2000);
    expect(sourcesBlock).toContain("…");
  });

  it("escapes quotes and newlines in heading attributes", () => {
    const { sourcesBlock } = buildSourcesContext([
      reranked({ heading: `Titre "spécial"\nmulti-ligne` }),
    ]);
    expect(sourcesBlock).toContain("&quot;");
    expect(sourcesBlock).not.toMatch(/heading="[^"]*\n/);
  });

  it("returns empty block for no chunks", () => {
    const ctx = buildSourcesContext([]);
    expect(ctx.sourcesBlock).toBe("");
    expect(ctx.citations).toEqual([]);
    expect(ctx.tokenCount).toBe(0);
  });
});
