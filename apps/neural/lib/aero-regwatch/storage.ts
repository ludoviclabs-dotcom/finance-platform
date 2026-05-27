/**
 * NEURAL - AeroRegWatch storage layer
 *
 * Persiste les snapshots de check sur Upstash Redis quand le projet est
 * provisionné (KV_* ou UPSTASH_* env vars, cf. lib/env.ts). En l'absence
 * de Redis, le storage est désactivé silencieusement — la page publique
 * affiche alors un état "watcher prêt, en attente de runtime data" plutôt
 * que de planter le build.
 *
 * Schéma Redis :
 *   neural:aero-regwatch:<sourceId>:latest  → Snapshot (1 objet)
 *   neural:aero-regwatch:<sourceId>:history → liste LIFO bornée à 30 entrées
 */

import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

const KEY_PREFIX = "neural:aero-regwatch";
const HISTORY_CAP = 30;

export type SnapshotStatus = "first_run" | "no_change" | "changed";

export type Snapshot = {
  sourceId: string;
  hash: string;
  sizeBytes: number;
  fetchedAt: string;
  status: SnapshotStatus;
  previousHash: string | null;
  /** ms entre l'envoi du fetch et la réception complète du body. */
  latencyMs: number;
};

let redis: Redis | null = null;
if (env.redis.ready && env.redis.url && env.redis.token) {
  try {
    redis = new Redis({ url: env.redis.url, token: env.redis.token });
  } catch (err) {
    console.warn(
      "[aero-regwatch/storage] Redis init failed — running storageless:",
      err instanceof Error ? err.message : err,
    );
  }
}

export function storageReady(): boolean {
  return redis !== null;
}

export async function getLatest(sourceId: string): Promise<Snapshot | null> {
  if (!redis) return null;
  try {
    return (await redis.get<Snapshot>(`${KEY_PREFIX}:${sourceId}:latest`)) ?? null;
  } catch (err) {
    console.warn(
      `[aero-regwatch/storage] getLatest(${sourceId}) failed:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function getHistory(sourceId: string, limit = 10): Promise<Snapshot[]> {
  if (!redis) return [];
  try {
    const items = await redis.lrange<Snapshot>(
      `${KEY_PREFIX}:${sourceId}:history`,
      0,
      Math.max(0, limit - 1),
    );
    return Array.isArray(items) ? items : [];
  } catch (err) {
    console.warn(
      `[aero-regwatch/storage] getHistory(${sourceId}) failed:`,
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

export async function saveSnapshot(snap: Snapshot): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(`${KEY_PREFIX}:${snap.sourceId}:latest`, snap);
    await redis.lpush(`${KEY_PREFIX}:${snap.sourceId}:history`, snap);
    await redis.ltrim(`${KEY_PREFIX}:${snap.sourceId}:history`, 0, HISTORY_CAP - 1);
  } catch (err) {
    console.warn(
      `[aero-regwatch/storage] saveSnapshot(${snap.sourceId}) failed:`,
      err instanceof Error ? err.message : err,
    );
  }
}
