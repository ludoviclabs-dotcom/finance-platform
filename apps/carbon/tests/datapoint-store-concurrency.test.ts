// @vitest-environment node

/**
 * Store des datapoints : l'historique de revue survit à une ré-extraction, et
 * deux écritures concurrentes ne s'écrasent pas (écriture conditionnée à
 * l'ETag, rejouée sur conflit).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Faux store Blob : un seul objet, ETag incrémenté à chaque écriture.
const blob = vi.hoisted(() => ({
  body: null as string | null,
  version: 0,
  /** Écriture concurrente simulée juste avant la prochaine écriture. */
  interleave: null as null | (() => void),
}));

vi.mock("@vercel/blob", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@vercel/blob")>();
  return {
    ...actual,
    get: vi.fn(async () =>
      blob.body === null
        ? null
        : {
            statusCode: 200,
            stream: new Response(blob.body).body,
            headers: new Headers(),
            blob: { etag: `"v${blob.version}"` },
          },
    ),
    put: vi.fn(async (_path: string, body: string, opts: { ifMatch?: string }) => {
      const hook = blob.interleave;
      blob.interleave = null;
      hook?.();
      if (opts.ifMatch && opts.ifMatch !== `"v${blob.version}"`) {
        throw new actual.BlobPreconditionFailedError();
      }
      blob.body = body;
      blob.version += 1;
      return {};
    }),
  };
});

import { loadState, updateDatapoint, upsertExtraction } from "@/lib/datapoints/store";
import type { ExtractedDatapoint } from "@/lib/esrs/schema";

const CID = "42";

function extraction(value: number): ExtractedDatapoint {
  return {
    datapointId: "E1-6_scope1",
    value,
    confidence: 0.9,
    sources: [],
    status: "extracted",
    extractedAt: "2026-11-02T10:00:00.000Z",
  };
}

function decision(by: string) {
  return {
    action: "accept" as const,
    by,
    at: "2026-11-02T11:00:00.000Z",
    previousStatus: "extracted" as const,
    previousValue: 1,
    newValue: 1,
  };
}

beforeEach(() => {
  blob.body = null;
  blob.version = 0;
  blob.interleave = null;
});

describe("datapoint store", () => {
  it("conserve l'historique de revue lors d'une ré-extraction", async () => {
    await upsertExtraction(CID, { ...extraction(1), reviewHistory: [decision("alice")] });
    await upsertExtraction(CID, extraction(2));

    const dp = (await loadState(CID)).datapoints["E1-6_scope1"];
    expect(dp.value).toBe(2);
    expect(dp.reviewHistory?.map((d) => d.by)).toEqual(["alice"]);
  });

  it("rejoue l'écriture sur conflit : aucune décision concurrente perdue", async () => {
    await upsertExtraction(CID, extraction(1));

    const appendDecision = (by: string) => (existing: ExtractedDatapoint | undefined) =>
      existing ? { ...existing, reviewHistory: [...(existing.reviewHistory ?? []), decision(by)] } : null;

    // Bob écrit pendant qu'Alice est entre sa lecture et son écriture.
    blob.interleave = () => {
      const state = JSON.parse(blob.body!);
      state.datapoints["E1-6_scope1"].reviewHistory = [decision("bob")];
      blob.body = JSON.stringify(state);
      blob.version += 1;
    };
    await updateDatapoint(CID, "E1-6_scope1", appendDecision("alice"));

    const dp = (await loadState(CID)).datapoints["E1-6_scope1"];
    expect(dp.reviewHistory?.map((d) => d.by)).toEqual(["bob", "alice"]);
  });

  it("n'écrit rien si la fonction de mise à jour renvoie null", async () => {
    expect(await updateDatapoint(CID, "absent", () => null)).toBeNull();
    expect(blob.body).toBeNull();
  });
});
