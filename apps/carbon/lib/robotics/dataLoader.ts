// Jeu de données « Robotique & IA physique » — chaîne de valeur mondiale des
// robots humanoïdes, en 12 couches. Même discipline que lib/crm/dataLoader.ts
// (snapshot local daté, lu au build), avec une exigence de plus : CHAQUE valeur
// porte sa provenance (qualité + identifiants de sources du registre `sources`).
//
// Vocabulaire de qualité — celui de DataStatusBadge, appliqué ainsi :
//   verified  : chiffre lu tel quel dans une source datée et consultée ;
//   estimated : fourchette ou synthèse de plusieurs sources, ou valeur que la
//               source présente elle-même comme une estimation ;
//   manual    : qualification éditoriale (rôle d'un acteur, lien vers une
//               matière, forces d'un bloc) — jamais un chiffre.
//
// Les sources éditoriales (kind "editorial", le dossier du portfolio) sont
// distinguées des sources externes : un chiffre ne peut pas être « vérifié »
// sur la seule foi d'une source éditoriale (voir validateRoboticsDataset).
//
// Hors périmètre, volontairement : cours, valorisations, tickers et thèses
// d'investissement du dossier d'origine. Ils restent sur le portfolio.
//
// Le JSON est généré par scripts/robotics/build_snapshot.py (source de vérité,
// contrôlée en CI par `--check`) : ne jamais le retoucher à la main.

import type { DataQuality, Material } from "@/lib/crm/dataLoader";
import { ISO3166_ALPHA2_TO_NUMERIC } from "@/lib/iso3166";

export type BlocId = "us" | "cn" | "eu" | "as" | "other";
export type SegmentId = "amont" | "milieu" | "mecatronique" | "aval";
export type SourceKind = "primary" | "secondary" | "editorial";

export interface RoboticsSource {
  id: string;
  publisher: string;
  title: string;
  url: string;
  // Date de publication de la source (AAAA-MM-JJ ou AAAA-MM), null si non datée.
  published: string | null;
  // Date à laquelle la valeur a été relue dans la source.
  accessed: string;
  kind: SourceKind;
  // Réserve de lecture (page lue par extrait de recherche, chiffre relayé…).
  note?: string;
}

export interface Provenance {
  data_quality: DataQuality;
  source_ids: string[];
  note?: string;
}

export interface KeyFigure {
  id: string;
  label: string;
  value_label: string;
  min: number;
  max: number;
  unit: string;
  // Année ou date de la mesure (pas de la publication).
  as_of: string;
  provenance: Provenance;
}

export interface Bloc {
  id: BlocId;
  name: string;
  strengths: string[];
  weaknesses: string[];
  provenance: Provenance;
}

export interface MaterialLink {
  material_id: string;
  rationale: string;
}

export interface Layer {
  id: string;
  // Numéro de couche du dossier d'origine (1-12), conservé pour les renvois.
  number: number;
  order: number;
  name: string;
  segment: SegmentId;
  dominant_blocs: BlocId[];
  challenger_blocs: BlocId[];
  dominance_note: string;
  key_figure_ids: string[];
  // Pont vers /materials : identifiants du snapshot CRM, liens éditoriaux.
  material_links: MaterialLink[];
  provenance: Provenance;
}

export interface Actor {
  id: string;
  name: string;
  // Codes ISO 3166-1 alpha-2 (jointure carte via lib/iso3166).
  countries: string[];
  bloc: BlocId;
  layer_ids: string[];
  role: string;
  provenance: Provenance;
}

export type VolumeKind = "produced" | "shipped" | "assembled" | "deployed" | "preorders";

export interface OemVolume {
  kind: VolumeKind;
  value: number | null;
  value_min: number | null;
  label: string;
  as_of: string;
  provenance: Provenance;
}

export interface OemCapacity {
  units_per_year: number;
  year: number | null;
  label: string;
  provenance: Provenance;
}

export interface Oem {
  actor_id: string;
  model: string;
  volume: OemVolume | null;
  capacity: OemCapacity | null;
  facts: string;
  provenance: Provenance;
}

export interface BomItem {
  id: string;
  label: string;
  detail: string;
  min_pct: number;
  max_pct: number;
  layer_ids: string[];
  provenance: Provenance;
}

