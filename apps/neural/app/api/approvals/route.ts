/**
 * GET /api/approvals
 *
 * Returns all non-expired PENDING approvals.
 * Optional query param: ?orgId=xxx (filters by organisation).
 *
 * Auth: expects x-reviewer-id header (replace with NextAuth session in production).
 */

import { NextRequest } from "next/server";
import { listPendingApprovals } from "@/lib/hitl";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // TODO: replace with session.user.id from NextAuth
  const reviewerId = req.headers.get("x-reviewer-id");
  if (!reviewerId) {
    return Response.json({ error: "Non authentifié." }, { status: 401 });
  }

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
