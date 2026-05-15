import { db } from "@/lib/db";
import { env } from "@/lib/env";

import { PROBED_COMPONENTS, type ProbeStatus, type ProbedComponentId } from "./probes";

export interface ComponentUptime {
  componentId: string;
  /** Live uptime % over the last 90 days, computed from probes. */
  uptime90d: number;
  /** Latest probe status. */
  latestStatus: ProbeStatus;
  /** When was the latest probe taken (UTC ISO). */
  latestProbeAt: string;
  /** Total probes counted in the window. */
  sampleSize: number;
  /** Mean latency in ms over the window, when available. */
  meanLatencyMs: number | null;
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Build a map of componentId -> live uptime metrics for every probed
 * component. Returns an empty map when the database is unavailable so the
 * caller can fall back to the declarative content.
 */
export async function getLiveUptimes(): Promise<Map<string, ComponentUptime>> {
  const result = new Map<string, ComponentUptime>();
  if (!env.database.ready) return result;

  try {
    const since = new Date(Date.now() - NINETY_DAYS_MS);
    const probes = await db.statusProbe.findMany({
      where: {
        componentId: { in: [...PROBED_COMPONENTS] },
        probedAt: { gte: since },
      },
      orderBy: { probedAt: "desc" },
    });

    const byComponent = new Map<string, typeof probes>();
    for (const probe of probes) {
      const arr = byComponent.get(probe.componentId);
      if (arr) arr.push(probe);
      else byComponent.set(probe.componentId, [probe]);
    }

    for (const componentId of PROBED_COMPONENTS) {
      const rows = byComponent.get(componentId);
      if (!rows || rows.length === 0) continue;
      const ok = rows.filter((p) => p.status === "operational").length;
      const latency = rows
        .map((p) => p.latencyMs)
        .filter((v): v is number => v !== null);
      const meanLatency =
        latency.length > 0
          ? Math.round(latency.reduce((a, b) => a + b, 0) / latency.length)
          : null;
      const latest = rows[0];
      result.set(componentId, {
        componentId,
        uptime90d: rows.length > 0 ? (ok / rows.length) * 100 : 0,
        latestStatus: latest.status as ProbeStatus,
        latestProbeAt: latest.probedAt.toISOString(),
        sampleSize: rows.length,
        meanLatencyMs: meanLatency,
      });
    }
  } catch (err) {
    console.warn("uptime fetch failed", {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  return result;
}

export function isProbed(componentId: string): componentId is ProbedComponentId {
  return (PROBED_COMPONENTS as readonly string[]).includes(componentId);
}
