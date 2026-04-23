/**
 * NEURAL — AG-B002 BankCrisisComms (Sprint 2)
 *
 * Vérifie un draft de communication de crise bancaire contre 4 gates
 * déterministes spécifiques crise :
 *   - GATE-CRISIS-ROOT-CAUSE       (interdit d'énoncer une cause racine non confirmée)
 *   - GATE-CRISIS-APPROVED-MESSAGE (le corps doit dériver d'un holding statement
 *                                  de la bibliothèque approuvée pour ce type)
 *   - GATE-CRISIS-REMEDIATION      (aucun engagement de remédiation chiffré/daté
 *                                  sans approbation explicite)
 *   - GATE-CRISIS-SLA              (publication initiale avant échéance SLA pour
 *                                  le niveau de sévérité)
 *
 * Mode d'entrée : scenario-id uniquement (correctif #2 du blueprint).
 * Fallback : si AI Gateway absent, renvoie le verdict déterministe +
 * reformulation templated.
 */

import { randomUUID } from "node:crypto";

import { gateway, generateObject, type GatewayModelId } from "ai";
import { z } from "zod";

import { env } from "@/lib/env";
import { flushLangfuse, getLangfuseClient } from "@/lib/ai/langfuse";
import { persistBankCommsRun } from "@/lib/ai/bank-comms-persistence";
import {
  getCrisisScenario,
  getCrisisTimer,
  getHoldingStatementsFor,
  type BankCrisisScenario,
  type HoldingStatement,
} from "@/lib/data/bank-comms-catalog";

// ─── Schema ─────────────────────────────────────────────────────────────────

export const CrisisGateResultSchema = z.object({
  gate_id: z.string(),
  label: z.string(),
  passed: z.boolean(),
  blocking: z.boolean(),
  reason: z.string().nullable(),
});
export type CrisisGateResult = z.infer<typeof CrisisGateResultSchema>;

export const CrisisVerdictSchema = z.object({
  decision: z.enum(["PASS", "PASS_WITH_REVIEW", "BLOCK"]),
  blockers: z.array(z.string()),
  warnings: z.array(z.string()),
  gates: z.array(CrisisGateResultSchema),
  sla: z.object({
    severity: z.string(),
    deadline_minutes: z.number(),
    elapsed_minutes: z.number(),
    overdue: z.boolean(),
  }),
  recommended_statement_id: z.string().nullable(),
  points_to_validate: z.array(z.string()).min(0).max(8),
  suggested_rewrite: z.string().nullable(),
  reviewer_comment: z.string(),
});
export type CrisisVerdict = z.infer<typeof CrisisVerdictSchema>;

// ─── Gates ───────────────────────────────────────────────────────────────────

type Draft = BankCrisisScenario["draft"];

function rootCauseGate(draft: Draft): CrisisGateResult {
  return {
    gate_id: "GATE-CRISIS-ROOT-CAUSE",
    label: "Pas de cause racine énoncée sans confirmation",
    passed: !draft.root_cause_stated,
    blocking: true,
    reason: draft.root_cause_stated
      ? "Le draft énonce une cause racine (root_cause_stated=true). Interdit tant que non confirmée par investigation technique + juridique."
      : null,
  };
}

function approvedMessageGate(
  draft: Draft,
  statements: HoldingStatement[],
): CrisisGateResult {
  const ok =
    draft.uses_approved_message &&
    !!draft.matched_statement_id &&
    statements.some((s) => s.statement_id === draft.matched_statement_id);
  return {
    gate_id: "GATE-CRISIS-APPROVED-MESSAGE",
    label: "Message dérivé de la bibliothèque approuvée",
    passed: ok,
    blocking: true,
    reason: ok
      ? null
      : `Aucun holding statement pré-approuvé référencé (matched_statement_id=${draft.matched_statement_id ?? "null"}). ${statements.length} statements disponibles pour ce type d'incident.`,
  };
}

function remediationGate(draft: Draft): CrisisGateResult {
  const hasCommit =
    typeof draft.remediation_commitment === "string" &&
    draft.remediation_commitment.trim().length > 0;
  // Engagement autorisé uniquement si coord régulateur confirmée (assumption trust-first).
  const passed = !hasCommit || draft.regulator_coord_confirmed;
  return {
    gate_id: "GATE-CRISIS-REMEDIATION",
    label: "Pas d'engagement de remédiation sans validation",
    passed,
    blocking: true,
    reason: passed
      ? null
      : `Engagement "${draft.remediation_commitment}" détecté sans coordination régulateur confirmée.`,
  };
}

