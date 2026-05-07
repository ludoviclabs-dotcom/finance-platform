/**
 * Inngest function — `datapoints/batch.extract` (parent fan-out).
 *
 * Reçoit un lot de N datapoints à extraire et émet N événements
 * `datapoints/extract.one`. Chaque extraction est isolée (retry,
 * concurrence) pour éviter qu'un échec ponctuel d'Anthropic
 * (5xx, rate limit) bloque tout le batch.
 *
 * Pas de limite max : on peut envoyer 127 datapoints (Set 2 complet)
 * en une fois, contrairement à l'API sync qui bloque à 60.
 */

import { inngest } from "@/lib/queue/client";
import { initJob } from "@/lib/queue/job-tracker";

export const datapointsBatchExtract = inngest.createFunction(
  {
    id: "datapoints-batch-extract",
    name: "Datapoints — Bulk extract ESRS",
    triggers: [{ event: "datapoints/batch.extract" }],
    concurrency: { limit: 5 }, // max 5 batches simultanés tous tenants
  },
  async ({ event, step }) => {
    const data = event.data as {
      cid: string;
      batchId: string;
      datapointIds: string[];
      actorSub: string;
    };
    const { cid, batchId, datapointIds, actorSub } = data;

    await step.run("init-tracker", async () => {
      await initJob({
        batchId,
        cid,
        kind: "extract",
        total: datapointIds.length,
        actorSub,
        startedAt: new Date().toISOString(),
        items: datapointIds.map((id) => ({ key: id, status: "pending" as const })),
      });
    });

    await step.sendEvent(
      "fan-out-datapoints",
      datapointIds.map((id) => ({
        name: "datapoints/extract.one" as const,
        data: { cid, batchId, datapointId: id },
      })),
    );

    return { batchId, dispatched: datapointIds.length };
  },
);
