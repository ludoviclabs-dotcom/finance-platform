// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const checkDemoRateLimitMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rate-limit", () => ({
  checkDemoRateLimit: checkDemoRateLimitMock,
}));

import { POST } from "@/app/api/auth/demo/route";
import { verifyBearerToken } from "@/lib/verify-jwt";

describe("POST /api/auth/demo", () => {
  beforeEach(() => {
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;
    process.env.AUTH_JWT_SECRET = "test-demo-secret-that-is-long-enough";
    checkDemoRateLimitMock.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 3600_000,
      retryAfterSeconds: 3600,
    });
  });

  it("crée une session isolée, pose le cookie et renvoie /demo", async () => {
    process.env.VERCEL_ENV = "preview";
    const response = await POST(
      new Request("http://localhost:3003/api/auth/demo", {
        method: "POST",
        headers: { "x-real-ip": "203.0.113.10" },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, redirect: "/demo" });
    expect(response.headers.get("cache-control")).toBe("no-store");

    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/cc_demo_session=[^;]+/);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=lax");
    expect(cookie).toContain("Max-Age=7200");
    expect(checkDemoRateLimitMock).toHaveBeenCalledWith("ip:203.0.113.10");

    const token = cookie.match(/cc_demo_session=([^;]+)/)?.[1];
    expect(token).toBeTruthy();
    await expect(verifyBearerToken(`Bearer ${token}`)).resolves.toMatchObject({
      sub: "demo-session@exemplia-industrie.invalid",
      role: "viewer",
      cid: 0,
      demo: true,
      scope: "demo",
    });
  });

  it("renvoie 429 quand la limite IP est atteinte", async () => {
    checkDemoRateLimitMock.mockResolvedValue({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Date.now() + 120,
      retryAfterSeconds: 1,
    });

    const response = await POST(new Request("http://localhost:3003/api/auth/demo", { method: "POST" }));

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: "Trop de demandes d'accès démo.",
      code: "RATE_LIMITED",
    });
    expect(response.headers.get("retry-after")).toBe("1");
  });

  it("masque les erreurs internes avec une réponse 500 stable", async () => {
    delete process.env.AUTH_JWT_SECRET;
    process.env.VERCEL_ENV = "production";

    const response = await POST(new Request("http://localhost:3003/api/auth/demo", { method: "POST" }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "Accès démo indisponible pour le moment.",
      code: "DEMO_SESSION_ERROR",
    });
    expect(JSON.stringify(body)).not.toContain("secret interne");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
