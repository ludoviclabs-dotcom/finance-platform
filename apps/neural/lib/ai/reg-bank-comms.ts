/**
 * NEURAL — AG-B001 RegBankComms (Sprint 1)
 *
 * Check d'un draft de communication réglementée bancaire contre les policy gates
 * déterministes MVP :
 *   - GATE-PRIV            (info privilégiée non publique)
 *   - GATE-NUM-VALIDATED   (tous les chiffres status=validated)
 *   - GATE-SOURCE-ACTIVE   (toute affirmation adossée à une source ACTIVE)
 *   - GATE-WORDING         (pas de restricted_wording sans qualifieur)
 *
 * Mode d'entrée — correctif #2 du blueprint : la démo publique accepte
 * **uniquement** un `scenario_id` (pas de texte libre). Cela prévient
 * l'ingestion accidentelle d'un communiqué bancaire non publié.
 *
 * Le LLM est utilisé optionnellement pour produire une reformulation
 * défendable ET un commentaire de revue destiné au HITL — jamais pour
 * _bypasser_ une gate. Les gates sont évaluées avant et après LLM.
 *
 * Fallback déterministe : si AI_GATEWAY_API_KEY n'est pas configuré ou si
 * le gateway échoue, on retourne le verdict des gates + un fallback
 * rewriter basé sur templates.
 */

import { randomUUID } from "node:crypto";

import { gateway, generateObject, type GatewayModelId } from "ai";
import { z } from "zod";

import { env } from "@/lib/env";
import { flushLangfuse, getLangfuseClient } from "@/lib/ai/langfuse";
import { persistBankCommsRun } from "@/lib/ai/bank-comms-persistence";
import {
  BANK_COMMS_DISCLOSURE_RULES,
  BANK_COMMS_RESTRICTED_WORDING,
  BANK_COMMS_SOURCES,
  getRegBankScenario,
  type RegBankScenario,
} from "@/lib/data/bank-comms-catalog";

// ─── Schémas ────────────────────────────────────────────────────────────────

export const GateResultSchema = z.object({
  gate_id: z.string(),
  label: z.string(),
  passed: z.boolean(),
  blocking: z.boolean(),
  reason: z.string().nullable(),
  offending_refs: z.array(z.string()),
});
export type GateResult = z.infer<typeof GateResultSchema>;

export const RegBankVerdictSchema = z.object({
  decision: z.enum(["PASS", "PASS_WITH_REVIEW", "BLOCK"]),
  blockers: z.array(z.string()).describe("gate_id des gates qui bloquent"),
  warnings: z.array(z.string()).describe("gate_id des gates non-bloquantes échouées"),
  gates: z.array(GateResultSchema),
  points_to_validate: z
    .array(z.string())
    .min(0)
    .max(8)
    .describe("Points à faire valider par le reviewer HITL."),
  suggested_rewrite: z
    .string()
    .nullable()
    .describe("Reformulation défendable, null si le draft passe déjà."),
  reviewer_comment: z
    .string()
    .describe("Commentaire synthétique pour la revue juridique / compliance."),
});
export type RegBankVerdict = z.infer<typeof RegBankVerdictSchema>;

// ─── Gates déterministes ────────────────────────────────────────────────────

type Draft = RegBankScenario["draft"];

function evaluatePrivilegedGate(draft: Draft): GateResult {
  const blocking = true;
  if (draft.contains_privileged_info) {
    return {
      gate_id: "GATE-PRIV",
      label: "Aucune information privilégiée non publique",
      passed: false,
      blocking,
      reason:
        "Le draft déclare contenir une information privilégiée non publique (flag contains_privileged_info=true). MAR Art. 7 / AMF Livre II.",
      offending_refs: ["contains_privileged_info"],
    };
  }
  return {
    gate_id: "GATE-PRIV",
    label: "Aucune information privilégiée non publique",
    passed: true,
    blocking,
    reason: null,
    offending_refs: [],
  };
}

