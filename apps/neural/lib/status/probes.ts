import { promises as fs } from "node:fs";
import path from "node:path";

import type { NextRequest } from "next/server";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getInternalReviewer } from "@/lib/internal-review-auth";

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
  "ai-gateway",
  "telemetry",
  "auth",
] as const;
export type ProbedComponentId = (typeof PROBED_COMPONENTS)[number];

export async function runAllProbes(): Promise<ProbeResult[]> {
  const probes: Array<Promise<ProbeResult>> = [
    probePlatform(),
    probeDatabase(),
    probeRateLimit(),
    probePublications(),
    probeAiGateway(),
    probeLangfuse(),
    probeAuth(),
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

async function probeAiGateway(): Promise<ProbeResult> {
  // The Vercel AI Gateway exposes a public health endpoint that does not
  // require a key. We hit it from the cron runtime to confirm both DNS +
  // upstream routing are healthy from our region.
  if (!env.ai.gatewayReady) {
    return {
      componentId: "ai-gateway",
      status: "outage",
      latencyMs: null,
      error: "no-gateway-key",
    };
  }
  const t0 = performance.now();
  try {
    const resp = await fetch("https://ai-gateway.vercel.sh/v1/health", {
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    const latency = Math.round(performance.now() - t0);
    if (!resp.ok) {
      return {
        componentId: "ai-gateway",
        status: "outage",
        latencyMs: latency,
        error: `http-${resp.status}`,
      };
    }
    return {
      componentId: "ai-gateway",
      status: latency > DEGRADED_LATENCY_MS ? "degraded" : "operational",
      latencyMs: latency,
      error: null,
    };
  } catch (err) {
    return {
      componentId: "ai-gateway",
      status: "outage",
      latencyMs: Math.round(performance.now() - t0),
      error: tagError(err),
    };
  }
}

async function probeLangfuse(): Promise<ProbeResult> {
  // Langfuse exposes /api/public/health on every deployment (cloud + self-hosted).
  // We probe the configured baseUrl so the result mirrors what the SDK sees.
  if (!env.observability.ready) {
    return {
      componentId: "telemetry",
      status: "outage",
      latencyMs: null,
      error: "no-langfuse-keys",
    };
  }
  const t0 = performance.now();
  try {
    const resp = await fetch(`${env.observability.baseUrl}/api/public/health`, {
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    const latency = Math.round(performance.now() - t0);
    if (!resp.ok) {
      return {
        componentId: "telemetry",
        status: "outage",
        latencyMs: latency,
        error: `http-${resp.status}`,
      };
    }
    return {
      componentId: "telemetry",
      status: latency > DEGRADED_LATENCY_MS ? "degraded" : "operational",
      latencyMs: latency,
      error: null,
    };
  } catch (err) {
    return {
      componentId: "telemetry",
      status: "outage",
      latencyMs: Math.round(performance.now() - t0),
      error: tagError(err),
    };
  }
}

async function probeAuth(): Promise<ProbeResult> {
  // Exercises the real /api/internal/* gate code path with a synthetic
  // unauthenticated request — no network call needed. The gate MUST return
  // 401 for an empty Authorization header. We also assert the secret is
  // configured in production so we don't ship a deployment where the
  // "fail-closed" gate locks out real reviewers.
  const t0 = performance.now();

  if (env.runtime.isProduction && !env.auth.internalReviewReady) {
    return {
      componentId: "auth",
      status: "outage",
      latencyMs: null,
      error: "no-internal-review-token",
    };
  }

  try {
    const probeReq = new Request("http://probe.local/api/internal", {
      method: "GET",
    }) as unknown as NextRequest;
    const result = getInternalReviewer(probeReq);
    const latency = Math.round(performance.now() - t0);

    if (result.ok) {
      // Unauth request was accepted — gate is broken.
      return {
        componentId: "auth",
        status: "outage",
        latencyMs: latency,
        error: "gate-not-enforcing",
      };
    }
    if (result.status !== 401) {
      return {
        componentId: "auth",
        status: "degraded",
        latencyMs: latency,
        error: `unexpected-status-${result.status}`,
      };
    }
    return {
      componentId: "auth",
      status: "operational",
      latencyMs: latency,
      error: null,
    };
  } catch (err) {
    return {
      componentId: "auth",
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
