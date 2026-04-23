/**
 * NEURAL — AG-B003 ESGBankComms (Sprint 3)
 *
 * Vérifie un claim ESG bancaire contre 4 gates déterministes :
 *   - GATE-ESG-WORDING       (formulation ABSOLUTE non qualifiée)
 *   - GATE-ESG-EVIDENCE      (preuve ACTIVE requise, pas STALE/MISSING)
 *   - GATE-ESG-JURISDICTION  (claim interdit dans la juridiction cible)
 *   - GATE-ESG-CLAIM-MATCH   (claim non reconnu → review humaine)
 *
 * Scenario-id uniquement (correctif #2). Le LLM suggère une reformulation
 * qualifiée sourcée mais ne peut pas contredire la décision déterministe.
 */

import { randomUUID } from "node:crypto";

import { gateway, generateObject, type GatewayModelId } from "ai";
import { z } from "zod";

import { env } from "@/lib/env";
import { flushLangfuse, getLangfuseClient } from "@/lib/ai/langfuse";
import { persistBankCommsRun } from "@/lib/ai/bank-comms-persistence";
import {
  ESG_CLAIM_LIBRARY,
  ESG_JURISDICTION_VERDICTS,
  bestEvidenceFor,
  getEsgScenario,
  matchEsgPatterns,
  type EsgClaim,
  type EsgEvidence,
  type EsgJurisdictionVerdict,
  type EsgScenario,
} from "@/lib/data/bank-comms-catalog";

// ─── Schema ─────────────────────────────────────────────────────────────────

export const EsgGateResultSchema = z.object({
  gate_id: z.string(),
  label: z.string(),
  passed: z.boolean(),
  blocking: z.boolean(),
  reason: z.string().nullable(),
});
export type EsgGateResult = z.infer<typeof EsgGateResultSchema>;

export const EsgVerdictSchema = z.object({
  decision: z.enum(["PASS", "PASS_WITH_REVIEW", "BLOCK"]),
  risk_class: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  blockers: z.array(z.string()),
  warnings: z.array(z.string()),
  gates: z.array(EsgGateResultSchema),
  matched_patterns: z.array(z.string()),
  evidence_summary: z
    .object({
      evidence_id: z.string().nullable(),
      status: z.string(),
      valeur: z.string().nullable(),
      expiry_date: z.string().nullable(),
    })
    .nullable(),
  jurisdiction_verdict: z.string(),
  regulation_citations: z.array(z.string()).min(1).max(5),
  qualified_rewrite: z.string().nullable(),
  reviewer_comment: z.string(),
});
export type EsgVerdict = z.infer<typeof EsgVerdictSchema>;

// ─── Gates déterministes ────────────────────────────────────────────────────

function wordingGate(claimText: string, matches: EsgClaim[]): EsgGateResult {
  // Si le texte contient un terme ABSOLUTE interdit sans qualifieur chiffré, on bloque.
  const hasChiffre = /\b\d{1,3}([.,]\d{1,2})?\s*%/.test(claimText) || /\d{4}/.test(claimText);
  const absoluteInterdit = matches.find(
    (m) => m.wording_type === "ABSOLUTE" && m.autorisation === "INTERDIT",
  );
  if (absoluteInterdit) {
    return {
      gate_id: "GATE-ESG-WORDING",
      label: "Formulation absolue interdite",
      passed: false,
      blocking: true,
      reason: `Pattern "${absoluteInterdit.pattern}" interdit (${absoluteInterdit.note ?? "absolu non défendable"}).`,
    };
  }
  const absoluteVague = matches.find(
    (m) => m.wording_type === "ABSOLUTE" && m.autorisation === "REVIEW" && !hasChiffre,
  );
  if (absoluteVague) {
    return {
      gate_id: "GATE-ESG-WORDING",
      label: "Formulation absolue vague (review requise)",
      passed: false,
      blocking: false,
      reason: `Pattern "${absoluteVague.pattern}" sans qualifieur chiffré.`,
    };
  }
  return {
    gate_id: "GATE-ESG-WORDING",
    label: "Formulation qualifiée ou autorisée",
    passed: true,
    blocking: true,
    reason: null,
  };
}

