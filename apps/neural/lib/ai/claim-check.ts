/**
 * NEURAL — AG-005 GreenClaimChecker live (Sprint 4)
 *
 * Expose `checkClaim()` : verifie une affirmation RSE contre la claim library
 * + jurisdiction matrix + evidence registry. Retourne PASS / PASS_WITH_REVIEW / BLOCK
 * + regulation citee + suggestion de reformulation qualifiee.
 */

import { randomUUID } from "node:crypto";

import { gateway, generateObject, type GatewayModelId } from "ai";
import { z } from "zod";

import {
  CLAIM_LIBRARY,
  CLAIMS_REGISTRY,
  JURISDICTION_MATRIX,
  resolveClaimStatus,
  type ClaimLibrary,
} from "@/lib/data/luxe-comms-catalog";
import { env } from "@/lib/env";
import { flushLangfuse, getLangfuseClient } from "@/lib/ai/langfuse";

// ─── Schema ──────────────────────────────────────────────────────────────────

export const JURISDICTIONS = ["EU", "FR", "UK", "US", "CH"] as const;
export type Jurisdiction = (typeof JURISDICTIONS)[number];

export const ClaimCheckSchema = z.object({
  decision: z.enum(["PASS", "PASS_WITH_REVIEW", "BLOCK"]),
  risk_class: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  detected_wording_type: z.enum(["ABSOLUTE", "QUALIFIED", "COMPARATIVE"]),
  matched_claim_pattern: z
    .string()
    .nullable()
    .describe("lib_id + pattern du claim library si match, sinon null."),
  evidence_found: z.boolean(),
  evidence_status: z.enum(["VALID", "STALE", "UNVERIFIED", "MISSING", "NONE"]),
  matched_claim_id: z.string().nullable().describe("CLM-XXX du registre evidence si match."),
  regulation_citations: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe("Regulations invoquees (EU Green Claims Directive 2024 Art. 6, Loi Climat FR 2023, CMA Green Claims Code UK, FTC Green Guides, etc.)."),
  jurisdiction_verdict: z
    .string()
    .describe("Verdict specifique a la juridiction (ex. 'INTERDIT vague en FR', 'PASS si % et source UE')."),
  feedback: z.array(z.string()).min(1).max(4),
  qualified_rewrite: z
    .string()
    .nullable()
    .describe("Reformulation qualifiee avec chiffre + source, si decision != PASS."),
});
export type ClaimCheckResult = z.infer<typeof ClaimCheckSchema>;

// ─── Prompt builder ──────────────────────────────────────────────────────────

