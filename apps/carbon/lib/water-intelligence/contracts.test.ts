/**
 * contracts.test.ts — contrats Water Intelligence côté TypeScript/Zod (P02).
 *
 * Valide la MÊME fixture JSON que
 * `apps/api/tests/test_water_intelligence_contracts.py`
 * (`docs/carbonco/water-intelligence/contracts/FIXTURE_MANIFEST.json`) —
 * c'est la preuve de compatibilité contractuelle minimale entre les deux
 * langages, pas une fixture dupliquée par langage.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  WaterIntelligenceManifestSchema,
  WaterSourceReferenceSchema,
  WaterGeographyRefSchema,
  WaterMetricObservationSchema,
  WaterLegalRecordSchema,
  WaterEditorialRecordSchema,
  WaterScenarioSchema,
} from "./contracts";

const REPO_ROOT = resolve(__dirname, "../../../..");
const FIXTURE_PATH = resolve(
  REPO_ROOT,
  "docs/carbonco/water-intelligence/contracts/FIXTURE_MANIFEST.json",
);

function loadFixture(): unknown {
  return JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
}

function validLicense(overrides: Record<string, unknown> = {}) {
  return {
    allow_ingest: true,
    allow_store: true,
    allow_display: true,
    allow_derived_use: true,
    reasons: [],
    warnings: [],
    ...overrides,
  };
}

function validSource(overrides: Record<string, unknown> = {}) {
  return {
    source_code: "TEST_SOURCE",
    release_key: "test-release-v1",
    checksum_sha256: "a".repeat(64),
    published_at: "2026-01-01",
    retrieved_at: "2026-01-02",
    observed_period_start: "2025-01-01",
    observed_period_end: "2025-12-31",
    methodology_version: "test-1.0.0",
    license: validLicense(),
    attribution: "Fixture de test.",
    warnings: [],
    ...overrides,
  };
}

function validObservation(overrides: Record<string, unknown> = {}) {
  return {
    metric_code: "test.metric",
    value: 10,
    unit: "unit",
    geography: { scope: "world", code: null, label: "Monde (test)" },
    period_start: "2025-01-01",
    period_end: "2025-12-31",
    method: { code: "TEST-METHOD", version: "1.0.0" },
    quality: { data_status: "observed", confidence: 80, coverage_pct: 100, warnings: [] },
    source: validSource(),
    scenario: null,
    value_withheld: false,
    ...overrides,
  };
}

describe("Fixture partagée Python <-> TypeScript", () => {
  it("valide le même FIXTURE_MANIFEST.json que la suite Python", () => {
    const raw = loadFixture();

    const manifest = WaterIntelligenceManifestSchema.parse(raw);

    expect(manifest.fixture_label).toBe("fixture");
    expect(manifest.sources).toHaveLength(1);
    expect(manifest.observations).toHaveLength(1);
    expect(manifest.geo_layers).toHaveLength(1);
    expect(manifest.editorial_records).toHaveLength(1);
    expect(manifest.legal_records).toHaveLength(1);
    expect(manifest.observations[0].quality.data_status).toBe("fixture");
  });
});

describe("WaterIntelligenceManifestSchema", () => {
  it("refuse un manifest sans source", () => {
    const raw = loadFixture() as Record<string, unknown>;
    raw.sources = [];

    expect(() => WaterIntelligenceManifestSchema.parse(raw)).toThrow();
  });

  it("refuse un manifest invalide avec une erreur lisible", () => {
    const result = WaterIntelligenceManifestSchema.safeParse({ manifest_version: "1.0.0" });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("generated_at");
      expect(paths).toContain("sources");
    }
  });
});

describe("WaterSourceReferenceSchema", () => {
  it("refuse une source sans release_key (donnée publiée sans release)", () => {
    const source = validSource();
    delete (source as Record<string, unknown>).release_key;

    expect(() => WaterSourceReferenceSchema.parse(source)).toThrow();
  });
});

describe("WaterMetricObservationSchema — valeur null", () => {
  it("conserve null et ne le convertit jamais en 0", () => {
    const observation = WaterMetricObservationSchema.parse(
      validObservation({ value: null }),
    );

    expect(observation.value).toBeNull();
    expect(observation.value).not.toBe(0);
  });

  it("distingue explicitement null de 0 dans l'union de type", () => {
    const withZero = WaterMetricObservationSchema.parse(validObservation({ value: 0 }));
    const withNull = WaterMetricObservationSchema.parse(validObservation({ value: null }));

    expect(withZero.value).toBe(0);
    expect(withNull.value).toBeNull();
    expect(withZero.value).not.toBe(withNull.value);
  });
});

describe("WaterMetricObservationSchema — licence et publication", () => {
  it("refuse une observation affichable dont la licence interdit l'affichage", () => {
    const payload = validObservation({
      source: validSource({ license: validLicense({ allow_display: false }) }),
      value_withheld: false,
    });

    expect(() => WaterMetricObservationSchema.parse(payload)).toThrow();
  });

  it("accepte la même observation quand value_withheld=true et value=null", () => {
    const observation = WaterMetricObservationSchema.parse(
      validObservation({
        source: validSource({ license: validLicense({ allow_display: false }) }),
        value: null,
        value_withheld: true,
      }),
    );

    expect(observation.value_withheld).toBe(true);
    expect(observation.value).toBeNull();
  });

  it("refuse value_withheld=true avec une valeur non nulle", () => {
    const payload = validObservation({ value: 10, value_withheld: true });

    expect(() => WaterMetricObservationSchema.parse(payload)).toThrow();
  });

  it("refuse un statut de donnée invalide", () => {
    const payload = validObservation();
    (payload.quality as Record<string, unknown>).data_status = "not_a_real_status";

    expect(() => WaterMetricObservationSchema.parse(payload)).toThrow();
  });
});

describe("WaterGeographyRefSchema", () => {
  it("refuse un scope non-monde sans code", () => {
    expect(() =>
      WaterGeographyRefSchema.parse({ scope: "france", code: null, label: "France" }),
    ).toThrow();
  });

  it("accepte scope='world' sans code", () => {
    const geography = WaterGeographyRefSchema.parse({
      scope: "world",
      code: null,
      label: "Monde",
    });

    expect(geography.code).toBeNull();
  });
});

describe("WaterLegalRecordSchema", () => {
  it("refuse un record juridique sans source", () => {
    expect(() =>
      WaterLegalRecordSchema.parse({
        record_id: "r1",
        jurisdiction: "Test",
        reference_text: "Texte",
        version: "1.0",
        legal_status: "unknown",
        reviewed_on: "2026-01-01",
        reviewed_by: "tester",
      }),
    ).toThrow();
  });

  it("refuse un record juridique sans date de revue", () => {
    expect(() =>
      WaterLegalRecordSchema.parse({
        record_id: "r1",
        jurisdiction: "Test",
        reference_text: "Texte",
        version: "1.0",
        legal_status: "unknown",
        source: validSource(),
        reviewed_by: "tester",
      }),
    ).toThrow();
  });
});

describe("WaterEditorialRecordSchema", () => {
  it("refuse un record éditorial sans source", () => {
    expect(() =>
      WaterEditorialRecordSchema.parse({
        record_id: "e1",
        record_type: "industry",
        title: "Titre",
        summary: "Résumé",
        reviewed_on: "2026-01-01",
        reviewed_by: "tester",
      }),
    ).toThrow();
  });
});

describe("WaterScenarioSchema", () => {
  it("refuse un scénario sans source", () => {
    expect(() =>
      WaterScenarioSchema.parse({ scenario_code: "s1", label: "Scénario test" }),
    ).toThrow();
  });

  it("accepte un scénario valide", () => {
    const scenario = WaterScenarioSchema.parse({
      scenario_code: "s1",
      label: "Scénario test",
      horizon_year: 2030,
      source: validSource(),
    });

    expect(scenario.horizon_year).toBe(2030);
  });
});
