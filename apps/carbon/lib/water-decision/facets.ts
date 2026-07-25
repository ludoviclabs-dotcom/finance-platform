/**
 * lib/water-decision/facets.ts — état d'affichage des six facettes du cockpit
 * décisionnel hydrique (Wave E-Interface, commit F2).
 *
 * Module PUR : aucune dépendance React, aucun accès réseau. Tout ce que la page
 * décide d'afficher pour une facette se décide ici, donc se teste ici.
 *
 * ## Pourquoi une facette porte son propre état
 *
 * `GET /water/decision-synthesis` répond d'un bloc : une seule requête pour les
 * six facettes. La tentation est d'en tirer un état global — « chargé »,
 * « erreur » — et de peindre les six facettes avec. C'est exactement ce que le
 * cahier des charges interdit : une facette indisponible ne doit jamais être
 * masquée derrière un état global favorable.
 *
 * `deriveFacetStates` rend donc TOUJOURS les six clés, quelle que soit la
 * réponse. Une facette que le backend n'a pas renvoyée reste visible, avec la
 * mention qu'elle n'a pas été renvoyée — elle ne disparaît pas de la page.
 *
 * ## Les quatre confusions refusées
 *
 * 1. **Absence ≠ zéro.** `empty` est un état à part entière ; aucune facette
 *    vide ne produit `0`.
 * 2. **Erreur ≠ absence.** `unexpected_error`, `access_denied` et
 *    `schema_unavailable` sont trois états distincts de `empty`. Une erreur
 *    dégradée en « aucune donnée » ferait croire à un périmètre vide alors que
 *    la question n'a pas pu être posée.
 * 3. **Vocabulaires non comparables.** Deux moteurs peuvent tous deux dire
 *    « high » sans parler de la même échelle. `has_mixed_vocabularies` est
 *    remonté tel quel : la page affiche l'avertissement, elle ne rapproche
 *    jamais deux valeurs de vocabulaires différents.
 * 4. **Aucun score global.** `summariseAvailability` compte des facettes
 *    disponibles — c'est un état de DISPONIBILITÉ, pas un niveau de risque, et
 *    il n'agrège aucune valeur métier.
 */

import type {
  WiDecisionSynthesis,
  WiFacetKind,
  WiFacetSummary,
} from "@/lib/api/water-decision";

/** Ordre d'affichage, figé : les six facettes sont toujours rendues, dans cet ordre. */
export const FACET_ORDER: readonly WiFacetKind[] = [
  "risk",
  "confidence",
  "dependency",
  "resource_material",
  "iro",
  "action",
] as const;

export const FACET_LABELS: Record<WiFacetKind, string> = {
  risk: "Risque",
  confidence: "Confiance",
  dependency: "Dépendance",
  resource_material: "Ressources et matières",
  iro: "IRO",
  action: "Actions",
};

/**
 * Ce que chaque facette est — et surtout ce qu'elle n'est pas. Le risque et la
 * confiance sont deux axes distincts ; le rappeler dans l'interface évite qu'un
 * lecteur les additionne mentalement.
 */
export const FACET_HINTS: Record<WiFacetKind, string> = {
  risk: "Exposition constatée sur le périmètre. Ne dit rien de la solidité de la preuve qui la documente.",
  confidence:
    "Solidité du socle documentaire. Un risque élevé mal documenté et un risque élevé bien documenté ne sont pas la même situation.",
  dependency:
    "Intensité du besoin en eau de l’activité, indépendamment de l’état de la ressource.",
  resource_material:
    "Ponts vers les ressources et matières dépendantes de l’eau, tels que déclarés par leurs modules d’origine.",
  iro: "Signaux transmis au registre IRO. Un signal n’est pas une décision de matérialité.",
  action:
    "Actions déclarées. Un effet attendu reste une intention, jamais un résultat soustrait d’une mesure.",
};

/* ------------------------------------------------------------- Transport */

/** État de l'unique requête de synthèse. */
export type WdTransport =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly synthesis: WiDecisionSynthesis }
  | { readonly kind: "schema_unavailable" }
  | { readonly kind: "access_denied"; readonly status: number }
  | { readonly kind: "unexpected_error"; readonly message: string };

/**
 * État d'affichage d'UNE facette.
 *
 * `empty` porte la raison de son vide : le backend a renvoyé la facette sans
 * entrée (`declared`), ou ne l'a pas renvoyée du tout (`not_returned`). Les
 * deux s'affichent comme « aucune donnée », mais pas avec la même explication —
 * le second cas est un écart de contrat, pas un périmètre vide.
 */
