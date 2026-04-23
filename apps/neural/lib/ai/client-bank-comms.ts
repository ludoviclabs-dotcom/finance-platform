/**
 * NEURAL — AG-B004 ClientBankComms (Sprint 4)
 *
 * Vérifie un draft de communication client sensible contre 4 gates :
 *   - GATE-CLIENT-MENTIONS   (mentions légales obligatoires selon use_case)
 *   - GATE-CLIENT-CANAL      (char_limit + support html/links/attachments)
 *   - GATE-CLIENT-TON        (pas de termes absolus promotionnels)
 *   - GATE-CLIENT-LISIBILITE (score lisibilité ≥ seuil selon segment)
 *
 * Scenario-id uniquement (correctif #2). Le score de lisibilité utilise
 * une approximation Flesch-FR (Kandel & Moles) : phrases courtes + mots
 * courts = score élevé = plus lisible.
 */

import { randomUUID } from "node:crypto";

import { gateway, generateObject, type GatewayModelId } from "ai";
import { z } from "zod";

import { env } from "@/lib/env";
import { flushLangfuse, getLangfuseClient } from "@/lib/ai/langfuse";
import { persistBankCommsRun } from "@/lib/ai/bank-comms-persistence";
import {
  getClientChannel,
  getClientScenario,
  getClientSegment,
  getClientUseCase,
  getNoticesRequiredFor,
  type ClientScenario,
} from "@/lib/data/bank-comms-catalog";

// ─── Schema ──────────────────────────────────────────────────────────────────

export const ClientGateResultSchema = z.object({
  gate_id: z.string(),
  label: z.string(),
  passed: z.boolean(),
  blocking: z.boolean(),
  reason: z.string().nullable(),
});
export type ClientGateResult = z.infer<typeof ClientGateResultSchema>;

export const ClientVerdictSchema = z.object({
  decision: z.enum(["PASS", "PASS_WITH_REVIEW", "BLOCK"]),
  blockers: z.array(z.string()),
  warnings: z.array(z.string()),
  gates: z.array(ClientGateResultSchema),
  metrics: z.object({
    char_count: z.number(),
    char_limit: z.number().nullable(),
    reading_level_score: z.number(),
    reading_level_max: z.number(),
    missing_notices: z.array(z.string()),
    absolute_terms: z.array(z.string()),
  }),
  points_to_validate: z.array(z.string()).min(0).max(8),
  suggested_rewrite: z.string().nullable(),
  reviewer_comment: z.string(),
});
export type ClientVerdict = z.infer<typeof ClientVerdictSchema>;

// ─── Readability score (Flesch-FR approximation) ─────────────────────────────

function countSyllables(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-zàâäçéèêëîïôöùûüÿœæ]/g, "");
  if (!clean) return 0;
  const vowelGroups = clean.match(/[aeiouyàâäéèêëîïôöùûüÿœæ]+/g);
  return Math.max(1, vowelGroups?.length ?? 1);
}

function fleschFR(text: string): number {
  const sentences = Math.max(1, text.split(/[.!?]+/).filter((s) => s.trim()).length);
  const words = text.split(/\s+/).filter((w) => w.replace(/[^a-zA-Zàâäéèêëîïôöùûüÿœæ]/g, ""));
  const wordCount = Math.max(1, words.length);
  const syllables = words.reduce((acc, w) => acc + countSyllables(w), 0);
  // Flesch adapté FR (Kandel & Moles 1958) : 207 - 1.015*(W/S) - 73.6*(Sy/W)
  const score = 207 - 1.015 * (wordCount / sentences) - 73.6 * (syllables / wordCount);
  return Math.round(Math.max(0, Math.min(100, score)));
}

// ─── Gates déterministes ────────────────────────────────────────────────────

function mentionsGate(scenario: ClientScenario): {
  gate: ClientGateResult;
  missing: string[];
} {
  const required = getNoticesRequiredFor(scenario.use_case_id).map((n) => n.notice_id);
  const included = new Set(scenario.draft.notices_included);
  const missing = required.filter((id) => !included.has(id));
  return {
    gate: {
      gate_id: "GATE-CLIENT-MENTIONS",
      label: "Mentions légales obligatoires présentes",
      passed: missing.length === 0,
      blocking: true,
      reason:
        missing.length === 0
          ? null
          : `Mentions manquantes pour ${scenario.use_case_id} : ${missing.join(", ")}.`,
    },
    missing,
  };
}

