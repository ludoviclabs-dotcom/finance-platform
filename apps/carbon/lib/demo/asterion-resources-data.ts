/**
 * asterion-resources-data.ts — données synthétiques de la séquence « Dépendances
 * industrielles étendues » (MODULE 2, PR-M2D).
 *
 * 100 % FICTIF. Typé avec les VRAIS types de `@/lib/api/resources` pour que les
 * VRAIS composants du cockpit (ResourceIndexCard, AssessmentDimensionsPanel,
 * StageConcentrationPanel, RegulatoryStatusPanel, ExposureLinksTable, ModuleLinks)
 * les acceptent sans adaptateur. Les valeurs numériques reproduisent EXACTEMENT
 * la sortie du moteur `services/resources/scoring.py` sur les mêmes entrées (voir
 * `resources.json::expected_assessments` + le test de parité backend) — jamais
 * saisies au hasard. Aucune statistique mondiale : les parts pays sont la
 * cartographie d'approvisionnement ESTIMÉE du tenant démo. Aucun contenu
 * Défense/Spatial opérationnel.
 */

import {
  buildStageConcentration,
  type ResourceAlert,
  type ResourceAssessmentDetail,
  type ResourceCatalogDetail,
  type ResourceCatalogItem,
  type ResourceDimension,
  type ResourceExposureLink,
  type ResourceRegulatoryStatus,
  type ResourceSectorUse,
  type ResourceSupplyObservation,
} from "@/lib/api/resources";

const RELEASE = 4201; // release Evidence Kernel synthétique (démo)
const YEAR = 2024;

/** Catalogue de démonstration (tenant-scoped, 5 ressources). */
export const RESOURCE_CATALOG: ResourceCatalogItem[] = [
  { id: 1, company_id: 90, slug: "silicon-metal", name: "Silicon metal", name_fr: "Silicium métal", primary_family: "critical_raw_material", data_status: "estimated", has_source: true },
  { id: 2, company_id: 90, slug: "helium", name: "Helium", name_fr: "Hélium", primary_family: "industrial_gas", data_status: "estimated", has_source: true },
  { id: 3, company_id: 90, slug: "xenon", name: "Xenon", name_fr: "Xénon", primary_family: "industrial_gas", data_status: "estimated", has_source: true },
  { id: 4, company_id: 90, slug: "hydrogen", name: "Hydrogen", name_fr: "Hydrogène", primary_family: "energy_fuel", data_status: "estimated", has_source: true },
  { id: 5, company_id: 90, slug: "coking-coal", name: "Coking coal", name_fr: "Charbon à coke", primary_family: "energy_fuel", data_status: "estimated", has_source: true },
];

// ── Ressource pilote : silicium métal ───────────────────────────────────────

export const SILICON: ResourceCatalogDetail = {
  id: 1,
  company_id: 90,
  slug: "silicon-metal",
  name: "Silicon metal",
  name_fr: "Silicium métal",
  primary_family: "critical_raw_material",
  description:
    "Silicium métal — intrant de l'électronique de puissance des moteurs E-Drive X4. Ressource pilote : concentration élevée en amont, dépendance hors UE, exposition via un achat réel.",
  data_status: "estimated",
  source_release_id: RELEASE,
  aliases_count: 2,
  regulations_count: 1,
  uses_count: 2,
  created_at: "2026-06-30T09:00:00Z",
};

export const SILICON_USES: ResourceSectorUse[] = [
  { id: 11, company_id: 90, resource_id: 1, sector_code: "C27", use_label: "Électronique de puissance (onduleurs moteurs)", criticality_note: "Intrant des semi-conducteurs de puissance.", data_status: "estimated", source_release_id: RELEASE, created_at: "2026-06-30T09:00:00Z" },
  { id: 12, company_id: 90, resource_id: 1, sector_code: "C24", use_label: "Alliages & silicones", criticality_note: null, data_status: "manual", source_release_id: null, created_at: "2026-06-30T09:00:00Z" },
];