function evaluateNumbersValidatedGate(draft: Draft): GateResult {
  const bad = draft.numbers.filter((n) => n.status !== "validated");
  return {
    gate_id: "GATE-NUM-VALIDATED",
    label: "Tous les chiffres marqués validated",
    passed: bad.length === 0,
    blocking: true,
    reason:
      bad.length === 0
        ? null
        : `Chiffres non validated : ${bad.map((b) => `${b.label} (${b.status})`).join(", ")}`,
    offending_refs: bad.map((b) => b.label),
  };
}

function evaluateSourceActiveGate(draft: Draft): GateResult {
  const activeIds = new Set(
    BANK_COMMS_SOURCES.filter((s) => s.status === "ACTIVE").map((s) => s.source_id),
  );
  const numbersMissingSource = draft.numbers.filter(
    (n) => !n.source_id || !activeIds.has(n.source_id),
  );
  const citedNotActive = draft.cited_sources.filter((id) => !activeIds.has(id));
  const passed = numbersMissingSource.length === 0 && citedNotActive.length === 0;
  const parts: string[] = [];
  if (numbersMissingSource.length) {
    parts.push(
      `Chiffres sans source ACTIVE : ${numbersMissingSource.map((n) => n.label).join(", ")}`,
    );
  }
  if (citedNotActive.length) {
    parts.push(`Sources citées non ACTIVE : ${citedNotActive.join(", ")}`);
  }
  return {
    gate_id: "GATE-SOURCE-ACTIVE",
    label: "Toute affirmation adossée à une source ACTIVE",
    passed,
    blocking: true,
    reason: passed ? null : parts.join(" | "),
    offending_refs: [
      ...numbersMissingSource.map((n) => n.label),
      ...citedNotActive,
    ],
  };
}

function evaluateWordingGate(draft: Draft): GateResult {
  const body = draft.body_fr.toLowerCase();
  const hits = BANK_COMMS_RESTRICTED_WORDING.filter((w) =>
    body.includes(w.term.toLowerCase()),
  );
  const critical = hits.filter((h) => h.severite === "CRITICAL" || h.severite === "HIGH");
  const passed = critical.length === 0;
  return {
    gate_id: "GATE-WORDING",
    label: "Aucun terme restreint sans qualifieur",
    passed,
    blocking: true,
    reason: passed
      ? null
      : `Termes restreints détectés : ${critical.map((c) => `"${c.term}" (${c.severite})`).join(", ")}`,
    offending_refs: critical.map((c) => c.term_id),
  };
}

export function runDeterministicGates(draft: Draft): GateResult[] {
  return [
    evaluatePrivilegedGate(draft),
    evaluateNumbersValidatedGate(draft),
    evaluateSourceActiveGate(draft),
    evaluateWordingGate(draft),
  ];
}

function decisionFromGates(gates: GateResult[]): RegBankVerdict["decision"] {
  const blocked = gates.some((g) => g.blocking && !g.passed);
  if (blocked) return "BLOCK";
  const anyFailed = gates.some((g) => !g.passed);
  return anyFailed ? "PASS_WITH_REVIEW" : "PASS";
}

// ─── Fallback déterministe ──────────────────────────────────────────────────

function fallbackVerdict(scenario: RegBankScenario): RegBankVerdict {
  const gates = runDeterministicGates(scenario.draft);
  const decision = decisionFromGates(gates);
  const blockers = gates.filter((g) => g.blocking && !g.passed).map((g) => g.gate_id);
  const warnings = gates.filter((g) => !g.blocking && !g.passed).map((g) => g.gate_id);

  const ptv: string[] = [];
  if (decision === "BLOCK") {
    ptv.push(
      `Ce draft est bloqué : ${blockers.join(", ")}. Corriger avant toute transmission au reviewer.`,
    );
  }
  if (scenario.draft.contains_privileged_info) {
    ptv.push(
      "Vérifier le calendrier de publication auprès de l'AMF (MAR Art. 17) avant toute diffusion.",
    );
  }
  const unvalidated = scenario.draft.numbers.filter((n) => n.status !== "validated");
  if (unvalidated.length) {
    ptv.push(
      `Obtenir validation finance pour : ${unvalidated.map((n) => n.label).join(", ")}.`,
    );
  }

  const suggestedRewrite =
    decision === "PASS"
      ? null
      : buildFallbackRewrite(scenario.draft, gates);

  const reviewer_comment =
    decision === "PASS"
      ? "Draft conforme aux gates MVP. À valider sur le fond par DirCom + Juridique."
      : `Decision: ${decision}. Blockers: ${blockers.join(", ") || "—"}. Warnings: ${warnings.join(", ") || "—"}.`;

  return {
    decision,
    blockers,
    warnings,
    gates,
    points_to_validate: ptv,
    suggested_rewrite: suggestedRewrite,
    reviewer_comment,
  };
}

