/**
 * NEURAL — Regulatory Watch types (Sprint 7)
 *
 * RawPublication  : data fetched directly from a regulatory source feed.
 * ClassifiedAlert : after Haiku classification, ready for DB persistence.
 *
 * Supported sources:
 *   "eur-lex"          — European legislation (regulations, directives)
 *   "bofip"            — Bulletin Officiel des Finances Publiques (French tax)
 *   "eba"              — European Banking Authority (Basel III, CRR, DORA)
 *   "anc"              — Autorité des Normes Comptables (French GAAP)
 *   "acpr"             — Autorité de Contrôle Prudentiel et de Résolution
 *   "ifrs-foundation"  — IFRS Foundation / IASB standards updates
 *
 * Agent categories (affectedAgents values):
 *   "ifrs-reporting"   — IFRS 9 ECL, IFRS 16, IFRS 17
 *   "tax-compliance"   — French TVA, IS, CFE, CVAE
 *   "banking-reg"      — Basel III, CRR/CRD V, LCR, NSFR, DORA
 *   "consolidation"    — Multi-entity, interco, restatements
 *   "payroll-hr"       — French payroll, social charges, URSSAF
 *   "audit-risk"       — Internal audit, risk scoring, compliance
 */

export type RegulatorySource =
  | "eur-lex"
  | "bofip"
  | "eba"
  | "anc"
  | "acpr"
  | "ifrs-foundation";

export type AffectedAgent =
  | "ifrs-reporting"
  | "tax-compliance"
  | "banking-reg"
  | "consolidation"
  | "payroll-hr"
  | "audit-risk";

// ── Raw ───────────────────────────────────────────────────────────────────────

/** Data fetched from a feed, before classification. */
export type RawPublication = {
  /** Stable unique ID from the source (CELEX, article ID, etc.) */
  externalId: string;
  source: RegulatorySource;
  publishedAt: Date;
  title: string;
  url: string;
  /** Short description / abstract — fed to the classifier. */
  abstract?: string;
};

// ── Classified ────────────────────────────────────────────────────────────────

/** After Haiku classification, ready for RegulatoryAlert persistence. */
export type ClassifiedAlert = RawPublication & {
  /** 0–1. > 0.5 triggers notifications. */
  impactScore: number;
  /** Which NEURAL agent categories are affected. */
  affectedAgents: AffectedAgent[];
  /** 1-sentence summary produced by Haiku. */
  summary: string;
  /** Detailed analysis (optional, produced by Sonnet for high-impact alerts). */
  fullAnalysis?: Record<string, unknown>;
};

// ── Watch result ──────────────────────────────────────────────────────────────

export type WatchRunResult = {
  source: RegulatorySource;
  fetched: number;
  newAlerts: number;
  skipped: number; // already in DB
  errors: number;
};