/** Expositions — DÉMONTRE les trois origines : achat, nomenclature (BOM), activité. */
export const EXPOSURES: ResourceExposureLink[] = [
  { id: 101, company_id: 90, resource_id: 1, resource_slug: "silicon-metal", role: "material", link_kind: "purchase_line", linked_ref: "purchase_line:842", annual_mass_kg: 9000, annual_spend_eur: 180000, share_of_supply_pct: 60, stock_coverage_days: 45, data_status: "estimated", created_at: "2026-06-30T09:00:00Z" },
  { id: 102, company_id: 90, resource_id: 1, resource_slug: "silicon-metal", role: "material", link_kind: "bom_item", linked_ref: "bom_item:501", annual_mass_kg: 6000, annual_spend_eur: null, share_of_supply_pct: 40, stock_coverage_days: null, data_status: "manual", created_at: "2026-06-30T09:00:00Z" },
  { id: 103, company_id: 90, resource_id: 4, resource_slug: "hydrogen", role: "energy_carrier", link_kind: "energy_activity", linked_ref: "energy_activity:31", annual_mass_kg: null, annual_spend_eur: null, share_of_supply_pct: null, stock_coverage_days: 60, data_status: "estimated", created_at: "2026-06-30T09:00:00Z" },
];

const SILICON_OBSERVATIONS: ResourceSupplyObservation[] = [
  ["mining", "CN", 40], ["mining", "RU", 22], ["mining", "BR", 16],
  ["smelting", "CN", 68], ["smelting", "NO", 12], ["smelting", "FR", 8],
].map(([stage, country, share], i) => ({
  id: 200 + i,
  company_id: 90,
  resource_id: 1,
  stage_code: stage as string,
  country_code: country as string,
  metric_code: "production",
  share_pct: share as number,
  volume_value: null,
  volume_unit: null,
  reference_year: YEAR,
  data_status: "estimated",
  confidence: null,
  source_release_id: RELEASE,
  evidence_artifact_id: null,
  created_at: "2026-06-30T09:00:00Z",
}));

/** Concentration par étape, calculée par le MÊME agrégateur que le cockpit réel. */
export const SILICON_STAGES = buildStageConcentration(SILICON_OBSERVATIONS);

export const SILICON_REGULATORY: ResourceRegulatoryStatus[] = [
  { id: 51, company_id: 90, resource_id: 1, regime: "crma", regulation_ref: "Reg (UE) 2024/1252 (illustratif)", list_or_annex: "Stratégique + Critique", listing_status: "listed", validity_note: "Classement illustratif de démonstration, non vérifié officiellement.", certainty: "probable", source_release_id: RELEASE, verified_on: "2024-05-01", created_at: "2026-06-30T09:00:00Z" },
];

// Dimensions — reproduction EXACTE de la sortie du moteur (silicon-metal).
const RISK_DIMS: ResourceDimension[] = [
  { kind: "risk", dimension_code: "stage_concentration", available: true, risk_value: 62.4, weight: 0.4118, contribution: 25.6963, raw_value: 6239.67, raw_unit: "HHI (0-10000)", stage_code: "smelting", rationale: "Étape la plus concentrée : smelting (HHI 6239.67, premier pays CN, 3 pays observés).", detail: { observed_hhi: 6239.67, coverage_pct: 88.0, missing_share_pct: 12.0, top_country: "CN" }, source_release_ids: [RELEASE] },
  { kind: "risk", dimension_code: "third_country_dependency", available: true, risk_value: 100.0, weight: 0.2353, contribution: 23.53, raw_value: 100.0, raw_unit: "% hors UE", stage_code: "mining", rationale: "Étape la plus dépendante de pays tiers : mining (100 % du marché observé hors Union européenne). « Part hors UE », pas un score de risque-pays.", detail: {}, source_release_ids: [] },
  { kind: "risk", dimension_code: "supplier_dependency", available: true, risk_value: 52.0, weight: 0.2353, contribution: 12.2356, raw_value: 5200.0, raw_unit: "HHI (0-10000)", stage_code: null, rationale: "Concentration des approvisionnements du tenant sur 2 fournisseur(s) (HHI 5200).", detail: {}, source_release_ids: [] },
  { kind: "risk", dimension_code: "substitutability", available: false, risk_value: null, weight: null, contribution: null, raw_value: null, raw_unit: null, stage_code: null, rationale: "Aucun substitut recensé — absence de donnée, PAS absence de substitut.", detail: {}, source_release_ids: [] },
  { kind: "risk", dimension_code: "stock_coverage", available: true, risk_value: 77.5, weight: 0.1176, contribution: 9.114, raw_value: 45.0, raw_unit: "jours", stage_code: null, rationale: "Couverture de stock de 45 jour(s) (180 j ramène au plancher 10).", detail: {}, source_release_ids: [] },
];

