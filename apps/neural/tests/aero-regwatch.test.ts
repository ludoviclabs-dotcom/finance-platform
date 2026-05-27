/**
 * Tests Aéro RegWatch — service de check déterministe.
 *
 * Couvre :
 *  - sources.ts : registre non vide, IDs uniques
 *  - watch.ts : logique status (first_run / no_change / changed) via mock fetch
 *  - GET /api/cron/aero-regwatch : auth Bearer + summary
 *
 * Aucun appel réseau réel (fetch mocké via vi.spyOn).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { REGWATCH_SOURCES, getSource } from "@/lib/aero-regwatch/sources";

describe("AeroRegWatch — sources registry", () => {
  it("contient au moins une source", () => {
    expect(REGWATCH_SOURCES.length).toBeGreaterThan(0);
  });

  it("IDs uniques et non vides", () => {
    const ids = REGWATCH_SOURCES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.length).toBeGreaterThan(0);
  });

  it("chaque source a une URL HTTPS et une autorité", () => {
    for (const s of REGWATCH_SOURCES) {
      expect(s.url.startsWith("https://")).toBe(true);
      expect(s.authority.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(20);
      expect(s.impactIfChanged.length).toBeGreaterThan(20);
    }
  });

  it("getSource trouve une source connue et rejette une inconnue", () => {
    expect(getSource("ofac-sdn")).toBeDefined();
    expect(getSource("does-not-exist")).toBeUndefined();
  });
});

describe("AeroRegWatch — checkSource logique status", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  async function importWatchWithMockStorage(latestReturn: unknown) {
    vi.doMock("@/lib/aero-regwatch/storage", () => ({
      getLatest: vi.fn().mockResolvedValue(latestReturn),
      saveSnapshot: vi.fn().mockResolvedValue(undefined),
      storageReady: () => true,
    }));
    return await import("@/lib/aero-regwatch/watch");
  }

  function mockFetchOnce(body: string, status = 200) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      statusText: "OK",
      arrayBuffer: async () => new TextEncoder().encode(body).buffer,
    } as unknown as Response);
  }

  it("first_run quand aucun snapshot précédent", async () => {
    mockFetchOnce("hello-world");
    const { checkSource } = await importWatchWithMockStorage(null);
    const out = await checkSource(REGWATCH_SOURCES[0]);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.snapshot.status).toBe("first_run");
      expect(out.snapshot.previousHash).toBeNull();
      expect(out.snapshot.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(out.snapshot.sizeBytes).toBe(11);
    }
  });

  it("no_change quand le hash est identique au précédent", async () => {
    const body = "identical-payload";
    const { checkSource: cs1 } = await importWatchWithMockStorage(null);
    mockFetchOnce(body);
    const first = await cs1(REGWATCH_SOURCES[0]);
    if (!first.ok) throw new Error("setup failed");
    const knownHash = first.snapshot.hash;

    vi.resetModules();
    const { checkSource: cs2 } = await importWatchWithMockStorage({
      sourceId: REGWATCH_SOURCES[0].id,
      hash: knownHash,
      sizeBytes: body.length,
      fetchedAt: new Date().toISOString(),
      status: "first_run",
      previousHash: null,
      latencyMs: 1,
    });
    mockFetchOnce(body);
    const out = await cs2(REGWATCH_SOURCES[0]);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.snapshot.status).toBe("no_change");
      expect(out.snapshot.previousHash).toBe(knownHash);
    }
  });

  it("changed quand le hash diffère", async () => {
    const previousHash = "a".repeat(64);
    const { checkSource } = await importWatchWithMockStorage({
      sourceId: REGWATCH_SOURCES[0].id,
      hash: previousHash,
      sizeBytes: 99,
      fetchedAt: new Date().toISOString(),
      status: "first_run",
      previousHash: null,
      latencyMs: 1,
    });
    mockFetchOnce("totally-different-payload");
    const out = await checkSource(REGWATCH_SOURCES[0]);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.snapshot.status).toBe("changed");
      expect(out.snapshot.previousHash).toBe(previousHash);
      expect(out.snapshot.hash).not.toBe(previousHash);
    }
  });

  it("ok=false quand le fetch retourne une erreur HTTP", async () => {
    const { checkSource } = await importWatchWithMockStorage(null);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      arrayBuffer: async () => new ArrayBuffer(0),
    } as unknown as Response);
    const out = await checkSource(REGWATCH_SOURCES[0]);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error).toMatch(/HTTP 503/);
      expect(out.sourceId).toBe(REGWATCH_SOURCES[0].id);
    }
  });
});

describe("AeroRegWatch — GET /api/cron/aero-regwatch", () => {
  const originalSecret = process.env.CRON_SECRET;
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("401 si CRON_SECRET set et auth header manquant", async () => {
    process.env.CRON_SECRET = "super-secret";
    const { GET } = await import("@/app/api/cron/aero-regwatch/route");
    const res = await GET(new Request("http://localhost/api/cron/aero-regwatch"));
    expect(res.status).toBe(401);
  });

  it("200 si CRON_SECRET non défini (mode dev/cron-less)", async () => {
    delete process.env.CRON_SECRET;
    vi.doMock("@/lib/aero-regwatch/watch", () => ({
      checkAll: vi.fn().mockResolvedValue([
        {
          ok: true,
          snapshot: {
            sourceId: "ofac-sdn",
            hash: "x".repeat(64),
            sizeBytes: 42,
            fetchedAt: new Date().toISOString(),
            status: "first_run",
            previousHash: null,
            latencyMs: 12,
          },
        },
      ]),
    }));
    const { GET } = await import("@/app/api/cron/aero-regwatch/route");
    const res = await GET(new Request("http://localhost/api/cron/aero-regwatch"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary.total).toBeGreaterThan(0);
    expect(body.summary.succeeded).toBeGreaterThan(0);
    expect(body.summary.failed).toBe(0);
    expect(res.headers.get("x-neural-aero-regwatch-changed")).toBeDefined();
  });
});
