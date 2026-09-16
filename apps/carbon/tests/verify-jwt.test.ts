// @vitest-environment node
import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import { signJwt, verifyAccessToken, verifyBearerToken } from "@/lib/verify-jwt";

const DEV_SECRET = new TextEncoder().encode("dev-secret-change-me-in-production-0123456789abcdef");
const inOneMinute = () => new Date(Date.now() + 60_000);

describe("verifyBearerToken — seul un jeton d'accès ouvre les routes /api/*", () => {
  it("accepte un jeton d'accès émis par l'API", async () => {
    const token = await signJwt({ sub: "a@b.fr", role: "analyst", cid: 3, scope: "access" }, inOneMinute());
    const payload = await verifyBearerToken(`Bearer ${token}`);
    expect(payload?.cid).toBe(3);
  });

  it("refuse le jeton pré-auth 2FA (B-02)", async () => {
    const token = await signJwt(
      { sub: "a@b.fr", role: "admin", cid: 3, scope: "totp_pending" },
      inOneMinute(),
    );
    expect(await verifyBearerToken(`Bearer ${token}`)).toBeNull();
  });

  it("refuse le cookie de session démo", async () => {
    const token = await signJwt(
      { sub: "demo@x.invalid", role: "viewer", cid: 0, demo: true, scope: "demo" },
      inOneMinute(),
    );
    expect(await verifyBearerToken(`Bearer ${token}`)).toBeNull();
  });

  it("refuse un jeton sans scope, sans exp ou aux claims invalides", async () => {
    const noScope = await signJwt({ sub: "a@b.fr", role: "admin", cid: 1 }, inOneMinute());
    const noExp = await new SignJWT({ sub: "a@b.fr", role: "admin", cid: 1, scope: "access" })
      .setProtectedHeader({ alg: "HS256" })
      .sign(DEV_SECRET);
    const badRole = await signJwt({ sub: "a@b.fr", role: "root", cid: 1, scope: "access" }, inOneMinute());
    const badCid = await new SignJWT({ sub: "a@b.fr", role: "admin", cid: "1", scope: "access" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1m")
      .sign(DEV_SECRET);
    for (const token of [noScope, noExp, badRole, badCid]) {
      expect(await verifyAccessToken(token)).toBeNull();
    }
  });

  it("refuse un en-tête mal formé", async () => {
    expect(await verifyBearerToken(null)).toBeNull();
    expect(await verifyBearerToken("Basic abc")).toBeNull();
    expect(await verifyBearerToken("Bearer ")).toBeNull();
  });
});