function slaGate(
  draft: Draft,
  severity: BankCrisisScenario["severity"],
): { gate: CrisisGateResult; elapsed: number; deadline: number } {
  const timer = getCrisisTimer(severity);
  const deadline = timer?.sla_minutes_initial ?? 240;
  const elapsed = draft.minutes_since_incident;
  const overdue = elapsed > deadline;
  return {
    gate: {
      gate_id: "GATE-CRISIS-SLA",
      label: `Publication initiale avant échéance SLA (${severity})`,
      passed: !overdue,
      blocking: false,
      reason: overdue
        ? `SLA dépassé : ${elapsed} min écoulées vs. ${deadline} min autorisées pour ${severity}.`
        : null,
    },
    elapsed,
    deadline,
  };
}

export function runCrisisGates(
  scenario: BankCrisisScenario,
): { gates: CrisisGateResult[]; sla: CrisisVerdict["sla"] } {
  const statements = getHoldingStatementsFor(scenario.incident_type);
  const sla = slaGate(scenario.draft, scenario.severity);
  const gates = [
    rootCauseGate(scenario.draft),
    approvedMessageGate(scenario.draft, statements),
    remediationGate(scenario.draft),
    sla.gate,
  ];
  return {
    gates,
    sla: {
      severity: scenario.severity,
      deadline_minutes: sla.deadline,
      elapsed_minutes: sla.elapsed,
      overdue: !sla.gate.passed,
    },
  };
}

function decisionFromGates(gates: CrisisGateResult[]): CrisisVerdict["decision"] {
  const blocked = gates.some((g) => g.blocking && !g.passed);
  if (blocked) return "BLOCK";
  const anyFailed = gates.some((g) => !g.passed);
  return anyFailed ? "PASS_WITH_REVIEW" : "PASS";
}

// ─── Fallback ────────────────────────────────────────────────────────────────

function fallbackVerdict(scenario: BankCrisisScenario): CrisisVerdict {
  const { gates, sla } = runCrisisGates(scenario);
  const decision = decisionFromGates(gates);
  const blockers = gates.filter((g) => g.blocking && !g.passed).map((g) => g.gate_id);
  const warnings = gates.filter((g) => !g.blocking && !g.passed).map((g) => g.gate_id);
  const statements = getHoldingStatementsFor(scenario.incident_type);
  const recommended = statements[0]?.statement_id ?? null;

  const ptv: string[] = [];
  if (scenario.draft.root_cause_stated) {
    ptv.push(
      "Retirer toute mention de cause racine tant que non confirmée par CISO + Juridique.",
    );
  }
  if (!scenario.draft.uses_approved_message) {
    ptv.push(
      `Repartir du holding statement pré-approuvé (${recommended ?? "à sélectionner dans la bibliothèque"}) plutôt que rédiger ex nihilo.`,
    );
  }
  if (scenario.draft.remediation_commitment && !scenario.draft.regulator_coord_confirmed) {
    ptv.push(
      "Retirer l'engagement de remédiation ou obtenir coord régulateur + validation juridique avant diffusion.",
    );
  }
  if (sla.overdue) {
    ptv.push(
      `Publication initiale en retard (${sla.elapsed_minutes}/${sla.deadline_minutes} min). Escalader cellule de crise niveau 3.`,
    );
  }

  let suggestedRewrite: string | null = null;
  if (decision === "BLOCK" && recommended) {
    const s = statements.find((st) => st.statement_id === recommended);
    if (s) {
      suggestedRewrite = `# ${s.title} — SUGGESTION DÉRIVÉE\n\n${s.body}\n\n---\n\n_Base : ${s.statement_id}, approuvé par ${s.approver} le ${s.approved_at}. Adapter le nom du service si nécessaire, ne rien ajouter d'autre avant validation juridique._`;
    }
  }

  return {
    decision,
    blockers,
    warnings,
    gates,
    sla,
    recommended_statement_id: recommended,
    points_to_validate: ptv,
    suggested_rewrite: suggestedRewrite,
    reviewer_comment:
      decision === "PASS"
        ? `Draft conforme aux gates crise ; SLA ${sla.elapsed_minutes}/${sla.deadline_minutes} min. Prêt pour revue humaine finale.`
        : `Décision: ${decision}. Blockers: ${blockers.join(", ") || "—"}. SLA ${sla.elapsed_minutes}/${sla.deadline_minutes} min${sla.overdue ? " (dépassé)" : ""}.`,
  };
}

// ─── LLM enrichment ─────────────────────────────────────────────────────────

