/**
 * P2 #137 — couverture pays du choroplèthe.
 *
 * L'ancienne table alpha-2 → numérique était partielle : un code valide mais
 * absent (`SE`, `AR`…) était rendu avec le même neutre qu'un pays SANS donnée —
 * carte matériellement fausse. Ces tests verrouillent le référentiel ISO 3166-1
 * complet, la normalisation des deux côtés de la jointure (les `id` world-atlas
 * ne sont pas tous sur 3 chiffres), et le fait qu'aucune observation n'est jamais
 * omise silencieusement.
 *
 * Assertions sans apostrophe (React échappe `'` → `&#x27;`).
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ISO3166_ALPHA2_TO_NUMERIC,
  iso3166Alpha2ToNumeric,
  normalizeIsoNumeric,
} from "@/lib/iso3166";
import { ConcentrationChoropleth } from "@/components/resources/viz/concentration-choropleth";

describe("iso3166 — référentiel complet", () => {
  it("couvre les codes cités par la revue et par la démo", () => {
    expect(iso3166Alpha2ToNumeric("FR")).toBe("250");
    expect(iso3166Alpha2ToNumeric("CN")).toBe("156");
    expect(iso3166Alpha2ToNumeric("US")).toBe("840");
    expect(iso3166Alpha2ToNumeric("SE")).toBe("752"); // absent de l ancienne table
    expect(iso3166Alpha2ToNumeric("AR")).toBe("032"); // absent de l ancienne table
    expect(iso3166Alpha2ToNumeric("BR")).toBe("076");
  });

  it("normalise la casse et les espaces", () => {
    expect(iso3166Alpha2ToNumeric("fr")).toBe("250");
    expect(iso3166Alpha2ToNumeric(" cn ")).toBe("156");
  });

  it("retourne null explicitement pour un code non assigné", () => {
    expect(iso3166Alpha2ToNumeric("XX")).toBeNull();
    expect(iso3166Alpha2ToNumeric("")).toBeNull();
    expect(iso3166Alpha2ToNumeric(null)).toBeNull();
  });

  it("est exhaustif (249 codes assignés), sans doublon, zero-paddé", () => {
    const codes = Object.keys(ISO3166_ALPHA2_TO_NUMERIC);
    const nums = Object.values(ISO3166_ALPHA2_TO_NUMERIC);
    expect(codes.length).toBe(249);
    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(nums).size).toBe(nums.length);
    for (const [a2, num] of Object.entries(ISO3166_ALPHA2_TO_NUMERIC)) {
      expect(a2).toMatch(/^[A-Z]{2}$/);
      expect(num).toMatch(/^\d{3}$/);
    }
  });

  it("normalizeIsoNumeric zero-padde les ids topojson courts", () => {
    expect(normalizeIsoNumeric("76")).toBe("076");
    expect(normalizeIsoNumeric(76)).toBe("076");
    expect(normalizeIsoNumeric("156")).toBe("156");
  });
});

describe("ConcentrationChoropleth — aucun code valide masqué", () => {
  it("plusieurs pays : carte rendue, tableau complet, parts inchangées", () => {
    const html = renderToStaticMarkup(
      <ConcentrationChoropleth
        shares={[
          { country_code: "CN", share_pct: 68 },
          { country_code: "SE", share_pct: 12 },
          { country_code: "AR", share_pct: 8 },
        ]}
        testId="choro"
      />,
    );
    expect(html).toContain("<svg");
    expect(html).toContain('data-testid="choropleth-table"');
    for (const [code, pct] of [
      ["CN", "68"],
      ["SE", "12"],
      ["AR", "8"],
    ]) {
      expect(html).toContain(code);
      expect(html).toContain(`${pct} %`);
    }
    // SE et AR sont desormais cartographiables : aucun avertissement
    expect(html).not.toContain('data-testid="choropleth-unmapped-warning"');
  });

  it("code en minuscules : cartographié normalement", () => {
    const html = renderToStaticMarkup(
      <ConcentrationChoropleth shares={[{ country_code: "fr", share_pct: 30 }]} />,
    );
    expect(html).toContain("<svg");
    expect(html).toContain("FR");
    expect(html).not.toContain('data-testid="choropleth-unmapped-warning"');
  });

  it("code inconnu mêlé : averti explicitement, part conservée au tableau", () => {
    const html = renderToStaticMarkup(
      <ConcentrationChoropleth
        shares={[
          { country_code: "FR", share_pct: 60 },
          { country_code: "XX", share_pct: 40 },
        ]}
      />,
    );
    expect(html).toContain('data-testid="choropleth-unmapped-warning"');
    expect(html).toContain("XX");
    expect(html).toContain("40 %"); // jamais omise silencieusement
  });

  it("aucun code cartographiable : pas de carte trompeuse, tableau conservé", () => {
    const html = renderToStaticMarkup(
      <ConcentrationChoropleth shares={[{ country_code: "XX", share_pct: 100 }]} />,
    );
    expect(html).toContain('data-testid="choropleth-unavailable"');
    expect(html).toContain("Carte indisponible");
    expect(html).not.toContain("<svg");
    expect(html).toContain("100 %");
  });

  it("aucune part : aucun rendu", () => {
    expect(renderToStaticMarkup(<ConcentrationChoropleth shares={[]} />)).toBe("");
  });
});