function buildSystemPrompt(juri: Jurisdiction): string {
  const library = CLAIM_LIBRARY.slice(0, 17)
    .map((c) => `- "${c.pattern}" [${c.autorisation}, ${c.wording_type}, evidence=${c.evidence_required}] ${c.note ?? ""}`)
    .join("\n");

  const juriMatrix = JURISDICTION_MATRIX.map((j) => {
    const verdict = j[juri.toLowerCase() as "eu" | "fr" | "uk" | "us" | "ch"] ?? "N/A";
    return `- ${j.claim_pattern} → ${verdict}`;
  }).join("\n");

  const evidenceSamples = CLAIMS_REGISTRY.filter(
    (c) => resolveClaimStatus(c) === "VALID"
  )
    .slice(0, 8)
    .map((c) => `- CLM ${c.claim_id} "${c.claim}" (${c.wording_type}, evidence: ${c.evidence_title ?? "?"}, expiry ${c.evidence_expiry ?? "n/a"}, juri ${c.juridiction})`)
    .join("\n");

  return `Tu es GreenClaimChecker (AG-005), l'agent NEURAL qui verifie chaque affirmation RSE d'une maison luxe contre les regulations en vigueur.

JURIDICTION CIBLE : ${juri}

CLAIM LIBRARY (patterns reconnus et leur statut) :
${library}

MATRICE JURIDICTION (verdict par juridiction) :
${juriMatrix}

EVIDENCE SAMPLES disponibles (CLAIMS_REGISTRY extraits, VALID uniquement) :
${evidenceSamples}

REGULATIONS A CITER :
- EU : Directive (UE) 2024/825 "Green Claims Directive" Art. 3/6/7, Directive 2005/29/CE consumer practices
- FR : Loi Climat & Resilience 2023 Art. 12 (interdit "neutre en carbone" sans preuve), DGCCRF
- UK : CMA Green Claims Code 2021
- US : FTC Green Guides 2012 (revision 2025 en cours)
- CH : Loi federale contre la concurrence deloyale, Art. 3

REGLES DE DECISION :
- Si claim matche un pattern INTERDIT dans la juridiction cible → BLOCK + CRITICAL.
- Si claim ABSOLUTE sans qualifieur ni evidence → BLOCK + CRITICAL ou HIGH.
- Si claim QUALIFIED avec match registry VALID → PASS + LOW ou MEDIUM.
- Si wording flou ou evidence STALE → PASS_WITH_REVIEW + HIGH.
- Si COMPARATIVE sans benchmark public → BLOCK + HIGH.

Fournis :
- decision, risk_class, detected_wording_type
- matched_claim_pattern (si un pattern library correspond)
- matched_claim_id (CLM-XXX du registre evidence si applicable, sinon null)
- evidence_found + evidence_status
- regulation_citations (1 a 3 par pays concerne)
- jurisdiction_verdict (une phrase specifique au pays)
- feedback (1-4 bullets, francais)
- qualified_rewrite (reformulation PASS si possible, sinon null)`;
}

function buildUserPrompt(claim: string, juri: Jurisdiction, context?: string): string {
  const ctx = context ? `\n\nContexte : ${context}` : "";
  return `Analyse cette affirmation RSE / ESG pour la juridiction ${juri} :\n\n"""${claim.trim()}"""${ctx}\n\nRetourne le verdict structure.`;
}

// ─── Fallback deterministique ────────────────────────────────────────────────

