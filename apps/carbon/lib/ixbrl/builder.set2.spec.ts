/**
 * Tests iXBRL Phase 2 — ESRS Set 2 complet (E2-E5, S1-S4, G1).
 *
 * Vérifie que le builder génère bien des tags XBRL pour tous les nouveaux
 * standards et que les unités (tonne, m3, ha, pure) sont correctement incluses.
 */

import { describe, it, expect } from "vitest";
import { buildIxbrl, type BuildIxbrlParams } from "./builder";

const ENTITY = {
  identifier: "FR1234567890",
  scheme: "http://standards.iso.org/iso/17442",
  name: "Société Test CSRD SA",
};

const PERIOD = {
  startDate: "2025-01-01",
  endDate: "2025-12-31",
};

function makeParams(facts: BuildIxbrlParams["facts"]): BuildIxbrlParams {
  return { reportId: "test-set2", entity: ENTITY, period: PERIOD, facts };
}

// ---------------------------------------------------------------------------
// 1. E2 — NOx taggé avec unitRef "tonne"
// ---------------------------------------------------------------------------
describe("E2 — Pollution", () => {
  it("1. tague les émissions NOx avec unitRef tonne", () => {
    const result = buildIxbrl(
      makeParams([{ datapointId: "E2-4_air_nox", value: 450 }]),
    );
    expect(result.factsTagged).toBe(1);
    expect(result.warnings).toHaveLength(0);
    expect(result.xml).toContain('name="esrs:NitrogenOxidesEmissions"');
    expect(result.xml).toContain('unitRef="tonne"');
    expect(result.xml).toContain("<xbrli:measure>esrs:tonne</xbrli:measure>");
  });

  it("2. rejette une valeur négative de polluant (nonNegative)", () => {
    const result = buildIxbrl(
      makeParams([{ datapointId: "E2-4_air_sox", value: -10 }]),
    );
    expect(result.factsTagged).toBe(0);
    expect(result.warnings[0]).toMatch(/negative_not_allowed/);
  });
});

// ---------------------------------------------------------------------------
// 3. E3 — Eau taggée avec unitRef "m3"
// ---------------------------------------------------------------------------
describe("E3 — Eau", () => {
  it("3. tague le prélèvement total d'eau avec unitRef m3", () => {
    const result = buildIxbrl(
      makeParams([{ datapointId: "E3-4_water_withdrawal", value: 125000 }]),
    );
    expect(result.factsTagged).toBe(1);
    expect(result.warnings).toHaveLength(0);
    expect(result.xml).toContain('name="esrs:TotalWaterWithdrawal"');
    expect(result.xml).toContain('unitRef="m3"');
    expect(result.xml).toContain("<xbrli:measure>esrs:m3</xbrli:measure>");
    expect(result.xml).toContain(">125000<");
  });

  it("4. tague l'intensité hydrique avec unitRef m3_per_meur (divide)", () => {
    const result = buildIxbrl(
      makeParams([{ datapointId: "E3-4_water_intensity", value: 42.5 }]),
    );
    expect(result.factsTagged).toBe(1);
    expect(result.xml).toContain('name="esrs:WaterIntensityPerNetRevenue"');
    expect(result.xml).toContain('unitRef="m3_per_meur"');
    expect(result.xml).toContain("<xbrli:unitNumerator>");
  });
});

// ---------------------------------------------------------------------------
// 5. E4 — Biodiversité taggée avec unitRef "ha"
// ---------------------------------------------------------------------------
describe("E4 — Biodiversité", () => {
  it("5. tague la superficie d'écosystèmes restaurés avec unitRef ha", () => {
    const result = buildIxbrl(
      makeParams([{ datapointId: "E4-5_ecosystems_restored", value: 30.5 }]),
    );
    expect(result.factsTagged).toBe(1);
    expect(result.warnings).toHaveLength(0);
    expect(result.xml).toContain('name="esrs:AreaOfRestoredEcosystems"');
    expect(result.xml).toContain('unitRef="ha"');
    expect(result.xml).toContain("<xbrli:measure>esrs:ha</xbrli:measure>");
  });
});

