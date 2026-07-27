/**
 * lib/water-intelligence/contracts.ts — miroir TypeScript/Zod des contrats
 * Python `apps/api/models/water_intelligence.py` (P02).
 *
 * Champs en snake_case, alignés sur le JSON Python (comme
 * `models/intelligence.py` côté backend) : c'est ce qui permet à
 * `docs/carbonco/water-intelligence/contracts/FIXTURE_MANIFEST.json` d'être
 * validé tel quel des deux côtés (voir `contracts.test.ts` et
 * `apps/api/tests/test_water_intelligence_contracts.py` — même fichier,
 * mêmes octets, c'est la preuve de compatibilité contractuelle).
 *
 * Aucune table, aucun endpoint public, aucune donnée réelle : uniquement des
 * types et leur validation. Aucune nouvelle dépendance — `zod` est déjà une
 * dépendance du projet (`lib/esrs/schema.ts`).
 */

import { z } from "zod";

export const WaterDataStatusEnum = z.enum([
  "observed",
  "modelled",
  "estimated",
  "manual",
  "fixture",
]);
export type WaterDataStatus = z.infer<typeof WaterDataStatusEnum>;

export const WaterGeographyScopeEnum = z.enum(["world", "europe", "france"]);
export type WaterGeographyScope = z.infer<typeof WaterGeographyScopeEnum>;

/**
 * Vocabulaire juridique partagé avec `apps/api/models/water_intelligence.py`.
 *
 * `repealed` a été AJOUTÉ en Wave E. Son absence forçait une conversion
 * destructive : un texte abrogé était publié comme `out_of_scope`, c'est-à-dire
 * comme un texte en vigueur mais hors du champ du lecteur. Un texte abrogé, lui,
 * ne redeviendra jamais applicable. La conversion est désormais interdite côté
 * Python et un test de parité verrouille les deux vocabulaires ensemble.
 */
export const WaterLegalStatusEnum = z.enum([
  "in_force",
  "adopted_not_applicable",
  "proposed",
  "transposition_pending",
  "materiality_dependent",
  "voluntary",
  "repealed",
  "out_of_scope",
  "unknown",
]);
export type WaterLegalStatus = z.infer<typeof WaterLegalStatusEnum>;

/** Nature de la source officielle d'un texte — jamais un portail open data. */
export const OfficialSourceKindEnum = z.enum([
  "official_journal",
  "consolidated_register",
  "regulator_publication",
  "standard_setter",
  "unknown",
]);
export type OfficialSourceKind = z.infer<typeof OfficialSourceKindEnum>;

/** Miroir de `models.analytics.MethodRef` — même forme, pas réinventée. */
export const MethodRefSchema = z.object({
  code: z.string().min(1).max(100),
  version: z.string().min(1).max(50),
});
export type MethodRef = z.infer<typeof MethodRefSchema>;

/** Miroir de `models.intelligence.LicenseDecision` (réexportée en Python
 * sous `WaterLicenseDecision` — même décision de licence déterministe). */
export const WaterLicenseDecisionSchema = z.object({
  allow_ingest: z.boolean(),
  allow_store: z.boolean(),
  allow_display: z.boolean(),
  allow_derived_use: z.boolean(),
  reasons: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
});
export type WaterLicenseDecision = z.infer<typeof WaterLicenseDecisionSchema>;

