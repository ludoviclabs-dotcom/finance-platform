/**
 * GET /api/jobs/[batchId]
 *
 * Renvoie l'état temps réel d'un batch Inngest (ingestion ou extraction).
 * Utilisé par l'UI pour afficher la barre de progression et les erreurs
 * item par item sans avoir à interroger Inngest directement.
 *
 * Sécurité : isolation par cid — un user d'un tenant ne peut pas voir
 * les jobs d'un autre tenant. Si batchId existe pour un autre cid,
 * on renvoie 404 plutôt que 403 (pas de leak d'existence).
 */

import { type NextRequest, NextResponse } from "next/server";
import { requireRole, verifyBearerToken } from "@/lib/verify-jwt";
import { getJob } from "@/lib/queue/job-tracker";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const payload = await verifyBearerToken(req.headers.get("authorization"));
  if (!payload) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!requireRole(payload, ["admin", "analyst", "auditor", "daf", "reader"])) {
    return NextResponse.json({ error: "Rôle insuffisant" }, { status: 403 });
  }

  const { batchId } = await params;
  if (!batchId || typeof batchId !== "string") {
    return NextResponse.json({ error: "batchId manquant" }, { status: 400 });
  }

  const cid = String(payload.cid);
  const state = await getJob(cid, batchId);
  if (!state) {
    return NextResponse.json({ error: "Job introuvable" }, { status: 404 });
  }

  // On ne renvoie que les fields utiles côté UI (pas l'actorSub).
  return NextResponse.json({
    batchId: state.batchId,
    kind: state.kind,
    total: state.total,
    done: state.done,
    failed: state.failed,
    startedAt: state.startedAt,
    updatedAt: state.updatedAt,
    finishedAt: state.finishedAt,
    items: state.items,
  });
}