function canalGate(scenario: ClientScenario): {
  gate: ClientGateResult;
  charCount: number;
  charLimit: number | null;
} {
  const channel = getClientChannel(scenario.canal);
  const charCount = scenario.draft.body_fr.length;
  if (!channel) {
    return {
      gate: {
        gate_id: "GATE-CLIENT-CANAL",
        label: "Canal reconnu",
        passed: false,
        blocking: true,
        reason: `Canal ${scenario.canal} non référencé dans la matrice.`,
      },
      charCount,
      charLimit: null,
    };
  }
  if (channel.char_limit !== null && charCount > channel.char_limit) {
    return {
      gate: {
        gate_id: "GATE-CLIENT-CANAL",
        label: "Limite de caractères du canal respectée",
        passed: false,
        blocking: true,
        reason: `Longueur ${charCount} chars > limite ${channel.char_limit} pour ${scenario.canal}.`,
      },
      charCount,
      charLimit: channel.char_limit,
    };
  }
  return {
    gate: {
      gate_id: "GATE-CLIENT-CANAL",
      label: "Limite de caractères respectée",
      passed: true,
      blocking: true,
      reason: null,
    },
    charCount,
    charLimit: channel.char_limit,
  };
}

const PROMOTIONAL_ABSOLUTES = [
  "sans aucun risque",
  "totalement révolutionnaire",
  "totalement révolutionnaires",
  "100 % sécurisé",
  "meilleure offre du marché",
  "opportunité unique",
  "excellente nouvelle",
  "immense plaisir",
  "offre exceptionnelle",
  "garantie absolue",
];

function tonGate(scenario: ClientScenario): {
  gate: ClientGateResult;
  detected: string[];
} {
  const lower = scenario.draft.body_fr.toLowerCase();
  const declared = scenario.draft.absolute_terms.map((t) => t.toLowerCase());
  const scanned = PROMOTIONAL_ABSOLUTES.filter((t) => lower.includes(t));
  const detected = Array.from(new Set([...declared, ...scanned]));
  return {
    gate: {
      gate_id: "GATE-CLIENT-TON",
      label: "Ton non promotionnel / non alarmiste",
      passed: detected.length === 0,
      blocking: true,
      reason:
        detected.length === 0
          ? null
          : `Termes absolus/promotionnels détectés : ${detected.map((t) => `"${t}"`).join(", ")}.`,
    },
    detected,
  };
}

function lisibiliteGate(scenario: ClientScenario): {
  gate: ClientGateResult;
  score: number;
  max: number;
} {
  const segment = getClientSegment(scenario.segment_id);
  const max = segment?.reading_level_max ?? 70;
  const score = fleschFR(scenario.draft.body_fr);
  // Flesch : plus haut = plus lisible. On veut score >= (100 - max_index).
  // Ici on adopte : score lisibilité doit être >= (100 - reading_level_max).
  // Convention simple : reading_level_max 70 → Flesch >= 30. Pour corporate (50), plus dense accepté.
  const threshold = Math.max(0, 100 - max);
  return {
    gate: {
      gate_id: "GATE-CLIENT-LISIBILITE",
      label: `Lisibilité adaptée au segment ${scenario.segment_id}`,
      passed: score >= threshold,
      blocking: false,
      reason:
        score >= threshold
          ? null
          : `Score Flesch FR ${score} < seuil ${threshold} pour segment ${scenario.segment_id}.`,
    },
    score,
    max,
  };
}

// ─── Decision ────────────────────────────────────────────────────────────────

function decisionFromGates(gates: ClientGateResult[]): ClientVerdict["decision"] {
  const blocked = gates.some((g) => g.blocking && !g.passed);
  if (blocked) return "BLOCK";
  const anyFailed = gates.some((g) => !g.passed);
  return anyFailed ? "PASS_WITH_REVIEW" : "PASS";
}