function deterministicCheck(claim: string, juri: Jurisdiction): ClaimCheckResult {
  const lower = claim.toLowerCase();
  const libMatch = CLAIM_LIBRARY.find((c) => lower.includes(c.pattern.toLowerCase()));

  // Wording heuristic
  const hasPct = /\b\d{1,3}\s*%/.test(claim);
  const hasQualifier = hasPct || /\b(certifie|certified|audit|selon|source|scope)\b/i.test(claim);
  const hasComparative = /\b(meilleur|superieur|plus que|versus|vs\.?)\b/i.test(lower);
  const detected_wording: ClaimCheckResult["detected_wording_type"] = hasComparative
    ? "COMPARATIVE"
    : hasQualifier
    ? "QUALIFIED"
    : "ABSOLUTE";

  let decision: ClaimCheckResult["decision"] = "PASS_WITH_REVIEW";
  let risk: ClaimCheckResult["risk_class"] = "MEDIUM";
  let verdict = "Analyse fallback (mode demo).";
  const citations: string[] = [];

  if (libMatch) {
    if (libMatch.autorisation === "INTERDIT") {
      decision = "BLOCK";
      risk = "CRITICAL";
      verdict = `Claim "${libMatch.pattern}" interdit vague dans ${juri}.`;
    } else if (libMatch.autorisation === "REVIEW") {
      decision = "PASS_WITH_REVIEW";
      risk = "HIGH";
      verdict = `Claim "${libMatch.pattern}" necessite review juridiction ${juri}.`;
    } else if (libMatch.autorisation === "AUTORISE_SI_PROUVE") {
      if (hasQualifier) {
        decision = "PASS_WITH_REVIEW";
        risk = "MEDIUM";
        verdict = `Claim "${libMatch.pattern}" accepte si evidence verifiable ${juri}.`;
      } else {
        decision = "BLOCK";
        risk = "HIGH";
        verdict = `Claim "${libMatch.pattern}" sans qualifieur : BLOCK ${juri}.`;
      }
    } else {
      decision = "PASS";
      risk = "LOW";
      verdict = `Claim "${libMatch.pattern}" autorise ${juri}.`;
    }
  } else if (detected_wording === "ABSOLUTE") {
    decision = "BLOCK";
    risk = "HIGH";
    verdict = `Formulation absolue non-qualifiee — BLOCK ${juri}.`;
  }

  if (juri === "EU") citations.push("EU Green Claims Directive 2024 Art. 6");
  if (juri === "FR") citations.push("Loi Climat & Resilience 2023 Art. 12");
  if (juri === "UK") citations.push("CMA Green Claims Code 2021");
  if (juri === "US") citations.push("FTC Green Guides 2012");
  if (juri === "CH") citations.push("LCD Art. 3");

  const feedback: string[] = [];
  feedback.push(verdict);
  if (decision !== "PASS") {
    feedback.push("Mode demo : pour une verification complete avec AI Gateway, activez AI_GATEWAY_API_KEY.");
  }

  // Cherche match registry
  const regMatch = CLAIMS_REGISTRY.find((c) =>
    c.claim.toLowerCase().includes(libMatch?.pattern.toLowerCase() ?? lower.slice(0, 20))
  );

  return {
    decision,
    risk_class: risk,
    detected_wording_type: detected_wording,
    matched_claim_pattern: libMatch ? `${libMatch.lib_id}: ${libMatch.pattern}` : null,
    evidence_found: !!regMatch,
    evidence_status: regMatch
      ? (resolveClaimStatus(regMatch) as ClaimCheckResult["evidence_status"])
      : "NONE",
    matched_claim_id: regMatch?.claim_id ?? null,
    regulation_citations: citations,
    jurisdiction_verdict: verdict,
    feedback,
    qualified_rewrite:
      decision === "PASS"
        ? null
        : "Qualifier avec un chiffre + source (ex: 'or 80% recycle, audit LBMA 2026').",
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

const MODEL: GatewayModelId = "anthropic/claude-sonnet-4.6";

export type ClaimCheckMeta = {
  traceId: string;
  mode: "gateway" | "fallback";
  model?: string;
  latencyMs: number;
};

export async function checkClaim({
  claim,
  juridiction,
  context,
  userId,
}: {
  claim: string;
  juridiction: Jurisdiction;
  context?: string;
  userId: string;
}): Promise<{ result: ClaimCheckResult; meta: ClaimCheckMeta }> {
  const traceId = randomUUID();
  const startedAt = Date.now();

  if (!env.ai.gatewayReady) {
    return {
      result: deterministicCheck(claim, juridiction),
      meta: { traceId, mode: "fallback", latencyMs: Date.now() - startedAt },
    };
  }

  const langfuse = getLangfuseClient();
  const trace = langfuse?.trace({
    id: traceId,
    name: "luxe-claim-check",
    userId,
    tags: ["agent:green-claim-checker", `juri:${juridiction}`, "sprint:4"],
    input: { claim_length: claim.length, juridiction },
  });

  try {
    const { object, usage } = await generateObject({
      model: gateway(MODEL),
      schema: ClaimCheckSchema,
      system: buildSystemPrompt(juridiction),
      prompt: buildUserPrompt(claim, juridiction, context),
      temperature: 0.1,
      maxRetries: 2,
      providerOptions: {
        gateway: {
          order: ["anthropic", "openai"],
          user: userId,
          tags: ["product:neural", "surface:luxe-claim-check", `juri:${juridiction}`],
        },
      },
    });

    trace?.update({
      output: { decision: object.decision, risk: object.risk_class, evidence: object.evidence_found },
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
    console.warn("[claim-check] gateway error, fallback:", err instanceof Error ? err.message : err);
    void flushLangfuse();
    return {
      result: deterministicCheck(claim, juridiction),
      meta: { traceId, mode: "fallback", latencyMs: Date.now() - startedAt },
    };
  }
}