// ---------------------------------------------------------------------------
// 6. E5 — Déchets
// ---------------------------------------------------------------------------
describe("E5 — Économie circulaire", () => {
  it("6. tague déchets détournés + dirigés dans un rapport cohérent", () => {
    const result = buildIxbrl(
      makeParams([
        { datapointId: "E5-5_waste_total", value: 1000 },
        { datapointId: "E5-5_waste_diverted_from_disposal", value: 700 },
        { datapointId: "E5-5_waste_directed_to_disposal", value: 300 },
      ]),
    );
    expect(result.factsTagged).toBe(3);
    expect(result.warnings).toHaveLength(0);
    expect(result.xml).toContain('name="esrs:TotalWasteGenerated"');
    expect(result.xml).toContain('name="esrs:WasteDivertedFromDisposal"');
    expect(result.xml).toContain('name="esrs:WasteDirectedToDisposal"');
    expect(result.xml).toContain('unitRef="tonne"');
  });
});

// ---------------------------------------------------------------------------
// 7. S1 — Effectifs
// ---------------------------------------------------------------------------
describe("S1 — Effectifs propres", () => {
  it("7. tague l'effectif total (instant)", () => {
    const result = buildIxbrl(
      makeParams([{ datapointId: "S1-6_total_employees", value: 2847 }]),
    );
    expect(result.factsTagged).toBe(1);
    expect(result.warnings).toHaveLength(0);
    expect(result.xml).toContain('name="esrs:TotalNumberOfEmployees"');
    // instant → contextRef contient "instant"
    expect(result.xml).toContain("c-instant-");
    expect(result.xml).toContain(">2847<");
  });
});

// ---------------------------------------------------------------------------
// 8. S2 — Incidents droits humains chaîne de valeur
// ---------------------------------------------------------------------------
describe("S2 — Chaîne de valeur", () => {
  it("8. tague les incidents droits humains en chaîne de valeur", () => {
    const result = buildIxbrl(
      makeParams([{ datapointId: "S2-5_human_rights_incidents", value: 3 }]),
    );
    expect(result.factsTagged).toBe(1);
    expect(result.xml).toContain('name="esrs:HumanRightsIncidentsInValueChain"');
    expect(result.xml).toContain('unitRef="pure"');
  });
});

// ---------------------------------------------------------------------------
// 9. G1 — Corruption
// ---------------------------------------------------------------------------
describe("G1 — Gouvernance", () => {
  it("9. tague les incidents de corruption", () => {
    const result = buildIxbrl(
      makeParams([{ datapointId: "G1-4_corruption_incidents", value: 0 }]),
    );
    expect(result.factsTagged).toBe(1);
    expect(result.warnings).toHaveLength(0);
    expect(result.xml).toContain(
      'name="esrs:ConfirmedIncidentsOfCorruptionOrBribery"',
    );
    expect(result.xml).toContain(">0<");
  });
});

// ---------------------------------------------------------------------------
// 10. Mix E1+E2+S1 dans un seul rapport — namespaces + déduplication contextes
// ---------------------------------------------------------------------------
describe("Mix Set 2 complet", () => {
  it("10. mélange E1/E2/S1 — namespaces, contextes dédupliqués, unités multiples", () => {
    const result = buildIxbrl(
      makeParams([
        // E1
        { datapointId: "E1-6_scope1_gross", value: 5000 },
        // E2
        { datapointId: "E2-4_air_nox", value: 12 },
        { datapointId: "E2-4_water_pollutants", value: 3 },
        // S1 (instant vs duration → 2 contextes distincts)
        { datapointId: "S1-6_total_employees", value: 150 },
        { datapointId: "S1-14_recordable_work_accidents", value: 2 },
        // G1
        { datapointId: "G1-4_corruption_incidents", value: 0 },
      ]),
    );

    expect(result.factsTagged).toBe(6);
    expect(result.warnings).toHaveLength(0);

    // Namespaces ESRS présents
    expect(result.xml).toContain('xmlns:esrs="https://xbrl.efrag.org/taxonomy/esrs/2024-12-04/esrs"');

    // Plusieurs unités présentes
    expect(result.xml).toContain('id="tco2e"');
    expect(result.xml).toContain('id="tonne"');
    expect(result.xml).toContain('id="pure"');

    // Contextes instant + duration présents (S1-6 est instant, S1-14 est duration)
    expect(result.xml).toContain("c-instant-");
    expect(result.xml).toContain("c-duration-");

    // Chaque datapoint taggé une seule fois
    const matches = result.xml.match(/name="esrs:/g);
    expect(matches).toHaveLength(6);
  });
});