export interface MarketProjection {
  id: string;
  institution: string;
  horizon: number;
  min_bn_usd: number;
  max_bn_usd: number;
  scope: string;
  detail: string;
  provenance: Provenance;
}

export interface Signal {
  date: string;
  text: string;
  // Échéance au-delà de laquelle le signal décrit peut-être un état révolu
  // (mesure suspendue jusqu'à une date, accord prolongé jusqu'à une date…).
  review_by?: string;
  provenance: Provenance;
}

export interface Chokepoint {
  id: string;
  title: string;
  layer_ids: string[];
  issue: string;
  signals: Signal[];
  actor_ids: string[];
  provenance: Provenance;
}

export interface Alliance {
  id: string;
  client: string;
  oem_actor_id: string;
  sector: string;
  relation: string;
  provenance: Provenance;
}

// Trace de la vérification : ce que la relecture des sources a changé par
// rapport au dossier d'origine. Affichable tel quel (transparence de méthode).
export interface Correction {
  id: string;
  claim: string;
  dossier_value: string;
  outcome: "corrected" | "removed";
  corrected_value: string | null;
  source_ids: string[];
}

export interface RoboticsDataset {
  schema_version: string;
  snapshot_date: string;
  scope_note: string;
  methodology_note: string;
  corrections: Correction[];
  blocs: Bloc[];
  layers: Layer[];
  actors: Actor[];
  oems: Oem[];
  bom: BomItem[];
  projections: MarketProjection[];
  key_figures: KeyFigure[];
  chokepoints: Chokepoint[];
  alliances: Alliance[];
  sources: RoboticsSource[];
}

export const ROBOTICS_SCHEMA_VERSION = "ROBOTICS-SNAPSHOT-1";

export async function getRoboticsDataset(): Promise<RoboticsDataset> {
  const { default: snapshot } = await import("@/data/robotics_humanoid_snapshot_2026-11-02.json");
  return snapshot as RoboticsDataset;
}

// Rattachement pays → bloc. « Europe » s'entend au sens géographique (Suisse,
// Royaume-Uni et Norvège compris), « as » regroupe Japon, Corée du Sud et
// Taïwan comme le dossier d'origine. Un acteur multi-pays (1X : Norvège et
// États-Unis) choisit son bloc parmi ceux de ses pays.
const EUROPE = new Set(["AT", "BE", "CH", "DE", "DK", "ES", "FI", "FR", "GB", "IE", "IT", "NL", "NO", "PL", "SE"]);
const EAST_ASIA = new Set(["JP", "KR", "TW"]);

export function blocForCountry(code: string): BlocId {
  if (code === "US") return "us";
  if (code === "CN") return "cn";
  if (EUROPE.has(code)) return "eu";
  if (EAST_ASIA.has(code)) return "as";
  return "other";
}

// Chiffre clé exigé par la page : un identifiant absent fait échouer le build
// plutôt que d'afficher une case vide.
export function getKeyFigure(ds: RoboticsDataset, id: string): KeyFigure {
  const figure = ds.key_figures.find(k => k.id === id);
  if (!figure) throw new Error(`Chiffre clé absent du snapshot robotique : ${id}`);
  return figure;
}

export function getLayerById(ds: RoboticsDataset, id: string): Layer | null {
  return ds.layers.find(l => l.id === id) ?? null;
}

export function getActorsForLayer(ds: RoboticsDataset, layerId: string): Actor[] {
  return ds.actors.filter(a => a.layer_ids.includes(layerId));
}

export function getChokepointsForLayer(ds: RoboticsDataset, layerId: string): Chokepoint[] {
  return ds.chokepoints.filter(c => c.layer_ids.includes(layerId));
}

export function getBomForLayer(ds: RoboticsDataset, layerId: string): BomItem[] {
  return ds.bom.filter(b => b.layer_ids.includes(layerId));
}

// Pont retour, de la fiche /materials vers les couches qui consomment la
// matière, dans l'ordre de lecture de la chaîne.
export function getLayersForMaterial(
  ds: RoboticsDataset,
  materialId: string,
): { layer: Layer; rationale: string }[] {
  return layersInReadingOrder(ds).flatMap(layer =>
    layer.material_links
      .filter(link => link.material_id === materialId)
      .map(link => ({ layer, rationale: link.rationale })),
  );
}

