/**
 * lib/water-intelligence/map-state.ts — état de l'explorateur cartographique,
 * entièrement dérivable de l'URL (Wave C, blueprint §10.1 et §10.6).
 *
 * Fonctions PURES : aucune dépendance à React, aucune lecture de `window`.
 * C'est ce qui rend l'URL partageable vérifiable par un test unitaire plutôt
 * que par un parcours de bout en bout.
 *
 * Décisions du blueprint tenues ici :
 * - les noms de paramètres reprennent les noms de champ du contrat
 *   (`scope`, `code`, `dim`, `period_start`…) : aucune table de correspondance
 *   à maintenir entre l'URL et le contrat ;
 * - une valeur invalide est IGNORÉE, avec repli sur le défaut et un
 *   avertissement — un lien partagé après retrait d'une couche ne doit pas
 *   produire un écran vide inexpliqué ;
 * - aucune option n'est écrite en dur : le validateur reçoit les valeurs
 *   réellement publiées.
 */

import type { WaterGeographyScope } from "./contracts";

export const MAP_SCOPES: readonly WaterGeographyScope[] = ["world", "europe", "france"];
export const DEFAULT_SCOPE: WaterGeographyScope = "world";

export type WiMapView = "map" | "table";

export interface WiMapState {
  readonly scope: WaterGeographyScope;
  readonly code: string | null;
  readonly dim: string | null;
  readonly period_start: string | null;
  readonly period_end: string | null;
  readonly scenario: string | null;
  readonly view: WiMapView;
}

export interface WiMapStateResult {
  readonly state: WiMapState;
  /** Paramètres ignorés, à afficher — jamais un écran vide inexpliqué. */
  readonly ignored: readonly string[];
}

export interface WiMapVocabulary {
  readonly dimensions: readonly string[];
  readonly periods: readonly (readonly [string, string])[];
  readonly scenarios: readonly string[];
  readonly codes: readonly string[];
}

export const EMPTY_VOCABULARY: WiMapVocabulary = {
  dimensions: [],
  periods: [],
  scenarios: [],
  codes: [],
};

export const DEFAULT_MAP_STATE: WiMapState = {
  scope: DEFAULT_SCOPE,
  code: null,
  dim: null,
  period_start: null,
  period_end: null,
  scenario: null,
  view: "map",
};

/**
 * Reconstruit l'état depuis des paramètres d'URL, en ne conservant que les
 * valeurs réellement publiées. Toute valeur inconnue est ignorée et signalée.
 */
export function parseMapState(
  params: URLSearchParams | Record<string, string | undefined>,
  vocabulary: WiMapVocabulary = EMPTY_VOCABULARY,
): WiMapStateResult {
  const get = (key: string): string | null => {
    if (params instanceof URLSearchParams) return params.get(key);
    return params[key] ?? null;
  };
  const ignored: string[] = [];

  const rawScope = get("scope");
  let scope: WaterGeographyScope = DEFAULT_SCOPE;
  if (rawScope) {
    if ((MAP_SCOPES as readonly string[]).includes(rawScope)) {
      scope = rawScope as WaterGeographyScope;
    } else {
      ignored.push("scope");
    }
  }

  const dim = pick(get("dim"), vocabulary.dimensions, "dim", ignored);
  const scenario = pick(get("scenario"), vocabulary.scenarios, "scenario", ignored);
  const code = pick(get("code"), vocabulary.codes, "code", ignored);

  const rawStart = get("period_start");
  const rawEnd = get("period_end");
  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  if (rawStart || rawEnd) {
    const match = vocabulary.periods.find(
      ([start, end]) => start === rawStart && end === rawEnd,
    );
    if (match) {
      [periodStart, periodEnd] = match;
    } else {
      ignored.push("period");
    }
  }

  const rawView = get("view");
  const view: WiMapView = rawView === "table" || rawView === "map" ? rawView : "map";
  if (rawView && rawView !== view) ignored.push("view");

  return {
    state: { scope, code, dim, period_start: periodStart, period_end: periodEnd, scenario, view },
    ignored,
  };
}

function pick(
  raw: string | null,
  allowed: readonly string[],
  key: string,
  ignored: string[],
): string | null {
  if (!raw) return null;
  if (allowed.includes(raw)) return raw;
  ignored.push(key);
  return null;
}

/**
 * Sérialise l'état en query string. Les valeurs nulles sont OMISES plutôt
 * qu'écrites vides : une URL partagée ne doit pas transporter de bruit.
 */
export function serialiseMapState(state: WiMapState): string {
  const params = new URLSearchParams();
  if (state.scope !== DEFAULT_SCOPE) params.set("scope", state.scope);
  if (state.dim) params.set("dim", state.dim);
  if (state.code) params.set("code", state.code);
  if (state.period_start) params.set("period_start", state.period_start);
  if (state.period_end) params.set("period_end", state.period_end);
  if (state.scenario) params.set("scenario", state.scenario);
  if (state.view !== "map") params.set("view", state.view);
  return params.toString();
}

/**
 * Changer un filtre de niveau *n* réinitialise les niveaux > *n*.
 *
 * La hiérarchie n'est pas cosmétique : elle empêche des combinaisons qui
 * n'ont pas de sens, comme une période appartenant à une autre dimension.
 */
export function applyScopeChange(state: WiMapState, scope: WaterGeographyScope): WiMapState {
  return { ...state, scope, code: null, dim: null, period_start: null, period_end: null, scenario: null };
}

export function applyDimensionChange(state: WiMapState, dim: string | null): WiMapState {
  return { ...state, dim, period_start: null, period_end: null, scenario: null };
}

/** Une entité déjà sélectionnée est désélectionnée (pattern de `WorldMap`). */
export function applySelection(state: WiMapState, code: string): WiMapState {
  return { ...state, code: state.code === code ? null : code };
}

/**
 * Les échelles atteignables : `world` toujours, les autres seulement si des
 * couches y sont publiées. On ne propose jamais une échelle vide.
 */
export function reachableScopes(
  layerScopes: readonly WaterGeographyScope[],
): readonly WaterGeographyScope[] {
  const available = new Set<WaterGeographyScope>(layerScopes);
  return MAP_SCOPES.filter((scope) => scope === DEFAULT_SCOPE || available.has(scope));
}
