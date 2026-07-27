/**
 * lib/water-intelligence/pilot-snapshot.ts — lecture du document public
 * `bnpe_minimal_pilot_v1`.
 *
 * ## Deux états, et un seul document
 *
 * Le fichier `public-snapshot-bnpe-v1.json` existe **toujours**. Il porte soit
 * un snapshot réel, soit un **marqueur** qui dit qu'il n'a pas encore été
 * généré. Ce n'est pas un détail d'implémentation, c'est la seule façon
 * honnête de tenir les trois contraintes à la fois :
 *
 * 1. le document ne peut pas être écrit à la main — il est produit par le
 *    workflow, depuis une acquisition réelle, sous une signature humaine ;
 * 2. la page doit se construire avant que ce workflow n'ait tourné ;
 * 3. rien de fabriqué ne doit jamais être rendu comme une donnée.
 *
 * Un `import` d'un fichier absent casse le build (1 et 2 s'excluent). Un
 * snapshot d'attente fabriqué se lirait comme une donnée (3 tombe). Le
 * marqueur est le seul objet qui satisfait les trois : il existe, il ne
 * contient aucune observation, et il dit ce qu'il est.
 *
 * `pilotIsPublished()` distingue donc « le pilote n'est pas encore généré »
 * de « le pilote est généré et contient trois observations ». La surface rend
 * deux états différents, jamais un seul état dégradé.
 */

import { z } from "zod";

import rawPilot from "./public-snapshot-bnpe-v1.json";
import {
  WaterPublicSnapshotSchema,
  WiAuthorizedScopeSchema,
} from "./public-snapshot";

/* ------------------------------------------------------- Le marqueur */

export const PilotMarkerSchema = z.object({
  pilot_document_status: z.literal("not_generated"),
  option_key: z.string().min(1),
  explanation: z.string().min(1),
  how_it_becomes_real: z.string().min(1),
  approved_scope: z.object({
    source_code: z.string().min(1),
    geography_type: z.string().min(1),
    geography_code: z.string().min(1),
    period_start: z.string().min(1),
    period_end: z.string().min(1),
    expected_observation_count: z.number().int().positive(),
    reviewed_by: z.string().min(1),
    reviewed_on: z.string().min(1),
  }),
  contains_no_observation: z.literal(true),
});
export type PilotMarker = z.infer<typeof PilotMarkerSchema>;

/* --------------------------------------------------- Le document réel */

/**
 * Métadonnées propres au pilote, ajoutées à l'enveloppe par le publieur.
 *
 * Elles vivent dans le DOCUMENT et non dans le front, délibérément : les
 * inventer côté surface les rendrait modifiables sans repasser par une
 * décision. `publication_mode`, `geo_layers` et `pilot_status` disent ce que
 * ce document est — une table, sans carte, sur un périmètre limité.
 */
export const PilotBlockSchema = z.object({
  option_key: z.literal("bnpe_minimal_pilot_v1"),
  publication_mode: z.literal("table_first"),
  geo_layers: z.literal("deferred"),
  pilot_status: z.literal("limited_scope"),
  observation_count: z.number().int().min(0),
  retrieved_at: z.string().min(1),
  /** `null` assumé : aucune cadence n'a été relevée, aucune n'est inventée. */
  source_refresh_cadence: z.string().min(1).nullable(),
  observed_period_start: z.string().min(1),
  observed_period_end: z.string().min(1),
  source_code: z.string().min(1),
  release_key: z.string().min(1),
  payload_sha256: z.string().length(64),
  artifact_checksum: z.string().nullable(),
  geography_type: z.string().min(1),
  geography_code: z.string().min(1),
  attribution: z.string().min(1),
  source_information_url: z.string().url(),
  license_code: z.string().min(1),
  license_scope: z.string().min(1),
  /**
   * `null` assumé. La voie de conformité retenue par la signature du
   * 2026-07-28 est celle de l'URL officielle ; y écrire une date de
   * consultation la ferait lire comme une date de mise à jour de la source,
   * qui sont deux faits différents.
   */
  source_last_updated_on: z.string().nullable(),
  reviewed_by: z.string().min(1),
  reviewed_on: z.string().min(1),
  permissions: z.object({
    display_allowed: z.boolean(),
    derived_use_allowed: z.boolean(),
    automated_access_allowed: z.boolean(),
    storage_allowed: z.boolean(),
  }),
  coverage_warnings: z.array(z.string().min(1)).min(1),
  excluded_sources: z.array(
    z.object({
      source_code: z.string().min(1),
      reason: z.string().min(1),
      detail: z.string().min(1),
    }),
  ),
});
export type PilotBlock = z.infer<typeof PilotBlockSchema>;

export const PilotDocumentSchema = WaterPublicSnapshotSchema.extend({
  pilot_document_status: z.literal("generated"),
  pilot: PilotBlockSchema,
});
export type PilotDocument = z.infer<typeof PilotDocumentSchema>;

export const PilotFileSchema = z.union([PilotMarkerSchema, PilotDocumentSchema]);
export type PilotFile = z.infer<typeof PilotFileSchema>;

