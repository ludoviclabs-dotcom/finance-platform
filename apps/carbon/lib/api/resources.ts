/**
 * lib/api/resources.ts — client des endpoints `/resources/*` (Module 2 :
 * Ressources stratégiques & dépendances industrielles étendues, PR-M2A/M2B).
 *
 * Réutilise `API_BASE_URL` + le porteur de token en mémoire de `lib/api.ts`,
 * et les paliers de lecture risque/confiance de `lib/api/crma.ts` (même
 * vocabulaire, aucune divergence entre modules). Types snake_case, miroir 1:1
 * de `apps/api/models/resources.py`.
 *
 * Quatre invariants du domaine se lisent DIRECTEMENT dans ces types — l'UI ne
 * peut pas les enfreindre par accident :
 *
 * 1. **Risque ≠ confiance.** `ResourceAssessmentDetail` porte `risk_score` ET
 *    `confidence` dans deux champs distincts ; il n'existe aucun champ combiné.
 *    `risk_score` peut être `null` (données obligatoires manquantes) — jamais un
 *    indice inventé — tandis que `confidence` reste calculée.
 * 2. **Concentration PAR ÉTAPE.** `ResourceStageConcentration` porte toujours un
 *    `stage_code` ; `buildStageConcentration()` agrège les observations pays SANS
 *    jamais moyenner deux étapes — impossible de rendre un HHI « toutes étapes ».
 * 3. **Manquant ≠ zéro.** `ResourceDimension.available=false` marque une
 *    composante sans donnée ; elle n'a ni `risk_value` ni `contribution`, donc
 *    l'UI ne peut pas l'afficher comme un risque nul.
 * 4. **Sourcé-ou-avoué.** Chaque `ResourceDimension` porte `source_release_ids`
 *    (provenance par composante) et chaque donnée un `data_status` + éventuel
 *    `source_release_id`. La licence bloquée dégrade la CONFIANCE, pas le risque.
 *
 * Le schéma arrive avec les migrations 042/043 : tant qu'elles ne sont pas
 * appliquées en production, le backend répond `503 schema_not_ready`, traduit
 * ici en `SchemaNotReadyError` que chaque page BETA rend comme « initialisation
 * du schéma en cours » — jamais une erreur brute.
 */

import { API_BASE_URL, getAuthToken } from "@/lib/api";
import {
  type BackendDataStatus,
  confidenceBand,
  formatPct,
  riskBand,
} from "@/lib/api/crma";

// On ré-exporte les paliers CRMA pour que les pages Resources n'aient qu'un seul
// point d'import — la présentation risque/confiance reste STRICTEMENT identique
// entre les deux modules (aucun « score net » ne peut apparaître d'un côté).
export { type BackendDataStatus, confidenceBand, formatPct, riskBand };

// ---------------------------------------------------------------------------
// Vocabulaires (miroir des CHECK de la migration 042/043 & models/resources.py)
// ---------------------------------------------------------------------------

export type ResourceFamily =
  | "industrial_gas"
  | "biomass_fibre"
  | "energy_fuel"
  | "critical_raw_material"
  | "other";

export type AliasKind =
  | "legacy_material_id"
  | "cas"
  | "ec"
  | "hs_cn"
  | "reach"
  | "internal"
  | "other";

export type RegulatoryRegime =
  | "crma"
  | "eudr"
  | "reach"
  | "clp"
  | "red_iii"
  | "cbam"
  | "euratom"
  | "dual_use"
  | "gas_sos"
  | "esrs"
  | "other";

export type ListingStatus =
  | "listed"
  | "not_listed"
  | "in_scope"
  | "out_of_scope"
  | "in_force"
  | "adopted_not_applicable"
  | "proposed"
  | "delayed";

export type Certainty = "confirmed" | "probable" | "unresolved";

export type ResourceRole =
  | "material"
  | "feedstock"
  | "energy_carrier"
  | "process_input"
  | "industrial_gas"
  | "nuclear_fuel"
  | "biomass"
  | "water";

export type LinkKind =
  | "bom_item"
  | "purchase_line"
  | "energy_activity"
  | "water_activity"
  | "supplier_declaration"
  | "manual";

export type SupplyMetric =
  | "production"
  | "reserves"
  | "refining_capacity"
  | "trade_export"
  | "trade_import";

