import { promises as fs } from "node:fs";
import path from "node:path";

import { db } from "@/lib/db";
import { env } from "@/lib/env";

export type ProbeStatus = "operational" | "degraded" | "outage";

export interface ProbeResult {
  componentId: string;
  status: ProbeStatus;
  latencyMs: number | null;
  error: string | null;
}

const DEGRADED_LATENCY_MS = 1500;

/**
 * Components this codebase can probe without external API credentials.
 * Anything not in this list keeps its declarative status from
 * content/status/components.json.
 */
export const PROBED_COMPONENTS = [
  "platform",
  "database",
  "rate-limit",
  "publications",
] as const;
export type ProbedComponentId = (typeof PROBED_COMPONENTS)[number];

export async function runAllProbes(): Promise<ProbeResult[]> {
  const probes: Array<Promise<ProbeResult>> = [
    probePlatform(),
    probeDatabase(),
    probeRateLimit(),
    probePublications(),
  ];
  return Promise.all(probes);
}

async function probePlatform(): Promise<ProbeResult> {
  // The cron handler reaching this code means the platform runtime is alive.
  // Latency 0 here is a placeholder; the cron job itself reports total
  // duration to the caller.
  return {
    componentId: "platform",
    status: "operational",
    latencyMs: 0,
    error: null,
  };
}

async function probeDatabase(): Promise<ProbeResult> {
  if (!env.database.ready) {
    return {
      componentId: "database",
      status: "outage",
      latencyMs: null,
      error: "no-db-url",
    };
  }
  const t0 = performance.now();
  try {
    await db.$queryRaw`SELECT 1`;
    const latency = Math.round(performance.now() - t0);
    return {
      componentId: "database",
      status: latency > DEGRADED_LATENCY_MS ? "degraded" : "operational",
      latencyMs: latency,
      error: null,
    };
  } catch (err) {
    return {
      componentId: "database",
      status: "outage",
      latencyMs: Math.round(performance.now() - t0),
      error: tagError(err),
    };
  }
}

async function probeRateLimit(): Promise<ProbeResult> {
  if (!env.redis.ready) {
    return {
      componentId: "rate-limit",
      status: "outage",
      latencyMs: null,
      error: "no-redis-url",
    };
  }
  const t0 = performance.now();
  try {
    const url = env.redis.url!;
    const token = env.redis.token!;
    const resp = await fetch(`${url}/ping`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!resp.ok) {
      return {
        componentId: "rate-limit",
        status: "outage",
        latencyMs: Math.round(performance.now() - t0),
        error: `http-${resp.status}`,
      };
    }
    const latency = Math.round(performance.now() - t0);
    return {
      componentId: "rate-limit",
      status: latency > DEGRADED_LATENCY_MS ? "degraded" : "operational",
      latencyMs: latency,
      error: null,
    };
  } catch (err) {
    return {
      componentId: "rate-limit",
      status: "outage",
      latencyMs: Math.round(performance.now() - t0),
      error: tagError(err),
    };
  }
}

async function probePublications(): Promise<ProbeResult> {
  const t0 = performance.now();
  try {
    const dir = path.join(process.cwd(), "content");
    const entries = await fs.readdir(dir);
    const latency = Math.round(performance.now() - t0);
    if (entries.length === 0) {
      return {
        componentId: "publications",
        status: "degraded",
        latencyMs: latency,
        error: "empty-content-dir",
      };
    }
    return {
      componentId: "publications",
      status: "operational",
      latencyMs: latency,
      error: null,
    };
  } catch (err) {
    return {
      componentId: "publications",
      status: "outage",
      latencyMs: Math.round(performance.now() - t0),
      error: tagError(err),
    };
  }
}

function tagError(err: unknown): string {
  if (!err) return "unknown";
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("timeout") || msg.includes("aborted")) return "timeout";
  if (/connect|ECONN/i.test(msg)) return "connect-error";
  if (/auth|401|403/i.test(msg)) return "auth-error";
  return "error";
}
