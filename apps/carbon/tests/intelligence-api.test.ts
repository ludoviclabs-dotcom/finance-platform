/**
 * tests/intelligence-api.test.ts — client lib/api/intelligence.ts + mapping badge (PR-04).
 *
 * Mock de fetch (setup.ts) : vérifie l'injection du bearer, la construction des
 * query params, la transformation d'erreur, et le mapping data_status → badge.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { setAuthToken } from "@/lib/api";
import {
  fetchSources,
  fetchSourceFreshness,
  fetchObservations,
  fetchIntelligenceHealth,
  publishRelease,
  validateRelease,
  type SourceListResponse,
  type SourceFreshness,
  type IntelligenceHealth,
} from "@/lib/api/intelligence";
import { dataStatusToBadge } from "@/components/ui/data-status-badge";

function mockFetch(body: unknown, status = 200): void {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

function lastCall() {
  const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
  return calls[calls.length - 1];
}

describe("intelligence api client — auth & requests", () => {
  beforeEach(() => setAuthToken(null));

  it("injects the bearer token", async () => {
    setAuthToken("jwt-123");
    mockFetch({ items: [], total: 0, limit: 50, offset: 0 } satisfies SourceListResponse);
    await fetchSources();
    const [, init] = lastCall();
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer jwt-123");
  });

  it("omits Authorization when no token", async () => {
    mockFetch({ items: [], total: 0, limit: 50, offset: 0 });
    await fetchSources();
    const [, init] = lastCall();
    expect((init.headers as Record<string, string>)["Authorization"]).toBeUndefined();
  });

  it("builds source list query params (limit/active_only)", async () => {
    mockFetch({ items: [], total: 0, limit: 10, offset: 0 });
    await fetchSources({ limit: 10, activeOnly: true });
    const [url] = lastCall();
    expect(String(url)).toContain("/intelligence/sources?");
    expect(String(url)).toContain("limit=10");
    expect(String(url)).toContain("active_only=true");
  });

  it("builds observation filters", async () => {
    mockFetch({ items: [], total: 0, limit: 50, offset: 0 });
    await fetchObservations({ subjectType: "material", metricCode: "price_usd" });
    const [url] = lastCall();
    expect(String(url)).toContain("subject_type=material");
    expect(String(url)).toContain("metric_code=price_usd");
  });

  it("fetchSourceFreshness hits the per-source endpoint", async () => {
    const fresh = { source_id: 5, code: "X", is_stale: false, license_ok: true } as unknown as SourceFreshness;
    mockFetch(fresh);
    const r = await fetchSourceFreshness(5);
    expect(r.source_id).toBe(5);
    expect(String(lastCall()[0])).toContain("/intelligence/sources/5/freshness");
  });

  it("fetchIntelligenceHealth hits the public health endpoint", async () => {
    const h = { status: "ok", source_count: 1, sources: [] } as unknown as IntelligenceHealth;
    mockFetch(h);
    const r = await fetchIntelligenceHealth();
    expect(r.status).toBe("ok");
    expect(String(lastCall()[0])).toContain("/health/intelligence");
  });

  it("publishRelease POSTs to the transition endpoint", async () => {
    mockFetch({ id: 9, status: "published" });
    await publishRelease(9);
    const [url, init] = lastCall();
    expect(init.method).toBe("POST");
    expect(String(url)).toContain("/intelligence/releases/9/publish");
  });

  it("validateRelease sends { passed }", async () => {
    mockFetch({ id: 9, status: "validated" });
    await validateRelease(9, true);
    const [url, init] = lastCall();
    expect(String(url)).toContain("/intelligence/releases/9/validate");
    expect(JSON.parse(init.body as string)).toEqual({ passed: true });
  });

  it("throws on non-2xx", async () => {
    mockFetch({ detail: "nope" }, 404);
    await expect(fetchSources()).rejects.toThrow("404");
  });
});

describe("dataStatusToBadge — mapping unique (contrats §2)", () => {
  it("maps verified/estimated/manual", () => {
    expect(dataStatusToBadge("verified")).toBe("VERIFIED");
    expect(dataStatusToBadge("estimated")).toBe("ESTIMATED");
    expect(dataStatusToBadge("manual")).toBe("MANUAL");
  });

  it("maps inferred to ESTIMATED (pas de badge dédié)", () => {
    expect(dataStatusToBadge("inferred")).toBe("ESTIMATED");
  });

  it("isStale force STALE quel que soit le statut", () => {
    expect(dataStatusToBadge("verified", true)).toBe("STALE");
    expect(dataStatusToBadge("estimated", true)).toBe("STALE");
  });
});
