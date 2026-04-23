/**
 * NEURAL — Banque / Communication : types métier centraux
 *
 * Types partagés par les 4 agents publics (RegBankComms, BankCrisis,
 * ESGBankComms, ClientBankComms) et les 2 services transverses
 * (RegWatchBank, BankEvidenceGuard).
 *
 * Principe : aucun type ici ne dépend d'une implémentation concrète (LLM,
 * provider, ORM). Ils représentent la *forme métier* des objets qui
 * circulent entre agents, policy gates, inbox HITL et exports.
 *
 * Scope : MVP (Sprint 0). Les types sont volontairement explicites et
 * documentés pour servir de contrat d'API entre les équipes métier
 * (DirCom/Juridique/Compliance) et l'implémentation technique.
 *
 * Hypothèses (cf. blueprint Banque/Comms — correctifs Sprint 0) :
 *  - le périmètre initial est FR + EU
 *  - toute publication reste sous validation humaine
 *  - `BankCommsDraft` embarque un `communication_subtype` dès le MVP pour
 *    permettre le split de RegBankComms sans refactor lourd (correctif #7)
 */

// ─── ENUMS PUBLICS ───────────────────────────────────────────────────────────

/** Type de communication bancaire (haut niveau). */
export const BANK_COMMUNICATION_TYPE = [
  "FINANCIAL_RESULTS",
  "GOVERNANCE",
  "SUPERVISION_NOTICE",
  "CRISIS_EXTERNAL",
  "CRISIS_INTERNAL",
  "ESG_CLAIM",
  "CLIENT_NOTICE",
  "INTERNAL_NOTE",
] as const;
export type BankCommunicationType = (typeof BANK_COMMUNICATION_TYPE)[number];

/**
 * Sous-type de communication — permet de splitter plus finement sans refactor.
 * Exemple : FINANCIAL_RESULTS peut être QUARTERLY, ANNUAL, GUIDANCE, PROFIT_WARNING.
 * Chaîne libre (validée par workbook Foundations plus tard).
 */
export type BankCommunicationSubtype = string;

export const BANK_JURISDICTION = ["FR", "EU", "UK", "US", "CH", "LU", "BE"] as const;
export type BankJurisdiction = (typeof BANK_JURISDICTION)[number];

export const BANK_REG_AUTHORITY = [
  "ACPR",
  "AMF",
  "EBA",
  "ECB",
  "ESMA",
  "FCA",
  "SEC",
  "FINMA",
  "EUR_LEX",
  "IFRS_FOUNDATION",
  "ANC",
] as const;
export type BankRegAuthority = (typeof BANK_REG_AUTHORITY)[number];

export const SEVERITY = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;
export type Severity = (typeof SEVERITY)[number];

export const EVIDENCE_STATUS = ["ACTIVE", "STALE", "REJECTED", "MISSING"] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUS)[number];

export const APPROVAL_STATUS = [
  "DRAFT",
  "AWAITING_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "REJECTED",
  "BLOCKED_BY_GATE",
] as const;
export type ApprovalStatusValue = (typeof APPROVAL_STATUS)[number];

export const CRISIS_SEVERITY = ["SEV0", "SEV1", "SEV2", "SEV3"] as const;
export type CrisisSeverity = (typeof CRISIS_SEVERITY)[number];

/** Statut d'un chiffre cité dans un draft. Zero-tolerance : seul `validated` passe le gate. */
export const NUMBER_STATUS = ["validated", "unvalidated", "estimate", "forecast"] as const;
export type NumberStatus = (typeof NUMBER_STATUS)[number];

// ─── SOURCES / EVIDENCE ──────────────────────────────────────────────────────

/**
 * Source réglementaire ou documentaire admissible.
 * Registre fermé (workbook Foundations → sheet `2_SOURCEBOOK`).
 * Extensions autorisées uniquement via workflow review + owner.
 */
export interface EvidenceSource {
  /** Identifiant stable — format `SRC-{AUTORITE}-NNN` */
  source_id: string;
  autorite: BankRegAuthority;
  titre: string;
  url: string | null;
  juridiction: BankJurisdiction[];
  status: EvidenceStatus;
  owner: string;
  /** ISO YYYY-MM-DD */
  review_date: string | null;
  /** Date d'expiration au-delà de laquelle la source bascule automatiquement STALE. */
  expiry_date: string | null;
  notes: string | null;
}

// ─── RÈGLES DE DISCLOSURE ────────────────────────────────────────────────────

/**
 * Règle obligatoire applicable à un type de communication.
 * `blocking = true` ⇒ le policy gate rejette le draft si la règle n'est pas satisfaite.
 */
export interface MandatoryDisclosureRule {
  rule_id: string;
  communication_type: BankCommunicationType | "ANY";
  champ_obligatoire: string;
  jurisdiction: BankJurisdiction[];
  autorite: BankRegAuthority | null;
  severite: Severity;
  blocking: boolean;
  description: string | null;
  source_refs: string[];
}

// ─── DRAFT + CHIFFRES ────────────────────────────────────────────────────────

/**
 * Un chiffre cité dans un draft. Contrat zero-tolerance :
 *  - si `status !== "validated"` ⇒ GATE-NUM-VALIDATED bloque.
 *  - `source_id` doit référencer un `EvidenceSource` actif.
 */
