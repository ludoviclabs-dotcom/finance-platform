/**
 * M-06 — /status : l'état global est dérivé des champs de GET /health.
 * Vert seulement si HTTP ok ET status "ok" ET db/storage ≠ "down" ; jamais
 * « Invalid Date ».
 */

import { describe, expect, it } from "vitest";

import {
  deriveOverallHealth,
  formatHealthTime,
  parseHealthPayload,
  type HealthPayload,
} from "@/lib/health-status";

function payload(overrides: Partial<HealthPayload> = {}): HealthPayload {
  return {
    status: "ok",
    version: "abc123",
    time: "2026-09-16T06:12:00+00:00",
    db: "ok",
    storage: "ok",
    worker: "inline",
    ...overrides,
  };
}

const ok = (p: HealthPayload) =>
  deriveOverallHealth({ kind: "response", httpOk: true, httpStatus: 200, payload: p });

describe("deriveOverallHealth", () => {
  it("vert quand tout répond", () => {
    expect(ok(payload())).toEqual({ level: "operational", label: "Tous les services répondent" });
  });

  it("vert si la base ou le stockage ne sont pas configurés (seul « down » dégrade)", () => {
    expect(ok(payload({ db: "not_configured", storage: "not_configured" })).level).toBe("operational");
    expect(ok(payload({ storage: "local" })).level).toBe("operational");
  });

  it("status « ok » mais base « down » : dégradé, pas vert", () => {
    expect(ok(payload({ db: "down" }))).toEqual({ level: "degraded", label: "Service dégradé" });
  });

  it("stockage « down » : dégradé", () => {
    expect(ok(payload({ storage: "down" })).level).toBe("degraded");
  });

  it("status « degraded » renvoyé par l'API : dégradé", () => {
    expect(ok(payload({ status: "degraded" })).level).toBe("degraded");
  });

  it("status absent : jamais vert", () => {
    expect(ok(payload({ status: null })).level).toBe("degraded");
  });

  it("HTTP 404 / 5xx : en erreur, même avec un corps « ok »", () => {
    for (const httpStatus of [404, 500, 503]) {
      expect(
        deriveOverallHealth({ kind: "response", httpOk: false, httpStatus, payload: payload() }),
      ).toEqual({ level: "down", label: "API en erreur" });
    }
  });

  it("corps illisible : en erreur", () => {
    expect(
      deriveOverallHealth({ kind: "response", httpOk: true, httpStatus: 200, payload: null }).level,
    ).toBe("down");
  });

  it("réseau / délai dépassé : injoignable", () => {
    expect(deriveOverallHealth({ kind: "unreachable" })).toEqual({
      level: "down",
      label: "API injoignable",
    });
  });
});

describe("parseHealthPayload", () => {
  it("extrait les champs texte et ignore le reste", () => {
    expect(
      parseHealthPayload({ status: "ok", db: "down", storage: 3, worker: "", version: "v1" }),
    ).toEqual({
      status: "ok",
      version: "v1",
      time: null,
      db: "down",
      storage: null,
      worker: null,
    });
  });

  it("rejette ce qui n'est pas un objet", () => {
    expect(parseHealthPayload(null)).toBeNull();
    expect(parseHealthPayload("<html>")).toBeNull();
    expect(parseHealthPayload([1, 2])).toBeNull();
  });
});

describe("formatHealthTime", () => {
  it("ne renvoie jamais « Invalid Date »", () => {
    expect(formatHealthTime("pas une date")).toBeNull();
    expect(formatHealthTime(undefined)).toBeNull();
    expect(formatHealthTime(null)).toBeNull();
    expect(formatHealthTime("")).toBeNull();
    expect(formatHealthTime(new Date(Number.NaN))).toBeNull();
  });

  it("formate une date ISO valide", () => {
    const out = formatHealthTime("2026-09-16T06:12:00+00:00");
    expect(out).not.toBeNull();
    expect(out).not.toContain("Invalid");
  });
});
