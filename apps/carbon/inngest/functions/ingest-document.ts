/**
 * Inngest function — `rag/document.ingest` (worker).
 *
 * Traite UN document : fetch → parse → chunk → embed → upsert vector.
 * Chaque étape est un `step.run()` indépendant : si l'embedding échoue
 * (Voyage 5xx), Inngest retry uniquement cette étape, pas tout le pipeline.
 *
 * Concurrence limitée à 10 documents en parallèle pour préserver les
 * quotas Voyage AI (rate limit) et Upstash Vector (write capacity).
 */

import { inngest } from "@/lib/queue/client";
import { updateItem } from "@/lib/queue/job-tracker";
import { parseDocument } from "@/lib/rag/parsers";
import { chunkSegments } from "@/lib/rag/chunker";
import { embedTexts } from "@/lib/rag/embeddings";
import {
  tenantNamespace,
  upsertChunks,
  type ChunkMetadata,
  type UpsertVector,
} from "@/lib/rag/vector-store";

function chunkId(cid: string, blobUrl: string, idx: number): string {
  const hash = Buffer.from(blobUrl).toString("base64url").slice(0, 32);
  return `${cid}_${hash}_${idx}`;
}

async function fetchBuffer(url: string): Promise<{ buffer: ArrayBuffer; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Téléchargement Blob échoué (${res.status})`);
  }
  const buffer = await res.arrayBuffer();
  const mimeType = res.headers.get("content-type") ?? "application/octet-stream";
  return { buffer, mimeType };
}

export const ragDocumentIngest = inngest.createFunction(
  {
    id: "rag-document-ingest",
    name: "RAG — Ingest single document",
    triggers: [{ event: "rag/document.ingest" }],
    concurrency: { limit: 5 }, // 5 docs en parallèle (plan Inngest gratuit)
    retries: 3, // retry automatique sur erreur transient (Voyage 5xx, blob 503)
  },
  async ({ event, step }) => {
    const data = event.data as {
      cid: string;
      batchId: string;
      blobUrl: string;
      filename: string;
      mimeType?: string;
    };
    const { cid, batchId, blobUrl, filename, mimeType } = data;
    const namespace = tenantNamespace(cid);
    const uploadedAt = new Date().toISOString();

    // Marqueur "running" pour l'UI dès qu'on commence.
    await step.run("mark-running", async () => {
      await updateItem(cid, batchId, filename, "running");
    });

    try {
      // 1. Fetch + parse (peut être lent pour PDF gros)
      const { segments, effectiveMime } = await step.run("fetch-and-parse", async () => {
        const { buffer, mimeType: detectedMime } = await fetchBuffer(blobUrl);
        const effective = mimeType || detectedMime;
        const segs = await parseDocument(filename, effective, buffer);
        if (segs.length === 0) {
          throw new Error("Aucun texte extrait du document");
        }
        return { segments: segs, effectiveMime: effective };
      });

      // 2. Chunking (rapide, in-memory)
      const chunks = await step.run("chunk", async () => {
        const c = chunkSegments(segments);
        if (c.length === 0) {
          throw new Error("Aucun chunk produit");
        }
        return c;
      });

      // 3. Embedding (réseau Voyage AI — étape la plus longue)
      const vectors = await step.run("embed", async () => {
        return await embedTexts(chunks.map((c) => c.text), "document");
      });

      // 4. Upsert Upstash Vector
      await step.run("upsert", async () => {
        const upserts: UpsertVector[] = chunks.map((c, i) => {
          const metadata: ChunkMetadata = {
            cid,
            blobUrl,
            filename,
            mimeType: effectiveMime,
            page: c.page,
            sheet: c.sheet,
            chunkIndex: c.index,
            uploadedAt,
            text: c.text,
          };
          return {
            id: chunkId(cid, blobUrl, c.index),
            vector: vectors[i],
            metadata,
          };
        });
        await upsertChunks(namespace, upserts);
      });

      // 5. Marqueur OK + meta (chunks count)
      await step.run("mark-ok", async () => {
        await updateItem(cid, batchId, filename, "ok", undefined, {
          chunks: chunks.length,
        });
      });

      return { filename, chunks: chunks.length };
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Erreur ingestion";
      await step.run("mark-error", async () => {
        await updateItem(cid, batchId, filename, "error", detail);
      });
      // On rethrow pour qu'Inngest enregistre l'échec dans son dashboard.
      throw err;
    }
  },
);
