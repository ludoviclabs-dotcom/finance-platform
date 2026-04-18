/**
 * NEURAL — HITL confidence router (Sprint 5)
 *
 * Decides whether an AgentRun requires human approval based on its confidence
 * score and returns the appropriate approval tier.
 *
 * Thresholds (configurable via env in a future sprint):
 *   >= 0.90  → AUTO   : no human needed, run transitions to DONE directly
 *   >= 0.70  → USER   : requesting user can approve with a single click
 *    < 0.70  → SUPERVISOR : escalated to a manager / financial controller
 *
 * null confidence (e.g. agent did not emit a score) → treated as SUPERVISOR tier
 * as a conservative default for regulated financial outputs.
 */

// ── Thresholds ────────────────────────────────────────────────────────────────

export const CONFIDENCE_THRESHOLDS = {
  /** Above this → auto-approve, no HITL. */
  AUTO_APPROVE: 0.90,
  /** Above this (and below AUTO_APPROVE) → USER tier. */
  USER_TIER: 0.70,
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export type HitlTier = "USER" | "SUPERVISOR";

export type RoutingDecision =
  | { requiresHitl: false; reason: string }
  | { requiresHitl: true; tier: HitlTier; reason: string };

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Given a confidence score (0–1 or null), returns the routing decision.
 * Pure function — no side effects, easily testable.
 */
export function routeByConfidence(confidence: number | null): RoutingDecision {
  const pct = confidence !== null ? Math.round(confidence * 100) : null;

  // No score → conservative escalation
  if (confidence === null) {
    return {
      requiresHitl: true,
      tier: "SUPERVISOR",
      reason: "Score de confiance absent — escalade superviseur par défaut.",
    };
  }

  // High confidence → auto-approve
  if (confidence >= CONFIDENCE_THRESHOLDS.AUTO_APPROVE) {
    return {
      requiresHitl: false,
      reason: `Confiance ${pct} % ≥ ${Math.round(CONFIDENCE_THRESHOLDS.AUTO_APPROVE * 100)} % — approbation automatique.`,
    };
  }

  // Medium confidence → user self-approval
  if (confidence >= CONFIDENCE_THRESHOLDS.USER_TIER) {
    return {
      requiresHitl: true,
      tier: "USER",
      reason: `Confiance ${pct} % — validation utilisateur requise avant livraison.`,
    };
  }

  // Low confidence → supervisor escalation
  return {
    requiresHitl: true,
    tier: "SUPERVISOR",
    reason: `Confiance ${pct} % < ${Math.round(CONFIDENCE_THRESHOLDS.USER_TIER * 100)} % — escalade contrôleur financier.`,
  };
}

// ── Expiry helpers ────────────────────────────────────────────────────────────

const EXPIRY_HOURS: Record<HitlTier, number> = {
  USER: 24,
  SUPERVISOR: 48,
};

/** Returns the expiry Date for a new approval given its tier. */
export function approvalExpiresAt(tier: HitlTier): Date {
  return new Date(Date.now() + EXPIRY_HOURS[tier] * 60 * 60 * 1_000);
}
