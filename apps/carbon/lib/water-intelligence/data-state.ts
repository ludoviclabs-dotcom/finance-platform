/**
 * lib/water-intelligence/data-state.ts — décideur PUR des huit états de
 * donnée de la surface publique (Wave C, blueprint §7).
 *
 * Pourquoi une fonction pure et non un composant : l'ordre de priorité des
 * états est la règle la plus facile à casser par inadvertance de toute la
 * surface. L'isoler la rend testable sans monter une page, et empêche qu'elle
 * soit réécrite différemment dans chaque composant. C'est le pattern déjà
 * retenu dans le dépôt pour `resourcesEmptyStateKind`.
 *
 * Ordre de priorité, du plus fort au plus faible (blueprint §7.9) :
 *
 *   1. fixture   — écrase tout : rien n'est rendu comme donnée
 *   2. error
 *   3. blocked   — licence : le motif juridique prime sur l'absence
 *   4. absent
 *   5. loading
 *   6. nominal
 *
 * `stale` et `partial-coverage` ne sont PAS des états exclusifs : ce sont des
 * modificateurs cumulables qui s'ajoutent à une valeur rendue.
 */

import type { WaterMetricObservation } from "./contracts";

export type WiDataStateKind =
  | "fixture"
  | "error"
  | "blocked"
  | "absent"
  | "loading"
  | "nominal";

export type WiDataModifier = "stale" | "partial-coverage";

export interface WiDataStateInput {
  /** `fixture_label` non nul ⇒ aucune valeur n'est rendue (décision P04B). */
  readonly fixtureLabel?: string | null;
  /** Message d'erreur ; sa seule présence déclenche l'état `error`. */
  readonly error?: string | null;
  readonly isLoading?: boolean;
  /** Licence : `allow_display === false` ⇒ valeur retenue. */
  readonly allowDisplay?: boolean;
  readonly valueWithheld?: boolean;
  /** `null` = absence de valeur. `0` est une valeur. */
  readonly value?: number | string | boolean | null;
  readonly coveragePct?: number | null;
  readonly isStale?: boolean;
  /** Raisons structurées de la décision de licence. */
  readonly licenseReasons?: readonly string[];
  readonly absenceReason?: string | null;
}

export interface WiDataState {
  readonly kind: WiDataStateKind;
  readonly modifiers: readonly WiDataModifier[];
  /** Libellé toujours présent : la couleur ne porte jamais seule le sens. */
  readonly label: string;
  readonly detail: string | null;
  /** `true` seulement si une valeur peut être affichée. */
  readonly rendersValue: boolean;
}

const LABELS: Record<WiDataStateKind, string> = {
  fixture: "Démonstration — aucune valeur publiée",
  error: "Erreur",
  blocked: "Valeur non publiable — licence",
  absent: "Donnée absente",
  loading: "Chargement",
  nominal: "Donnée publiée",
};

/**
 * Décide l'état d'un bloc de donnée. Aucune valeur n'est inventée : quand la
 * fonction renvoie `rendersValue: false`, l'appelant ne doit rendre aucune
 * mesure, aucune unité, aucune date.
 */
export function resolveWiDataState(input: WiDataStateInput): WiDataState {
  const modifiers: WiDataModifier[] = [];
  if (input.isStale) modifiers.push("stale");
  if (
    typeof input.coveragePct === "number" &&
    input.coveragePct >= 0 &&
    input.coveragePct < 100
  ) {
    modifiers.push("partial-coverage");
  }

  // 1. Fixture — écrase tout, y compris une erreur : rien ne doit sortir.
  if (input.fixtureLabel) {
    return state("fixture", modifiers, `Étiquette : ${input.fixtureLabel}`, false);
  }

  // 2. Erreur.
  if (input.error) {
    return state("error", modifiers, input.error, false);
  }

  // 3. Licence bloquée — AVANT l'absence : une valeur retenue est un fait
  //    juridique, pas une lacune de couverture.
  const displayBlocked = input.allowDisplay === false || input.valueWithheld === true;
  if (displayBlocked) {
    const reasons = input.licenseReasons?.length
      ? input.licenseReasons.join(" · ")
      : "La licence de la source interdit la publication de cette valeur.";
    return state("blocked", modifiers, reasons, false);
  }

  // 4. Absence — `null` seulement. `0` et `false` sont des valeurs.
  if (input.value === null || input.value === undefined) {
    return state(
      "absent",
      modifiers,
      input.absenceReason ?? "Aucune observation pour ce territoire et cette période.",
      false,
    );
  }

  // 5. Chargement — après l'absence : un bloc sans donnée connue n'est pas
  //    « en cours de chargement », il est vide.
  if (input.isLoading) {
    return state("loading", modifiers, null, false);
  }

  return state("nominal", modifiers, null, true);
}

function state(
  kind: WiDataStateKind,
  modifiers: readonly WiDataModifier[],
  detail: string | null,
  rendersValue: boolean,
): WiDataState {
  return { kind, modifiers, label: LABELS[kind], detail, rendersValue };
}

/** Dérive l'état d'une observation P02 complète. */
export function resolveObservationState(
  observation: WaterMetricObservation,
  extra: Pick<WiDataStateInput, "fixtureLabel" | "error" | "isLoading" | "isStale"> = {},
): WiDataState {
  return resolveWiDataState({
    ...extra,
    allowDisplay: observation.source.license.allow_display,
    valueWithheld: observation.value_withheld,
    value: observation.value,
    coveragePct: observation.quality.coverage_pct ?? null,
    licenseReasons: observation.source.license.reasons,
  });
}

/**
 * Libellé des modificateurs. Rendu en texte à côté de la valeur — jamais
 * seulement en couleur, jamais replié dans un tooltip.
 */
export const MODIFIER_LABELS: Record<WiDataModifier, string> = {
  stale: "Snapshot potentiellement périmé",
  "partial-coverage": "Couverture partielle",
};