function evidenceGate(
  matches: EsgClaim[],
): { gate: EsgGateResult; evidence: EsgEvidence | undefined } {
  // Prend le premier match qui requiert evidence.
  const needsEvidence = matches.find((m) => m.evidence_required);
  if (!needsEvidence) {
    return {
      gate: {
        gate_id: "GATE-ESG-EVIDENCE",
        label: "Preuve non requise pour ce claim",
        passed: true,
        blocking: true,
        reason: null,
      },
      evidence: undefined,
    };
  }
  const ev = bestEvidenceFor(needsEvidence.pattern);
  if (!ev) {
    return {
      gate: {
        gate_id: "GATE-ESG-EVIDENCE",
        label: "Preuve ACTIVE requise dans le registre",
        passed: false,
        blocking: true,
        reason: `Aucune evidence trouvée pour "${needsEvidence.pattern}" dans le registre.`,
      },
      evidence: undefined,
    };
  }
  if (ev.status !== "ACTIVE") {
    return {
      gate: {
        gate_id: "GATE-ESG-EVIDENCE",
        label: "Preuve ACTIVE requise",
        passed: false,
        blocking: true,
        reason: `Evidence ${ev.evidence_id} status=${ev.status}${ev.expiry_date ? ` (expiry ${ev.expiry_date})` : ""}. Rafraîchir avant publication.`,
      },
      evidence: ev,
    };
  }
  return {
    gate: {
      gate_id: "GATE-ESG-EVIDENCE",
      label: "Preuve ACTIVE disponible",
      passed: true,
      blocking: true,
      reason: null,
    },
    evidence: ev,
  };
}

function jurisdictionGate(
  matches: EsgClaim[],
  jurisdiction: "FR" | "EU",
  verdicts: EsgJurisdictionVerdict[],
): { gate: EsgGateResult; verdictLabel: string } {
  // Priorité 1 : verdict INTERDIT → fail bloquant.
  for (const m of matches) {
    const v = verdicts.find((x) => x.claim_pattern === m.pattern);
    if (!v) continue;
    const val = jurisdiction === "FR" ? v.fr : v.eu;
    if (val === "INTERDIT") {
      return {
        gate: {
          gate_id: "GATE-ESG-JURISDICTION",
          label: `Claim interdit en ${jurisdiction}`,
          passed: false,
          blocking: true,
          reason: `Pattern "${m.pattern}" : ${val} en ${jurisdiction}. ${v.note ?? ""}`,
        },
        verdictLabel: `${val} en ${jurisdiction}`,
      };
    }
  }
  // Priorité 2 : verdict REVIEW → warning non bloquant (review humaine requise).
  for (const m of matches) {
    const v = verdicts.find((x) => x.claim_pattern === m.pattern);
    if (!v) continue;
    const val = jurisdiction === "FR" ? v.fr : v.eu;
    if (val === "REVIEW") {
      return {
        gate: {
          gate_id: "GATE-ESG-JURISDICTION",
          label: `Claim soumis à review ${jurisdiction}`,
          passed: false,
          blocking: false,
          reason: `Pattern "${m.pattern}" : REVIEW en ${jurisdiction}. ${v.note ?? "Indicateur chiffré + méthodologie requis."}`,
        },
        verdictLabel: `REVIEW en ${jurisdiction}`,
      };
    }
  }
  const first = matches[0];
  const firstVerdict = first
    ? verdicts.find((x) => x.claim_pattern === first.pattern)
    : undefined;
  const label = firstVerdict
    ? `${jurisdiction === "FR" ? firstVerdict.fr : firstVerdict.eu} en ${jurisdiction}`
    : `Non matché en ${jurisdiction}`;
  return {
    gate: {
      gate_id: "GATE-ESG-JURISDICTION",
      label: `Autorisation juridiction ${jurisdiction}`,
      passed: true,
      blocking: true,
      reason: null,
    },
    verdictLabel: label,
  };
}

function claimMatchGate(matches: EsgClaim[]): EsgGateResult {
  if (matches.length === 0) {
    return {
      gate_id: "GATE-ESG-CLAIM-MATCH",
      label: "Claim reconnu dans la library",
      passed: false,
      blocking: false,
      reason:
        "Aucun pattern de la claim library ne matche. Review humaine requise pour décider d'ajouter un nouveau pattern ou de reformuler.",
    };
  }
  return {
    gate_id: "GATE-ESG-CLAIM-MATCH",
    label: "Claim reconnu dans la library",
    passed: true,
    blocking: false,
    reason: null,
  };
}

