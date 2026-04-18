/**
 * NEURAL — HITL façade (Sprint 5)
 *
 * Single import for all Human-in-the-Loop operations.
 *
 * Typical agent handler usage:
 *
 *   import { routeByConfidence, submitForApproval } from "@/lib/hitl";
 *
 *   const decision = routeByConfidence(confidence);
 *
 *   if (decision.requiresHitl) {
 *     const { approvalId } = await submitForApproval(run.id, decision.tier);
 *     return { status: "waiting_approval", approvalId };
 *   }
 *
 *   // → auto-approved, continue with delivery
 */

export {
  routeByConfidence,
  approvalExpiresAt,
  CONFIDENCE_THRESHOLDS,
} from "./router";

export type { HitlTier, RoutingDecision } from "./router";

export {
  submitForApproval,
  approveRun,
  rejectRun,
  listPendingApprovals,
  expireStaleApprovals,
  getApproval,
} from "./queue";

export type { PendingApproval, ReviewAction } from "./queue";
