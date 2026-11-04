/**
 * lib/water-intelligence/context-candidates.ts — repères de contexte EN ATTENTE
 * de revue humaine.
 *
 * ## Ce que ce module livre
 *
 * Un document versionné, `context-candidates.json`, qui rassemble les repères
 * collectés pour la refonte du module Eau :
 *
 * - des chiffres nationaux relayés par Datagora, avec leur source primaire
 *   NOMMÉE (verification `relayed_primary_named`) ;
 * - des chiffres lus directement dans la source primaire (rapport SISPEA de
 *   l'OFB, synthèse Explore2, rapport n° 928 de l'Assemblée nationale),
 *   marqués `primary_verified` ;
 * - deux cas locaux sur la commune 34172, extraits de sources ouvertes :
 *   l'historique journalier des restrictions VigiEau, et le contrôle sanitaire
 *   PFAS publié par Hub'Eau.
 *
 * ## Ce que ce module ne fait PAS
 *
 * Il ne publie que ce qui a passé la revue. Un document sans réviseur nommé,
 * sans date ou sans méthode de revue ne publie RIEN ; un document revu ne
 * publie que les valeurs `primary_verified`. C'est la règle d'`editorial.ts` —
 * rien n'atteint la surface publique sans revue identifiée — appliquée à des
 * chiffres de contexte, avec une exigence de plus : la source primaire.
 *
 * Ces repères ne sont pas des données du pilote BNPE (commune 34172, 2020) : ils
 * n'entrent ni dans le snapshot public ni dans les observations, et un test
 * vérifie qu'aucun n'emprunte le code de source du pilote.
 */

import { z } from "zod";

import rawCandidates from "./context-candidates.json";

export const WiContextVerificationEnum = z.enum([
  /** Valeur lue dans la source primaire elle-même. */
  "primary_verified",
  /** Valeur relayée ; la source primaire est nommée mais n'a pas été ouverte. */
  "relayed_primary_named",
  /** Valeur relayée et introuvable dans les sources primaires consultées. */
  "relayed_unverified",
]);
export type WiContextVerification = z.infer<typeof WiContextVerificationEnum>;

const GeographySchema = z.object({
  scope: z.enum(["france", "bassin", "commune"]),
  code: z.string().min(1),
  label: z.string().min(1),
});

const NamedSourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().url().nullable(),
});

export const WiContextFactSchema = z
  .object({
    id: z.string().min(1),
    theme: z.enum(["quantite", "usages", "qualite", "risques", "couts"]),
    label: z.string().min(1),
    value: z.union([z.number(), z.string().min(1)]),
    unit: z.string().min(1),
    period: z.string().min(1).nullable(),
    geography: GeographySchema,
    primary_source: NamedSourceSchema,
    relay: z.object({ name: z.string().min(1), url: z.string().url() }).nullable(),
    verification: WiContextVerificationEnum,
    caveat: z.string().min(1).nullable(),
    breakdown: z.record(z.string(), z.number()).optional(),
  })
  .superRefine((fact, ctx) => {
    if (fact.verification === "primary_verified" && !fact.primary_source.url) {
      ctx.addIssue({
        code: "custom",
        path: ["primary_source", "url"],
        message: "Une valeur dite vérifiée à la source doit pointer vers cette source.",
      });
    }
    if (fact.verification !== "primary_verified" && !fact.relay) {
      ctx.addIssue({
        code: "custom",
        path: ["relay"],
        message: "Une valeur relayée doit nommer son relais.",
      });
    }
    if (fact.verification === "relayed_unverified" && !fact.caveat) {
      ctx.addIssue({
        code: "custom",
        path: ["caveat"],
        message: "Une valeur non vérifiée doit dire pourquoi.",
      });
    }
  });
export type WiContextFact = z.infer<typeof WiContextFactSchema>;

const RetrievedSourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  resource_url: z.string().url().optional(),
  retrieved_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const WiRestrictionYearSchema = z
  .object({
    year: z.number().int().min(2000),
    observed_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    observed_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    days_observed: z.number().int().min(1).max(366),
    days_vigilance_or_higher: z.number().int().min(0),
    days_alerte_or_higher: z.number().int().min(0),
    days_alerte_renforcee_or_higher: z.number().int().min(0),
    days_crise: z.number().int().min(0),
  })
  .superRefine((y, ctx) => {
    // Les seuils sont emboîtés : un jour de crise est aussi un jour d'alerte.
    const ordered = [
      y.days_observed,
      y.days_vigilance_or_higher,
      y.days_alerte_or_higher,
      y.days_alerte_renforcee_or_higher,
      y.days_crise,
    ];
    for (let i = 1; i < ordered.length; i += 1) {
      if (ordered[i] > ordered[i - 1]) {
        ctx.addIssue({
          code: "custom",
          message: `Année ${y.year} : les compteurs de jours doivent décroître avec la sévérité.`,
        });
        return;
      }
    }
  });
export type WiRestrictionYear = z.infer<typeof WiRestrictionYearSchema>;

export const WiContextCandidatesSchema = z.object({
  schema_version: z.literal("1.0.0"),
  document: z.literal("water-context-candidates"),
  collected_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  review: z.object({
    status: z.enum(["pending_human_review", "reviewed"]),
    reviewed_by: z.string().min(1).nullable(),
    reviewed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    /** Comment la revue a été conduite — obligatoire pour qu'elle compte. */
    method: z.string().min(1).optional(),
  }),
  scope_notice: z.string().min(1),
  facts: z.array(WiContextFactSchema).min(1),
  local_cases: z.object({
    restrictions_34172: z.object({
      geography: GeographySchema,
      source: RetrievedSourceSchema,
      method: z.string().min(1),
      caveat: z.string().min(1),
      years: z.array(WiRestrictionYearSchema).min(1),
    }),
    pfas_34172: z.object({
      geography: GeographySchema,
      source: RetrievedSourceSchema,
      parameter: z.object({ code: z.string().min(1), label: z.string().min(1) }),
      unit: z.string().min(1),
      quality_limit: z.number().positive(),
      analyses: z
        .array(
          z.object({
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            value_ug_l: z.number().min(0),
          }),
        )
        .min(1),
      caveat: z.string().min(1),
    }),
    restriction_level_departement_34: z.object({
      source: RetrievedSourceSchema,
      max_level: z.enum(["vigilance", "alerte", "alerte_renforcee", "crise"]),
      note: z.string().min(1),
    }),
  }),
  restriction_scale: z
    .array(z.object({ niveau: z.string().min(1), effet: z.string().min(1) }))
    .length(4),
  remaining_gaps: z.array(
    z.object({
      need: z.string().min(1),
      why_not_collected: z.string().min(1),
      lead: z.string().min(1),
    }),
  ),
});
export type WiContextCandidates = z.infer<typeof WiContextCandidatesSchema>;

/**
 * Document chargé au build. `.parse()` et non `.safeParse()` : un document hors
 * contrat casse le build plutôt que d'être affiché à moitié.
 */
export const CONTEXT_CANDIDATES: WiContextCandidates =
  WiContextCandidatesSchema.parse(rawCandidates);

/** Un document n'est revu que s'il porte un réviseur ET une date de revue. */
export function isHumanReviewed(doc: WiContextCandidates): boolean {
  return (
    doc.review.status === "reviewed" &&
    Boolean(doc.review.reviewed_by?.trim()) &&
    Boolean(doc.review.reviewed_on) &&
    Boolean(doc.review.method?.trim())
  );
}

/**
 * Repères publiables : AUCUN tant que la revue n'est pas signée et décrite, et
 * alors SEULEMENT les valeurs relues dans leur source primaire. Une valeur
 * seulement relayée reste un candidat, même dans un document revu.
 */
export function publishableContextFacts(
  doc: WiContextCandidates = CONTEXT_CANDIDATES,
): readonly WiContextFact[] {
  if (!isHumanReviewed(doc)) return [];
  return doc.facts.filter((fact) => fact.verification === "primary_verified");
}

/** Un repère publiable par identifiant, ou `null` s'il ne l'est pas. */
export function publishableFact(
  id: string,
  doc: WiContextCandidates = CONTEXT_CANDIDATES,
): WiContextFact | null {
  return publishableContextFacts(doc).find((fact) => fact.id === id) ?? null;
}

/** Analyses PFAS au-delà de la limite de qualité (lecture, pas conclusion). */
export function pfasAnalysesAboveLimit(doc: WiContextCandidates = CONTEXT_CANDIDATES) {
  const { analyses, quality_limit } = doc.local_cases.pfas_34172;
  return analyses.filter((a) => a.value_ug_l > quality_limit);
}
