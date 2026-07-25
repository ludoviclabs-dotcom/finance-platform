/**
 * lib/water-intelligence/editorial.ts — contenus sourcés (P12, Wave C).
 *
 * ## Ce que ce module livre, et ce qu'il ne livre pas
 *
 * Il livre le **contenant** : le schéma d'un contenu publiable, ses garde-fous,
 * et le refus explicite de tout ce qui n'est pas sourcé et revu.
 *
 * Il ne livre **aucun contenu**. Un record éditorial exige, par schéma, une
 * source, une date de revue et un réviseur identifié. Aucun humain n'a encore
 * rédigé ni revu de contenu pour cette surface : le jeu livré est donc VIDE,
 * et c'est le seul état honnête. Écrire des textes « plausibles » signés d'un
 * réviseur fictif produirait exactement le faux que le chantier interdit.
 *
 * Le blueprint l'avait anticipé : « Ce blueprint fixe le contenant, jamais le
 * contenu » (annexe A) — le contenu réel relève de P12 et d'une revue humaine.
 *
 * ## Garde-fous appliqués
 *
 * - source, `reviewed_on` et `reviewed_by` obligatoires — un record sans revue
 *   n'est pas publiable ;
 * - pour un ÉVÉNEMENT, la date de l'événement (`valid_from`) est distincte de
 *   la date de publication de la source, et le territoire est obligatoire ;
 * - pour un ACTEUR, aucun rang n'est accepté : sans méthodologie objective
 *   publiée, un classement d'entreprises est une opinion déguisée en donnée ;
 * - aucun chiffre dans un résumé sans source attachée ;
 * - aucun texte généré au runtime : les contenus sont des données statiques,
 *   validées au build.
 */

import { z } from "zod";

import { WaterEditorialRecordSchema, type WaterEditorialRecord } from "./contracts";

export type WiEditorialType = WaterEditorialRecord["record_type"];

/** Sections éditoriales de la surface publique et leur ancre. */
export const EDITORIAL_SECTIONS: Readonly<
  Record<WiEditorialType, { readonly anchor: string; readonly title: string }>
> = {
  industry: { anchor: "secteurs", title: "Secteurs et dépendances" },
  actor: { anchor: "secteurs", title: "Secteurs et dépendances" },
  event: { anchor: "evenements", title: "Climat et événements" },
  innovation: { anchor: "innovations", title: "Innovations et adaptation" },
};

export class EditorialValidationError extends Error {}

/**
 * Schéma publiable : le contrat P02 plus les garde-fous éditoriaux qui ne
 * peuvent pas être exprimés dans le contrat partagé.
 */
export const WiPublishableEditorialSchema = WaterEditorialRecordSchema.superRefine(
  (record, ctx) => {
    if (!record.reviewed_by.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["reviewed_by"],
        message: "Un réviseur identifié est obligatoire : un contenu non revu n'est pas publiable.",
      });
    }
    if (!record.source.attribution && !record.source.source_code) {
      ctx.addIssue({
        code: "custom",
        path: ["source"],
        message: "Une source identifiable est obligatoire.",
      });
    }
    if (record.record_type === "event") {
      if (!record.valid_from) {
        ctx.addIssue({
          code: "custom",
          path: ["valid_from"],
          message:
            "Un événement doit porter sa propre date, distincte de la date de publication de la source.",
        });
      }
      if (!record.jurisdiction) {
        ctx.addIssue({
          code: "custom",
          path: ["jurisdiction"],
          message: "Un événement doit porter son territoire.",
        });
      }
    }
    if (containsUnsourcedFigure(record)) {
      ctx.addIssue({
        code: "custom",
        path: ["summary"],
        message:
          "Un chiffre apparaît dans le résumé sans source attachée : aucune statistique sans provenance.",
      });
    }
  },
);

/**
 * Détecte un chiffre « nu » dans un résumé.
 *
 * Volontairement conservateur : les années seules (2024) et les énumérations
 * ne déclenchent rien, mais toute quantité (pourcentage, volume, montant)
 * exige une source explicitement attachée au record.
 */
export function containsUnsourcedFigure(record: WaterEditorialRecord): boolean {
  const hasQuantity = /\d+([.,]\d+)?\s*(%|m³|m3|km|km²|Mm³|hm³|€|\$|tonnes?|litres?)/i.test(
    record.summary,
  );
  if (!hasQuantity) return false;
  return !record.source.source_code || !record.source.release_key;
}

/** Un rang explicite n'a aucune place sans méthodologie publiée. */
export function rejectsRanking(record: unknown): boolean {
  if (typeof record !== "object" || record === null) return false;
  return ["rank", "ranking", "position", "score", "classement"].some(
    (key) => key in (record as Record<string, unknown>),
  );
}

export interface EditorialValidationResult {
  readonly published: readonly WaterEditorialRecord[];
  readonly rejected: readonly { readonly id: string; readonly reason: string }[];
}

/**
 * Valide un lot. Un record invalide est ÉCARTÉ et nommé — jamais publié
 * partiellement, jamais corrigé en silence.
 */
export function validateEditorialRecords(input: readonly unknown[]): EditorialValidationResult {
  const published: WaterEditorialRecord[] = [];
  const rejected: { id: string; reason: string }[] = [];

  input.forEach((candidate, index) => {
    if (rejectsRanking(candidate)) {
      rejected.push({
        id: identify(candidate, index),
        reason:
          "Classement refusé : aucun rang d'acteur sans méthodologie objective publiée.",
      });
      return;
    }
    const parsed = WiPublishableEditorialSchema.safeParse(candidate);
    if (parsed.success) {
      published.push(parsed.data);
    } else {
      rejected.push({
        id: identify(candidate, index),
        reason: parsed.error.issues.map((issue) => issue.message).join(" · "),
      });
    }
  });

  return { published, rejected };
}

function identify(candidate: unknown, index: number): string {
  if (typeof candidate === "object" && candidate !== null && "record_id" in candidate) {
    return String((candidate as { record_id: unknown }).record_id);
  }
  return `record #${index}`;
}

export function recordsOfType(
  records: readonly WaterEditorialRecord[],
  type: WiEditorialType,
): readonly WaterEditorialRecord[] {
  return records.filter((record) => record.record_type === type);
}

/**
 * Contenus publiés à ce jour : AUCUN.
 *
 * Aucun humain n'a rédigé ni revu de contenu pour cette surface. Le tableau
 * reste vide jusqu'à ce que ce soit le cas — un contenu « plausible » signé
 * d'un réviseur fictif serait précisément le faux que le chantier interdit.
 */
export const PUBLISHED_EDITORIAL_RECORDS: readonly WaterEditorialRecord[] = [];

/** Sections attendues, pour que l'UI annonce ce qui viendra sans l'inventer. */
export const EDITORIAL_ROADMAP: readonly {
  readonly type: WiEditorialType;
  readonly describes: string;
}[] = [
  { type: "industry", describes: "Secteurs et dépendances hydriques, sourcés et datés" },
  { type: "actor", describes: "Écosystème d'acteurs, non classé par défaut" },
  { type: "event", describes: "Événements datés, territoire et source obligatoires" },
  {
    type: "innovation",
    describes:
      "Innovations : maturité, arbitrages énergie/carbone, bénéfice hydrique seulement si sourcé",
  },
];

export const EDITORIAL_SCHEMA = z.array(WiPublishableEditorialSchema);
