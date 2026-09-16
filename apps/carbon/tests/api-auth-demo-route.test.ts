// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const checkDemoRateLimitMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rate-limit", () => ({
  checkDemoRateLimit: checkDemoRateLimitMock,
}));

import { DELETE, GET, POST } from "@/app/api/auth/demo/route";
import { DEMO_SESSION_COOKIE } from "@/lib/demo/session";
import { verifyBearerToken, verifyJwtToken } from "@/lib/verify-jwt";

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
    await expect(verifyJwtToken(token ?? null)).resolves.toMatchObject({
      sub: "demo-session@exemplia-industrie.invalid",
      role: "viewer",
      cid: 0,
      demo: true,
      scope: "demo",
    });
    // Le cookie démo n'est jamais un jeton d'accès pour les routes /api/*.
    await expect(verifyBearerToken(`Bearer ${token}`)).resolves.toBeNull();
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

  it("expose uniquement l'état d'une session démo valide", async () => {
    const issued = await POST(new Request("http://localhost:3003/api/auth/demo", { method: "POST" }));
    const cookie = issued.headers.get("set-cookie") ?? "";
    const token = cookie.match(new RegExp(`${DEMO_SESSION_COOKIE}=([^;]+)`))?.[1];

    const response = await GET(
      new Request("http://localhost:3003/api/auth/demo", {
        headers: { Cookie: `${DEMO_SESSION_COOKIE}=${token}` },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      isDemo: true,
      user: {
        email: "demo-session@exemplia-industrie.invalid",
        role: "viewer",
        company_id: 0,
        is_demo: true,
      },
    });
  });

  it("supprime le cookie démo lors d'un nettoyage explicite", async () => {
    const response = DELETE();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("set-cookie")).toMatch(
      new RegExp(`${DEMO_SESSION_COOKIE}=;.*Max-Age=0`),
    );
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