// ─── Fallback ────────────────────────────────────────────────────────────────

function fallbackVerdict(scenario: ClientScenario): ClientVerdict {
  const m = mentionsGate(scenario);
  const c = canalGate(scenario);
  const t = tonGate(scenario);
  const l = lisibiliteGate(scenario);
  const gates = [m.gate, c.gate, t.gate, l.gate];
  const decision = decisionFromGates(gates);
  const blockers = gates.filter((g) => g.blocking && !g.passed).map((g) => g.gate_id);
  const warnings = gates.filter((g) => !g.blocking && !g.passed).map((g) => g.gate_id);

  const ptv: string[] = [];
  if (m.missing.length) {
    ptv.push(
      `Ajouter les mentions légales manquantes : ${m.missing.join(", ")}.`,
    );
  }
  if (!c.gate.passed && c.charLimit !== null) {
    ptv.push(
      `Réduire le message sous ${c.charLimit} caractères (actuel : ${c.charCount}).`,
    );
  }
  if (t.detected.length) {
    ptv.push(
      `Retirer les formulations absolues : ${t.detected.map((x) => `"${x}"`).join(", ")}.`,
    );
  }
  if (!l.gate.passed) {
    ptv.push(
      `Simplifier la formulation (segment ${scenario.segment_id}) : phrases plus courtes, vocabulaire plus simple.`,
    );
  }

  const suggestedRewrite =
    decision === "PASS"
      ? null
      : buildFallbackRewrite(scenario, m.missing, t.detected);

  return {
    decision,
    blockers,
    warnings,
    gates,
    metrics: {
      char_count: c.charCount,
      char_limit: c.charLimit,
      reading_level_score: l.score,
      reading_level_max: l.max,
      missing_notices: m.missing,
      absolute_terms: t.detected,
    },
    points_to_validate: ptv,
    suggested_rewrite: suggestedRewrite,
    reviewer_comment:
      decision === "PASS"
        ? "Draft conforme : mentions présentes, canal respecté, ton neutre, lisibilité adaptée."
        : `Decision: ${decision}. Blockers: ${blockers.join(", ") || "—"}.`,
  };
}

function buildFallbackRewrite(
  scenario: ClientScenario,
  missing: string[],
  absolutes: string[],
): string {
  const uc = getClientUseCase(scenario.use_case_id);
  const lines = [
    `# ${scenario.draft.subject ?? scenario.label} — VERSION REVUE`,
    ``,
    `> Draft corrigé pour segment ${scenario.segment_id} · canal ${scenario.canal}.`,
    ``,
    `Madame, Monsieur,`,
    ``,
    scenario.draft.body_fr
      .replace(/Excellente nouvelle[^.]*\.?/gi, "")
      .replace(/immense plaisir[^.]*\.?/gi, "")
      .replace(/opportunité unique[^.]*\.?/gi, "")
      .replace(/sans aucun risque/gi, "dans les conditions prévues par votre contrat")
      .replace(/totalement révolutionnaires?/gi, "nouvelle génération")
      .trim(),
    ``,
  ];
  if (missing.length) {
    lines.push(`[À INSÉRER — mentions légales manquantes : ${missing.join(", ")}]`);
    lines.push(``);
  }
  if (absolutes.length) {
    lines.push(
      `[À RETIRER — formulations absolues à supprimer : ${absolutes.map((x) => `"${x}"`).join(", ")}]`,
    );
    lines.push(``);
  }
  if (uc) {
    lines.push(`Base légale : ${uc.base_legale}. Préavis : ${uc.preavis_jours} jours.`);
  }
  lines.push(``, `Cordialement,`, `Votre conseiller`);
  return lines.join("\n");
}

// ─── LLM enrichment ─────────────────────────────────────────────────────────

const MODEL: GatewayModelId = "anthropic/claude-sonnet-4.6";

