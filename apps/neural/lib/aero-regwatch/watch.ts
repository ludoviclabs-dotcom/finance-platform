/**
 * NEURAL - AeroRegWatch core
 *
 * Logique métier du service AM-SR001 : fetch d'une source réglementaire,
 * calcul du SHA-256 stable du body, comparaison au snapshot précédent
 * (lu depuis storage), retour d'un verdict first_run / no_change / changed
 * et persistance conditionnelle.
 *
 * Aucun appel LLM ici, déterministe par construction.
 */

import { createHash } from "node:crypto";
import { getLatest, saveSnapshot, type Snapshot, type SnapshotStatus } from "./storage";
import { REGWATCH_SOURCES, type RegWatchSource } from "./sources";

const FETCH_TIMEOUT_MS = 25_000;

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function fetchWithTimeout(url: string): Promise<{ bytes: Uint8Array; latencyMs: number }> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "neural-aero-regwatch/1.0" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const buf = await res.arrayBuffer();
    return { bytes: new Uint8Array(buf), latencyMs: Date.now() - start };
  } finally {
    clearTimeout(timer);
  }
}

export type CheckOutcome =
  | { ok: true; snapshot: Snapshot }
  | { ok: false; sourceId: string; error: string };

export async function checkSource(source: RegWatchSource): Promise<CheckOutcome> {
  try {
    const { bytes, latencyMs } = await fetchWithTimeout(source.url);
    const hash = sha256Hex(bytes);

    const previous = await getLatest(source.id);
    const status: SnapshotStatus =
      previous === null ? "first_run" : previous.hash === hash ? "no_change" : "changed";

    const snapshot: Snapshot = {
      sourceId: source.id,
      hash,
      sizeBytes: bytes.byteLength,
      fetchedAt: new Date().toISOString(),
      status,
      previousHash: previous?.hash ?? null,
      latencyMs,
    };

    // On ne persiste que quand l'état change — économise l'historique Redis
    // et évite que la liste se remplisse de doublons en cas de cron quotidien
    // sur une source stable. Le "no_change" reste visible via `latest` qui
    // contient le dernier snapshot persisté (toujours first_run ou changed).
    if (status !== "no_change") {
      await saveSnapshot(snapshot);
    }

    return { ok: true, snapshot };
  } catch (err) {
    return {
      ok: false,
      sourceId: source.id,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function checkAll(): Promise<CheckOutcome[]> {
  return Promise.all(REGWATCH_SOURCES.map(checkSource));
}
