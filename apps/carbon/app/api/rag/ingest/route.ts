import { type NextRequest, NextResponse } from "next/server";
import { requireRole, verifyBearerToken } from "@/lib/verify-jwt";
import { parseDocument } from "@/lib/rag/parsers";
import { chunkSegments } from "@/lib/rag/chunker";
import { embedTexts } from "@/lib/rag/embeddings";
import {
  tenantNamespace,
  upsertChunks,
  type ChunkMetadata,
  type UpsertVector,
} from "@/lib/rag/vector-store";

export const runtime = "nodejs";
export const maxDuration = 300;

type IngestBody = {
  documents: Array<{
    blobUrl: string;
    filename: string;
    mimeType?: string;
  }>;
};

type IngestFileResult = {
  blobUrl: string;
  filename: string;
  status: "ok" | "error";
  chunks?: number;
  detail?: string;
};

async function fetchBuffer(url: string): Promise<{ buffer: ArrayBuffer; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Téléchargement Blob échoué (${res.status})`);
  }
  const buffer = await res.arrayBuffer();
  const mimeType = res.headers.get("content-type") ?? "application/octet-stream";
  return { buffer, mimeType };
}

function chunkId(cid: string, blobUrl: string, idx: number): string {
  const hash = Buffer.from(blobUrl).toString("base64url").slice(0, 32);
  return `${cid}_${hash}_${idx}`;
}

export async function POST(req: NextRequest) {
  const payload = await verifyBearerToken(req.headers.get("authorization"));
  if (!payload) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!requireRole(payload, ["admin", "analyst"])) {
    return NextResponse.json({ error: "Rôle insuffisant" }, { status: 403 });
  }

  let body: IngestBody;
  try {
    body = (await req.json()) as IngestBody;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!body.documents || body.documents.length === 0) {
    return NextResponse.json({ error: "Aucun document à ingérer" }, { status: 400 });
  }

  const cid = String(payload.cid);
  const namespace = tenantNamespace(cid);
  const uploadedAt = new Date().toISOString();
  const results: IngestFileResult[] = [];

  for (const doc of body.documents) {
    try {
      const { buffer, mimeType } = await fetchBuffer(doc.blobUrl);
      const effectiveMime = doc.mimeType || mimeType;
      const segments = await parseDocument(doc.filename, effectiveMime, buffer);
      if (segments.length === 0) {
        results.push({
          blobUrl: doc.blobUrl,
          filename: doc.filename,
          status: "error",
          detail: "Aucun texte extrait du document",
        });
        continue;
      }
      const chunks = chunkSegments(segments);
      if (chunks.length === 0) {
        results.push({
          blobUrl: doc.blobUrl,
          filename: doc.filename,
          status: "error",
          detail: "Aucun chunk produit",
        });
        continue;
      }

      const vectors = await embedTexts(chunks.map((c) => c.text), "document");

      const upserts: UpsertVector[] = chunks.map((c, i) => {
        const metadata: ChunkMetadata = {
          cid,
          blobUrl: doc.blobUrl,
          filename: doc.filename,
          mimeType: effectiveMime,
          page: c.page,
          sheet: c.sheet,
          chunkIndex: c.index,
          uploadedAt,
          text: c.text,
        };
        return {
          id: chunkId(cid, doc.blobUrl, c.index),
          vector: vectors[i],
          metadata,
        };
      });

      await upsertChunks(namespace, upserts);

      results.push({
        blobUrl: doc.blobUrl,
        filename: doc.filename,
        status: "ok",
        chunks: chunks.length,
      });
    } catch (err) {
      results.push({
        blobUrl: doc.blobUrl,
        filename: doc.filename,
        status: "error",
        detail: err instanceof Error ? err.message : "Erreur ingestion",
      });
    }
  }

  const allOk = results.every((r) => r.status === "ok");
  const anyOk = results.some((r) => r.status === "ok");
  return NextResponse.json(
    { status: allOk ? "ok" : anyOk ? "partial" : "error", results },
    { status: allOk ? 200 : anyOk ? 207 : 400 },
  );
}
