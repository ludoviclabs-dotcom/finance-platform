/**
 * NEURAL — Banque / Communication catalog (Sprint 0 — scaffold)
 *
 * Source de vérité pour la branche Banque / Communication.
 * Miroir du pattern `luxe-comms-catalog.ts` :
 *   - charge les JSON gelés depuis content/bank-comms/
 *   - expose des parsers safe (Zod)
 *   - expose un résumé consommable par la page secteur
 *
 * En Sprint 0 les JSON sont des squelettes minimaux. Les vraies données
 * arrivent dans Sprint 1 via `scripts/sync-bank-comms.ts` à partir de
 * `data/bank-comms/*.xlsx`.
 *
 * IMPORTANT :
 *   - module server-side (import de .json)
 *   - IDs stables : `AG-B00N`, `SRC-{AUTORITE}-NNN`, `RUL-{TYPE}-NNN`, `GATE-*`
 *   - garder le fichier réduit en Sprint 0 ; enrichir au fur et à mesure que
 *     les workbooks atterrissent.
 */

import { z } from "zod";

import manifestJson from "@/content/bank-comms/_manifest.json";
import foundationsJson from "@/content/bank-comms/foundations.json";
import masterJson from "@/content/bank-comms/master.json";
import agb001Json from "@/content/bank-comms/agb001-regbank.json";

// ─── CONSTS ──────────────────────────────────────────────────────────────────

export const BANK_COMMS_AGENT_SLUGS = [
  "reg-bank-comms",
  "bank-crisis-comms",
  "esg-bank-comms",
  "client-bank-comms",
] as const;
export type BankCommsAgentSlug = (typeof BANK_COMMS_AGENT_SLUGS)[number];

export const BANK_COMMS_SERVICE_SLUGS = [
  "reg-watch-bank",
  "bank-evidence-guard",
] as const;
export type BankCommsServiceSlug = (typeof BANK_COMMS_SERVICE_SLUGS)[number];

// ─── SCHEMAS (strict = false au Sprint 0 pour tolérer l'itération workbook) ──

const AgentRegistryRowSchema = z.object({
  agent_id: z.string(),
  slug: z.string(),
  name: z.string(),
  type: z.enum(["agent", "service"]),
  priority: z.enum(["MVP", "V1", "V2"]),
  sla_h: z.number().nullable(),
  owner: z.string(),
  status: z.enum(["planned", "demo", "live"]),
});
export type AgentRegistryRow = z.infer<typeof AgentRegistryRowSchema>;

const WorkflowStepSchema = z.object({
  step: z.number(),
  stage: z.string(),
  owner: z.string(),
  outcome: z.string(),
});
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

const ReviewGateSchema = z.object({
  gate_id: z.string(),
  label: z.string(),
  stage: z.string(),
  blocking: z.boolean(),
});
export type ReviewGate = z.infer<typeof ReviewGateSchema>;

const RiskRowSchema = z.object({
  risk_id: z.string(),
  label: z.string(),
  impact: z.number(),
  probabilite: z.number(),
  score: z.number(),
  mitigation: z.string(),
});
export type RiskRow = z.infer<typeof RiskRowSchema>;

const SourceRowSchema = z.object({
  source_id: z.string(),
  autorite: z.string(),
  titre: z.string(),
  url: z.string().nullable(),
  juridiction: z.string(),
  status: z.string(),
  owner: z.string(),
  review_date: z.string().nullable(),
  note: z.string().nullable(),
});
export type SourceRow = z.infer<typeof SourceRowSchema>;

const DisclosureRuleRowSchema = z.object({
  rule_id: z.string(),
  communication_type: z.string(),
  champ_obligatoire: z.string(),
  jurisdiction: z.string(),
  autorite: z.string(),
  severite: z.string(),
  blocking: z.boolean(),
  note: z.string().nullable(),
});
export type DisclosureRuleRow = z.infer<typeof DisclosureRuleRowSchema>;

const RestrictedWordingSchema = z.object({
  term_id: z.string(),
  term: z.string(),
  severite: z.string(),
  reason: z.string(),
});
export type RestrictedWording = z.infer<typeof RestrictedWordingSchema>;

const ScenarioNumberSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  status: z.enum(["validated", "unvalidated", "estimate", "forecast"]),
  source_id: z.string().nullable(),
});

const ScenarioDraftSchema = z.object({
  title: z.string(),
  period: z.string(),
  body_fr: z.string(),
  numbers: z.array(ScenarioNumberSchema),
  cited_sources: z.array(z.string()),
  contains_privileged_info: z.boolean(),
});

