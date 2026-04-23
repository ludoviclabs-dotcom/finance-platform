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
import agb002Json from "@/content/bank-comms/agb002-crisis.json";
import agb003Json from "@/content/bank-comms/agb003-esg.json";
import agb004Json from "@/content/bank-comms/agb004-client.json";
import agb005Json from "@/content/bank-comms/agb005-regwatch.json";

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

// ─── AG-B002 BankCrisis ──────────────────────────────────────────────────────

const CrisisDraftSchema = z.object({
  title: z.string(),
  body_fr: z.string(),
  root_cause_stated: z.boolean(),
  uses_approved_message: z.boolean(),
  matched_statement_id: z.string().nullable(),
  regulator_coord_confirmed: z.boolean(),
  remediation_commitment: z.string().nullable(),
  minutes_since_incident: z.number(),
});

const CrisisScenarioSchema = z.object({
  scenario_id: z.string(),
  label: z.string(),
  incident_type: z.enum([
    "CYBER",
    "DATA_LEAK",
    "LIQUIDITY_RUMOR",
    "SANCTION",
    "SERVICE_OUTAGE",
  ]),
  severity: z.enum(["SEV0", "SEV1", "SEV2", "SEV3"]),
  expected_verdict: z.enum(["PASS", "PASS_WITH_REVIEW", "BLOCK"]),
  expected_blockers: z.array(z.string()),
  draft: CrisisDraftSchema,
});
export type BankCrisisScenario = z.infer<typeof CrisisScenarioSchema>;

const CrisisCatalogSchema = z.object({
  scenario_id: z.string(),
  label: z.string(),
  severity_default: z.string(),
  sla_minutes_initial: z.number(),
  regulator_coord_required: z.boolean(),
});
export type CrisisCatalogEntry = z.infer<typeof CrisisCatalogSchema>;

const HoldingStatementSchema = z.object({
  statement_id: z.string(),
  scenario_id: z.string(),
  lang: z.string(),
  title: z.string(),
  body: z.string(),
  approver: z.string(),
  approved_at: z.string(),
});
export type HoldingStatement = z.infer<typeof HoldingStatementSchema>;

const CrisisTimerSchema = z.object({
  severity: z.string(),
  sla_minutes_initial: z.number(),
  reassess_every_minutes: z.number(),
});
export type CrisisTimer = z.infer<typeof CrisisTimerSchema>;

const crisisData = (agb002Json as { data: Record<string, unknown> }).data ?? {};

export const BANK_CRISIS_CATALOG: CrisisCatalogEntry[] = safeParseArray(
  CrisisCatalogSchema,
  crisisData["1_SCENARIO_CATALOG"],
  "crisis_catalog",
);

export const BANK_CRISIS_HOLDING_STATEMENTS: HoldingStatement[] = safeParseArray(
  HoldingStatementSchema,
  crisisData["2_HOLDING_STATEMENTS"],
  "holding_statements",
);

export const BANK_CRISIS_TIMERS: CrisisTimer[] = safeParseArray(
  CrisisTimerSchema,
  crisisData["5_CRISIS_TIMER"],
  "crisis_timers",
);

export const BANK_CRISIS_SCENARIOS: BankCrisisScenario[] = safeParseArray(
  CrisisScenarioSchema,
  crisisData["6_TESTSET"],
  "crisis_scenarios",
);

export function getCrisisScenario(id: string): BankCrisisScenario | undefined {
  return BANK_CRISIS_SCENARIOS.find((s) => s.scenario_id === id);
}

export function getHoldingStatementsFor(incidentType: string): HoldingStatement[] {
  return BANK_CRISIS_HOLDING_STATEMENTS.filter(
    (s) => s.scenario_id === incidentType,
  );
}

export function getCrisisTimer(severity: string): CrisisTimer | undefined {
  return BANK_CRISIS_TIMERS.find((t) => t.severity === severity);
}

// ─── AG-B003 ESGBankComms ────────────────────────────────────────────────────

const EsgClaimLibSchema = z.object({
  lib_id: z.string(),
  pattern: z.string(),
  wording_type: z.enum(["ABSOLUTE", "QUALIFIED", "COMPARATIVE"]),
  autorisation: z.enum(["INTERDIT", "REVIEW", "AUTORISE_SI_PROUVE", "AUTORISE"]),
  evidence_required: z.boolean(),
  note: z.string().nullable(),
});
export type EsgClaim = z.infer<typeof EsgClaimLibSchema>;

const EsgEvidenceSchema = z.object({
  evidence_id: z.string(),
  claim_pattern: z.string(),
  source_id: z.string(),
  titre: z.string(),
  valeur: z.string(),
  perimetre: z.string(),
  annee: z.number(),
  expiry_date: z.string().nullable(),
  status: z.enum(["ACTIVE", "STALE", "REJECTED", "MISSING"]),
});
export type EsgEvidence = z.infer<typeof EsgEvidenceSchema>;

