import { describe, expect, it, vi } from "vitest";
import { embedBatched } from "@/lib/embeddings/batch";
import type { EmbeddingClient } from "@/lib/embeddings/client";

function fakeClient(): EmbeddingClient & { calls: number; sizes: number[] } {
  const calls = { n: 0, sizes: [] as number[] };
  return {
    model: "fake-embed-v1",
    dimensions: 4,
    async embed(texts: string[]) {
      calls.n++;
      calls.sizes.push(texts.length);
      return texts.map((t: string) => Array.from({ length: 4 }, (_, i) => t.length + i));
    },
    get calls() {
      return calls.n;
    },
    get sizes() {
      return calls.sizes;
    },
  } as never;
}

describe("embedBatched", () => {
  it("returns vectors in the same order as inputs", async () => {
    const client = fakeClient();
    const texts = ["a", "bbb", "cc", "ddddd"];
    const vectors = await embedBatched(client, texts, "document");
    expect(vectors).toHaveLength(4);
    expect(vectors[0][0]).toBe(1);
    expect(vectors[1][0]).toBe(3);
    expect(vectors[2][0]).toBe(2);
    expect(vectors[3][0]).toBe(5);
  });

  it("splits requests according to batchSize", async () => {
    const client = fakeClient();
    const texts = Array.from({ length: 150 }, (_, i) => `t${i}`);
    await embedBatched(client, texts, "document", { batchSize: 64, concurrency: 4 });
    expect(client.calls).toBe(3);
    expect(client.sizes.sort((a, b) => a - b)).toEqual([22, 64, 64]);
  });

  it("returns [] for empty input without invoking the client", async () => {
    const client = fakeClient();
    const spy = vi.spyOn(client, "embed");
    expect(await embedBatched(client, [], "document")).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("throws when provider returns wrong count", async () => {
    const broken: EmbeddingClient = {
      model: "broken",
      dimensions: 4,
      async embed() {
        return [[1, 2, 3, 4]]; // only one vector for any input length
      },
    };
    await expect(
      embedBatched(broken, ["a", "b"], "document", { batchSize: 2 }),
    ).rejects.toThrow(/count mismatch/);
  });
});