/**
 * Le document, validé au build.
 *
 * `.parse()` et non `.safeParse()` : un document hors contrat doit casser le
 * build plutôt que dégrader silencieusement l'affichage. Un snapshot publié
 * dont la forme a dérivé est un snapshot dont on ne sait plus ce qu'il dit.
 */
export const PILOT_FILE: PilotFile = PilotFileSchema.parse(rawPilot);

export function pilotIsPublished(file: PilotFile = PILOT_FILE): file is PilotDocument {
  return file.pilot_document_status === "generated";
}

/* ----------------------------------------------------------- Lectures */

export interface PilotObservationRow {
  /** Identifiant d'ouvrage, tel que porté par la source. */
  ouvrageCode: string;
  label: string;
  value: number | string | boolean | null;
  unit: string | null;
  periodStart: string;
  periodEnd: string;
  dataStatus: string;
  methodCode: string;
  methodVersion: string;
  checksum: string;
  releaseKey: string;
  retrievedAt: string;
}

/**
 * Les observations, aplaties pour l'affichage.
 *
 * Aucun tri par valeur : classer trois volumes produirait un CLASSEMENT, que
 * `derived_use_allowed = false` interdit. L'ordre est celui du document, qui
 * est déterministe et ne signifie rien d'autre.
 */
export function pilotObservations(
  file: PilotFile = PILOT_FILE,
): readonly PilotObservationRow[] {
  if (!pilotIsPublished(file) || !file.manifest) return [];
  return file.manifest.observations.map((observation) => ({
    ouvrageCode: observation.geography.code ?? "—",
    label: observation.geography.label,
    value: observation.value,
    /* `null` plutôt qu'`undefined` : une unité absente est une absence, et
       elle se rend « n.c. ». Les deux formes se confondraient à l'affichage
       mais pas au typage — autant n'en garder qu'une. */
    unit: observation.unit ?? null,
    periodStart: observation.period_start,
    periodEnd: observation.period_end,
    dataStatus: observation.quality.data_status,
    methodCode: observation.method.code,
    methodVersion: observation.method.version,
    checksum: observation.source.checksum_sha256,
    releaseKey: observation.source.release_key,
    retrievedAt: observation.source.retrieved_at,
  }));
}

/**
 * Périmètre signé, lisible quel que soit l'état du document.
 *
 * Il vient du marqueur avant génération et du bloc `pilot` après : dans les
 * deux cas d'une source unique, jamais d'une constante recopiée dans le front.
 */
export function pilotScope(file: PilotFile = PILOT_FILE): {
  sourceCode: string;
  geographyType: string;
  geographyCode: string;
  periodStart: string;
  periodEnd: string;
  expectedObservationCount: number;
  reviewedBy: string;
  reviewedOn: string;
} {
  if (pilotIsPublished(file)) {
    return {
      sourceCode: file.pilot.source_code,
      geographyType: file.pilot.geography_type,
      geographyCode: file.pilot.geography_code,
      periodStart: file.pilot.observed_period_start,
      periodEnd: file.pilot.observed_period_end,
      expectedObservationCount: file.pilot.observation_count,
      reviewedBy: file.pilot.reviewed_by,
      reviewedOn: file.pilot.reviewed_on,
    };
  }
  const scope = file.approved_scope;
  return {
    sourceCode: scope.source_code,
    geographyType: scope.geography_type,
    geographyCode: scope.geography_code,
    periodStart: scope.period_start,
    periodEnd: scope.period_end,
    expectedObservationCount: scope.expected_observation_count,
    reviewedBy: scope.reviewed_by,
    reviewedOn: scope.reviewed_on,
  };
}

/**
 * Les avertissements de couverture, à afficher À CÔTÉ des valeurs.
 *
 * Avant génération ils sont connus quand même — ce sont des faits sur la
 * source BNPE, pas des propriétés du document. Les taire tant que rien n'est
 * publié reviendrait à ne les afficher qu'une fois qu'il est trop tard pour
 * qu'ils changent la lecture.
 */
export const BNPE_COVERAGE_WARNINGS: readonly string[] = [
  "Les volumes exonérés de redevance peuvent être absents de cette source.",
  "Certains petits volumes peuvent ne pas être déclarés.",
  "Une absence de déclaration n'est JAMAIS un prélèvement nul.",
] as const;

export function pilotCoverageWarnings(
  file: PilotFile = PILOT_FILE,
): readonly string[] {
  return pilotIsPublished(file)
    ? file.pilot.coverage_warnings
    : BNPE_COVERAGE_WARNINGS;
}

/** Périmètre autorisé tel que porté par la décision, si le document l'expose. */
export function pilotAuthorizedScope(file: PilotFile = PILOT_FILE) {
  if (!pilotIsPublished(file)) return null;
  const decision = file.decisions.find(
    (entry) => entry.source_code === file.pilot.source_code,
  );
  if (!decision?.authorized_scope) return null;
  return WiAuthorizedScopeSchema.parse(decision.authorized_scope);
}

/** Formatage FR d'un volume, sans jamais arrondir vers un ordre de grandeur. */
export function formatVolume(value: number | string | boolean | null): string {
  if (typeof value !== "number") return "n.c.";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
}