export type WdFacetState =
  | { readonly kind: "loading" }
  | { readonly kind: "schema_unavailable" }
  | { readonly kind: "access_denied"; readonly status: number }
  | { readonly kind: "unexpected_error"; readonly message: string }
  | { readonly kind: "empty"; readonly reason: "declared" | "not_returned" }
  | { readonly kind: "available"; readonly summary: WiFacetSummary };

/**
 * Projette l'état de la requête sur les six facettes.
 *
 * Invariant : le résultat contient TOUJOURS les six clés de `FACET_ORDER`.
 * Aucune branche ne peut en omettre une, y compris en erreur.
 */
export function deriveFacetStates(
  transport: WdTransport,
): Record<WiFacetKind, WdFacetState> {
  const fill = (state: WdFacetState): Record<WiFacetKind, WdFacetState> =>
    Object.fromEntries(FACET_ORDER.map((facet) => [facet, state])) as Record<
      WiFacetKind,
      WdFacetState
    >;

  switch (transport.kind) {
    case "loading":
      return fill({ kind: "loading" });
    case "schema_unavailable":
      return fill({ kind: "schema_unavailable" });
    case "access_denied":
      return fill({ kind: "access_denied", status: transport.status });
    case "unexpected_error":
      return fill({ kind: "unexpected_error", message: transport.message });
    case "ready": {
      const byFacet = new Map(
        transport.synthesis.facets.map((summary) => [summary.facet, summary]),
      );
      const entries = FACET_ORDER.map((facet): [WiFacetKind, WdFacetState] => {
        const summary = byFacet.get(facet);
        if (!summary) return [facet, { kind: "empty", reason: "not_returned" }];
        /*
          La disponibilité se lit sur les ENTRÉES réellement présentes, pas sur
          le drapeau `is_empty` : si les deux se contredisent, ce qui est là
          fait foi, et une facette annoncée non vide mais sans entrée reste
          affichée comme sans donnée plutôt que comme un bloc vide silencieux.
        */
        if (summary.entries.length === 0) return [facet, { kind: "empty", reason: "declared" }];
        return [facet, { kind: "available", summary }];
      });
      return Object.fromEntries(entries) as Record<WiFacetKind, WdFacetState>;
    }
  }
}

/* ------------------------------------------------------- État global lisible */

/**
 * Décompte de DISPONIBILITÉ.
 *
 * Ce n'est pas un score : rien n'est pondéré, rien n'est agrégé, aucune valeur
 * métier n'entre dans le calcul. On compte des facettes exploitables, des
 * facettes sans donnée et des facettes qu'on n'a pas pu interroger.
 */
export interface WdAvailability {
  readonly available: number;
  readonly empty: number;
  readonly unavailable: number;
  readonly total: number;
}

export function summariseAvailability(
  states: Record<WiFacetKind, WdFacetState>,
): WdAvailability {
  let available = 0;
  let empty = 0;
  let unavailable = 0;
  for (const facet of FACET_ORDER) {
    const state = states[facet];
    if (state.kind === "available") available += 1;
    else if (state.kind === "empty") empty += 1;
    else unavailable += 1;
  }
  return { available, empty, unavailable, total: FACET_ORDER.length };
}

/** Phrase d'état global — disponibilité uniquement, jamais un niveau de risque. */
export function availabilitySentence(availability: WdAvailability): string {
  const { available, empty, unavailable, total } = availability;
  return (
    `${available} facette(s) exploitable(s) sur ${total} · ` +
    `${empty} sans donnée · ${unavailable} non interrogeable(s). ` +
    `Ce décompte mesure la disponibilité de l’information, pas un niveau de risque.`
  );
}

/* ------------------------------------------------------------ Entrées */

/**
 * Ce qu'affiche une entrée dont la valeur est nulle.
 *
 * Jamais `0`, jamais un tiret muet : la raison d'absence fournie par le moteur,
 * ou à défaut le constat que le moteur n'en a pas donné.
 */
export function absenceText(absenceReason: string | null): string {
  return absenceReason ?? "Absence non motivée par le moteur d’origine.";
}

/**
 * Avertissement de vocabulaires hétérogènes.
 *
 * Rendu dès que le backend signale le mélange : la page n'essaie jamais de
 * réconcilier deux échelles, elle prévient qu'elles ne sont pas comparables.
 */
export function mixedVocabularyWarning(summary: WiFacetSummary): string | null {
  if (!summary.has_mixed_vocabularies) return null;
  return (
    `Vocabulaires hétérogènes (${summary.vocabularies.join(", ")}) : ` +
    `ces valeurs proviennent de moteurs différents et ne sont pas comparables entre elles.`
  );
}
