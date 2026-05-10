/**
 * GET /api/approvals
 *
 * Returns all non-expired PENDING approvals.
 * Optional query param: ?orgId=xxx (filters by organisation).
 *
 * Auth: INTERNAL_REVIEW_TOKEN when configured, x-reviewer-id only for local/dev fallback.
 */

import { NextRequest } from "next/server";
import { listPendingApprovals } from "@/lib/hitl";
import { getInternalReviewer } from "@/lib/internal-review-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const reviewer = getInternalReviewer(req);
  if (!reviewer.ok) return Response.json({ error: reviewer.error }, { status: reviewer.status });

  const orgId = req.nextUrl.searchParams.get("orgId") ?? undefined;

  try {
    const approvals = await listPendingApprovals(orgId);
    return Response.json({ approvals, count: approvals.length });
  } catch (err) {
    console.error("[api/approvals] GET error:", err);
    return Response.json(
      { error: "Erreur lors de la récupération de la file d'approbation." },
      { status: 500 },
    );
  }
}