// Couches triées dans l'ordre de lecture (amont → aval), pas par numéro : le
// dossier numérote les couches par ancienneté, l'ordre d'affichage les regroupe
// par segment (les batteries, couche 7, se lisent en amont).
export function layersInReadingOrder(ds: RoboticsDataset): Layer[] {
  return [...ds.layers].sort((a, b) => a.order - b.order);
}

// Résout le pont couche → fiches /materials. Un identifiant absent du snapshot
// CRM est ignoré ici et signalé par validateRoboticsDataset (jamais une fiche
// inventée).
export function resolveLayerMaterials(layer: Layer, materials: Material[]): Material[] {
  return layer.material_links
    .map(link => materials.find(m => m.id === link.material_id))
    .filter((m): m is Material => m !== undefined);
}

export function resolveSources(ds: RoboticsDataset, provenance: Provenance): RoboticsSource[] {
  return provenance.source_ids
    .map(id => ds.sources.find(s => s.id === id))
    .filter((s): s is RoboticsSource => s !== undefined);
}

// Toutes les provenances du jeu, avec un chemin lisible — sert à la validation
// et aux décomptes de qualité (aucune valeur n'échappe au contrôle).
export function collectProvenances(ds: RoboticsDataset): { path: string; provenance: Provenance }[] {
  const out: { path: string; provenance: Provenance }[] = [];
  const add = (path: string, provenance: Provenance) => out.push({ path, provenance });
  ds.blocs.forEach(b => add(`blocs.${b.id}`, b.provenance));
  ds.layers.forEach(l => add(`layers.${l.id}`, l.provenance));
  ds.actors.forEach(a => add(`actors.${a.id}`, a.provenance));
  ds.oems.forEach(o => {
    add(`oems.${o.actor_id}`, o.provenance);
    if (o.volume) add(`oems.${o.actor_id}.volume`, o.volume.provenance);
    if (o.capacity) add(`oems.${o.actor_id}.capacity`, o.capacity.provenance);
  });
  ds.bom.forEach(b => add(`bom.${b.id}`, b.provenance));
  ds.projections.forEach(p => add(`projections.${p.id}`, p.provenance));
  ds.key_figures.forEach(k => add(`key_figures.${k.id}`, k.provenance));
  ds.chokepoints.forEach(c => {
    add(`chokepoints.${c.id}`, c.provenance);
    c.signals.forEach((s, i) => add(`chokepoints.${c.id}.signals.${i}`, s.provenance));
  });
  ds.alliances.forEach(a => add(`alliances.${a.id}`, a.provenance));
  return out;
}

const ISO_DATE = /^\d{4}-\d{2}(-\d{2})?$/;

