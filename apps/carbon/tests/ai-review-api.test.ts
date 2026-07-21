/**
 * tests/ai-review-api.test.ts — client des endpoints /ai/review/* (PR-11).
 *
 * Mock de fetch (setup.ts) : vérifie l'injection du bearer, la méthode/chemin
 * de chaque endpoint, la préservation du « : » dans envelope_ref, la
 * sérialisation du corps de décision, et surtout la traduction CONTRACTUELLE
 * des erreurs (429 / 503 schema_not_ready / 503 générique / 404 / 401) en
 * `ReviewApiError` typée — c'est ce que ReviewGate rend en états dédiés.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  setAuthToken,
  setOnTokenExpired,
  reviewIroCandidate,
  reviewCalcRun,
  reviewScope2Run,
  fetchReviewRuns,
  fetchReviewRun,
  submitReviewDecision,
  ReviewApiError,
  type ReviewRunResponse,
  type RunListResponse,
  type ReviewDecisionResponse,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(body: unknown, status = 200, headers: Record<string, string> = {}): void {
  const lower = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => lower.get(k.toLowerCase()) ?? null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

function lastCall() {
  const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
  return calls[calls.length - 1] as [string, RequestInit];
}

const RUN_RESPONSE: ReviewRunResponse = {
  run: {
    id: 42,
    company_id: 1,
    use_case: "iro",
    subject_type: "iro",
    subject_key: "7",
    provider: "anthropic",
    model: "claude-x",
    model_version: "1",
    prompt_version: "p1",
    policy_version: "pol1",
    input_hash: "abc",
    status: "succeeded",
    review_status: "needs_review",
    tokens_input: 100,
    tokens_output: 50,
    cost_estimate: 0.001,
    latency_ms: 900,
    error_code: null,
    created_at: "2026-07-21T10:00:00Z",
    completed_at: "2026-07-21T10:00:02Z",
  },
  claims: [],
  schema_valid: true,
  citation_resolved: true,
  license_allowed: true,
};

describe("ai review api client — auth & requests", () => {
  beforeEach(() => {
    setAuthToken(null);
    setOnTokenExpired(null);
  });

  it("injects the bearer token", async () => {
    setAuthToken("jwt-xyz");
    mockFetch(RUN_RESPONSE, 201);
    await reviewIroCandidate(7);
    const [, init] = lastCall();
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer jwt-xyz");
  });

  it("omits Authorization when no token", async () => {
    mockFetch(RUN_RESPONSE, 201);
    await reviewIroCandidate(7);
    const [, init] = lastCall();
    expect((init.headers as Record<string, string>)["Authorization"]).toBeUndefined();
  });

  it("reviewIroCandidate POSTs to /ai/review/iro/{id}", async () => {
    mockFetch(RUN_RESPONSE, 201);
    const res = await reviewIroCandidate(7);
    const [url, init] = lastCall();
    expect(init.method).toBe("POST");
    expect(String(url)).toContain("/ai/review/iro/7");
    expect(res.run.id).toBe(42);
  });

  it("reviewCalcRun keeps the colon in envelope_ref (no encoding)", async () => {
    mockFetch(RUN_RESPONSE, 201);
    await reviewCalcRun("scope2:99");
    const [url] = lastCall();
    expect(String(url)).toContain("/ai/review/calc/scope2:99");
    expect(String(url)).not.toContain("scope2%3A");
  });

  it("reviewScope2Run builds the scope2:{runId} envelope_ref", async () => {
    mockFetch(RUN_RESPONSE, 201);
    await reviewScope2Run(123);
    const [url, init] = lastCall();
    expect(init.method).toBe("POST");
    expect(String(url)).toContain("/ai/review/calc/scope2:123");
  });

  it("fetchReviewRun GETs /ai/review/runs/{id}", async () => {
    mockFetch(RUN_RESPONSE);
    await fetchReviewRun(42);
    const [url, init] = lastCall();
    expect(init.method).toBe("GET");
    expect(String(url)).toContain("/ai/review/runs/42");
  });

  it("fetchReviewRuns builds query params", async () => {
    const list: RunListResponse = { items: [], total: 0, limit: 10, offset: 20 };
    mockFetch(list);
    await fetchReviewRuns({
      use_case: "iro",
      subject_type: "iro",
      subject_key: "7",
      status: "succeeded",
      limit: 10,
      offset: 20,
    });
    const [url] = lastCall();
    const s = String(url);
    expect(s).toContain("/ai/review/runs?");
    expect(s).toContain("use_case=iro");
    expect(s).toContain("subject_type=iro");
    expect(s).toContain("subject_key=7");
    expect(s).toContain("status=succeeded");
    expect(s).toContain("limit=10");
    expect(s).toContain("offset=20");
  });

  it("submitReviewDecision POSTs the decision body", async () => {
    const decision: ReviewDecisionResponse = {
      id: 5,
      run_id: 42,
      company_id: 1,
      decision: "accept",
      reviewer_id: 3,
      justification: "Cohérent avec les preuves.",
      feedback: "useful",
      supersedes_id: null,
      created_at: "2026-07-21T11:00:00Z",
    };
    mockFetch(decision, 201);
    const res = await submitReviewDecision(42, {
      decision: "accept",
      justification: "Cohérent avec les preuves.",
      feedback: "useful",
    });
    const [url, init] = lastCall();
    expect(init.method).toBe("POST");
    expect(String(url)).toContain("/ai/review/runs/42/decision");
    const parsed = JSON.parse(init.body as string);
    expect(parsed.decision).toBe("accept");
    expect(parsed.justification).toBe("Cohérent avec les preuves.");
    expect(res.id).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Traduction contractuelle des erreurs → ReviewApiError typée
// ---------------------------------------------------------------------------

describe("ai review api client — typed errors", () => {
  beforeEach(() => {
    setAuthToken(null);
    setOnTokenExpired(null);
  });

  it("429 → rate_limited with retryAfterSeconds from header", async () => {
    mockFetch({ error: "rate_limited", retryAfterSeconds: 12 }, 429, { "retry-after": "12" });
    const err = await reviewIroCandidate(7).catch((e) => e);
    expect(err).toBeInstanceOf(ReviewApiError);
    expect((err as ReviewApiError).kind).toBe("rate_limited");
    expect((err as ReviewApiError).retryAfterSeconds).toBe(12);
  });

  it("503 with detail schema_not_ready → unavailable + schemaNotReady", async () => {
    mockFetch({ detail: "schema_not_ready" }, 503);
    const err = await reviewIroCandidate(7).catch((e) => e);
    expect(err).toBeInstanceOf(ReviewApiError);
    expect((err as ReviewApiError).kind).toBe("unavailable");
    expect((err as ReviewApiError).schemaNotReady).toBe(true);
  });

  it("503 generic → unavailable, schemaNotReady false", async () => {
    mockFetch({ detail: "provider down" }, 503);
    const err = await reviewScope2Run(1).catch((e) => e);
    expect(err).toBeInstanceOf(ReviewApiError);
    expect((err as ReviewApiError).kind).toBe("unavailable");
    expect((err as ReviewApiError).schemaNotReady).toBe(false);
  });

  it("404 → not_found", async () => {
    mockFetch({ detail: "not found" }, 404);
    const err = await fetchReviewRun(999).catch((e) => e);
    expect(err).toBeInstanceOf(ReviewApiError);
    expect((err as ReviewApiError).kind).toBe("not_found");
  });

  it("401 → unauthorized", async () => {
    mockFetch({ detail: "unauthorized" }, 401);
    const err = await fetchReviewRun(1).catch((e) => e);
    expect(err).toBeInstanceOf(ReviewApiError);
    expect((err as ReviewApiError).kind).toBe("unauthorized");
  });

  it("other non-2xx → generic", async () => {
    mockFetch({ detail: "boom" }, 500);
    const err = await fetchReviewRun(1).catch((e) => e);
    expect(err).toBeInstanceOf(ReviewApiError);
    expect((err as ReviewApiError).kind).toBe("generic");
    expect((err as ReviewApiError).status).toBe(500);
  });
});