function buildFallbackRewrite(draft: Draft, gates: GateResult[]): string {
  const issues = gates
    .filter((g) => !g.passed)
    .map((g) => `- [${g.gate_id}] ${g.reason ?? g.label}`)
    .join("\n");
  return [
    `# ${draft.title} — VERSION REVUE`,
    ``,
    `> ⚠ Draft bloqué par les gates suivantes, à corriger avant toute diffusion :`,
    issues,
    ``,
    `Corps original (${draft.period}) :`,
    draft.body_fr,
    ``,
    `Actions suggérées :`,
    `- Retirer ou qualifier les termes non conformes (cf. liste restricted_wording).`,
    `- N'insérer que des chiffres validés (status=validated) avec source_id ACTIVE.`,
    `- Si information privilégiée, geler la publication et coordonner avec AMF/ECB.`,
  ].join("\n");
}

// ─── Prompt LLM (enrichit le verdict avec rewrite + commentaire) ────────────

function buildSystemPrompt(gates: GateResult[]): string {
  const gateSummary = gates
    .map(
      (g) =>
        `- ${g.gate_id} (${g.blocking ? "bloquant" : "info"}) : ${g.passed ? "PASS" : `FAIL — ${g.reason}`}`,
    )
    .join("\n");

  const rules = BANK_COMMS_DISCLOSURE_RULES.filter((r) => r.blocking)
    .slice(0, 10)
    .map((r) => `- ${r.rule_id} [${r.severite}] ${r.champ_obligatoire} (${r.autorite})`)
    .join("\n");

  return `Tu es RegBankComms (AG-B001), l'agent NEURAL qui sécurise les communications bancaires régulées (résultats financiers, gouvernance, notices supervision) pour la France + UE.

CONTEXTE RÉGLEMENTAIRE
- Marchés : ACPR, AMF, EBA, ECB, ESMA, EUR-Lex (MAR), IFRS.
- Zero-tolerance sur info privilégiée non publique (MAR Art. 7 / AMF Livre II).
- Tous les chiffres publiés doivent être status=validated. Aucune prévision/estimation ne peut être diffusée sans disclaimer forward-looking.

RÈGLES DE DISCLOSURE CLÉS (blocantes) :
${rules}

RÉSULTATS DES GATES DÉTERMINISTES (source de vérité — tu ne peux pas les contredire) :
${gateSummary}

TON RÔLE
- Si les gates passent : produire un commentaire de revue synthétique (1-2 phrases) et laisser suggested_rewrite à null.
- Si une gate bloque : produire un suggested_rewrite qui respecte toutes les gates (sans inventer de chiffres ni de sources), et une liste points_to_validate (3-5 items actionnables pour le reviewer HITL).
- Ne JAMAIS déclarer PASS si un gate bloquant a échoué. decision/blockers/warnings/gates sont déjà calculés en amont et te sont fournis.

STYLE DU REWRITE
- Langue : français, registre communication financière sobre.
- Pas de superlatif non qualifié, pas de forward-looking sans disclaimer.
- Conserver uniquement les chiffres validated.`;
}

