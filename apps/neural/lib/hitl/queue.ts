/**
 * NEURAL — HITL approval queue (Sprint 5)
 *
 * Prisma-backed operations for the Approval model.
 * Called by:
 *   • Agent handlers  → submitForApproval() after a low-confidence run
 *   • API routes      → approve() / reject() when a reviewer acts
 *   • Cron job        → expireStale() (Sprint 11)
 */

import { ApprovalTier, ApprovalStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { approvalExpiresAt, type HitlTier } from "./router";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PendingApproval = {
  id: string;
  tier: HitlTier;
  status: ApprovalStatus;
  expiresAt: Date;
  createdAt: Date;
  run: {
    id: string;
    agentId: string;
    question: string;
    confidence: number | null;
    startedAt: Date;
    user: { name: string | null; email: string } | null;
  };
  reviewer: { name: string | null; email: string } | null;
};

// ── Submit ────────────────────────────────────────────────────────────────────

/**
 * Put a run in the HITL queue.
 * Sets the AgentRun status to WAITING_APPROVAL and creates the Approval row.
 */
export async function submitForApproval(
  runId: string,
  tier: HitlTier,
): Promise<{ approvalId: string }> {
  const expiresAt = approvalExpiresAt(tier);

  const [approval] = await db.$transaction([
    db.approval.create({
      data: {
        runId,
        tier: tier as ApprovalTier,
        status: "PENDING",
        expiresAt,
      },
      select: { id: true },
    }),
    db.agentRun.update({
      where: { id: runId },
      data: { status: "WAITING_APPROVAL" },
    }),
  ]);

  return { approvalId: approval.id };
}

// ── Approve ───────────────────────────────────────────────────────────────────

export type ReviewAction = {
  approvalId: string;
  reviewerId: string;
  reason?: string;
};

/**
 * Approve a pending run. Transitions:
 *   Approval  : PENDING → APPROVED
 *   AgentRun  : WAITING_APPROVAL → DONE
 */
export async function approveRun({ approvalId, reviewerId, reason }: ReviewAction) {
  const approval = await db.approval.findUnique({
    where: { id: approvalId },
    select: { runId: true, status: true, expiresAt: true },
  });

  if (!approval) throw new Error(`Approval ${approvalId} introuvable.`);
  if (approval.status !== "PENDING") {
    throw new Error(`Impossible d'approuver — statut actuel : ${approval.status}.`);
  }
  if (approval.expiresAt < new Date()) {
    throw new Error("L'approbation a expiré.");
  }

  await db.$transaction([
    db.approval.update({
      where: { id: approvalId },
      data: {
        status: "APPROVED",
        reviewerId,
        reviewedAt: new Date(),
        reason: reason ?? null,
      },
    }),
    db.agentRun.update({
      where: { id: approval.runId },
      data: { status: "DONE", completedAt: new Date() },
    }),
  ]);
}

// ── Reject ────────────────────────────────────────────────────────────────────

/**
 * Reject a pending run. A reason is mandatory for audit trail.
 * Transitions:
 *   Approval  : PENDING → REJECTED
 *   AgentRun  : WAITING_APPROVAL → REJECTED
 */
export async function rejectRun({
  approvalId,
  reviewerId,
  reason,
}: ReviewAction & { reason: string }) {
  const approval = await db.approval.findUnique({
    where: { id: approvalId },
    select: { runId: true, status: true },
  });

  if (!approval) throw new Error(`Approval ${approvalId} introuvable.`);
  if (approval.status !== "PENDING") {
    throw new Error(`Impossible de rejeter — statut actuel : ${approval.status}.`);
  }

  await db.$transaction([
    db.approval.update({
      where: { id: approvalId },
      data: {
        status: "REJECTED",
        reviewerId,
        reviewedAt: new Date(),
        reason,
      },
    }),
    db.agentRun.update({
      where: { id: approval.runId },
      data: { status: "REJECTED", completedAt: new Date() },
    }),
  ]);
}

// ── List ──────────────────────────────────────────────────────────────────────

/**
 * List all non-expired PENDING approvals.
 * Optionally filter by organization (for multi-tenant access control).
 */
export async function listPendingApprovals(
  organizationId?: string,
): Promise<PendingApproval[]> {
  const rows = await db.approval.findMany({
    where: {
      status: "PENDING",
      expiresAt: { gt: new Date() },
      ...(organizationId && { run: { organizationId } }),
    },
    include: {
      run: {
        select: {
          id: true,
          agentId: true,
          question: true,
          confidence: true,
          startedAt: true,
          user: { select: { name: true, email: true } },
        },
      },
      reviewer: { select: { name: true, email: true } },
    },
    // Supervisors first, then by expiry asc (most urgent = soonest to expire)
    orderBy: [{ tier: "desc" }, { expiresAt: "asc" }],
  });

  return rows.map((r) => ({
    id: r.id,
    tier: r.tier as HitlTier,
    status: r.status,
    expiresAt: r.expiresAt,
    createdAt: r.createdAt,
    run: r.run,
    reviewer: r.reviewer,
  }));
}

// ── Expire stale ──────────────────────────────────────────────────────────────

/**
 * Mark all past-deadline PENDING approvals as EXPIRED.
 * Called by /api/cron/expire-approvals (Sprint 11).
 * Returns the number of rows updated.
 */
export async function expireStaleApprovals(): Promise<number> {
  const { count } = await db.approval.updateMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: new Date() },
    },
    data: { status: "EXPIRED" },
  });
  return count;
}

// ── Single fetch ──────────────────────────────────────────────────────────────

export async function getApproval(approvalId: string) {
  return db.approval.findUnique({
    where: { id: approvalId },
    include: {
      run: {
        select: {
          id: true,
          agentId: true,
          question: true,
          answer: true,
          confidence: true,
          status: true,
          startedAt: true,
          completedAt: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
  });
}