function buildSystemPrompt(scenario: ClientScenario, baseline: ClientVerdict): string {
  const uc = getClientUseCase(scenario.use_case_id);
  const seg = getClientSegment(scenario.segment_id);
  const gateBlock = baseline.gates
    .map(
      (g) =>
        `- ${g.gate_id} (${g.blocking ? "bloquant" : "info"}) : ${g.passed ? "PASS" : `FAIL — ${g.reason}`}`,
    )
    .join("\n");
  return `Tu es ClientBankComms (AG-B004), l'agent NEURAL qui valide les communications clients sensibles (hausse tarifs, fermeture agence, incident, alerte fraude).

CONTEXTE
- Use case : ${uc?.label ?? scenario.use_case_id} — base légale : ${uc?.base_legale ?? "?"}
- Segment : ${seg?.label ?? scenario.segment_id} — ton attendu : ${seg?.ton ?? "neutre"}
- Canal : ${scenario.canal}

GATES (source de vérité) :
${gateBlock}

RÈGLES
- Ton neutre, factuel, empathique si incident. Pas de superlatif promotionnel.
- Respect des mentions légales obligatoires selon use_case.
- Respect du char_limit du canal.
- Lisibilité adaptée au segment.

TON RÔLE
- Produire un reviewer_comment synthétique.
- Si PASS : suggested_rewrite=null.
- Si BLOCK/PASS_WITH_REVIEW : produire un suggested_rewrite corrigé respectant TOUTES les gates.
- decision / blockers / warnings / gates / metrics sont déjà calculés serveur.`;
}

function buildUserPrompt(scenario: ClientScenario): string {
  return `SUJET : ${scenario.draft.subject ?? "(aucun)"}

CORPS :
${scenario.draft.body_fr}

Mentions incluses déclarées : ${scenario.draft.notices_included.join(", ") || "(aucune)"}
Termes absolus déclarés : ${scenario.draft.absolute_terms.join(", ") || "(aucun)"}

Réponds en JSON strict selon le schéma.`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

export type ClientMeta = {
  traceId: string;
  mode: "gateway" | "fallback";
  model?: string;
  latencyMs: number;
  scenarioId: string;
};

export async function checkClientScenario({
  scenarioId,
  userId,
}: {
  scenarioId: string;
  userId: string;
}): Promise<
  | { ok: true; result: ClientVerdict; meta: ClientMeta }
  | { ok: false; error: string }
> {
  const scenario = getClientScenario(scenarioId);
  if (!scenario) return { ok: false, error: `Scénario inconnu : ${scenarioId}` };

  const traceId = randomUUID();
  const startedAt = Date.now();
  const baseline = fallbackVerdict(scenario);

  const finish = async (
    result: ClientVerdict,
    mode: "gateway" | "fallback",
    model?: string,
  ): Promise<{ ok: true; result: ClientVerdict; meta: ClientMeta }> => {
    const latencyMs = Date.now() - startedAt;
    void persistBankCommsRun({
      traceId,
      agentSlug: "client-bank-comms",
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
    name: "client-bank-comms",
    userId,
    tags: ["agent:client-bank-comms", "sprint:4", `scenario:${scenarioId}`],
    input: {
      scenarioId,
      canal: scenario.canal,
      segment: scenario.segment_id,
      use_case: scenario.use_case_id,
    },
  });

  try {
    const { object, usage } = await generateObject({
      model: gateway(MODEL),
      schema: ClientVerdictSchema,
      system: buildSystemPrompt(scenario, baseline),
      prompt: buildUserPrompt(scenario),
      temperature: 0.1,
      maxRetries: 2,
      providerOptions: {
        gateway: {
          order: ["anthropic", "openai"],
          user: userId,
          tags: ["product:neural", "surface:client-bank-comms", `scenario:${scenarioId}`],
        },
      },
    });

    const safe: ClientVerdict = {
      ...object,
      decision: baseline.decision,
      blockers: baseline.blockers,
      warnings: baseline.warnings,
      gates: baseline.gates,
      metrics: baseline.metrics,
    };

    trace?.update({ output: { decision: safe.decision, blockers: safe.blockers } });
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
    // eslint-disable-next-line no-console
    console.warn(
      "[client-bank-comms] gateway error, fallback:",
      err instanceof Error ? err.message : err,
    );
    void flushLangfuse();
    return finish(baseline, "fallback");
  }
}
