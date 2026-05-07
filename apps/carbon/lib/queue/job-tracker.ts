/**
 * Job tracker — état temps réel des batches Inngest dans Redis.
 *
 * L'UI a besoin de connaître l'avancement d'un batch ingestion/extraction
 * sans polling Inngest directement. On stocke dans Upstash Redis :
 *   - clé `job:${cid}:${batchId}` → JSON { total, done, failed, items[] }
 *   - TTL 24h (pas besoin d'historique long terme)
 *
 * Les fonctions Inngest mettent à jour la clé après chaque step réussi
 * ou échoué, et la route GET /api/jobs/[batchId] renvoie l'état au client.
 */

import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

const redis = url && token ? new Redis({ url, token }) : null;

const TTL_SECONDS = 24 * 60 * 60;

export type JobItemStatus = "pending" | "running" | "ok" | "error";

export interface JobItem {
  /** Clé d'identification (filename pour ingestion, datapointId pour extract). */
  key: string;
  status: JobItemStatus;
  detail?: string;
  /** Métadonnée optionnelle (chunks count, confidence, etc.). */
  meta?: Record<string, unknown>;
}

export interface JobState {
  batchId: string;
  cid: string;
  kind: "ingest" | "extract";
  /** Total d'items dans le batch (constant). */
  total: number;
  /** Items terminés OK ou en erreur (dynamique). */
  done: number;
  failed: number;
  /** Acteur qui a déclenché le job (audit). */
  actorSub: string;
  startedAt: string;
  updatedAt: string;
  finishedAt?: string;
  items: JobItem[];
}

function key(cid: string, batchId: string): string {
  return `job:${cid}:${batchId}`;
}

/**
 * Initialise l'état d'un batch (à appeler avant le fan-out).
 * Idempotent : ne réécrit pas si déjà présent.
 */
export async function initJob(state: Omit<JobState, "done" | "failed" | "updatedAt">): Promise<void> {
  if (!redis) return;
  const now = new Date().toISOString();
  const full: JobState = {
    ...state,
    done: 0,
    failed: 0,
    updatedAt: now,
  };
  // SET NX → ne pas écraser si la clé existe déjà (cas double trigger Inngest).
  await redis.set(key(state.cid, state.batchId), JSON.stringify(full), {
    ex: TTL_SECONDS,
    nx: true,
  });
}

/**
 * Met à jour l'état d'UN item du batch et recalcule done/failed.
 * Concurrent-safe (Redis SET avec lecture/modification/écriture optimiste).
 */
export async function updateItem(
  cid: string,
  batchId: string,
  key_: string,
  status: JobItemStatus,
  detail?: string,
  meta?: Record<string, unknown>,
): Promise<JobState | null> {
  if (!redis) return null;
  const k = key(cid, batchId);
  const raw = await redis.get<string>(k);
  if (!raw) return null;

  // Upstash Redis renvoie l'objet déjà parsé OU une string selon le payload.
  const state: JobState = typeof raw === "string" ? JSON.parse(raw) : (raw as JobState);

  const idx = state.items.findIndex((i) => i.key === key_);
  if (idx === -1) {
    state.items.push({ key: key_, status, detail, meta });
  } else {
    state.items[idx] = { key: key_, status, detail, meta };
  }

  state.done = state.items.filter((i) => i.status === "ok" || i.status === "error").length;
  state.failed = state.items.filter((i) => i.status === "error").length;
  state.updatedAt = new Date().toISOString();
  if (state.done >= state.total) {
    state.finishedAt = state.updatedAt;
  }

  await redis.set(k, JSON.stringify(state), { ex: TTL_SECONDS });
  return state;
}

/** Lit l'état complet d'un batch (renvoie null si absent ou Redis off). */
export async function getJob(cid: string, batchId: string): Promise<JobState | null> {
  if (!redis) return null;
  const raw = await redis.get<string>(key(cid, batchId));
  if (!raw) return null;
  return typeof raw === "string" ? (JSON.parse(raw) as JobState) : (raw as JobState);
}