const CONF_DIMS: ResourceDimension[] = [
  { kind: "confidence", dimension_code: "market_coverage", available: true, risk_value: null, weight: 0.3, contribution: null, raw_value: 0.88, raw_unit: null, stage_code: null, rationale: "Marché documenté à l'étape retenue : 88 %.", detail: {}, source_release_ids: [] },
  { kind: "confidence", dimension_code: "data_quality", available: true, risk_value: null, weight: 0.2, contribution: null, raw_value: 0.5, raw_unit: null, stage_code: null, rationale: "6 observation(s), toutes estimées.", detail: {}, source_release_ids: [] },
  { kind: "confidence", dimension_code: "component_coverage", available: true, risk_value: null, weight: 0.15, contribution: null, raw_value: 0.8, raw_unit: null, stage_code: null, rationale: "4 composante(s) de risque disponible(s) sur 5.", detail: {}, source_release_ids: [] },
  { kind: "confidence", dimension_code: "evidence_coverage", available: true, risk_value: null, weight: 0.15, contribution: null, raw_value: 1.0, raw_unit: null, stage_code: null, rationale: "6/6 observation(s) sourcée(s) (source_release_id).", detail: {}, source_release_ids: [RELEASE] },
  { kind: "confidence", dimension_code: "freshness", available: true, risk_value: null, weight: 0.1, contribution: null, raw_value: 0.6, raw_unit: null, stage_code: null, rationale: "Donnée la plus récente : 2024 (écart 2 an(s)).", detail: {}, source_release_ids: [] },
  { kind: "confidence", dimension_code: "license_access", available: true, risk_value: null, weight: 0.1, contribution: null, raw_value: 1.0, raw_unit: null, stage_code: null, rationale: "1 donnée(s) de marché, toutes exploitables.", detail: {}, source_release_ids: [] },
];

export const SILICON_ASSESSMENT: ResourceAssessmentDetail = {
  run_id: 9001,
  resource_slug: "silicon-metal",
  resource_id: 1,
  assessment_year: 2025,
  status: "computed",
  risk_score: 70.58,
  confidence: 79.4,
  coverage_pct: 88.0,
  observed_hhi: 6239.67,
  missing_share_pct: 12.0,
  methodology_code: "CC-RESOURCE-EXPOSURE",
  methodology_version: "0.1.0",
  input_hash: "demo-asterion-silicon-metal",
  drivers: [
    { dimension_code: "stage_concentration", contribution: 25.6963, stage_code: "smelting" },
    { dimension_code: "third_country_dependency", contribution: 23.53, stage_code: "mining" },
    { dimension_code: "supplier_dependency", contribution: 12.2356, stage_code: null },
    { dimension_code: "stock_coverage", contribution: 9.114, stage_code: null },
  ],
  warnings: [
    "Composantes exclues faute de données (poids renormalisés, jamais comptées risque nul) : substitutability.",
  ],
  sensitivity: { delta_pct: 0.2, band: { low: 66.9, high: 74.2 } },
  iro_signal_id: null,
  calculated_at: "2026-06-30T09:12:00Z",
  dimensions: [...RISK_DIMS, ...CONF_DIMS],
  disclaimer:
    "CarbonCo Resource Exposure Score — méthode CarbonCo versionnée (CC-RESOURCE-EXPOSURE 0.1.0). Ce score n'est PAS un score officiel de l'Union européenne ni une notation réglementaire. Le risque et la confiance sont deux grandeurs distinctes : une confiance faible signale des données lacunaires, pas un risque faible.",
};

/** Signal dérivé (beat « suggestion d'action ») — jamais une décision automatique. */
export const SILICON_ALERT: ResourceAlert = {
  kind: "high_dependency",
  severity: "high",
  resource_slug: "silicon-metal",
  message: "Dépendance élevée : score d'exposition 70.58 (≥ 66). Concentration smelting + dépendance hors UE.",
  as_of: "2026-06-30",
};

/** Suggestions d'action (proposées, pas appliquées) et décision HUMAINE. */
export const SUGGESTED_ACTIONS: { title: string; detail: string }[] = [
  { title: "Qualifier un second bassin d'approvisionnement hors CN", detail: "Réduire la concentration à l'étape smelting (HHI 6240) — piste à instruire, non chiffrée ici." },
  { title: "Porter la couverture de stock à 90 jours", detail: "Amortir une rupture courte ; arbitrage coût/risque à valider par les achats." },
];

export const HUMAN_DECISION = {
  question: "Retenir « Dépendance silicium métal » comme risque matériel à instruire ?",
  note: "La décision de matérialité reste HUMAINE, motivée et append-only. L'IA et le score proposent — ils ne décident jamais.",
  options: ["Retenir (à instruire)", "Écarter (motivé)", "Différer"],
};