// Contrôle d'intégrité du jeu : renvoie la liste des écarts (vide = jeu sain).
// Fonction pure, appelée par les tests ; les règles ci-dessous sont celles que
// la page affichera comme garanties.
export function validateRoboticsDataset(ds: RoboticsDataset, materials: Material[]): string[] {
  const issues: string[] = [];
  const sourceById = new Map(ds.sources.map(s => [s.id, s]));
  const layerIds = new Set(ds.layers.map(l => l.id));
  const actorIds = new Set(ds.actors.map(a => a.id));
  const blocIds = new Set(ds.blocs.map(b => b.id));
  const materialIds = new Set(materials.map(m => m.id));
  const keyFigureIds = new Set(ds.key_figures.map(k => k.id));

  if (ds.schema_version !== ROBOTICS_SCHEMA_VERSION) issues.push(`schema_version inattendue : ${ds.schema_version}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ds.snapshot_date)) issues.push(`snapshot_date invalide : ${ds.snapshot_date}`);

  const dupes = (label: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) issues.push(`${label} : identifiant en double ${id}`);
      seen.add(id);
    }
  };
  dupes("sources", ds.sources.map(s => s.id));
  dupes("layers", ds.layers.map(l => l.id));
  dupes("actors", ds.actors.map(a => a.id));
  dupes("key_figures", ds.key_figures.map(k => k.id));

  for (const s of ds.sources) {
    if (!s.url.startsWith("https://")) issues.push(`sources.${s.id} : URL non https`);
    if (!ISO_DATE.test(s.accessed)) issues.push(`sources.${s.id} : date de consultation invalide`);
    if (s.published !== null && !ISO_DATE.test(s.published)) issues.push(`sources.${s.id} : date de publication invalide`);
  }

  const referenced = new Set<string>();
  for (const { path, provenance } of collectProvenances(ds)) {
    provenance.source_ids.forEach(id => referenced.add(id));
    const sources = provenance.source_ids.map(id => sourceById.get(id));
    sources.forEach((s, i) => {
      if (!s) issues.push(`${path} : source inconnue ${provenance.source_ids[i]}`);
    });
    const external = sources.filter(s => s && s.kind !== "editorial");
    if (provenance.data_quality !== "manual" && external.length === 0) {
      issues.push(`${path} : valeur ${provenance.data_quality} sans source externe`);
    }
  }
  for (const c of ds.corrections) {
    c.source_ids.forEach(id => {
      referenced.add(id);
      if (!sourceById.has(id)) issues.push(`corrections.${c.id} : source inconnue ${id}`);
    });
    if (c.outcome === "corrected" && c.corrected_value === null) issues.push(`corrections.${c.id} : valeur corrigée manquante`);
    if (c.outcome === "removed" && c.corrected_value !== null) issues.push(`corrections.${c.id} : valeur retirée mais renseignée`);
  }
  for (const s of ds.sources) {
    if (!referenced.has(s.id)) issues.push(`sources.${s.id} : source jamais citée`);
  }

  const numbers = ds.layers.map(l => l.number).sort((a, b) => a - b);
  if (numbers.join(",") !== Array.from({ length: 12 }, (_, i) => i + 1).join(",")) {
    issues.push(`layers : numéros attendus 1 à 12, reçus ${numbers.join(",")}`);
  }
  for (const l of ds.layers) {
    [...l.dominant_blocs, ...l.challenger_blocs].forEach(b => {
      if (!blocIds.has(b) && b !== "other") issues.push(`layers.${l.id} : bloc inconnu ${b}`);
    });
    l.key_figure_ids.forEach(k => {
      if (!keyFigureIds.has(k)) issues.push(`layers.${l.id} : chiffre clé inconnu ${k}`);
    });
    l.material_links.forEach(link => {
      if (!materialIds.has(link.material_id)) issues.push(`layers.${l.id} : matière absente de /materials ${link.material_id}`);
      if (link.rationale.trim().length === 0) issues.push(`layers.${l.id} : lien ${link.material_id} sans justification`);
    });
    if (getActorsForLayer(ds, l.id).length === 0) issues.push(`layers.${l.id} : aucun acteur`);
  }

  for (const a of ds.actors) {
    if (a.countries.length === 0) issues.push(`actors.${a.id} : aucun pays`);
    a.countries.forEach(c => {
      if (!(c in ISO3166_ALPHA2_TO_NUMERIC)) issues.push(`actors.${a.id} : code pays inconnu ${c}`);
    });
    if (!a.countries.some(c => blocForCountry(c) === a.bloc)) {
      issues.push(`actors.${a.id} : bloc ${a.bloc} sans pays correspondant`);
    }
    a.layer_ids.forEach(id => {
      if (!layerIds.has(id)) issues.push(`actors.${a.id} : couche inconnue ${id}`);
    });
  }

  const refActor = (path: string, id: string) => {
    if (!actorIds.has(id)) issues.push(`${path} : acteur inconnu ${id}`);
  };
  ds.oems.forEach(o => refActor(`oems.${o.actor_id}`, o.actor_id));
  ds.alliances.forEach(a => refActor(`alliances.${a.id}`, a.oem_actor_id));
  ds.chokepoints.forEach(c => {
    c.signals.forEach((s, i) => {
      if (s.review_by === undefined) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s.review_by)) issues.push(`chokepoints.${c.id}.signals.${i} : échéance invalide`);
      else if (s.review_by < s.date) issues.push(`chokepoints.${c.id}.signals.${i} : échéance antérieure au signal`);
    });
    c.actor_ids.forEach(id => refActor(`chokepoints.${c.id}`, id));
    c.layer_ids.forEach(id => {
      if (!layerIds.has(id)) issues.push(`chokepoints.${c.id} : couche inconnue ${id}`);
    });
  });
  ds.bom.forEach(b => {
    if (b.min_pct > b.max_pct) issues.push(`bom.${b.id} : min_pct > max_pct`);
    b.layer_ids.forEach(id => {
      if (!layerIds.has(id)) issues.push(`bom.${b.id} : couche inconnue ${id}`);
    });
  });
  if (ds.bom.length > 0) {
    // Les fourchettes doivent pouvoir faire 100 % : la somme des bornes basses
    // ne dépasse pas 100 et celle des bornes hautes l'atteint.
    const minSum = ds.bom.reduce((acc, b) => acc + b.min_pct, 0);
    const maxSum = ds.bom.reduce((acc, b) => acc + b.max_pct, 0);
    if (minSum > 100 || maxSum < 100) issues.push(`bom : fourchettes incompatibles avec 100 % (${minSum}–${maxSum})`);
  }
  ds.key_figures.forEach(k => {
    if (k.min > k.max) issues.push(`key_figures.${k.id} : min > max`);
  });
  ds.projections.forEach(p => {
    if (p.min_bn_usd > p.max_bn_usd) issues.push(`projections.${p.id} : min > max`);
  });

  return issues;
}

// Signaux dont l'échéance est atteinte : la page les marque « à revérifier »
// plutôt que de présenter un état peut-être révolu comme actuel. `now` est
// injectable, et la page le fixe côté serveur (même discipline que
// isSnapshotStale : jamais recalculé à l'hydratation).
export function signalsDueForReview(
  ds: RoboticsDataset,
  now: number = Date.now(),
): { chokepoint_id: string; signal: Signal }[] {
  const today = new Date(now).toISOString().slice(0, 10);
  return ds.chokepoints.flatMap(c =>
    c.signals
      .filter(s => s.review_by !== undefined && s.review_by <= today)
      .map(signal => ({ chokepoint_id: c.id, signal })),
  );
}

// Clés « idGoulot:indexSignal » des signaux à revérifier, pour la page :
// Date.now() reste encapsulé ici, hors du rendu d'un composant.
export function dueSignalKeys(ds: RoboticsDataset, now: number = Date.now()): Set<string> {
  const keys = new Set<string>();
  for (const { chokepoint_id, signal } of signalsDueForReview(ds, now)) {
    const chokepoint = ds.chokepoints.find(c => c.id === chokepoint_id);
    if (chokepoint) keys.add(`${chokepoint_id}:${chokepoint.signals.indexOf(signal)}`);
  }
  return keys;
}

export interface RoboticsSummary {
  layers: number;
  actors: number;
  countries: number;
  oems: number;
  linkedMaterials: number;
  sources: number;
  externalSources: number;
  values: number;
  verifiedPct: number;
}

// Provenances des seules valeurs CHIFFRÉES : chiffres clés, projections,
// postes de coût, volumes et capacités des constructeurs. Les acteurs, couches,
// goulots et alliances portent des faits sourcés, pas des chiffres : les compter
// gonflerait le taux de « valeurs chiffrées vérifiées » affiché par la page.
export function collectNumericProvenances(ds: RoboticsDataset): { path: string; provenance: Provenance }[] {
  return [
    ...ds.key_figures.map(k => ({ path: `key_figures.${k.id}`, provenance: k.provenance })),
    ...ds.projections.map(p => ({ path: `projections.${p.id}`, provenance: p.provenance })),
    ...ds.bom.map(b => ({ path: `bom.${b.id}`, provenance: b.provenance })),
    ...ds.oems.flatMap(o => [
      ...(o.volume ? [{ path: `oems.${o.actor_id}.volume`, provenance: o.volume.provenance }] : []),
      ...(o.capacity ? [{ path: `oems.${o.actor_id}.capacity`, provenance: o.capacity.provenance }] : []),
    ]),
  ];
}

// Indicateurs de tête — TOUS calculés depuis le jeu, aucun chiffre en dur.
export function summarizeRobotics(ds: RoboticsDataset): RoboticsSummary {
  const provenances = collectNumericProvenances(ds);
  const verified = provenances.filter(p => p.provenance.data_quality === "verified").length;
  return {
    layers: ds.layers.length,
    actors: ds.actors.length,
    countries: new Set(ds.actors.flatMap(a => a.countries)).size,
    oems: ds.oems.length,
    linkedMaterials: new Set(ds.layers.flatMap(l => l.material_links.map(m => m.material_id))).size,
    sources: ds.sources.length,
    externalSources: ds.sources.filter(s => s.kind !== "editorial").length,
    values: provenances.length,
    verifiedPct: provenances.length === 0 ? 0 : Math.round((verified / provenances.length) * 100),
  };
}
