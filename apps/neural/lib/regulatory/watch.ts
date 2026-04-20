/**
 * NEURAL — Regulatory watch orchestrator (Sprint 7)
 *
 * Ties together: fetch → deduplicate → classify → persist
 *
 * Flow:
 *   1. fetchAllSources()          — pull RSS feeds from all 6 sources
 *   2. filter by externalId       — skip publications already in DB
 *   3. classifyBatch()            — Haiku assigns impactScore + affectedAgents
 *   4. upsertAlerts()             — persist new alerts to Neon
 *   5. return WatchRunResult[]    — summary for cron response body
 *
 * The cron at /api/cron/regulatory-watch calls runRegulatoryWatch() once daily.
 */

import { fetchAllSources } from "./sources/feeds";
import { classifyBatch } from "./classifier";
import { upsertAlerts } from "./store";
import { db } from "@/lib/db";
import type { WatchRunResult, RegulatorySource } from "./types";

// ── Dedup helper ──────────────────────────────────────────────────────────────

async function filterNewPublications(
  externalIds: string[],
): Promise<Set<string>> {
  if (externalIds.length === 0) return new Set();

  const existing = await db.regulatoryAlert.findMany({
    where: { externalId: { in: externalIds } },
    select: { externalId: true },
  });

  return new Set(existing.map((r) => r.externalId));
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

/**
 * Run a full regulatory watch cycle.
 * @param lookbackDays  How many days back to look in each feed (default: 3)
 * @param classifyAll   If false (default), only classify new publications not in DB
 */
export async function runRegulatoryWatch(
  lookbackDays = 3,
  classifyAll = false,
): Promise<WatchRunResult[]> {
  console.info("[regulatory-watch] Starting watch cycle…");

  // 1. Fetch all sources
  const allPubs = await fetchAllSources(lookbackDays);
  console.info(`[regulatory-watch] Fetched ${allPubs.length} publications.`);

  if (allPubs.length === 0) {
    return [];
  }

  // 2. Deduplicate
  const existingIds = classifyAll
    ? new Set<string>()
    : await filterNewPublications(allPubs.map((p) => p.externalId));

  const newPubs = allPubs.filter((p) => !existingIds.has(p.externalId));
  console.info(
    `[regulatory-watch] ${newPubs.length} new (${existingIds.size} already in DB).`,
  );

  if (newPubs.length === 0) {
    // Group skipped by source for the result
    const bySource = new Map<RegulatorySource, number>();
    for (const p of allPubs) {
      bySource.set(p.source, (bySource.get(p.source) ?? 0) + 1);
    }
    return Array.from(bySource.entries()).map(([source, n]) => ({
      source,
      fetched: n,
      newAlerts: 0,
      skipped: n,
      errors: 0,
    }));
  }

  // 3. Classify (Haiku)
  const classified = await classifyBatch(newPubs);
  console.info(`[regulatory-watch] Classified ${classified.length} publications.`);

  // 4. Persist
  const { created, skipped } = await upsertAlerts(classified);
  console.info(
    `[regulatory-watch] Persisted ${created} new alerts (${skipped} skipped).`,
  );

  // 5. Build result summary per source
  const resultMap = new Map<
    RegulatorySource,
    WatchRunResult
  >();

  for (const p of allPubs) {
    const r = resultMap.get(p.source) ?? {
      source: p.source,
      fetched: 0,
      newAlerts: 0,
      skipped: 0,
      errors: 0,
    };
    r.fetched++;
    resultMap.set(p.source, r);
  }

  for (const c of classified) {
    const r = resultMap.get(c.source)!;
    r.newAlerts++;
  }

  for (const p of allPubs.filter((p) => existingIds.has(p.externalId))) {
    const r = resultMap.get(p.source)!;
    r.skipped++;
  }

  const results = Array.from(resultMap.values());
  console.info("[regulatory-watch] Cycle complete:", JSON.stringify(results));
  return results;
}

// ── Re-export store helpers for direct use ────────────────────────────────────

export { listAlerts, listHighImpactAlerts, getAlert } from "./store";