export type DimensionKind = "risk" | "confidence";
export type RunStatus = "computed" | "approved" | "superseded";
export type AlertKind =
  | "high_dependency"
  | "stale_supply_data"
  | "license_blocked"
  | "regulatory_flag";
export type AlertSeverity = "low" | "medium" | "high" | "critical";

// ---------------------------------------------------------------------------
// Types — catalogue (042)
// ---------------------------------------------------------------------------

export interface ResourceCatalogItem {
  id: number;
  company_id: number | null;
  slug: string;
  name: string;
  name_fr: string | null;
  primary_family: ResourceFamily;
  data_status: BackendDataStatus;
  has_source: boolean;
}

export interface ResourceCatalogListResponse {
  items: ResourceCatalogItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface ResourceCatalogDetail {
  id: number;
  company_id: number | null;
  slug: string;
  name: string;
  name_fr: string | null;
  primary_family: ResourceFamily;
  description: string | null;
  data_status: BackendDataStatus;
  source_release_id: number | null;
  aliases_count: number;
  regulations_count: number;
  uses_count: number;
  created_at: string;
}

export interface ResourceAlias {
  id: number;
  company_id: number | null;
  resource_id: number;
  alias_kind: AliasKind;
  alias_value: string;
  created_at: string;
}

export interface ResourceRegulatoryStatus {
  id: number;
  company_id: number | null;
  resource_id: number;
  regime: RegulatoryRegime;
  regulation_ref: string | null;
  list_or_annex: string | null;
  listing_status: ListingStatus;
  validity_note: string | null;
  certainty: Certainty;
  /** Provenance : `null` = statut avoué non sourcé ; jamais `confirmed` sans release. */
  source_release_id: number | null;
  /** « Année » de vérification du statut réglementaire. */
  verified_on: string | null;
  created_at: string;
}

export interface ResourceSectorUse {
  id: number;
  company_id: number | null;
  resource_id: number;
  sector_code: string | null;
  /** Classification supply-chain SEULEMENT — aucun contenu technique. */
  use_label: string;
  criticality_note: string | null;
  data_status: BackendDataStatus;
  source_release_id: number | null;
  created_at: string;
}

export interface ResourceSupplyObservation {
  id: number;
  company_id: number | null;
  resource_id: number;
  stage_code: string;
  country_code: string;
  metric_code: SupplyMetric;
  share_pct: number | null;
  volume_value: number | null;
  volume_unit: string | null;
  reference_year: number;
  data_status: BackendDataStatus;
  confidence: number | null;
  source_release_id: number | null;
  evidence_artifact_id: number | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Types — expositions (043, tenant)
// ---------------------------------------------------------------------------

export interface ResourceExposureLink {
  id: number;
  company_id: number;
  resource_id: number;
  resource_slug: string | null;
  role: ResourceRole;
  link_kind: LinkKind;
  /** Pointeur lisible vers un autre module, ex. "purchase_line:842". */
  linked_ref: string | null;
  annual_mass_kg: number | null;
  annual_spend_eur: number | null;
  share_of_supply_pct: number | null;
  stock_coverage_days: number | null;
  data_status: BackendDataStatus;
  created_at: string;
}

export interface ResourceExposureLinkCreate {
  resource_slug: string;
  role: ResourceRole;
  link_kind: LinkKind;
  bom_item_id?: number | null;
  purchase_line_id?: number | null;
  energy_activity_id?: number | null;
  water_activity_id?: number | null;
  supplier_declaration_id?: number | null;
  manual_note?: string | null;
  annual_mass_kg?: number | null;
  annual_spend_eur?: number | null;
  share_of_supply_pct?: number | null;
  stock_coverage_days?: number | null;
  data_status?: BackendDataStatus;
  confidence?: number | null;
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// Types — assessments (043, runs immuables)
// ---------------------------------------------------------------------------

/**
 * Composante inspectable — risque OU confiance, jamais additionnées. `detail`
 * porte des sous-valeurs SÉPARÉES (ex. substituabilité `{maturity, penalty_pct}`).
 * `available=false` ⇒ donnée manquante, exclue et renormalisée (jamais risque nul).
 */
export interface ResourceDimension {
  kind: DimensionKind;
  dimension_code: string;
  available: boolean;
  risk_value: number | null;
  weight: number | null;
  contribution: number | null;
  raw_value: number | null;
  raw_unit: string | null;
  stage_code: string | null;
  rationale: string | null;
  detail: Record<string, unknown>;
  source_release_ids: number[];
}

export interface ResourceAssessmentSummary {
  run_id: number;
  resource_slug: string;
  resource_id: number;
  assessment_year: number;
  status: RunStatus;
  /** Intensité du risque (0-100). `null` si concentration obligatoire absente. */
  risk_score: number | null;
  /** Qualité du socle documentaire (0-100). Ne dit RIEN du niveau de risque. */
  confidence: number | null;
  coverage_pct: number | null;
  observed_hhi: number | null;
  missing_share_pct: number | null;
  methodology_code: string;
  methodology_version: string;
  calculated_at: string;
}

export interface ResourceAssessmentDetail {
  run_id: number;
  resource_slug: string;
  resource_id: number;
  assessment_year: number;
  status: RunStatus;
  risk_score: number | null;
  confidence: number | null;
  coverage_pct: number | null;
  observed_hhi: number | null;
  missing_share_pct: number | null;
  methodology_code: string;
  methodology_version: string;
  input_hash: string;
  drivers: Array<Record<string, unknown>>;
  warnings: string[];
  sensitivity: Record<string, unknown> | null;
  iro_signal_id: number | null;
  calculated_at: string;
  dimensions: ResourceDimension[];
  /** Méthode CarbonCo versionnée — JAMAIS une note officielle UE/CRMA. */
  disclaimer: string;
}

export interface ResourceAlert {
  kind: AlertKind;
  severity: AlertSeverity;
  resource_slug: string;
  message: string;
  as_of: string | null;
}

export interface ResourceAssessmentRunCreate {
  resource_slug: string;
  assessment_year: number;
  as_of?: string | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// ---------------------------------------------------------------------------
// Client — avec détection contractuelle de `schema_not_ready` (motif water.ts)
// ---------------------------------------------------------------------------

/** 503 `schema_not_ready` : migrations 042/043 pas encore appliquées. Les pages
 * BETA rendent « initialisation du schéma en cours », jamais une erreur brute. */
export class SchemaNotReadyError extends Error {
  constructor() {
    super("schema_not_ready");
    this.name = "SchemaNotReadyError";
  }
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle<T>(res: Response, path: string): Promise<T> {
  if (res.status === 503) {
    let detail: unknown = null;
    try {
      detail = ((await res.json()) as { detail?: unknown }).detail;
    } catch {
      /* corps non-JSON : erreur générique ci-dessous */
    }
    if (detail === "schema_not_ready") throw new SchemaNotReadyError();
  }
  if (!res.ok) {
    let detail = "";
    try {
      detail = String(((await res.json()) as { detail?: unknown }).detail ?? "");
    } catch {
      /* garder le message générique */
    }
    throw new Error(detail || `API ${res.status} on ${path}`);
  }
  return (await res.json()) as T;
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: { Accept: "application/json", ...authHeaders() },
    credentials: "include",
    signal,
  });
  return handle<T>(res, path);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    credentials: "include",
    body: JSON.stringify(body),
  });
  return handle<T>(res, path);
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

// ── Catalogue (lecture) ──────────────────────────────────────────────────────

export function fetchResourceCatalog(
  params: { family?: string; q?: string; limit?: number; offset?: number } = {},
  signal?: AbortSignal,
): Promise<ResourceCatalogListResponse> {
  return get<ResourceCatalogListResponse>(
    `/resources/catalog${qs({ limit: 200, ...params })}`,
    signal,
  );
}

export function fetchResourceDetail(
  slug: string,
  signal?: AbortSignal,
): Promise<ResourceCatalogDetail> {
  return get<ResourceCatalogDetail>(
    `/resources/catalog/${encodeURIComponent(slug)}`,
    signal,
  );
}

export function fetchResourceAliases(
  slug: string,
  signal?: AbortSignal,
): Promise<Paginated<ResourceAlias>> {
  return get<Paginated<ResourceAlias>>(
    `/resources/catalog/${encodeURIComponent(slug)}/aliases?limit=200`,
    signal,
  );
}

export function fetchResourceRegulations(
  slug: string,
  params: { regime?: string } = {},
  signal?: AbortSignal,
): Promise<Paginated<ResourceRegulatoryStatus>> {
  return get<Paginated<ResourceRegulatoryStatus>>(
    `/resources/catalog/${encodeURIComponent(slug)}/regulations${qs({ limit: 200, ...params })}`,
    signal,
  );
}

export function fetchResourceUses(
  slug: string,
  signal?: AbortSignal,
): Promise<Paginated<ResourceSectorUse>> {
  return get<Paginated<ResourceSectorUse>>(
    `/resources/catalog/${encodeURIComponent(slug)}/uses?limit=200`,
    signal,
  );
}

export function fetchResourceSupply(
  slug: string,
  params: { stage_code?: string; reference_year?: number } = {},
  signal?: AbortSignal,
): Promise<Paginated<ResourceSupplyObservation>> {
  return get<Paginated<ResourceSupplyObservation>>(
    `/resources/catalog/${encodeURIComponent(slug)}/supply${qs({ limit: 200, ...params })}`,
    signal,
  );
}

// ── Expositions (tenant) ─────────────────────────────────────────────────────

export function fetchResourceExposures(
  params: { resource_slug?: string; link_kind?: string; role?: string } = {},
  signal?: AbortSignal,
): Promise<Paginated<ResourceExposureLink>> {
  return get<Paginated<ResourceExposureLink>>(
    `/resources/exposures${qs({ limit: 200, ...params })}`,
    signal,
  );
}

export function createResourceExposureLink(
  body: ResourceExposureLinkCreate,
): Promise<ResourceExposureLink> {
  return post<ResourceExposureLink>("/resources/exposures/link", body);
}

// ── Assessments (tenant, runs immuables) ─────────────────────────────────────

export function fetchResourceAssessments(
  params: {
    resource_slug?: string;
    assessment_year?: number;
    status?: string;
    current_only?: boolean;
  } = {},
  signal?: AbortSignal,
): Promise<Paginated<ResourceAssessmentSummary>> {
  return get<Paginated<ResourceAssessmentSummary>>(
    `/resources/assessments${qs({ limit: 200, ...params })}`,
    signal,
  );
}

export function createResourceAssessment(
  body: ResourceAssessmentRunCreate,
): Promise<ResourceAssessmentDetail> {
  return post<ResourceAssessmentDetail>("/resources/assessments", body);
}

export function fetchResourceAssessment(
  runId: number,
  signal?: AbortSignal,
): Promise<ResourceAssessmentDetail> {
  return get<ResourceAssessmentDetail>(`/resources/assessments/${runId}`, signal);
}

export function fetchResourceAssessmentDimensions(
  runId: number,
  signal?: AbortSignal,
): Promise<Paginated<ResourceDimension>> {
  return get<Paginated<ResourceDimension>>(
    `/resources/assessments/${runId}/dimensions?limit=200`,
    signal,
  );
}

export function fetchResourceAlerts(
  signal?: AbortSignal,
): Promise<Paginated<ResourceAlert>> {
  return get<Paginated<ResourceAlert>>("/resources/alerts?limit=200", signal);
}

// ---------------------------------------------------------------------------
// Sélection du run courant — PUR
// ---------------------------------------------------------------------------

/**
 * `current_only=true` n'exclut que les runs *superseded* pour un couple
 * (ressource, année) : une ressource évaluée sur PLUSIEURS années renvoie donc
 * plusieurs runs non-superseded. Cette fonction tranche explicitement, sans
 * jamais dépendre de l'ordre de l'API.
 *
 * Le run « le plus récent » est défini ainsi, dans cet ordre :
 *   1. `assessment_year` décroissant ;
 *   2. puis `calculated_at` décroissant (horodatage absent/illisible = le plus
 *      ancien — jamais gagnant par défaut) ;
 *   3. puis `run_id` décroissant, départage stable et déterministe.
 */
function isMoreRecentRun(
  candidate: ResourceAssessmentSummary,
  incumbent: ResourceAssessmentSummary,
): boolean {
  if (candidate.assessment_year !== incumbent.assessment_year) {
    return candidate.assessment_year > incumbent.assessment_year;
  }
  const tsCandidate = Date.parse(candidate.calculated_at ?? "");
  const tsIncumbent = Date.parse(incumbent.calculated_at ?? "");
  const a = Number.isFinite(tsCandidate) ? tsCandidate : Number.NEGATIVE_INFINITY;
  const b = Number.isFinite(tsIncumbent) ? tsIncumbent : Number.NEGATIVE_INFINITY;
  if (a !== b) return a > b;
  return candidate.run_id > incumbent.run_id;
}

/**
 * Réduit une liste de runs à AU PLUS UN run par `resource_slug` : le plus récent
 * au sens de `isMoreRecentRun`. Source unique pour le bandeau de KPI, les cartes
 * du catalogue, les barres de signaux et la comparaison des expositions — aucun
 * ancien run ne peut donc écraser le plus récent.
 */
export function selectLatestAssessmentPerResource(
  runs: ResourceAssessmentSummary[],
): Map<string, ResourceAssessmentSummary> {
  const latest = new Map<string, ResourceAssessmentSummary>();
  for (const run of runs) {
    const incumbent = latest.get(run.resource_slug);
    if (!incumbent || isMoreRecentRun(run, incumbent)) latest.set(run.resource_slug, run);
  }
  return latest;
}

// ---------------------------------------------------------------------------
// Présentation — libellés FR (jamais codés en dur dans les composants)
// ---------------------------------------------------------------------------

export const FAMILY_LABEL: Record<ResourceFamily, string> = {
  industrial_gas: "Gaz industriel",
  biomass_fibre: "Biomasse & fibre",
  energy_fuel: "Combustible énergétique",
  critical_raw_material: "Matière première critique",
  other: "Autre",
};

export const ROLE_LABEL: Record<ResourceRole, string> = {
  material: "Matière",
  feedstock: "Charge/feedstock",
  energy_carrier: "Vecteur énergétique",
  process_input: "Intrant de procédé",
  industrial_gas: "Gaz industriel",
  nuclear_fuel: "Combustible nucléaire",
  biomass: "Biomasse",
  water: "Eau",
};

export const LINK_KIND_LABEL: Record<LinkKind, string> = {
  bom_item: "Nomenclature (BOM)",
  purchase_line: "Ligne d'achat",
  energy_activity: "Activité énergie",
  water_activity: "Activité eau",
  supplier_declaration: "Déclaration fournisseur",
  manual: "Saisie manuelle",
};

export const REGIME_LABEL: Record<RegulatoryRegime, string> = {
  crma: "CRMA — matières critiques/stratégiques",
  eudr: "EUDR — déforestation",
  reach: "REACH",
  clp: "CLP",
  red_iii: "RED III — RFNBO",
  cbam: "CBAM",
  euratom: "Euratom / ESA",
  dual_use: "Double usage",
  gas_sos: "Sécurité d'approvisionnement gaz",
  esrs: "ESRS / CSRD",
  other: "Autre",
};

export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = {
  listed: "Listée",
  not_listed: "Non listée",
  in_scope: "Dans le périmètre",
  out_of_scope: "Hors périmètre",
  in_force: "En vigueur",
  adopted_not_applicable: "Adopté — non applicable",
  proposed: "Proposé",
  delayed: "Reporté",
};

export const CERTAINTY_LABEL: Record<Certainty, string> = {
  confirmed: "Confirmé",
  probable: "Probable",
  unresolved: "Non résolu",
};

export const ALIAS_KIND_LABEL: Record<AliasKind, string> = {
  legacy_material_id: "Identifiant matière historique",
  cas: "CAS",
  ec: "EC",
  hs_cn: "HS / CN",
  reach: "REACH",
  internal: "Interne",
  other: "Autre",
};

/** Libellés des composantes du moteur (`services/resources/scoring.py`). */
export const DIMENSION_LABEL: Record<string, string> = {
  // risque
  stage_concentration: "Concentration par étape",
  third_country_dependency: "Dépendance hors UE",
  supplier_dependency: "Concentration fournisseur",
  substitutability: "Substituabilité",
  stock_coverage: "Couverture de stock",
  // confiance
  market_coverage: "Couverture de marché",
  data_quality: "Qualité des données",
  component_coverage: "Couverture des composantes",
  evidence_coverage: "Couverture des preuves",
  freshness: "Fraîcheur",
  license_access: "Accès licence",
};

export const ALERT_KIND_LABEL: Record<AlertKind, string> = {
  high_dependency: "Dépendance élevée",
  stale_supply_data: "Données d'offre périmées",
  license_blocked: "Donnée bloquée par licence",
  regulatory_flag: "Signal réglementaire",
};

export const SEVERITY_TONE: Record<AlertSeverity, string> = {
  low: "text-emerald-600 dark:text-emerald-400",
  medium: "text-amber-600 dark:text-amber-400",
  high: "text-orange-600 dark:text-orange-400",
  critical: "text-red-600 dark:text-red-400",
};

/**
 * Disclaimer canonique du module — miroir EXACT de `scoring.py::DISCLAIMER`
 * (backend). Affiché partout où l'indice global apparaît, pour qu'aucun écran
 * ne présente le score comme une notation officielle de l'Union européenne.
 */
export const RESOURCE_METHODOLOGY_CODE = "CC-RESOURCE-EXPOSURE";
export const RESOURCE_METHODOLOGY_VERSION = "0.1.0";
export const RESOURCE_DISCLAIMER =
  "CarbonCo Resource Exposure Score — méthode CarbonCo versionnée " +
  `(${RESOURCE_METHODOLOGY_CODE} ${RESOURCE_METHODOLOGY_VERSION}). Ce score n'est PAS un score ` +
  "officiel de l'Union européenne ni une notation réglementaire. Le risque et " +
  "la confiance sont deux grandeurs distinctes : une confiance faible signale " +
  "des données lacunaires, pas un risque faible.";

// ---------------------------------------------------------------------------
// Agrégation PURE — concentration PAR ÉTAPE (miroir de scoring.py::compute_stage)
// ---------------------------------------------------------------------------

/** Codes ISO des 27 États membres de l'UE (+ EL alias GR), pour la part hors UE. */
export const EU_COUNTRY_CODES: ReadonlySet<string> = new Set([
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "EL",
  "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO",
  "SE", "SI", "SK",
]);

export interface CountryShare {
  country_code: string;
  share_pct: number;
  data_status: BackendDataStatus;
}

/** Concentration d'UNE étape — jamais « toutes étapes confondues ». */
export interface ResourceStageConcentration {
  stage_code: string;
  reference_year: number | null;
  metric_code: SupplyMetric;
  country_shares: CountryShare[];
  /** HHI au barème DOJ 0-10000 (monopole=10000, 4 parts égales=2500). `null` si aucune part. */
  hhi: number | null;
  observed_total_pct: number;
  coverage_pct: number | null;
  missing_share_pct: number | null;
  top_country_code: string | null;
  top_country_share_pct: number | null;
  non_eu_pct: number | null;
  country_count: number;
  is_share_based: boolean;
  source_release_ids: number[];
}

/**
 * HHI au barème `scale` (0-10000 par défaut) sur des parts renormalisées à leur
 * somme. Standard (somme des carrés des parts). `null` si aucune part positive.
 * Identique à `scoring.py::herfindahl` — pour que la fiche affiche exactement ce
 * que le moteur calculerait.
 */
export function herfindahl(shares: number[], scale = 10000): number | null {
  const positive = shares.filter((s) => typeof s === "number" && s > 0);
  const total = positive.reduce((a, b) => a + b, 0);
  if (positive.length === 0 || total <= 0) return null;
  const raw = positive.reduce((acc, s) => acc + (s / total) ** 2, 0) * scale;
  return Math.round(raw * 100) / 100;
}

/**
 * Agrège des observations pays (`GET /resources/catalog/{slug}/supply`) en
 * concentration PAR ÉTAPE — sans jamais moyenner deux étapes. Une observation
 * en volume (sans `share_pct`) est ignorée pour la couverture (part du monde
 * inconnue), mais compte pour le HHI si elle porte une valeur positive.
 *
 * Miroir fidèle de `services/resources/scoring.py::compute_stage`, mais côté
 * client : la fiche montre le détail décomposé, jamais une jauge opaque.
 */
export function buildStageConcentration(
  observations: ResourceSupplyObservation[],
): ResourceStageConcentration[] {
  const byStage = new Map<string, ResourceSupplyObservation[]>();
  for (const o of observations) {
    const list = byStage.get(o.stage_code) ?? [];
    list.push(o);
    byStage.set(o.stage_code, list);
  }

  const stages: ResourceStageConcentration[] = [];
  for (const [stage_code, rows] of [...byStage.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const shareRows = rows.filter((r) => r.share_pct != null);
    const usesShare = shareRows.length > 0;
    const valued = usesShare
      ? shareRows
      : rows.filter((r) => r.volume_value != null);

    const country_shares: CountryShare[] = valued.map((r) => ({
      country_code: r.country_code,
      share_pct: usesShare ? (r.share_pct as number) : (r.volume_value as number),
      data_status: r.data_status,
    }));
    const values = country_shares.map((c) => c.share_pct);
    const hhi = herfindahl(values);
    const observed_total = Math.round(values.reduce((a, b) => a + b, 0) * 10000) / 10000;

    let top_country_code: string | null = null;
    let top_country_share_pct: number | null = null;
    for (const c of country_shares) {
      if (top_country_share_pct == null || c.share_pct > top_country_share_pct) {
        top_country_share_pct = c.share_pct;
        top_country_code = c.country_code;
      }
    }

    let non_eu_pct: number | null = null;
    if (country_shares.length > 0 && observed_total > 0) {
      const nonEu = country_shares
        .filter((c) => !EU_COUNTRY_CODES.has(c.country_code.toUpperCase()))
        .reduce((a, c) => a + c.share_pct, 0);
      non_eu_pct = Math.round((nonEu / observed_total) * 100 * 100) / 100;
    }

    const years = [...new Set(rows.map((r) => r.reference_year))];
    const source_release_ids = [
      ...new Set(
        rows
          .map((r) => r.source_release_id)
          .filter((id): id is number => id != null),
      ),
    ].sort((a, b) => a - b);

    stages.push({
      stage_code,
      reference_year: years.length === 1 ? years[0] : years.length ? Math.max(...years) : null,
      metric_code: rows[0]?.metric_code ?? "production",
      country_shares,
      hhi,
      observed_total_pct: observed_total,
      coverage_pct: usesShare ? Math.round(Math.min(observed_total, 100) * 100) / 100 : null,
      missing_share_pct: usesShare
        ? Math.round(Math.max(0, 100 - observed_total) * 100) / 100
        : null,
      top_country_code,
      top_country_share_pct,
      non_eu_pct,
      country_count: country_shares.length,
      is_share_based: usesShare,
      source_release_ids,
    });
  }
  return stages;
}

// ---------------------------------------------------------------------------
// Fraîcheur dérivée — pour StalenessWarning (jamais un statut backend)
// ---------------------------------------------------------------------------

/** Seuil de péremption des observations d'offre (années). Au-delà → STALE. */
export const SUPPLY_STALE_AFTER_YEARS = 3;

/**
 * Dérive la fraîcheur des observations d'offre à partir de leur année de
 * référence la plus récente (comparée à `asOfYear`). `isStale` alimente
 * `StalenessWarning` — c'est un état DÉRIVÉ, jamais renvoyé par le backend.
 */
export function deriveSupplyStaleness(
  observations: ResourceSupplyObservation[],
  asOfYear: number,
): { isStale: boolean; ageDays: number | null; lastReferenceYear: number | null; lastReleaseAt: string | null } {
  const years = observations.map((o) => o.reference_year).filter((y) => Number.isFinite(y));
  if (years.length === 0) {
    return { isStale: false, ageDays: null, lastReferenceYear: null, lastReleaseAt: null };
  }
  const lastReferenceYear = Math.max(...years);
  const ageYears = Math.max(0, asOfYear - lastReferenceYear);
  return {
    isStale: ageYears > SUPPLY_STALE_AFTER_YEARS,
    ageDays: ageYears * 365,
    lastReferenceYear,
    // Représentation ISO conventionnelle : 31 décembre de l'année de référence.
    lastReleaseAt: `${lastReferenceYear}-12-31T00:00:00Z`,
  };
}

/** Palier de lecture d'un HHI 0-10000 (DOJ). `null` → non calculé. */
export function hhiBand(
  hhi: number | null,
): { label: string; tone: "unknown" | "low" | "moderate" | "high" | "severe" } {
  if (hhi == null || Number.isNaN(hhi)) return { label: "Non calculé", tone: "unknown" };
  if (hhi >= 5000) return { label: "Très concentré", tone: "severe" };
  if (hhi >= 2500) return { label: "Concentré", tone: "high" };
  if (hhi >= 1500) return { label: "Modérément concentré", tone: "moderate" };
  return { label: "Peu concentré", tone: "low" };
}
