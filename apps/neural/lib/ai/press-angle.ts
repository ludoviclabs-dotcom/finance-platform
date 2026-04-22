/**
 * NEURAL — AG-002 LuxePressAgent live (Sprint 4)
 *
 * Expose `generatePressAngle()` : prend un brief + media cible, retourne
 * angle editorial + accroche + lede + structure + quote CEO + recommandations.
 *
 * Le prompt injecte le MEDIA_MATRIX (7 types) pour calibrer registre + longueur.
 */

import { randomUUID } from "node:crypto";

import { gateway, generateObject, type GatewayModelId } from "ai";
import { z } from "zod";

import { MEDIA_MATRIX, type MediaMatrix } from "@/lib/data/luxe-comms-catalog";
import { env } from "@/lib/env";
import { flushLangfuse, getLangfuseClient } from "@/lib/ai/langfuse";

// ─── Types ───────────────────────────────────────────────────────────────────

export const MEDIA_TYPES = [
  "Lifestyle",
  "Business",
  "Trade",
  "Digital",
  "Social",
  "Generaliste",
  "Magazine",
] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const PressAngleSchema = z.object({
  media_type: z.string(),
  angle_editorial: z.string().describe("Angle strategique retenu pour ce media (1 phrase)."),
  format_target: z.string().describe("Format editorial conseille (e.g. 'Communique 400-600 mots + media kit')."),
  length_words_target: z.number().int().min(100).max(2000),
  headline: z
    .string()
    .max(140)
    .describe("Accroche < 140 caracteres, respectant la charte luxe (pas de superlatif absolu)."),
  lede: z
    .string()
    .describe("Paragraphe d'amorce 3-4 lignes, factuel, allusif."),
  key_points: z
    .array(z.string())
    .min(3)
    .max(5)
    .describe("3-5 points a inclure obligatoirement."),
  structure_outline: z
    .array(z.string())
    .min(3)
    .max(6)
    .describe("Squelette de paragraphes proposes."),
  ceo_quote: z
    .string()
    .nullable()
    .describe("Quote CEO si le media l'attend, sinon null."),
  visuals_recommendation: z.string(),
  embargo_recommendation: z.string(),
  brand_compliance_check: z
    .array(z.string())
    .describe("Liste des points de charte respectes (ex : 'Pas de superlatif', 'Vocabulaire atelier')."),
  red_flags: z
    .array(z.string())
    .describe("Formulations a eviter absolument dans le draft final (referencant le hard-fail library)."),
});
export type PressAngleResult = z.infer<typeof PressAngleSchema>;

// ─── Prompt ──────────────────────────────────────────────────────────────────

function buildSystemPrompt(matrix: MediaMatrix | undefined): string {
  const matrixStr = MEDIA_MATRIX.map(
    (m) => `- ${m.media_type} → angle="${m.angle}", format="${m.format_target}", longueur=${m.length_words ?? "?"} mots, quote_ceo=${m.quote_ceo}, visuels=${m.visuals_required}, embargo=${m.embargo_recommand}`
  ).join("\n");

  const targetHint = matrix
    ? `Tu vises specifiquement ${matrix.media_type} : angle "${matrix.angle}", format "${matrix.format_target}", ${matrix.length_words ?? "?"} mots, quote_ceo=${matrix.quote_ceo}.`
    : "";

  return `Tu es LuxePressAgent (AG-002), l'agent NEURAL qui redige des communiques dans le registre du luxe.

${targetHint}

MEDIA MATRIX (angle + format + contraintes par outlet) :
${matrixStr}

REGLES EDITORIALES LUXE :
- Registre allusif, jamais declamatoire. Pas de superlatif absolu (meilleur, unique, exceptionnel sans contexte).
- Pas de nom de concurrent. Pas d'exhortation commerciale ("achetez").
- Vocabulaire prefere : atelier, savoir-faire, geste, maison, heritage, ciselure, artisan.
- Accroche < 140 caracteres.
- Quote CEO uniquement si le media l'attend (voir matrice).

POUR CHAQUE BRIEF, TU DOIS :
1. Choisir l'angle editorial adapte au media cible.
2. Ecrire une accroche courte, un lede factuel, une structure 3-6 paragraphes.
3. Identifier les points cle a inclure.
4. Proposer une quote CEO si l'outlet l'attend (Lifestyle, Business, Generaliste, Magazine typiquement).
5. Recommander visuels + embargo.
6. Lister 3-5 points de charte respectes (brand_compliance_check).
7. Lister explicitement les red flags a eviter (discount, promo, meilleur, unique au monde, usine, etc.).

La qualite luxe passe par la retenue. Moins de mots, plus de precision.`;
}

function buildUserPrompt(brief: string, mediaType: MediaType, lang: "FR" | "EN"): string {
  return `Brief presse (${lang}) :\n\n"""${brief.trim()}"""\n\nMedia cible : ${mediaType}\n\nGenere l'angle + structure + elements du draft.`;
}