export const WaterSourceReferenceSchema = z.object({
  source_code: z.string().min(1),
  release_key: z.string().min(1),
  checksum_sha256: z.string().length(64),
  published_at: z.string().nullable().optional(),
  retrieved_at: z.string(),
  observed_period_start: z.string().nullable().optional(),
  observed_period_end: z.string().nullable().optional(),
  methodology_version: z.string().min(1),
  license: WaterLicenseDecisionSchema,
  attribution: z.string().nullable().optional(),
  /**
   * URL officielle STABLE de la page décrivant le jeu — jamais une URL d'appel
   * d'API paramétrée. Nullable au contrat pour ne pas invalider les documents
   * canoniques déjà gelés (`FIXTURE_MANIFEST.json` en porte quatre) :
   * l'obligation « une source PUBLIÉE en porte une » est appliquée par
   * l'assembleur Python, qui écarte avec motif plutôt que de publier une
   * provenance muette.
   */
  source_information_url: z.string().nullable().optional(),
  /**
   * Cadence de mise à jour CÔTÉ SOURCE. `null` signifie « non vérifiée », ce
   * qui n'est pas « pas de mise à jour » — la surface rend les deux
   * différemment. Distinct de `retrieved_at`, qui est notre date de lecture :
   * une source synchronisée tous les jours ne rend pas « actuelle » une
   * observation historique.
   */
  source_refresh_cadence: z.string().nullable().optional(),
  /**
   * Date de dernière mise à jour de l'Information réutilisée, relevée sur la
   * source officielle. Exigée par la condition de paternité de la Licence
   * Ouverte 2.0. Jamais déduite d'un checksum ni d'une période observée.
   */
  source_last_updated_on: z.string().nullable().optional(),
  warnings: z.array(z.string()).default([]),
});
export type WaterSourceReference = z.infer<typeof WaterSourceReferenceSchema>;

/** `code` obligatoire dès que `scope != "world"` — aucune jointure par nom. */
export const WaterGeographyRefSchema = z
  .object({
    scope: WaterGeographyScopeEnum,
    code: z.string().nullable().optional(),
    label: z.string().min(1),
  })
  .refine((geography) => geography.scope === "world" || !!geography.code, {
    message:
      "geography.code obligatoire pour scope != 'world' (seul scope='world' peut omettre un identifiant)",
    path: ["code"],
  });
export type WaterGeographyRef = z.infer<typeof WaterGeographyRefSchema>;

/** Séparée de `value` par construction : risque/valeur ≠ confiance. */
export const WaterQualityMetadataSchema = z.object({
  data_status: WaterDataStatusEnum,
  confidence: z.number().int().min(0).max(100).nullable().optional(),
  coverage_pct: z.number().min(0).max(100).nullable().optional(),
  warnings: z.array(z.string()).default([]),
});
export type WaterQualityMetadata = z.infer<typeof WaterQualityMetadataSchema>;

export const WaterScenarioSchema = z.object({
  scenario_code: z.string().min(1),
  label: z.string().min(1),
  horizon_year: z.number().int().nullable().optional(),
  source: WaterSourceReferenceSchema,
});
export type WaterScenario = z.infer<typeof WaterScenarioSchema>;

/** Jamais coercée, jamais par défaut à 0 — `null` reste `null`. */
export const WaterMetricValueSchema = z.union([
  z.number(),
  z.string(),
  z.boolean(),
  z.null(),
]);
export type WaterMetricValue = z.infer<typeof WaterMetricValueSchema>;

export const WaterMetricObservationSchema = z
  .object({
    metric_code: z.string().min(1),
    value: WaterMetricValueSchema,
    unit: z.string().nullable().optional(),
    geography: WaterGeographyRefSchema,
    period_start: z.string(),
    period_end: z.string(),
    method: MethodRefSchema,
    quality: WaterQualityMetadataSchema,
    source: WaterSourceReferenceSchema,
    scenario: WaterScenarioSchema.nullable().optional(),
    value_withheld: z.boolean().default(false),
  })
  .refine(
    (observation) => observation.source.license.allow_display || observation.value_withheld,
    {
      message:
        "source.license.allow_display=false : value_withheld doit être true (la valeur ne peut pas être publiée)",
      path: ["value_withheld"],
    },
  )
  .refine((observation) => !observation.value_withheld || observation.value === null, {
    message: "value_withheld=true : value doit être null (la valeur ne quitte jamais le backend)",
    path: ["value"],
  });
