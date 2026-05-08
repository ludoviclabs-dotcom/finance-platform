/**
 * Inngest function — `rag/batch.ingest` (parent fan-out).
 *
 * Reçoit un batch de N documents et émet N événements `rag/document.ingest`
 * (un par document). Cette fonction est très courte : elle ne fait que
 * dispatcher et initialiser l'état Redis du batch.
 *
 * Avantage du fan-out vs traitement en une fois :
 *   - chaque document a son propre cycle retry/timeout (300s par doc)
 *   - parallélisme natif (Inngest scale les events enfants)
 *   - un échec n'invalide pas les autres
 */

import { inngest } from "@/lib/queue/client";
import { initJob } from "@/lib/queue/job-tracker";

export const ragBatchIngest = inngest.createFunction(
  {
    id: "rag-batch-ingest",
    name: "RAG — Bulk ingest documents",
    triggers: [{ event: "rag/batch.ingest" }],
    concurrency: { limit: 5 }, // max 5 batches simultanés tous tenants confondus
  },
  async ({ event, step }) => {
    const data = event.data as {
      cid: string;
      batchId: string;
      documents: Array<{ blobUrl: string; filename: string; mimeType?: string }>;
      actorSub: string;
    };
    const { cid, batchId, documents, actorSub } = data;

    // 1. Init Redis tracker (idempotent — Inngest peut rejouer la fonction).
    await step.run("init-tracker", async () => {
      await initJob({
        batchId,
        cid,
        kind: "ingest",
        total: documents.length,
        actorSub,
        startedAt: new Date().toISOString(),
        items: documents.map((d) => ({ key: d.filename, status: "pending" as const })),
      });
    });

    // 2. Fan-out : émet un événement par document. Inngest les exécute en parallèle.
    await step.sendEvent(
      "fan-out-documents",
      documents.map((doc) => ({
        name: "rag/document.ingest" as const,
        data: {
          cid,
          batchId,
          blobUrl: doc.blobUrl,
          filename: doc.filename,
          mimeType: doc.mimeType,
        },
      })),
    );

    return {
      batchId,
      dispatched: documents.length,
    };
  },
);
