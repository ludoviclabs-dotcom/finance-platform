/**
 * POST /api/datapoints/extract-async
 *
 * Variante asynchrone de /api/datapoints/extract. Au lieu d'extraire
 * en synchrone (max 60 datapoints, timeout 5 min), enqueue un événement
 * Inngest et renvoie immédiatement un `batchId` que l'UI peut poller via
 * /api/jobs/[batchId].
 *
 * Avantages :
 *   - Pas de limite max (on peut envoyer 127 datapoints Set 2 complet)
 *   - Pas de timeout HTTP — Inngest scale les workers
 *   - Retry automatique sur erreurs transient (Anthropic 5xx, Voyage 429)
 *
 * Body : { datapointIds: string[] }
 * Response 202 : { batchId, total }
 */

import { type NextRequest, NextResponse } from "next/server";
import { requireRole, verifyBearerToken } from "@/lib/verify-jwt";
import { inngest, newBatchId } from "@/lib/queue/client";

export const runtime = "nodejs";

type Body = { datapointIds?: unknown };

export async function POST(req: NextRequest) {
  const payload = await verifyBearerToken(req.headers.get("authorization"));
  if (!payload) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!requireRole(payload, ["admin", "analyst"])) {
    return NextResponse.json({ error: "Rôle insuffisant" }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const ids = Array.isArray(body.datapointIds)
    ? body.datapointIds.filter((s): s is string => typeof s === "string" && s.length > 0)
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "datapointIds manquant" }, { status: 400 });
  }
  if (ids.length > 200) {
    return NextResponse.json({ error: "Trop de datapoints (max 200 par batch async)" }, { status: 400 });
  }

  const cid = String(payload.cid);
  const batchId = newBatchId("dpx");

  await inngest.send({
    name: "datapoints/batch.extract",
    data: {
      cid,
      batchId,
      datapointIds: ids,
      actorSub: String(payload.sub),
    },
  });

  return NextResponse.json(
    {
      batchId,
      total: ids.length,
      pollUrl: `/api/jobs/${batchId}`,
    },
    { status: 202 },
  );
}