function decisionFromGates(gates: EsgGateResult[]): EsgVerdict["decision"] {
  const blocked = gates.some((g) => g.blocking && !g.passed);
  if (blocked) return "BLOCK";
  const warn = gates.some((g) => !g.passed);
  return warn ? "PASS_WITH_REVIEW" : "PASS";
}

function riskFromDecision(
  decision: EsgVerdict["decision"],
  matches: EsgClaim[],
): EsgVerdict["risk_class"] {
  if (decision === "BLOCK") {
    return matches.some((m) => m.autorisation === "INTERDIT") ? "CRITICAL" : "HIGH";
  }
  if (decision === "PASS_WITH_REVIEW") return "MEDIUM";
  return "LOW";
}

function defaultCitations(juri: "FR" | "EU"): string[] {
  const base = [
    "EU Green Claims Directive 2024 (Directive (UE) 2024/825)",
    "EBA Guidelines on ESG risk disclosures EBA/GL/2022/09",
  ];
  if (juri === "FR") base.push("Loi Climat & Résilience 2023 Art. 12");
  if (juri === "EU") base.push("SFDR Regulation (EU) 2019/2088");
  return base.slice(0, 3);
}

// ─── Fallback déterministe ──────────────────────────────────────────────────

function fallbackVerdict(scenario: EsgScenario): EsgVerdict {
  const { claim_text: text, jurisdiction } = scenario.draft;
  const matches = matchEsgPatterns(text);
  const wGate = wordingGate(text, matches);
  const { gate: eGate, evidence } = evidenceGate(matches);
  const { gate: jGate, verdictLabel } = jurisdictionGate(
    matches,
    jurisdiction,
    ESG_JURISDICTION_VERDICTS,
  );
  const cGate = claimMatchGate(matches);
  const gates = [wGate, eGate, jGate, cGate];
  const decision = decisionFromGates(gates);
  const risk = riskFromDecision(decision, matches);
  const blockers = gates.filter((g) => g.blocking && !g.passed).map((g) => g.gate_id);
  const warnings = gates.filter((g) => !g.blocking && !g.passed).map((g) => g.gate_id);

  const rewriteSource = matches.find(
    (m) =>
      m.autorisation === "INTERDIT" ||
      (m.autorisation === "REVIEW" && m.wording_type === "ABSOLUTE"),
  );
  const qualifiedRewrite =
    decision === "PASS"
      ? null
      : rewriteSource
        ? `Reformulation suggérée : remplacer "${rewriteSource.pattern}" par une formulation qualifiée chiffrée + année de base + périmètre. Exemple : "réduction de X % vs. année YYYY (périmètre scope 1+2, méthodologie SBTi)".`
        : "Ajouter une preuve chiffrée et une méthodologie explicite avant publication.";

  return {
    decision,
    risk_class: risk,
    blockers,
    warnings,
    gates,
    matched_patterns: matches.map((m) => m.pattern),
    evidence_summary: evidence
      ? {
          evidence_id: evidence.evidence_id,
          status: evidence.status,
          valeur: evidence.valeur,
          expiry_date: evidence.expiry_date,
        }
      : null,
    jurisdiction_verdict: verdictLabel,
    regulation_citations: defaultCitations(jurisdiction),
    qualified_rewrite: qualifiedRewrite,
    reviewer_comment:
      decision === "PASS"
        ? "Claim ESG conforme — qualifieur chiffré présent, preuve ACTIVE disponible."
        : `Decision: ${decision} (${risk}). Blockers: ${blockers.join(", ") || "—"}.`,
  };
}

// ─── LLM enrichment ─────────────────────────────────────────────────────────

const MODEL: GatewayModelId = "anthropic/claude-sonnet-4.6";

