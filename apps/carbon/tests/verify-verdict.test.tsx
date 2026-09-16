/**
 * /verify/[hash] — l'intitulé du bloc « empreinte » suit le verdict
 * (QA 2026-09-16, m-10 : « Hash vérifié » s'affichait au-dessus d'une
 * empreinte inconnue ou mal formée).
 */

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import VerifyHashPage from "@/app/verify/[hash]/page";
import {
  displayedHash,
  hashPanelHeading,
  isSha256Hex,
  MAX_DISPLAYED_HASH_LENGTH,
  resolveHashVerdict,
} from "@/app/verify/verify-verdict";

const VALID = "a".repeat(64);

describe("resolveHashVerdict", () => {
  it("classe une saisie mal formée comme invalide, sans consulter l'API", () => {
    for (const hash of ["abc", "g".repeat(64), "a".repeat(63), "a".repeat(65), `${"a".repeat(63)} `, ""]) {
      expect(resolveHashVerdict(hash, { verified: true }), JSON.stringify(hash)).toBe("invalid");
    }
  });

  it("distingue authentique, inconnue et service injoignable", () => {
    expect(resolveHashVerdict(VALID, { verified: true })).toBe("authentic");
    expect(resolveHashVerdict(VALID.toUpperCase(), { verified: true })).toBe("authentic");
    expect(resolveHashVerdict(VALID, { verified: false })).toBe("unknown");
    expect(resolveHashVerdict(VALID, null)).toBe("unreachable");
  });

  it("isSha256Hex n'accepte que 64 caractères hexadécimaux", () => {
    expect(isSha256Hex(VALID)).toBe(true);
    expect(isSha256Hex("0123456789abcdefABCDEF".padEnd(64, "0"))).toBe(true);
    expect(isSha256Hex(`${VALID}\n`)).toBe(false);
  });
});

describe("hashPanelHeading", () => {
  it("ne dit « vérifiée » que pour une empreinte authentique", () => {
    expect(hashPanelHeading("authentic")).toBe("Empreinte vérifiée");
    expect(hashPanelHeading("unknown")).toBe("Empreinte inconnue");
    expect(hashPanelHeading("invalid")).toBe("Format d'empreinte invalide");
    expect(hashPanelHeading("unreachable")).toBe("Empreinte non vérifiée");
    for (const verdict of ["unknown", "invalid", "unreachable"] as const) {
      expect(hashPanelHeading(verdict)).not.toMatch(/Empreinte vérifiée|Hash vérifié/);
    }
  });

  it("tronque une saisie démesurée", () => {
    const long = "x".repeat(MAX_DISPLAYED_HASH_LENGTH + 50);
    expect(displayedHash(long)).toBe(`${"x".repeat(MAX_DISPLAYED_HASH_LENGTH)}…`);
    expect(displayedHash(VALID)).toBe(VALID);
  });
});

async function renderPage(hash: string): Promise<string> {
  const element = await VerifyHashPage({ params: Promise.resolve({ hash }) });
  return renderToStaticMarkup(element);
}

function apiResponse(body: Record<string, unknown>) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

const API_BODY = {
  package_hash: VALID,
  manifest_hash: null,
  domain: null,
  filename: null,
  size_bytes: null,
  event_count: null,
  frozen_count: null,
  generated_at: null,
  company_name: null,
};

describe("page /verify/[hash]", () => {
  it("format invalide : intitulé dédié, aucun appel réseau", async () => {
    const html = await renderPage("pas-un-hash");
    expect(html).toContain("Format d&#x27;empreinte invalide");
    expect(html).not.toContain("vérifiée");
    expect(html).toContain('data-testid="verify-invalid"');
    expect(fetch).not.toHaveBeenCalled();
  });

  it("empreinte inconnue de l'API : « Empreinte inconnue »", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(apiResponse({ ...API_BODY, verified: false, message: "Aucun package." }));
    const html = await renderPage(VALID);
    expect(html).toContain('data-verdict="unknown"');
    expect(html).toContain("Empreinte inconnue");
    expect(html).not.toContain("Empreinte vérifiée");
    expect(html).toContain('data-testid="verify-unknown"');
  });

  it("API injoignable : « Empreinte non vérifiée »", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const html = await renderPage(VALID);
    expect(html).toContain('data-verdict="unreachable"');
    expect(html).toContain("Empreinte non vérifiée");
    expect(html).toContain('data-testid="verify-api-unreachable"');
  });

  it("empreinte authentique : « Empreinte vérifiée »", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(apiResponse({ ...API_BODY, verified: true, message: "OK" }));
    const html = await renderPage(VALID);
    expect(html).toContain('data-verdict="authentic"');
    expect(html).toContain("Empreinte vérifiée");
    expect(html).toContain('data-testid="verify-success"');
  });
});
