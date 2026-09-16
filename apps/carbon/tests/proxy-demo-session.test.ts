import { afterEach, describe, expect, it, vi } from "vitest";

import { buildCsp, isDemoProtectedPath } from "@/proxy";

describe("proxy — périmètre de session démo", () => {
  it("protège les pages métier et les APIs sous cookie démo", () => {
    expect(isDemoProtectedPath("/dashboard")).toBe(true);
    expect(isDemoProtectedPath("/resources/assessments")).toBe(true);
    expect(isDemoProtectedPath("/api/upload")).toBe(true);
  });

  it("laisse disponibles la démo publique et son endpoint d'émission", () => {
    expect(isDemoProtectedPath("/demo")).toBe(false);
    expect(isDemoProtectedPath("/demo/asterion-motion")).toBe(false);
    expect(isDemoProtectedPath("/api/auth/demo")).toBe(false);
  });

  it("M-16 : protège le journal /audit mais pas le lien auditeur public /audit/<token>", () => {
    expect(isDemoProtectedPath("/audit")).toBe(true);
    expect(isDemoProtectedPath("/audit/")).toBe(true);
    expect(isDemoProtectedPath("/audit/abc")).toBe(false);
    expect(isDemoProtectedPath(`/audit/${"a".repeat(64)}`)).toBe(false);
    // Pas de faux positif sur un chemin qui commence seulement par « /audit ».
    expect(isDemoProtectedPath("/auditeur")).toBe(false);
  });

  it("M-16 : /login reste accessible pour pouvoir quitter la démo", () => {
    expect(isDemoProtectedPath("/login")).toBe(false);
    expect(isDemoProtectedPath("/dashboard")).toBe(true);
  });
});

describe("proxy — CSP et barre d'outils Vercel (m-14)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function directive(csp: string, name: string): string | undefined {
    return csp
      .split(";")
      .map((part) => part.trim())
      .find((part) => part === name || part.startsWith(`${name} `));
  }

  it("production : aucune ouverture vers vercel.live ni pusher", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    const csp = buildCsp();

    expect(csp).not.toContain("vercel.live");
    expect(csp).not.toContain("pusher.com");
    expect(csp).not.toContain("assets.vercel.com");
    expect(directive(csp, "frame-src")).toBeUndefined();
    expect(directive(csp, "script-src")).toBe(
      "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
    );
    expect(directive(csp, "style-src")).toBe("style-src 'self' 'unsafe-inline'");
    expect(directive(csp, "font-src")).toBe("font-src 'self' data:");
  });

  it("sans VERCEL_ENV (auto-hébergé / CI) : comportement production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "");
    expect(buildCsp()).not.toContain("vercel.live");
  });

  it("preview : autorise la barre d'outils selon la doc Vercel", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    const csp = buildCsp();

    expect(directive(csp, "script-src")).toContain("https://vercel.live");
    expect(directive(csp, "connect-src")).toContain("https://vercel.live");
    expect(directive(csp, "connect-src")).toContain("wss://ws-us3.pusher.com");
    expect(directive(csp, "frame-src")).toBe("frame-src 'self' https://vercel.live");
    expect(directive(csp, "style-src")).toContain("https://vercel.live");
    expect(directive(csp, "font-src")).toBe(
      "font-src 'self' data: https://vercel.live https://assets.vercel.com",
    );
    // Les protections structurantes restent en place.
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(directive(csp, "script-src")).not.toContain("'unsafe-eval'");
  });
});