function buildUserPrompt(scenario: RegBankScenario, gates: GateResult[]): string {
  const numbersBlock = scenario.draft.numbers
    .map((n) => `  - ${n.label}: ${n.value} [status=${n.status}, source=${n.source_id ?? "—"}]`)
    .join("\n");

  return `SCÉNARIO : ${scenario.label}
Type : ${scenario.communication_type}${scenario.communication_subtype ? ` / ${scenario.communication_subtype}` : ""}
Période : ${scenario.draft.period}
Info privilégiée déclarée : ${scenario.draft.contains_privileged_info ? "OUI" : "non"}

TITRE : ${scenario.draft.title}

CORPS (FR) :
${scenario.draft.body_fr}

CHIFFRES CITÉS :
${numbersBlock || "  (aucun)"}

SOURCES CITÉES : ${scenario.draft.cited_sources.join(", ") || "(aucune)"}

Synthèse des gates (source de vérité) :
${gates.map((g) => `- ${g.gate_id}: ${g.passed ? "PASS" : "FAIL"}`).join("\n")}

Réponds en JSON strict selon le schéma fourni.`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

const MODEL: GatewayModelId = "anthropic/claude-sonnet-4.6";

export type RegBankMeta = {
  traceId: string;
  mode: "gateway" | "fallback";
  model?: string;
  latencyMs: number;
  scenarioId: string;
};

export async function checkRegBankScenario({
  scenarioId,
  userId,
}: {
  scenarioId: string;
  userId: string;
}): Promise<
  | { ok: true; result: RegBankVerdict; meta: RegBankMeta }
  | { ok: false; error: string }
> {
  const scenario = getRegBankScenario(scenarioId);
  if (!scenario) return { ok: false, error: `Scénario inconnu : ${scenarioId}` };

  const traceId = randomUUID();
  const startedAt = Date.now();

  // Gates déterministes d'abord. Le LLM n'a pas le droit de les contredire.
  const gates = runDeterministicGates(scenario.draft);
  const decision = decisionFromGates(gates);
  const blockers = gates.filter((g) => g.blocking && !g.passed).map((g) => g.gate_id);
  const warnings = gates.filter((g) => !g.blocking && !g.passed).map((g) => g.gate_id);

  // Persistance best-effort : historise dans AgentRun pour inbox HITL + audit.
  const finish = async (
    result: RegBankVerdict,
    mode: "gateway" | "fallback",
    model?: string,
  ): Promise<{ ok: true; result: RegBankVerdict; meta: RegBankMeta }> => {
    const latencyMs = Date.now() - startedAt;
    void persistBankCommsRun({
      traceId,
      agentSlug: "reg-bank-comms",
      scenarioId,
      decision: result.decision,
      mode,
      model,
      latencyMs,
      startedAtMs: startedAt,
      trace: { result, meta: { mode, model, latencyMs } },
    });
    return {
      ok: true,
      result,
      meta: { traceId, mode, model, latencyMs, scenarioId },
    };
  };

  if (!env.ai.gatewayReady) {
    return finish(fallbackVerdict(scenario), "fallback");
  }

  const langfuse = getLangfuseClient();
  const trace = langfuse?.trace({
    id: traceId,
    name: "reg-bank-comms",
    userId,
    tags: ["agent:reg-bank-comms", "sprint:1", `scenario:${scenarioId}`],
    input: { scenarioId, gates_failed: gates.filter((g) => !g.passed).length },
  });

  try {
    const { object, usage } = await generateObject({
      model: gateway(MODEL),
      schema: RegBankVerdictSchema,
      system: buildSystemPrompt(gates),
      prompt: buildUserPrompt(scenario, gates),
      temperature: 0.1,
      maxRetries: 2,
      providerOptions: {
        gateway: {
          order: ["anthropic", "openai"],
          user: userId,
          tags: ["product:neural", "surface:reg-bank-comms", `scenario:${scenarioId}`],
        },
      },
    });

    // Override : le LLM ne peut pas contredire les gates déterministes.
    const safeResult: RegBankVerdict = {
      ...object,
      decision,
      blockers,
      warnings,
      gates,
    };

    trace?.update({
      output: {
        decision: safeResult.decision,
        blockers: safeResult.blockers,
        warnings: safeResult.warnings,
      },
    });
    trace?.generation({
      name: "generate-object",
      model: MODEL,
      usage: usage
        ? { input: usage.inputTokens, output: usage.outputTokens, total: usage.totalTokens }
        : undefined,
    });
    void flushLangfuse();

    return finish(safeResult, "gateway", MODEL);
  } catch (err) {
     
    console.warn(
      "[reg-bank-comms] gateway error, fallback:",
      err instanceof Error ? err.message : err,
    );
    void flushLangfuse();
    return finish(fallbackVerdict(scenario), "fallback");
  }
}