function buildSystemPrompt(
  scenario: BankCrisisScenario,
  gates: CrisisGateResult[],
  statements: HoldingStatement[],
): string {
  const gateBlock = gates
    .map(
      (g) =>
        `- ${g.gate_id} (${g.blocking ? "bloquant" : "info"}) : ${g.passed ? "PASS" : `FAIL — ${g.reason}`}`,
    )
    .join("\n");
  const libBlock = statements
    .map((s) => `- ${s.statement_id} (${s.lang}, approuvé par ${s.approver})`)
    .join("\n");
  return `Tu es BankCrisisComms (AG-B002). Tu sécurises la communication de crise bancaire (cyber, fuite de données, rumeur liquidité, sanction, indisponibilité service).

CONTRAT
- Aucune cause racine ne peut être publiée sans confirmation CISO + Juridique.
- Les messages doivent dériver de la bibliothèque d'holding statements pré-approuvés.
- Aucun engagement de remédiation chiffré/daté sans coordination régulateur (ACPR / ECB) + Juridique.
- Le SLA publication initiale dépend du niveau de sévérité (SEV0 < SEV1 < SEV2 < SEV3).

CONTEXTE SCÉNARIO
- Incident : ${scenario.incident_type} · Sévérité : ${scenario.severity}
- Minutes depuis l'incident : ${scenario.draft.minutes_since_incident}

GATES (source de vérité, tu ne peux pas les contredire) :
${gateBlock}

HOLDING STATEMENTS PRÉ-APPROUVÉS pour ${scenario.incident_type} :
${libBlock || "- (aucun)"}

TON RÔLE
- Produire un reviewer_comment court et actionnable.
- Si décision BLOCK : proposer un suggested_rewrite dérivé du holding statement le plus pertinent, avec uniquement les faits confirmés et sans engagement non validé.
- Recommander un statement_id si applicable.
- decision / blockers / warnings / gates / sla sont déjà calculés côté serveur et te sont fournis : ne les réécris pas.`;
}

function buildUserPrompt(scenario: BankCrisisScenario): string {
  const d = scenario.draft;
  return `SCÉNARIO : ${scenario.label}

TITRE : ${d.title}

CORPS :
${d.body_fr}

FLAGS :
- root_cause_stated : ${d.root_cause_stated}
- uses_approved_message : ${d.uses_approved_message}
- matched_statement_id : ${d.matched_statement_id ?? "null"}
- regulator_coord_confirmed : ${d.regulator_coord_confirmed}
- remediation_commitment : ${d.remediation_commitment ?? "null"}

Réponds en JSON strict selon le schéma.`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

const MODEL: GatewayModelId = "anthropic/claude-sonnet-4.6";

export type CrisisMeta = {
  traceId: string;
  mode: "gateway" | "fallback";
  model?: string;
  latencyMs: number;
  scenarioId: string;
};

export async function checkCrisisScenario({
  scenarioId,
  userId,
}: {
  scenarioId: string;
  userId: string;
}): Promise<
  | { ok: true; result: CrisisVerdict; meta: CrisisMeta }
  | { ok: false; error: string }
> {
  const scenario = getCrisisScenario(scenarioId);
  if (!scenario) return { ok: false, error: `Scénario inconnu : ${scenarioId}` };

  const traceId = randomUUID();
  const startedAt = Date.now();
  const { gates, sla } = runCrisisGates(scenario);
  const decision = decisionFromGates(gates);
  const blockers = gates.filter((g) => g.blocking && !g.passed).map((g) => g.gate_id);
  const warnings = gates.filter((g) => !g.blocking && !g.passed).map((g) => g.gate_id);
  const statements = getHoldingStatementsFor(scenario.incident_type);
  const recommended = statements[0]?.statement_id ?? null;

  const finish = async (
    result: CrisisVerdict,
    mode: "gateway" | "fallback",
    model?: string,
  ): Promise<{ ok: true; result: CrisisVerdict; meta: CrisisMeta }> => {
    const latencyMs = Date.now() - startedAt;
    void persistBankCommsRun({
      traceId,
      agentSlug: "bank-crisis-comms",
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
    return finish(fallbackVerdict(scenario), "fallback");
  }

  const langfuse = getLangfuseClient();
  const trace = langfuse?.trace({
    id: traceId,
    name: "bank-crisis-comms",
    userId,
    tags: ["agent:bank-crisis-comms", "sprint:2", `scenario:${scenarioId}`],
    input: { scenarioId, severity: scenario.severity },
  });

  try {
    const { object, usage } = await generateObject({
      model: gateway(MODEL),
      schema: CrisisVerdictSchema,
      system: buildSystemPrompt(scenario, gates, statements),
      prompt: buildUserPrompt(scenario),
      temperature: 0.1,
      maxRetries: 2,
      providerOptions: {
        gateway: {
          order: ["anthropic", "openai"],
          user: userId,
          tags: ["product:neural", "surface:bank-crisis", `scenario:${scenarioId}`],
        },
      },
    });

    // Override : gates, sla, decision sont source de vérité serveur.
    const safe: CrisisVerdict = {
      ...object,
      decision,
      blockers,
      warnings,
      gates,
      sla,
      recommended_statement_id: recommended,
    };

    trace?.update({ output: { decision, blockers, warnings } });
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
      "[bank-crisis-comms] gateway error, fallback:",
      err instanceof Error ? err.message : err,
    );
    void flushLangfuse();
    return finish(fallbackVerdict(scenario), "fallback");
  }
}