function buildSystemPrompt(scenario: EsgScenario, gates: EsgGateResult[]): string {
  const lib = ESG_CLAIM_LIBRARY.map(
    (c) => `- "${c.pattern}" [${c.wording_type}, ${c.autorisation}, evidence=${c.evidence_required}] ${c.note ?? ""}`,
  ).join("\n");
  const gateBlock = gates
    .map(
      (g) =>
        `- ${g.gate_id} (${g.blocking ? "bloquant" : "info"}) : ${g.passed ? "PASS" : `FAIL — ${g.reason}`}`,
    )
    .join("\n");
  return `Tu es ESGBankComms (AG-B003), l'agent NEURAL qui vérifie les claims ESG bancaires (SFDR, taxonomie UE, Loi Climat, EU Green Claims Directive).

JURIDICTION CIBLE : ${scenario.draft.jurisdiction}

CLAIM LIBRARY :
${lib}

GATES (source de vérité — tu ne peux pas les contredire) :
${gateBlock}

RÔLE
- Produire un reviewer_comment synthétique.
- Si BLOCK/PASS_WITH_REVIEW : produire qualified_rewrite (reformulation qualifiée, chiffrée, sourcée). Si PASS : qualified_rewrite=null.
- Citer 1 à 3 regulations pertinentes (Green Claims Directive, SFDR, Loi Climat, EBA GL, taxonomie).
- Ne JAMAIS déclarer PASS si un gate bloquant a échoué.`;
}

function buildUserPrompt(scenario: EsgScenario): string {
  return `CLAIM : """${scenario.draft.claim_text}"""
JURIDICTION : ${scenario.draft.jurisdiction}

Réponds en JSON strict selon le schéma.`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

export type EsgMeta = {
  traceId: string;
  mode: "gateway" | "fallback";
  model?: string;
  latencyMs: number;
  scenarioId: string;
};

export async function checkEsgScenario({
  scenarioId,
  userId,
}: {
  scenarioId: string;
  userId: string;
}): Promise<
  | { ok: true; result: EsgVerdict; meta: EsgMeta }
  | { ok: false; error: string }
> {
  const scenario = getEsgScenario(scenarioId);
  if (!scenario) return { ok: false, error: `Scénario inconnu : ${scenarioId}` };

  const traceId = randomUUID();
  const startedAt = Date.now();
  const baseline = fallbackVerdict(scenario);

  const finish = async (
    result: EsgVerdict,
    mode: "gateway" | "fallback",
    model?: string,
  ): Promise<{ ok: true; result: EsgVerdict; meta: EsgMeta }> => {
    const latencyMs = Date.now() - startedAt;
    void persistBankCommsRun({
      traceId,
      agentSlug: "esg-bank-comms",
      scenarioId,
      decision: result.decision,
      mode,
      model,
      latencyMs,
      startedAtMs: startedAt,
      trace: { result, meta: { mode, model, latencyMs } },
    });
    return { ok: true, result, meta: { traceId, mode, model, latencyMs, scenarioId } };
  };

  if (!env.ai.gatewayReady) {
    return finish(baseline, "fallback");
  }

  const langfuse = getLangfuseClient();
  const trace = langfuse?.trace({
    id: traceId,
    name: "esg-bank-comms",
    userId,
    tags: ["agent:esg-bank-comms", "sprint:3", `scenario:${scenarioId}`],
    input: { scenarioId, jurisdiction: scenario.draft.jurisdiction },
  });

  try {
    const { object, usage } = await generateObject({
      model: gateway(MODEL),
      schema: EsgVerdictSchema,
      system: buildSystemPrompt(scenario, baseline.gates),
      prompt: buildUserPrompt(scenario),
      temperature: 0.1,
      maxRetries: 2,
      providerOptions: {
        gateway: {
          order: ["anthropic", "openai"],
          user: userId,
          tags: ["product:neural", "surface:esg-bank", `scenario:${scenarioId}`],
        },
      },
    });

    // Override : les gates / decision / blockers sont source de vérité.
    const safe: EsgVerdict = {
      ...object,
      decision: baseline.decision,
      blockers: baseline.blockers,
      warnings: baseline.warnings,
      gates: baseline.gates,
      matched_patterns: baseline.matched_patterns,
      evidence_summary: baseline.evidence_summary,
      jurisdiction_verdict: baseline.jurisdiction_verdict,
    };

    trace?.update({ output: { decision: safe.decision, risk: safe.risk_class } });
    trace?.generation({
      name: "generate-object",
      model: MODEL,
      usage: usage
        ? { input: usage.inputTokens, output: usage.outputTokens, total: usage.totalTokens }
        : undefined,
    });
    void flushLangfuse();

    return finish(safe, "gateway", MODEL);
  } catch (err) {
     
    console.warn(
      "[esg-bank-comms] gateway error, fallback:",
      err instanceof Error ? err.message : err,
    );
    void flushLangfuse();
    return finish(baseline, "fallback");
  }
}
