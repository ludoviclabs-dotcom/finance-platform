/**
 * PATCH /api/approvals/[id]
 *
 * Body: { action: "approve" | "reject", reason?: string }
 * reason is required when action = "reject".
 *
 * Auth: expects x-reviewer-id header (replace with NextAuth session in production).
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { approveRun, rejectRun } from "@/lib/hitl";

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), reason: z.string().optional() }),
  z.object({ action: z.literal("reject"),  reason: z.string().min(1, "Un motif de refus est requis.") }),
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // TODO: replace with session.user.id from NextAuth
  const reviewerId = req.headers.get("x-reviewer-id");
  if (!reviewerId) {
    return Response.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { id: approvalId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides." },
      { status: 400 },
    );
  }

  try {
    if (parsed.data.action === "approve") {
      await approveRun({ approvalId, reviewerId, reason: parsed.data.reason });
      return Response.json({ ok: true, action: "approved" });
    } else {
      await rejectRun({ approvalId, reviewerId, reason: parsed.data.reason });
      return Response.json({ ok: true, action: "rejected" });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue.";
    const status = message.includes("introuvable") ? 404
      : message.includes("expiré") || message.includes("statut") ? 409
      : 500;

    return Response.json({ error: message }, { status });
  }
}