const EsgJurisdictionVerdictSchema = z.object({
  claim_pattern: z.string(),
  fr: z.string(),
  eu: z.string(),
  note: z.string().nullable(),
});
export type EsgJurisdictionVerdict = z.infer<typeof EsgJurisdictionVerdictSchema>;

const EsgScenarioDraftSchema = z.object({
  claim_text: z.string(),
  jurisdiction: z.enum(["FR", "EU"]),
});

const EsgScenarioSchema = z.object({
  scenario_id: z.string(),
  label: z.string(),
  expected_verdict: z.enum(["PASS", "PASS_WITH_REVIEW", "BLOCK"]),
  expected_blockers: z.array(z.string()),
  draft: EsgScenarioDraftSchema,
});
export type EsgScenario = z.infer<typeof EsgScenarioSchema>;

const esgData = (agb003Json as { data: Record<string, unknown> }).data ?? {};

export const ESG_CLAIM_LIBRARY: EsgClaim[] = safeParseArray(
  EsgClaimLibSchema,
  esgData["2_CLAIM_LIBRARY"],
  "esg_claim_library",
);

export const ESG_EVIDENCE_REGISTRY: EsgEvidence[] = safeParseArray(
  EsgEvidenceSchema,
  esgData["3_EVIDENCE_REGISTRY"],
  "esg_evidence",
);

export const ESG_JURISDICTION_VERDICTS: EsgJurisdictionVerdict[] = safeParseArray(
  EsgJurisdictionVerdictSchema,
  esgData["4_JURISDICTION_VERDICTS"],
  "esg_jurisdiction",
);

export const ESG_SCENARIOS: EsgScenario[] = safeParseArray(
  EsgScenarioSchema,
  esgData["5_TESTSET"],
  "esg_scenarios",
);

export function getEsgScenario(id: string): EsgScenario | undefined {
  return ESG_SCENARIOS.find((s) => s.scenario_id === id);
}

/** Matching basique : retourne les patterns de la library détectés dans le claim text. */
export function matchEsgPatterns(claimText: string): EsgClaim[] {
  const lower = claimText.toLowerCase();
  return ESG_CLAIM_LIBRARY.filter((c) => lower.includes(c.pattern.toLowerCase()));
}

/** Retourne l'evidence la plus récente pour un pattern. */
export function bestEvidenceFor(pattern: string): EsgEvidence | undefined {
  const candidates = ESG_EVIDENCE_REGISTRY.filter(
    (e) => e.claim_pattern === pattern,
  );
  if (!candidates.length) return undefined;
  return candidates.sort((a, b) => b.annee - a.annee)[0];
}

// ─── AG-B004 ClientBankComms ─────────────────────────────────────────────────

const ClientUseCaseSchema = z.object({
  use_case_id: z.string(),
  label: z.string(),
  preavis_jours: z.number(),
  canaux_autorises: z.string(),
  base_legale: z.string(),
});
export type ClientUseCase = z.infer<typeof ClientUseCaseSchema>;

const ClientSegmentSchema = z.object({
  segment_id: z.string(),
  label: z.string(),
  reading_level_max: z.number(),
  ton: z.string(),
  lang_default: z.string(),
});
export type ClientSegment = z.infer<typeof ClientSegmentSchema>;

const ClientNoticeSchema = z.object({
  notice_id: z.string(),
  label: z.string(),
  required_for: z.string(),
  text: z.string(),
});
export type ClientNotice = z.infer<typeof ClientNoticeSchema>;

const ClientChannelSchema = z.object({
  canal: z.enum(["EMAIL", "SMS", "APP", "PUSH", "MAIL"]),
  char_limit: z.number().nullable(),
  supports_html: z.boolean(),
  supports_links: z.boolean(),
  supports_attachments: z.boolean(),
});
export type ClientChannel = z.infer<typeof ClientChannelSchema>;

const ClientScenarioDraftSchema = z.object({
  subject: z.string().nullable(),
  body_fr: z.string(),
  notices_included: z.array(z.string()),
  absolute_terms: z.array(z.string()),
});

const ClientScenarioSchema = z.object({
  scenario_id: z.string(),
  label: z.string(),
  use_case_id: z.string(),
  segment_id: z.string(),
  canal: z.enum(["EMAIL", "SMS", "APP", "PUSH", "MAIL"]),
  expected_verdict: z.enum(["PASS", "PASS_WITH_REVIEW", "BLOCK"]),
  expected_blockers: z.array(z.string()),
  draft: ClientScenarioDraftSchema,
});
export type ClientScenario = z.infer<typeof ClientScenarioSchema>;

