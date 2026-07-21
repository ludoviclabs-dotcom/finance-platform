/**
 * countryWeights — agrégation par pays producteur + mapping ISO utilisé par
 * la carte D3 (topojson-client/world-atlas joint sur isoNumeric).
 */

import { describe, it, expect } from "vitest";

import { getMaterials } from "@/lib/crm/dataLoader";
import { computeCountryWeights, COUNTRY_CODES } from "@/lib/crm/countryWeights";
import snapshot from "@/data/crm_full_34_snapshot_2026-06-30.json";

describe("computeCountryWeights — agrégation", () => {
  it("agrège le poids total par pays sur toutes les matières", async () => {
    const { materials } = await getMaterials();
    const weights = computeCountryWeights(materials);

    const chine = weights.find(c => c.country === "Chine")!;
    const expectedChineTotal = materials
      .flatMap(m => m.top_producers)
      .filter(p => p.country === "Chine")
      .reduce((sum, p) => sum + p.share_pct, 0);
    expect(chine.total).toBeCloseTo(expectedChineTotal);
  });

  it("trie les pays par poids total décroissant", async () => {
    const { materials } = await getMaterials();
    const weights = computeCountryWeights(materials);
    for (let i = 1; i < weights.length; i++) {
      expect(weights[i - 1].total).toBeGreaterThanOrEqual(weights[i].total);
    }
  });

  it("trie les matières de chaque pays par part décroissante", async () => {
    const { materials } = await getMaterials();
    const weights = computeCountryWeights(materials);
    for (const country of weights) {
      for (let i = 1; i < country.materials.length; i++) {
        expect(country.materials[i - 1].share_pct).toBeGreaterThanOrEqual(country.materials[i].share_pct);
      }
    }
  });

  it("renvoie iso2/isoNumeric null (pas une exception) pour un pays non mappé", async () => {
    const { materials } = await getMaterials();
    const weights = computeCountryWeights([
      ...materials,
      {
        ...materials[0],
        id: "__test_unmapped__",
        top_producers: [{ country: "Pays Imaginaire", share_pct: 5 }],
      },
    ]);
    const unmapped = weights.find(c => c.country === "Pays Imaginaire")!;
    expect(unmapped.iso2).toBeNull();
    expect(unmapped.isoNumeric).toBeNull();
  });
});

describe("COUNTRY_CODES — couverture et format", () => {
  it("couvre chaque pays producteur réellement présent dans le snapshot live", () => {
    const countries = new Set<string>(
      (snapshot.materials as { top_producers: { country: string }[] }[])
        .flatMap(m => m.top_producers)
        .map(p => p.country)
    );
    const missing = [...countries].filter(c => !(c in COUNTRY_CODES));
    // Échoue volontairement et lisiblement si un futur snapshot introduit un
    // nouveau pays producteur : sans entrée ici, il apparaîtrait gris sur la carte.
    expect(missing, `pays sans code ISO : ${missing.join(", ")}`).toEqual([]);
  });

  it("iso2 est toujours 2 lettres majuscules", () => {
    for (const [country, codes] of Object.entries(COUNTRY_CODES)) {
      expect(codes.iso2, country).toMatch(/^[A-Z]{2}$/);
    }
  });

  it("isoNumeric est toujours un code numérique ISO 3166-1 à 3 chiffres (zero-paddé)", () => {
    for (const [country, codes] of Object.entries(COUNTRY_CODES)) {
      expect(codes.isoNumeric, country).toMatch(/^\d{3}$/);
    }
  });
});