export interface NumberCitation {
  label: string;
  value: number | string;
  unit: string | null;
  status: NumberStatus;
  source_id: string | null;
  note: string | null;
}

/**
 * Un draft bancaire produit par un agent.
 *
 * Remarque (correctif #7) : `communication_subtype` est présent dès le MVP
 * pour permettre plus tard un split de RegBankComms (résultats / gouvernance /
 * notices supervision) sans refactor du schéma.
 */
export interface BankCommsDraft {
  draft_id: string;
  agent_id: "AG-B001" | "AG-B002" | "AG-B003" | "AG-B004";
  communication_type: BankCommunicationType;
  communication_subtype: BankCommunicationSubtype | null;
  jurisdiction: BankJurisdiction[];
  langs: Array<"FR" | "EN">;
  title: string;
  body_fr: string | null;
  body_en: string | null;
  numbers: NumberCitation[];
  /** Sources citées. Doit être un sous-ensemble du paquet fourni par BankEvidenceGuard. */
  cited_sources: string[];
  /** Points à valider — bloc explicite pour le reviewer HITL. */
  points_to_validate: string[];
  /** Flag info privilégiée explicite. Si vrai, gate PRIVILEGED bloque toute diffusion publique. */
  contains_privileged_info: boolean;
  created_at: string;
  version: number;
}

// ─── POLICIES & GATES ────────────────────────────────────────────────────────

/**
 * Politique d'approbation applicable à un type de communication.
 * Déclare qui doit signer pour quelle juridiction.
 */
export interface ApprovalPolicy {
  policy_id: string;
  communication_type: BankCommunicationType;
  jurisdiction: BankJurisdiction[];
  required_roles: string[];
  /** Au moins N rôles parmi `required_roles`. Défaut : tous. */
  min_approvals: number;
  sla_hours: number;
}

/** Décision d'approbation par un rôle humain. */
export interface ApprovalDecision {
  decision_id: string;
  draft_id: string;
  draft_version: number;
  role_id: string;
  reviewer: string;
  decision: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";
  comment: string | null;
  decided_at: string;
}

/** Résultat d'un gate déterministe. Un seul `blocking=true` suffit à bloquer le draft. */
export interface PolicyGateResult {
  gate_id: string;
  label: string;
  passed: boolean;
  blocking: boolean;
  reason: string | null;
  /** Références aux objets fautifs (rule_id, source_id, number label, etc.) */
  offending_refs: string[];
}

// ─── CRISIS ──────────────────────────────────────────────────────────────────

export interface CrisisScenario {
  scenario_id: string;
  label: string;
  incident_type: "CYBER" | "DATA_LEAK" | "SANCTION" | "LIQUIDITY_RUMOR" | "SERVICE_OUTAGE" | "OTHER";
  severity: CrisisSeverity;
  /** Messages pré-approuvés (holding statement, FAQ, réseau/agence). */
  approved_messages: Array<{
    channel: "PRESS" | "INTERNAL" | "AGENCY" | "CLIENT" | "REGULATOR";
    title: string;
    body_fr: string;
    body_en: string | null;
    approver: string;
    approved_at: string;
  }>;
  escalation_levels: Array<{ level: number; role: string; sla_minutes: number }>;
}

// ─── CLIENT NOTICE ───────────────────────────────────────────────────────────

export interface ClientNoticeTemplate {
  template_id: string;
  use_case: string;
  segment: string;
  channel: "EMAIL" | "SMS" | "APP" | "MAIL" | "PUSH";
  jurisdiction: BankJurisdiction;
  lang: "FR" | "EN";
  body: string;
  /** Mentions légales obligatoires selon canal + juridiction. */
  mandatory_notices: string[];
  /** Limite de caractères selon canal (ex: SMS ≤ 160). */
  channel_char_limit: number | null;
  approval_status: ApprovalStatusValue;
}

// ─── REGULATORY WATCH ────────────────────────────────────────────────────────

export interface RegulatoryDigest {
  digest_id: string;
  published_at: string;
  autorite: BankRegAuthority;
  title: string;
  summary: string;
  url: string;
  /** Score d'impact 1-5 (5 = gel publication en cours, mise à jour règles immédiate). */
  impact_score: 1 | 2 | 3 | 4 | 5;
  /** Agents touchés par le changement. */
  affected_agents: Array<"AG-B001" | "AG-B002" | "AG-B003" | "AG-B004">;
  /** Task ouverte pour mise à jour workbook. */
  followup_task_id: string | null;
}

// ─── RUN / TRACE (haut niveau) ───────────────────────────────────────────────

/**
 * Enregistrement d'un run agent. La trace complète (sources → décision →
 * validation) est stockée côté DB ; ce type est le résumé exposable.
 */
export interface BankCommsRun {
  run_id: string;
  agent_id: BankCommsDraft["agent_id"];
  draft_id: string;
  started_at: string;
  ended_at: string | null;
  gate_results: PolicyGateResult[];
  approvals: ApprovalDecision[];
  status: ApprovalStatusValue;
  /** Hash de l'export packagé (draft + checklist + sources + approbations + versions). */
  export_hash: string | null;
}
