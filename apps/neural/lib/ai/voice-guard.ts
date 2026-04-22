/**
 * NEURAL — AG-001 MaisonVoiceGuard live scorer (Sprint 3)
 *
 * Expose `analyzeVoice()` : score un texte contre la charte de marque + hard-fail
 * + vocabulaire FR/EN. Output structure (Zod) pour consommation client fiable.
 *
 * Architecture :
 *   - System prompt compile a la volee depuis le catalogue luxe-comms
 *     (tblBrandRules, tblHardFail, tblVocabFR) — aucune hallucination possible,
 *     l'agent ne peut pas "inventer" une regle.
 *   - AI Gateway "anthropic/claude-sonnet-4.6" via generateObject (AI SDK v6).
 *     Temperature 0.2 pour reproductibilite.
 *   - Fallback deterministique (scoring regex simple) si gateway indisponible
 *     (dev local sans key) — le composant montre "mode demo" dans ce cas.
 *   - Langfuse trace avec tags {agent, lang, decision, score}.
 *
 * Note : on utilise `generateObject` et non `streamObject`. Pour un texte < 500
 * chars, la latence totale est ~1-3s ; l'animation "counter" cote client fait
 * l'effet "stream" sans complexite SSE additionnelle.
 */

import { randomUUID } from "node:crypto";

import { gateway, generateObject, type GatewayModelId } from "ai";
import { z } from "zod";

import { BRAND_RULES, HARD_FAIL_RULES, VOCAB_FR } from "@/lib/data/luxe-comms-catalog";
import { env } from "@/lib/env";
import { getLangfuseClient, flushLangfuse } from "@/lib/ai/langfuse";

// ─── Schema de sortie (contrat client/serveur) ──────────────────────────────

export const VoiceScoreSchema = z.object({
  score: z.number().int().min(0).max(100).describe("Score global /100 apres deduction des penalites."),
  decision: z
    .enum(["APPROVE", "REWORK", "REJECT"])
    .describe("APPROVE si score >= seuil ET hard_fail=0 ; REJECT si hard_fail>0 ; REWORK sinon."),
  hard_fail_count: z.number().int().min(0).describe("Nombre total de hard-fail detectes."),
  hard_fail_detected: z
    .array(z.string())
    .describe("Liste des patterns hard-fail trouves (e.g. 'discount', 'unique au monde')."),
  forbidden_detected: z
    .array(z.string())
    .describe("Termes FORBIDDEN non hard-fail detectes."),
  preferred_detected: z
    .array(z.string())
    .describe("Termes PREFERRED detectes (bonus charte)."),
  score_breakdown: z
    .object({
      tone: z.number().int().min(0).max(25),
      forbidden: z.number().int().min(0).max(50),
      preferred_missing: z.number().int().min(0).max(15),
      structure: z.number().int().min(0).max(15),
      identity: z.number().int().min(0).max(25),
      claim: z.number().int().min(0).max(25),
    })
    .describe("Penalites par categorie. Somme <= 100."),
  feedback: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe("1 a 5 points d'amelioration concrets, en francais."),
  rewrite_suggestion: z
    .string()
    .nullable()
    .describe("Reformulation suggeree si decision != APPROVE, sinon null."),
});
export type VoiceScoreResult = z.infer<typeof VoiceScoreSchema>;

// ─── Prompt builder ──────────────────────────────────────────────────────────

