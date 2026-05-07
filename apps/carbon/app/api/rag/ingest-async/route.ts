/**
 * POST /api/rag/ingest-async
 *
 * Variante asynchrone de /api/rag/ingest. Enqueue un batch de N
 * documents pour ingestion via Inngest fan-out, retourne immédiatement
 * un batchId pollable.
 *
 * Cas d'usage : audit terrain Big 4 — 50 PDFs (~500 Mo) à ingérer
 * sans timeout HTTP. Inngest les traite en parallèle (concurrence 10)
 * avec retry automatique.
 *
 * Body : { documents: Array<{ blobUrl, filename, mimeType? }> }
 * Response 202 : { batchId, total, pollUrl }
 */

import { type NextRequest, NextResponse } from "next/server";
import { requireRole, verifyBearerToken } from "@/lib/verify-jwt";
import { inngest, newBatchId } from "@/lib/queue/client";

export const runtime = "nodejs";

type Body = {
  documents?: unknown;
};

interface ValidDoc {
  blobUrl: string;
  filename: string;
  mimeType?: string;
}

function validateDocs(raw: unknown): ValidDoc[] {
  if (!Array.isArray(raw)) return [];
  const out: ValidDoc[] = [];
  for (const d of raw) {
    if (!d || typeof d !== "object") continue;
    const obj = d as Record<string, unknown>;
    if (typeof obj.blobUrl !== "string" || obj.blobUrl.length === 0) continue;
    if (typeof obj.filename !== "string" || obj.filename.length === 0) continue;
    out.push({
      blobUrl: obj.blobUrl,
      filename: obj.filename,
      mimeType: typeof obj.mimeType === "string" ? obj.mimeType : undefined,
    });
  }
  return out;
}

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

  const docs = validateDocs(body.documents);
  if (docs.length === 0) {
    return NextResponse.json({ error: "documents manquant ou invalide" }, { status: 400 });
  }
  if (docs.length > 100) {
    return NextResponse.json({ error: "Trop de documents (max 100 par batch async)" }, { status: 400 });
  }

  const cid = String(payload.cid);
  const batchId = newBatchId("ing");

  await inngest.send({
    name: "rag/batch.ingest",
    data: {
      cid,
      batchId,
      documents: docs,
      actorSub: String(payload.sub),
    },
  });

  return NextResponse.json(
    {
      batchId,
      total: docs.length,
      pollUrl: `/api/jobs/${batchId}`,
    },
    { status: 202 },
  );
}