const clientData = (agb004Json as { data: Record<string, unknown> }).data ?? {};

export const CLIENT_USE_CASES: ClientUseCase[] = safeParseArray(
  ClientUseCaseSchema,
  clientData["1_USE_CASES"],
  "client_use_cases",
);

export const CLIENT_SEGMENTS: ClientSegment[] = safeParseArray(
  ClientSegmentSchema,
  clientData["2_SEGMENT_RULES"],
  "client_segments",
);

export const CLIENT_NOTICES: ClientNotice[] = safeParseArray(
  ClientNoticeSchema,
  clientData["3_MANDATORY_NOTICES"],
  "client_notices",
);

export const CLIENT_CHANNELS: ClientChannel[] = safeParseArray(
  ClientChannelSchema,
  clientData["4_CHANNEL_MATRIX"],
  "client_channels",
);

export const CLIENT_SCENARIOS: ClientScenario[] = safeParseArray(
  ClientScenarioSchema,
  clientData["5_TESTSET"],
  "client_scenarios",
);

export function getClientScenario(id: string): ClientScenario | undefined {
  return CLIENT_SCENARIOS.find((s) => s.scenario_id === id);
}

export function getClientUseCase(id: string): ClientUseCase | undefined {
  return CLIENT_USE_CASES.find((u) => u.use_case_id === id);
}

export function getClientSegment(id: string): ClientSegment | undefined {
  return CLIENT_SEGMENTS.find((s) => s.segment_id === id);
}

export function getClientChannel(canal: string): ClientChannel | undefined {
  return CLIENT_CHANNELS.find((c) => c.canal === canal);
}

export function getNoticesRequiredFor(useCaseId: string): ClientNotice[] {
  return CLIENT_NOTICES.filter((n) =>
    n.required_for.split(",").map((s) => s.trim()).includes(useCaseId),
  );
}

// ─── AG-B005 RegWatchBank (service transverse, scaffold Sprint 3) ────────────

const RegFeedSchema = z.object({
  feed_id: z.string(),
  autorite: z.string(),
  url: z.string(),
  cadence: z.string(),
  owner: z.string(),
  active: z.boolean(),
});
export type RegFeed = z.infer<typeof RegFeedSchema>;

const RegDigestSchema = z.object({
  digest_id: z.string(),
  published_at: z.string(),
  autorite: z.string(),
  title: z.string(),
  summary: z.string(),
  url: z.string(),
  impact_score: z.number(),
  affected_agents: z.array(z.string()),
  followup_task_id: z.string().nullable(),
});
export type RegDigest = z.infer<typeof RegDigestSchema>;

const RegImpactSchema = z.object({
  impact_score: z.number(),
  label: z.string(),
  sla_days: z.number(),
});
export type RegImpactLevel = z.infer<typeof RegImpactSchema>;

const regwatchData = (agb005Json as { data: Record<string, unknown> }).data ?? {};

export const BANK_REG_FEEDS: RegFeed[] = safeParseArray(
  RegFeedSchema,
  regwatchData["1_SOURCES_FEED"],
  "reg_feeds",
);

export const BANK_REG_DIGESTS: RegDigest[] = safeParseArray(
  RegDigestSchema,
  regwatchData["2_DIGESTS"],
  "reg_digests",
);

export const BANK_REG_IMPACT_LEVELS: RegImpactLevel[] = safeParseArray(
  RegImpactSchema,
  regwatchData["3_IMPACT_MAPPING"],
  "reg_impact_levels",
);

/** Digests triés du plus récent au plus ancien. */
export function getRecentDigests(limit = 10): RegDigest[] {
  return [...BANK_REG_DIGESTS]
    .sort((a, b) => b.published_at.localeCompare(a.published_at))
    .slice(0, limit);
}

/** Digests concernant un agent donné. */
export function getDigestsForAgent(agentId: string): RegDigest[] {
  return BANK_REG_DIGESTS.filter((d) => d.affected_agents.includes(agentId));
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
  crisis_scenarios_count: BANK_CRISIS_SCENARIOS.length,
  holding_statements_count: BANK_CRISIS_HOLDING_STATEMENTS.length,
  esg_claims_count: ESG_CLAIM_LIBRARY.length,
  esg_evidence_count: ESG_EVIDENCE_REGISTRY.length,
  esg_scenarios_count: ESG_SCENARIOS.length,
  reg_feeds_count: BANK_REG_FEEDS.length,
  reg_digests_count: BANK_REG_DIGESTS.length,
  client_scenarios_count: CLIENT_SCENARIOS.length,
  client_notices_count: CLIENT_NOTICES.length,
  readiness: {
    workbooks_built: false,
    demo_live: true,
    regulatory_watch_branch: true,
    export_pack_ready: true,
  },
} as const;
