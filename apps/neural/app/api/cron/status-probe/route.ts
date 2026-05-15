/**
 * GET /api/cron/status-probe
 *
 * Vercel Cron job: runs every 5 minutes (see vercel.ts). Probes the internal
 * components NEURAL can actually reach (platform, database, rate-limit,
 * publications) and persists each result as a StatusProbe row. The public
 * /status page reads from this table to compute real 90d uptime per
 * component.
 *
 * Security: requires Authorization: Bearer <CRON_SECRET> in production.
 */

import { NextRequest } from "next/server";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { requireConfiguredToken } from "@/lib/security/tokens";
import { runAllProbes, type ProbeResult } from "@/lib/status/probes";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const auth = requireConfiguredToken(req, {
    envKey: "CRON_SECRET",
    allowDevWithoutToken: true,
    missingMessage: "CRON_SECRET doit être configuré pour exécuter cette tâche.",
    invalidMessage: "Token cron manquant ou invalide.",
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const startedAt = Date.now();
  const results = await runAllProbes();
  const durationMs = Date.now() - startedAt;

  // Replace the platform probe's placeholder latency with the cron round-trip
  // observed up to this point — it's the closest honest measure of "the
  // function ran end-to-end".
  for (const probe of results) {
    if (probe.componentId === "platform") {
      probe.latencyMs = durationMs;
    }
  }

  await storeProbes(results);

  return Response.json({
    ok: true,
    durationMs,
    probesPersisted: env.database.ready,
    results: results.map((r) => ({
      id: r.componentId,
      status: r.status,
      latencyMs: r.latencyMs,
      error: r.error,
    })),
  });
}

async function storeProbes(results: ProbeResult[]): Promise<void> {
  if (!env.database.ready) return;
  try {
    await db.statusProbe.createMany({
      data: results.map((r) => ({
        componentId: r.componentId,
        status: r.status,
        latencyMs: r.latencyMs,
        error: r.error,
      })),
    });
  } catch (err) {
    console.warn("status probes persist failed", {
      err: err instanceof Error ? err.message : String(err),
      count: results.length,
    });
  }
}