export type WaterMetricObservation = z.infer<typeof WaterMetricObservationSchema>;

/** `feature_count` borné à 1000 — budget documenté dans P02_DATA_CONTRACTS.md. */
export const WaterGeoLayerDescriptorSchema = z.object({
  layer_id: z.string().min(1),
  zoom_level: WaterGeographyScopeEnum,
  geography: WaterGeographyRefSchema,
  feature_count: z.number().int().min(0).max(1000),
  boundary_format: z.enum(["geojson", "topojson"]).default("topojson"),
  payload_bytes_gzip: z.number().int().min(0).nullable().optional(),
  source: WaterSourceReferenceSchema,
});
export type WaterGeoLayerDescriptor = z.infer<typeof WaterGeoLayerDescriptorSchema>;

export const WaterEditorialRecordSchema = z.object({
  record_id: z.string().min(1),
  record_type: z.enum(["industry", "actor", "event", "innovation"]),
  title: z.string().min(1),
  summary: z.string().min(1),
  jurisdiction: z.string().nullable().optional(),
  valid_from: z.string().nullable().optional(),
  valid_to: z.string().nullable().optional(),
  source: WaterSourceReferenceSchema,
  reviewed_on: z.string(),
  reviewed_by: z.string().min(1),
});
export type WaterEditorialRecord = z.infer<typeof WaterEditorialRecordSchema>;

/**
 * Référence officielle d'un TEXTE DE LOI.
 *
 * Distincte de `WaterSourceReferenceSchema`, qui décrit une release de jeu de
 * données et exige une clé de release, une empreinte SHA-256 de 64 caractères
 * et une décision de licence. Forcer un article de directive dans cette forme
 * obligeait à fabriquer trois valeurs pour satisfaire un schéma.
 *
 * Tous les champs sont optionnels : un réviseur juridique les renseigne au fil
 * de son instruction. Une référence incomplète est un état légitime — c'est
 * l'état de toutes les entrées aujourd'hui.
 */
export const OfficialLegalReferenceSchema = z.object({
  official_url: z.string().url().startsWith("https://").nullable().optional(),
  publisher: z.string().min(1).nullable().optional(),
  instrument_identifier: z.string().min(1).nullable().optional(),
  version_or_consolidation_date: z.string().min(1).nullable().optional(),
  retrieved_on: z.string().nullable().optional(),
  jurisdiction: z.string().min(1).nullable().optional(),
  official_source_kind: OfficialSourceKindEnum.default("unknown"),
});
export type OfficialLegalReference = z.infer<typeof OfficialLegalReferenceSchema>;

export const WaterLegalRecordSchema = z.object({
  record_id: z.string().min(1),
  jurisdiction: z.string().min(1),
  reference_text: z.string().min(1),
  version: z.string().min(1),
  legal_status: WaterLegalStatusEnum,
  source: OfficialLegalReferenceSchema,
  reviewed_on: z.string(),
  reviewed_by: z.string().min(1),
});
export type WaterLegalRecord = z.infer<typeof WaterLegalRecordSchema>;

/** Forme unique du snapshot public (P10 en construira les instances réelles). */
export const WaterIntelligenceManifestSchema = z.object({
  manifest_version: z.string().min(1),
  generated_at: z.string(),
  fixture_label: z.enum(["fixture", "demo"]).nullable().optional(),
  sources: z.array(WaterSourceReferenceSchema).min(1),
  observations: z.array(WaterMetricObservationSchema).default([]),
  geo_layers: z.array(WaterGeoLayerDescriptorSchema).default([]),
  scenarios: z.array(WaterScenarioSchema).default([]),
  editorial_records: z.array(WaterEditorialRecordSchema).default([]),
  legal_records: z.array(WaterLegalRecordSchema).default([]),
  warnings: z.array(z.string()).default([]),
});
export type WaterIntelligenceManifest = z.infer<typeof WaterIntelligenceManifestSchema>;