function buildSystemPrompt(lang: "FR" | "EN"): string {
  // Injecte les regles brand ponderees, les hard-fail, le vocab FR
  const rules = BRAND_RULES.filter((r) => r.lang === lang || r.lang === null)
    .slice(0, 15)
    .map((r) => `- [${r.niveau} ${r.poids ?? 0}pt] ${r.regle}`)
    .join("\n");

  const hardFails = HARD_FAIL_RULES.filter((h) => h.lang === lang)
    .map((h) => `- ${h.pattern} (${h.categorie})`)
    .join("\n");

  const forbidden = VOCAB_FR.filter((v) => v.term_type === "FORBIDDEN")
    .slice(0, 15)
    .map((v) => `- "${v.terme}" (${v.categorie ?? "?"})${v.suggestion_remplacement && v.suggestion_remplacement !== "-" ? ` → remplacer par "${v.suggestion_remplacement}"` : ""}`)
    .join("\n");

  const preferred = VOCAB_FR.filter((v) => v.term_type === "PREFERRED")
    .slice(0, 10)
    .map((v) => `- "${v.terme}" (${v.categorie ?? "?"})`)
    .join("\n");

  return `Tu es MaisonVoiceGuard (AG-001), l'agent NEURAL qui score chaque communication luxe contre la charte de marque.

Ta mission : analyser le texte soumis et retourner un verdict structure.

REGLES DE CHARTE (${lang}) :
${rules}

HARD-FAIL (refus automatique si detecte, 25pt par occurrence) :
${hardFails}

VOCABULAIRE INTERDIT (pt de penalite par occurrence) :
${forbidden}

VOCABULAIRE PREFERE (bonus : reduit la penalite "preferred_missing") :
${preferred}

REGLES DE SCORING :
- Commence a 100. Deduis les penalites par categorie.
- Categories : tone, forbidden, preferred_missing, structure, identity, claim.
- Chaque occurrence de hard-fail compte 25pt de penalite "forbidden" + incremente hard_fail_count.
- Si hard_fail_count > 0 : decision = REJECT.
- Sinon si score < 75 : decision = REWORK.
- Sinon : decision = APPROVE.

Donne feedback en francais clair. Si decision != APPROVE, propose une reformulation courte.

Sois objectif, factuel, sans blabla marketing.`;
}

function buildUserPrompt(text: string, contextLabel?: string): string {
  const ctx = contextLabel ? `\n\nContexte : ${contextLabel}` : "";
  return `Analyse ce texte de communication :\n\n"""${text.trim()}"""${ctx}\n\nRetourne le verdict structure.`;
}

// ─── Fallback deterministique (dev local / gateway off) ──────────────────────

function deterministicAnalyze(text: string, lang: "FR" | "EN"): VoiceScoreResult {
  const lower = text.toLowerCase();
  const hardFails = HARD_FAIL_RULES.filter((h) => h.lang === lang && h.type === "LITERAL");
  const hard_fail_detected: string[] = [];
  for (const h of hardFails) {
    if (lower.includes(h.pattern.toLowerCase())) hard_fail_detected.push(h.pattern);
  }
  const hard_fail_count = hard_fail_detected.length;

  const forbidden = VOCAB_FR.filter((v) => v.term_type === "FORBIDDEN");
  const forbidden_detected: string[] = [];
  for (const v of forbidden) {
    if (lower.includes(v.terme.toLowerCase())) forbidden_detected.push(v.terme);
  }

  const preferred = VOCAB_FR.filter((v) => v.term_type === "PREFERRED");
  const preferred_detected: string[] = [];
  for (const v of preferred) {
    if (lower.includes(v.terme.toLowerCase())) preferred_detected.push(v.terme);
  }

  const pen_forbidden = hard_fail_count * 25 + Math.max(0, forbidden_detected.length - hard_fail_count) * 10;
  const pen_preferred_missing = preferred_detected.length === 0 ? 5 : 0;
  const pen_structure = text.length > 300 ? 5 : 0;
  const score = Math.max(0, 100 - pen_forbidden - pen_preferred_missing - pen_structure);

  const decision: VoiceScoreResult["decision"] =
    hard_fail_count > 0 ? "REJECT" : score < 75 ? "REWORK" : "APPROVE";

  const feedback: string[] = [];
  if (hard_fail_count > 0) {
    feedback.push(
      `${hard_fail_count} hard-fail detecte(s) : ${hard_fail_detected.join(", ")}. Ces termes declenchent un refus automatique en charte luxe.`
    );
  }
  if (forbidden_detected.length > hard_fail_count) {
    const extra = forbidden_detected.filter((f) => !hard_fail_detected.includes(f));
    if (extra.length > 0) feedback.push(`Termes a eviter : ${extra.slice(0, 3).join(", ")}.`);
  }
  if (preferred_detected.length === 0) {
    feedback.push(
      `Le texte ne valorise aucun terme preferre (savoir-faire, heritage, atelier, geste). Envisagez d'ancrer le registre maison.`
    );
  }
  if (feedback.length === 0) {
    feedback.push("Texte conforme a la charte. Vocabulaire maitrise, aucun hard-fail detecte.");
  }

  return {
    score,
    decision,
    hard_fail_count,
    hard_fail_detected,
    forbidden_detected,
    preferred_detected,
    score_breakdown: {
      tone: 0,
      forbidden: pen_forbidden,
      preferred_missing: pen_preferred_missing,
      structure: pen_structure,
      identity: 0,
      claim: 0,
    },
    feedback,
    rewrite_suggestion:
      decision === "APPROVE"
        ? null
        : "Reecriture suggeree (mode demo) : simplifiez le registre, remplacez tout superlatif par une allusion au savoir-faire.",
  };
}

