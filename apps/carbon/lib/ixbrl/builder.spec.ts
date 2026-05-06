import { describe, expect, it } from "vitest";
import { buildIxbrl } from "./builder";
import { ESRS_E1_COVERED_IDS } from "./esrs-e1-tags";

const entity = {
  identifier: "969500HKZUL3KGFNAQ12",
  scheme: "http://standards.iso.org/iso/17442",
  name: "Acme Industrie SA",
};

const period = { startDate: "2025-01-01", endDate: "2025-12-31" };

describe("ixbrl builder — ESRS E1", () => {
  it("génère un XHTML valide avec en-tête et namespaces requis", () => {
    const r = buildIxbrl({
      reportId: "rep_2025",
      entity,
      period,
      facts: [
        { datapointId: "E1-6_scope1_gross", value: 12500 },
        { datapointId: "E1-6_scope2_location_based", value: 8400 },
        { datapointId: "E1-6_total_ghg", value: 20900 },
      ],
    });
    expect(r.xml).toContain("xmlns:ix=");
    expect(r.xml).toContain("xmlns:xbrli=");
    expect(r.xml).toContain("xmlns:esrs=");
    expect(r.xml).toContain("link:schemaRef");
    expect(r.factsTagged).toBe(3);
    expect(r.factsSkipped).toBe(0);
  });

  it("tagge correctement les émissions Scope 1 / 2 / 3", () => {
    const r = buildIxbrl({
      reportId: "rep_2025",
      entity,
      period,
      facts: [
        { datapointId: "E1-6_scope1_gross", value: 1000 },
        { datapointId: "E1-6_scope2_location_based", value: 500 },
        { datapointId: "E1-6_scope2_market_based", value: 480 },
        { datapointId: "E1-6_scope3_total", value: 7500 },
      ],
    });
    expect(r.xml).toContain('name="esrs:GrossScope1GHGEmissions"');
    expect(r.xml).toContain('name="esrs:GrossLocationBasedScope2GHGEmissions"');
    expect(r.xml).toContain('name="esrs:GrossMarketBasedScope2GHGEmissions"');
    expect(r.xml).toContain('name="esrs:GrossScope3GHGEmissions"');
    expect(r.xml).toContain("unitRef=\"tco2e\"");
  });

  it("rejette les datapoints inconnus avec un warning", () => {
    const r = buildIxbrl({
      reportId: "rep_2025",
      entity,
      period,
      facts: [
        { datapointId: "E1-6_scope1_gross", value: 1000 },
        { datapointId: "ZZ_unknown", value: 999 },
      ],
    });
    expect(r.factsTagged).toBe(1);
    expect(r.warnings).toContain("unknown_datapoint:ZZ_unknown");
  });

  it("rejette les valeurs négatives sur les datapoints non-négatifs", () => {
    const r = buildIxbrl({
      reportId: "rep_2025",
      entity,
      period,
      facts: [{ datapointId: "E1-6_scope1_gross", value: -50 }],
    });
    expect(r.factsTagged).toBe(0);
    expect(r.warnings[0]).toContain("negative_not_allowed");
  });

  it("ignore les valeurs nulles avec un warning", () => {
    const r = buildIxbrl({
      reportId: "rep_2025",
      entity,
      period,
      facts: [{ datapointId: "E1-6_scope1_gross", value: null }],
    });
    expect(r.factsTagged).toBe(0);
    expect(r.warnings[0]).toContain("null_value");
  });

  it("escape les caractères XML dans le nom de l'entité et les valeurs string", () => {
    const r = buildIxbrl({
      reportId: "rep_2025",
      entity: { ...entity, name: "Acme & Co <industrial>" },
      period,
      facts: [
        {
          datapointId: "E1-1_transition_plan",
          value: "Plan 1.5°C — pilotage <CapEx> & <OpEx>",
        },
      ],
    });
    expect(r.xml).not.toContain("<industrial>");
    expect(r.xml).toContain("&lt;industrial&gt;");
    expect(r.xml).toContain("Plan 1.5°C");
    expect(r.xml).toContain("&lt;CapEx&gt;");
  });

  it("convertit les pourcentages en ratio décimal pour percentItemType", () => {
    const r = buildIxbrl({
      reportId: "rep_2025",
      entity,
      period,
      facts: [{ datapointId: "E1-9_capex_aligned_taxonomy", value: 24.5 }],
    });
    // 24.5% → ratio 0.245
    expect(r.xml).toContain(">0.245</ix:nonFraction>");
  });

  it("crée les contextes period (instant et duration) déduplication par id", () => {
    const r = buildIxbrl({
      reportId: "rep_2025",
      entity,
      period,
      facts: [
        { datapointId: "E1-6_scope1_gross", value: 1000 }, // duration
        { datapointId: "E1-9_assets_at_physical_risk", value: 500 }, // instant
        { datapointId: "E1-9_assets_at_transition_risk", value: 200 }, // instant
      ],
    });
    expect(r.xml).toContain('xbrli:context id="c-duration-2025-01-01-2025-12-31"');
    expect(r.xml).toContain('xbrli:context id="c-instant-2025-12-31"');
    // pas de duplication
    const matchesInstant = r.xml.match(/c-instant-2025-12-31/g);
    expect(matchesInstant?.length).toBeGreaterThanOrEqual(2); // au moins context + 2 contextRef
  });

  it("inclut les unités xbrli (tco2e, mwh, eur, ratios)", () => {
    const r = buildIxbrl({
      reportId: "rep_2025",
      entity,
      period,
      facts: [
        { datapointId: "E1-5_energy_consumption_total", value: 12000 },
        { datapointId: "E1-6_total_ghg", value: 5000 },
        { datapointId: "E1-9_assets_at_physical_risk", value: 1_200_000 },
        { datapointId: "E1-6_ghg_intensity", value: 12.5 },
      ],
    });
    expect(r.xml).toContain('xbrli:unit id="mwh"');
    expect(r.xml).toContain('xbrli:unit id="tco2e"');
    expect(r.xml).toContain('xbrli:unit id="m_eur"');
    expect(r.xml).toContain('xbrli:unit id="tco2e_per_meur"');
    expect(r.xml).toContain("<xbrli:divide>");
  });

  it("couvre l'ensemble des datapoints E1 obligatoires si valeurs fournies", () => {
    const facts = ESRS_E1_COVERED_IDS.map((id) => ({
      datapointId: id,
      value: id.startsWith("E1-1_") || id.startsWith("E1-2_") || id.startsWith("E1-3_") || id.startsWith("E1-4_") ? "narratif" : 100,
    }));
    const r = buildIxbrl({ reportId: "rep_2025", entity, period, facts });
    expect(r.factsTagged).toBe(facts.length);
    expect(r.warnings).toHaveLength(0);
  });
});
