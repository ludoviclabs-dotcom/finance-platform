import { db } from "@/lib/db";
import { env } from "@/lib/env";

import type { SignedReceipt, OutilId } from "./sign";

export interface StoredReceipt {
  hash: string;
  tool: OutilId;
  toolLabel: string;
  resultLabel: string;
  generatedAt: Date;
  createdAt: Date;
}

/**
 * Persist a signed receipt so the public /verify/outil/{hash} page can
 * confirm it later. Best-effort: a missing DB or a write failure must not
 * break the user-facing PDF download.
 */
export async function storeReceipt<T>(
  receipt: SignedReceipt<T>,
  resultLabel: string,
): Promise<void> {
  if (!env.database.ready) return;

  try {
    await db.outilReceipt.upsert({
      where: { hash: receipt.hash },
      create: {
        hash: receipt.hash,
        tool: receipt.tool,
        toolLabel: receipt.toolLabel,
        resultLabel,
        generatedAt: new Date(receipt.generatedAt),
      },
      update: {
        // The same hash is, by construction, the same content. We touch the
        // updatedAt-style createdAt only on first write.
        resultLabel,
      },
    });
  } catch (err) {
    // Log and continue — the receipt is best-effort.
    console.warn("outil receipt store failed", {
      hash: receipt.hash.slice(0, 8),
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Look up a receipt by its hex hash. Returns null when the database is
 * unavailable or when no receipt matches.
 */
export async function lookupReceipt(hash: string): Promise<StoredReceipt | null> {
  if (!env.database.ready) return null;
  if (!/^[a-f0-9]{64}$/.test(hash)) return null;

  try {
    const row = await db.outilReceipt.findUnique({ where: { hash } });
    if (!row) return null;
    return {
      hash: row.hash,
      tool: row.tool as OutilId,
      toolLabel: row.toolLabel,
      resultLabel: row.resultLabel,
      generatedAt: row.generatedAt,
      createdAt: row.createdAt,
    };
  } catch (err) {
    console.warn("outil receipt lookup failed", {
      hash: hash.slice(0, 8),
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