const ScenarioSchema = z.object({
  scenario_id: z.string(),
  label: z.string(),
  communication_type: z.string(),
  communication_subtype: z.string().nullable(),
  expected_verdict: z.enum(["PASS", "PASS_WITH_REVIEW", "BLOCK"]),
  expected_blockers: z.array(z.string()),
  draft: ScenarioDraftSchema,
});
export type RegBankScenario = z.infer<typeof ScenarioSchema>;

// ─── PARSERS SAFE ────────────────────────────────────────────────────────────

function safeParseArray<T>(
  schema: z.ZodSchema<T>,
  raw: unknown,
  label: string,
): T[] {
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  for (const [idx, row] of raw.entries()) {
    const parsed = schema.safeParse(row);
    if (parsed.success) out.push(parsed.data);
    else if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(`[bank-comms-catalog] ${label}[${idx}] skipped:`, parsed.error.issues);
    }
  }
  return out;
}

// ─── ACCESSORS ───────────────────────────────────────────────────────────────

const masterData = (masterJson as { data: Record<string, unknown> }).data ?? {};
const foundationsData = (foundationsJson as { data: Record<string, unknown> }).data ?? {};

export const BANK_COMMS_AGENT_REGISTRY: AgentRegistryRow[] = safeParseArray(
  AgentRegistryRowSchema,
  masterData["2_AGENT_REGISTRY"],
  "agent_registry",
);

export const BANK_COMMS_WORKFLOW: WorkflowStep[] = safeParseArray(
  WorkflowStepSchema,
  masterData["3_WORKFLOW_MAP"],
  "workflow_map",
);

export const BANK_COMMS_GATES: ReviewGate[] = safeParseArray(
  ReviewGateSchema,
  masterData["5_REVIEW_GATES"],
  "review_gates",
);

export const BANK_COMMS_RISKS: RiskRow[] = safeParseArray(
  RiskRowSchema,
  masterData["6_RISK_REGISTER"],
  "risk_register",
);

export const BANK_COMMS_SOURCES: SourceRow[] = safeParseArray(
  SourceRowSchema,
  foundationsData["2_SOURCEBOOK"],
  "sourcebook",
);

export const BANK_COMMS_DISCLOSURE_RULES: DisclosureRuleRow[] = safeParseArray(
  DisclosureRuleRowSchema,
  foundationsData["3_DISCLOSURE_RULES"],
  "disclosure_rules",
);

export const BANK_COMMS_RESTRICTED_WORDING: RestrictedWording[] = safeParseArray(
  RestrictedWordingSchema,
  foundationsData["7_RESTRICTED_WORDING"],
  "restricted_wording",
);

const agb001Data = (agb001Json as { data: Record<string, unknown> }).data ?? {};

export const REG_BANK_SCENARIOS: RegBankScenario[] = safeParseArray(
  ScenarioSchema,
  agb001Data["4_DRAFT_TESTSET"],
  "regbank_scenarios",
);

export function getRegBankScenario(id: string): RegBankScenario | undefined {
  return REG_BANK_SCENARIOS.find((s) => s.scenario_id === id);
}

// ─── SÉLECTEURS MÉTIER ───────────────────────────────────────────────────────

export function getPublicAgents(): AgentRegistryRow[] {
  return BANK_COMMS_AGENT_REGISTRY.filter((a) => a.type === "agent");
}

export function getTransverseServices(): AgentRegistryRow[] {
  return BANK_COMMS_AGENT_REGISTRY.filter((a) => a.type === "service");
}

export function getAgentBySlug(slug: string): AgentRegistryRow | undefined {
  return BANK_COMMS_AGENT_REGISTRY.find((a) => a.slug === slug);
}

// ─── SUMMARY EXPOSÉ À LA PAGE SECTEUR ────────────────────────────────────────

export const BANK_COMMS_SUMMARY = {
  vertical: "banque × communication",
  sprint: "Sprint 0 — scaffold",
  manifest: manifestJson,
  agents: getPublicAgents(),
  services: getTransverseServices(),
  workflow: BANK_COMMS_WORKFLOW,
  gates: BANK_COMMS_GATES,
  risks: BANK_COMMS_RISKS,
  sources_count: BANK_COMMS_SOURCES.length,
  rules_count: BANK_COMMS_DISCLOSURE_RULES.length,
  scenarios_count: REG_BANK_SCENARIOS.length,
  readiness: {
    workbooks_built: false,
    demo_live: true,
    regulatory_watch_branch: false,
    export_pack_ready: false,
  },
} as const;