// ─── Fallback ────────────────────────────────────────────────────────────────

function deterministicAngle(brief: string, mediaType: MediaType): PressAngleResult {
  const m = MEDIA_MATRIX.find((x) => x.media_type === mediaType);
  const length = m?.length_words ?? 400;
  const quoteExpected = m?.quote_ceo === "YES";

  const lower = brief.toLowerCase();
  const isHeritage = /heritage|patrimoine|archive|fondat|1920|1930|historique/i.test(brief);
  const isESG = /esg|durable|recycle|rse|eco|carbon|green/i.test(brief);

  const angle = m?.angle ?? "Narration factuelle";
  const headline = isHeritage
    ? "Une allusion au geste transmis depuis l'atelier"
    : isESG
    ? "Transparence RSE — chiffres, sources, audit"
    : `Annonce structuree pour ${mediaType}`;

  const lede = `[Demo fallback] La maison communique sur "${brief.slice(0, 80)}..." selon un angle ${angle.toLowerCase()}. Le draft complet sera genere via AI Gateway (Claude Sonnet) en mode production.`;

  return {
    media_type: mediaType,
    angle_editorial: angle,
    format_target: m?.format_target ?? "Communique standard",
    length_words_target: length,
    headline: headline.slice(0, 140),
    lede,
    key_points: [
      "Contexte maison + actualite declenchante",
      isHeritage ? "Ancrage patrimonial source" : "Faits + chiffres cles",
      "Temoignage interne (artisan / directeur)",
      isESG ? "Preuve RSE (certif, audit, scope)" : "Appel a en savoir plus",
    ],
    structure_outline: [
      "Accroche (1 phrase)",
      "Contexte (1 paragraphe)",
      "Annonce principale (1-2 paragraphes)",
      "Temoignage interne (1 paragraphe)",
      quoteExpected ? "Quote CEO" : "Conclusion",
    ],
    ceo_quote: quoteExpected
      ? "Nous poursuivons ce geste patrimonial dans la continuite de notre atelier."
      : null,
    visuals_recommendation: m?.visuals_required ?? "1 photo HD",
    embargo_recommendation: m?.embargo_recommand ?? "J-3",
    brand_compliance_check: [
      "Vocabulaire atelier/maison respecte",
      "Pas de superlatif absolu detecte",
      "Pas de nom concurrent",
    ],
    red_flags: ["discount", "promo", "meilleur", "unique au monde", "usine"],
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

const MODEL: GatewayModelId = "anthropic/claude-sonnet-4.6";

export type PressAngleMeta = {
  traceId: string;
  mode: "gateway" | "fallback";
  model?: string;
  latencyMs: number;
};

export async function generatePressAngle({
  brief,
  mediaType,
  lang = "FR",
  userId,
}: {
  brief: string;
  mediaType: MediaType;
  lang?: "FR" | "EN";
  userId: string;
}): Promise<{ result: PressAngleResult; meta: PressAngleMeta }> {
  const traceId = randomUUID();
  const startedAt = Date.now();

  if (!env.ai.gatewayReady) {
    return {
      result: deterministicAngle(brief, mediaType),
      meta: { traceId, mode: "fallback", latencyMs: Date.now() - startedAt },
    };
  }

  const matrix = MEDIA_MATRIX.find((m) => m.media_type === mediaType);

  const langfuse = getLangfuseClient();
  const trace = langfuse?.trace({
    id: traceId,
    name: "luxe-press-angle",
    userId,
    tags: ["agent:luxe-press-agent", `media:${mediaType}`, `lang:${lang}`, "sprint:4"],
    input: { brief_length: brief.length, mediaType, lang },
  });

  try {
    const { object, usage } = await generateObject({
      model: gateway(MODEL),
      schema: PressAngleSchema,
      system: buildSystemPrompt(matrix),
      prompt: buildUserPrompt(brief, mediaType, lang),
      temperature: 0.3,
      maxRetries: 2,
      providerOptions: {
        gateway: {
          order: ["anthropic", "openai"],
          user: userId,
          tags: ["product:neural", "surface:luxe-press-angle", `media:${mediaType}`],
        },
      },
    });

    trace?.update({
      output: { angle: object.angle_editorial, length: object.length_words_target },
    });
    trace?.generation({
      name: "generate-object",
      model: MODEL,
      usage: usage
        ? { input: usage.inputTokens, output: usage.outputTokens, total: usage.totalTokens }
        : undefined,
    });
    void flushLangfuse();

    return {
      result: object,
      meta: { traceId, mode: "gateway", model: MODEL, latencyMs: Date.now() - startedAt },
    };
  } catch (err) {
    console.warn("[press-angle] gateway error, fallback:", err instanceof Error ? err.message : err);
    void flushLangfuse();
    return {
      result: deterministicAngle(brief, mediaType),
      meta: { traceId, mode: "fallback", latencyMs: Date.now() - startedAt },
    };
  }
}
