/**
 * Source → indexed pipeline.
 *
 * Lifecycle on Source.status:
 *   READY (parsed) → CHUNKING → EMBEDDING → READY (re-set with indexedAt populated)
 *   any error → FAILED with errorMessage
 *
 * Idempotent: calling twice on the same source replaces all chunks (FK cascade
 * + replace-semantics in saveChunksWithEmbeddings).
 */

import { db } from "@/lib/db";
import { splitBlocks } from "@/lib/chunking/splitter";
import { embedBatched } from "@/lib/embeddings/batch";
import { getEmbeddingClient } from "@/lib/embeddings/client";
import { saveChunksWithEmbeddings } from "./ingest";
import type { Block } from "@/lib/types/source";

export interface IndexResult {
  sourceId: string;
  chunkCount: number;
  embeddingModel: string;
  tookMs: number;
}

export async function indexSource(sourceId: string): Promise<IndexResult> {
  const t0 = Date.now();

  const source = await db.source.findUnique({ where: { id: sourceId } });
  if (!source) throw new Error(`Source ${sourceId} not found`);

  const blocks = extractBlocks(source.metadata);
  if (blocks.length === 0) {
    await markFailed(sourceId, "No parsed blocks available on Source.metadata");
    throw new Error("No parsed blocks");
  }

  try {
    await db.source.update({
      where: { id: sourceId },
      data: { status: "CHUNKING", errorMessage: null },
    });

    const chunks = splitBlocks(blocks);

    if (chunks.length === 0) {
      await markFailed(sourceId, "Splitter produced zero chunks");
      throw new Error("Zero chunks");
    }

    await db.source.update({
      where: { id: sourceId },
      data: { status: "EMBEDDING" },
    });

    const client = await getEmbeddingClient();
    const vectors = await embedBatched(
      client,
      chunks.map((c) => c.content),
      "document",
    );

    const inserted = await saveChunksWithEmbeddings({
      sourceId,
      chunks,
      vectors,
    });

    await db.source.update({
      where: { id: sourceId },
      data: { status: "READY", indexedAt: new Date(), errorMessage: null },
    });

    return {
      sourceId,
      chunkCount: inserted,
      embeddingModel: client.model,
      tookMs: Date.now() - t0,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markFailed(sourceId, message);
    throw err;
  }
}

async function markFailed(sourceId: string, message: string): Promise<void> {
  await db.source.update({
    where: { id: sourceId },
    data: { status: "FAILED", errorMessage: message.slice(0, 1000) },
  });
}

function extractBlocks(metadata: unknown): Block[] {
  if (!metadata || typeof metadata !== "object") return [];
  const raw = (metadata as { blocks?: unknown }).blocks;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (b): b is Block =>
      b !== null &&
      typeof b === "object" &&
      typeof (b as Block).kind === "string" &&
      typeof (b as Block).text === "string",
  );
}