// ─── Main entry ──────────────────────────────────────────────────────────────

const MODEL: GatewayModelId = "anthropic/claude-sonnet-4.6";

export type VoiceScoreMeta = {
  traceId: string;
  /** "gateway" si generateObject reussi, "fallback" si deterministique. */
  mode: "gateway" | "fallback";
  /** Modele utilise (si gateway). */
  model?: string;
  latencyMs: number;
};

export async function analyzeVoice({
  text,
  lang = "FR",
  contextLabel,
  userId,
}: {
  text: string;
  lang?: "FR" | "EN";
  contextLabel?: string;
  userId: string;
}): Promise<{ result: VoiceScoreResult; meta: VoiceScoreMeta }> {
  const traceId = randomUUID();
  const startedAt = Date.now();

  // Mode fallback si gateway non configure (dev local sans vercel env pull)
  if (!env.ai.gatewayReady) {
    const result = deterministicAnalyze(text, lang);
    return {
      result,
      meta: {
        traceId,
        mode: "fallback",
        latencyMs: Date.now() - startedAt,
      },
    };
  }

  // Langfuse trace (no-op si non configure)
  const langfuse = getLangfuseClient();
  const trace = langfuse?.trace({
    id: traceId,
    name: "luxe-voice-score",
    userId,
    tags: ["agent:maison-voice-guard", `lang:${lang}`, "sprint:3"],
    input: { text_length: text.length, context: contextLabel ?? null },
  });

  try {
    const { object, usage } = await generateObject({
      model: gateway(MODEL),
      schema: VoiceScoreSchema,
      system: buildSystemPrompt(lang),
      prompt: buildUserPrompt(text, contextLabel),
      temperature: 0.2,
      maxRetries: 2,
      providerOptions: {
        gateway: {
          order: ["anthropic", "openai"],
          user: userId,
          tags: ["product:neural", "surface:luxe-voice-score", `lang:${lang}`],
        },
      },
    });

    trace?.update({
      output: {
        score: object.score,
        decision: object.decision,
        hard_fail_count: object.hard_fail_count,
      },
    });
    trace?.generation({
      name: "generate-object",
      model: MODEL,
      usage: usage
        ? {
            input: usage.inputTokens,
            output: usage.outputTokens,
            total: usage.totalTokens,
          }
        : undefined,
      input: { text_length: text.length },
      output: { score: object.score, decision: object.decision },
    });

    // Flush async, ne bloque pas la reponse
    void flushLangfuse();

    return {
      result: object,
      meta: {
        traceId,
        mode: "gateway",
        model: MODEL,
        latencyMs: Date.now() - startedAt,
      },
    };
  } catch (err) {
    console.warn("[voice-guard] gateway error, fallback deterministic:", err instanceof Error ? err.message : err);
    trace?.update({
      output: { error: err instanceof Error ? err.message : "unknown" },
    });
    void flushLangfuse();
    const result = deterministicAnalyze(text, lang);
    return {
      result,
      meta: {
        traceId,
        mode: "fallback",
        latencyMs: Date.now() - startedAt,
      },
    };
  }
}
