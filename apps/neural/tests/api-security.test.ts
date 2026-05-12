import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { getInternalReviewer } from "@/lib/internal-review-auth";
import { requireConfiguredToken } from "@/lib/security/tokens";

const originalEnv = { ...process.env };

function resetEnv() {
  process.env = { ...originalEnv };
}

describe("API security guards", () => {
  afterEach(() => {
    resetEnv();
  });

  it("rejects cron requests in production when CRON_SECRET is absent", () => {
    process.env.VERCEL_ENV = "production";
    delete process.env.CRON_SECRET;

    const result = requireConfiguredToken(new Request("https://neural.test/api/cron/regulatory-watch"), {
      envKey: "CRON_SECRET",
      allowDevWithoutToken: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });

  it("rejects MCP requests in production when MCP_PUBLIC_TOKEN is absent", () => {
    process.env.VERCEL_ENV = "production";
    delete process.env.MCP_PUBLIC_TOKEN;

    const result = requireConfiguredToken(new Request("https://neural.test/api/mcp"), {
      envKey: "MCP_PUBLIC_TOKEN",
      headerName: "x-mcp-token",
      allowDevWithoutToken: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });

  it("rejects internal reviewer requests in production when INTERNAL_REVIEW_TOKEN is absent", () => {
    process.env.VERCEL_ENV = "production";
    delete process.env.INTERNAL_REVIEW_TOKEN;

    const result = getInternalReviewer(
      new NextRequest("https://neural.test/api/internal/bank-comms-runs", {
        headers: { "x-reviewer-id": "local-user" },
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });

  it("accepts internal reviewer bearer token when configured", () => {
    process.env.VERCEL_ENV = "production";
    process.env.INTERNAL_REVIEW_TOKEN = "review-secret";

    const result = getInternalReviewer(
      new NextRequest("https://neural.test/api/approvals", {
        headers: { authorization: "Bearer review-secret" },
      }),
    );

    expect(result).toEqual({
      ok: true,
      reviewerId: "internal-reviewer",
      mode: "token",
    });
  });
});
