/**
 * lib/water-intelligence/canonical-snapshot.ts — snapshot public canonique et
 * état des sources (P16, Wave E).
 *
 * ## Ce que ce module remplace
 *
 * Jusqu'à la Wave D, la page publique affichait le **manifest de fixture**
 * (`FIXTURE_MANIFEST`) et un `EMPTY_SNAPSHOT` écrit à la main. Les deux étaient
 * des artefacts de développement rendus à des lecteurs réels : identifiants
 * `FIXTURE_SOURCE`, `fixture-release-v1`, `fixture.stress_index`. Même
 * étiquetés « démonstration », ils se lisaient comme du contenu.
 *
 * Ces deux documents-ci sont **produits par le backend** :
 *
 * - `public-snapshot-empty.json` est assemblé par le MÊME assembleur que la
 *   production (`assemble_public_snapshot`), avec zéro observation. Il porte
 *   donc les vraies exclusions, les vraies décisions et une couverture à zéro ;
 * - `source-status.json` compose les faits établis par les Waves A à C : ce qui
 *   a été vérifié pour chaque source, à quelle granularité, et ce qui bloque
 *   encore sa publication.
 *
 * Aucun des deux ne contient d'observation, de chiffre hydrique ni de date
 * d'assemblage : `generated_at` est volontairement vide, parce qu'un document
 * versionné dans le dépôt ne peut pas porter une date d'assemblage réelle.
 *
 * Les fixtures restent dans les contrats et les tests, où elles ont leur place.
 * Elles ne reviennent jamais dans le rendu public.
 */

import { z } from "zod";

import rawEmptySnapshot from "./public-snapshot-empty.json";
import rawSourceStatus from "./source-status.json";
import {
  WaterPublicSnapshotSchema,
  type WaterPublicSnapshot,
} from "./public-snapshot";

/**
 * Snapshot public canonique — vide, valide, et **réel**.
 *
 * `.parse()` et non `.safeParse()` : un snapshat hors contrat doit casser le
 * build plutôt que dégrader silencieusement l'affichage.
 */
export const CANONICAL_EMPTY_SNAPSHOT: WaterPublicSnapshot =
  WaterPublicSnapshotSchema.parse(rawEmptySnapshot);

/* ------------------------------------------------------- État des sources */

/** Granularité de la vérification de licence — `platform` n'est pas `dataset`. */
export const WiLicenseScopeEnum = z.enum(["dataset", "platform", "unknown"]);
export type WiLicenseScope = z.infer<typeof WiLicenseScopeEnum>;

/** Les cinq états qu'une source peut prendre sur la surface publique. */
export const WiSourceStateEnum = z.enum([
  "publishable",
  "decision_pending",
  "publication_blocked",
  "decoder_deferred",
  "no_decision",
]);
export type WiSourceState = z.infer<typeof WiSourceStateEnum>;

export const WiSourceStatusSchema = z.object({
  source_code: z.string().min(1),
  label: z.string().min(1),
  license_code: z.string().min(1).nullable(),
  license_scope: WiLicenseScopeEnum,
  license_verified: z.boolean(),
  license_verified_in: z.string().min(1).nullable(),
  connector_status: z.string().min(1),
  state: WiSourceStateEnum,
  state_label: z.string().min(1),
  blocking_reason: z.string().min(1),
});
export type WiSourceStatus = z.infer<typeof WiSourceStatusSchema>;

export const WiSourceStatusDocumentSchema = z.object({
  source_count: z.number().int().min(0),
  publishable_count: z.number().int().min(0),
  license_verified_count: z.number().int().min(0),
  sources: z.array(WiSourceStatusSchema),
});
export type WiSourceStatusDocument = z.infer<typeof WiSourceStatusDocumentSchema>;

export const SOURCE_STATUS: WiSourceStatusDocument =
  WiSourceStatusDocumentSchema.parse(rawSourceStatus);

/** Libellés de granularité — la nuance plateforme/jeu est portée en texte. */
export const LICENSE_SCOPE_LABELS: Record<WiLicenseScope, string> = {
  dataset: "vérifiée pour ce jeu de données",
  platform: "vérifiée au niveau de la plateforme",
  unknown: "non vérifiée",
};

/**
 * Ordre d'affichage : ce qui est bloqué par une démarche humaine d'abord, ce
 * qui attend une décision ensuite. Un ordre alphabétique ferait passer une
 * source refusée pour équivalente à une source en attente.
 */
const STATE_ORDER: Record<WiSourceState, number> = {
  publishable: 0,
  publication_blocked: 1,
  decoder_deferred: 2,
  decision_pending: 3,
  no_decision: 4,
};

export function orderedSources(
  document: WiSourceStatusDocument = SOURCE_STATUS,
): readonly WiSourceStatus[] {
  return [...document.sources].sort(
    (a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.source_code.localeCompare(b.source_code),
  );
}

/** Vrai tant qu'aucune source n'a de décision de publication signée. */
export function nothingIsPublishable(
  document: WiSourceStatusDocument = SOURCE_STATUS,
): boolean {
  return document.publishable_count === 0;
}
