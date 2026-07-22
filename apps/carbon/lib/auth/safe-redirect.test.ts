/**
 * safe-redirect.test.ts — anti-open-redirect exhaustif pour `next`.
 */

import { describe, it, expect } from "vitest";
import { getSafeInternalRedirect } from "./safe-redirect";

describe("getSafeInternalRedirect — chemins internes valides", () => {
  it("accepte un chemin simple", () => {
    expect(getSafeInternalRedirect("/resources", "/dashboard")).toBe("/resources");
  });

  it("préserve la query string et le hash", () => {
    expect(
      getSafeInternalRedirect(
        "/resources/assessments?status=completed",
        "/dashboard",
      ),
    ).toBe("/resources/assessments?status=completed");
    expect(getSafeInternalRedirect("/resources#top", "/dashboard")).toBe(
      "/resources#top",
    );
  });

  it("accepte la racine", () => {
    expect(getSafeInternalRedirect("/", "/dashboard")).toBe("/");
  });
});

describe("getSafeInternalRedirect — valeurs absentes → fallback", () => {
  it("null / undefined / chaîne vide", () => {
    expect(getSafeInternalRedirect(null, "/dashboard")).toBe("/dashboard");
    expect(getSafeInternalRedirect(undefined, "/dashboard")).toBe("/dashboard");
    expect(getSafeInternalRedirect("", "/dashboard")).toBe("/dashboard");
  });
});

describe("getSafeInternalRedirect — open redirect refusé", () => {
  it("URL absolue http(s)", () => {
    expect(getSafeInternalRedirect("https://evil.example", "/dashboard")).toBe(
      "/dashboard",
    );
    expect(getSafeInternalRedirect("http://evil.example/x", "/dashboard")).toBe(
      "/dashboard",
    );
  });

  it("protocol-relative (//)", () => {
    expect(getSafeInternalRedirect("//evil.example", "/dashboard")).toBe(
      "/dashboard",
    );
    expect(getSafeInternalRedirect("///evil.example", "/dashboard")).toBe(
      "/dashboard",
    );
  });

  it("schéma javascript:", () => {
    expect(getSafeInternalRedirect("javascript:alert(1)", "/dashboard")).toBe(
      "/dashboard",
    );
  });

  it("schéma data:", () => {
    expect(
      getSafeInternalRedirect("data:text/html,<script>1</script>", "/dashboard"),
    ).toBe("/dashboard");
  });

  it("backslash détourné en authority (piège navigateur)", () => {
    // Les navigateurs (et le parseur WHATWG) traitent "\" comme "/" pour les
    // schémas spéciaux → "/\evil.example" devient effectivement "//evil.example".
    expect(getSafeInternalRedirect("/\\evil.example", "/dashboard")).toBe(
      "/dashboard",
    );
    expect(getSafeInternalRedirect("\\\\evil.example", "/dashboard")).toBe(
      "/dashboard",
    );
  });

  it("chemin relatif sans slash initial", () => {
    expect(getSafeInternalRedirect("resources", "/dashboard")).toBe(
      "/dashboard",
    );
    expect(getSafeInternalRedirect("dashboard/../../evil", "/dashboard")).toBe(
      "/dashboard",
    );
  });

  it("espace ou caractère de contrôle en tête", () => {
    expect(getSafeInternalRedirect(" /resources", "/dashboard")).toBe(
      "/dashboard",
    );
    expect(getSafeInternalRedirect("\t/evil.example", "/dashboard")).toBe(
      "/dashboard",
    );
  });

  it("valeur non-string", () => {
    // @ts-expect-error — cas volontairement mal typé pour prouver le garde-fou runtime.
    expect(getSafeInternalRedirect(42, "/dashboard")).toBe("/dashboard");
    // @ts-expect-error — idem.
    expect(getSafeInternalRedirect({ toString: () => "//evil" }, "/dashboard")).toBe(
      "/dashboard",
    );
  });
});

describe("getSafeInternalRedirect — encodage ne masque jamais une évasion", () => {
  it("chemin encodé qui reste sur notre origine (sûr, même inhabituel)", () => {
    // %2F n'est PAS décodé en séparateur de chemin par l'URL parser — reste
    // un segment littéral sur notre propre origine, donc sans danger.
    expect(getSafeInternalRedirect("/%2F%2Fevil.example", "/dashboard")).toBe(
      "/%2F%2Fevil.example",
    );
  });
});
