/**
 * NEURAL — Persistent rate limiter (Sprint 1)
 *
 * Uses Upstash Redis (sliding window, 20 req/min per IP) when the KV store is
 * provisioned. Falls back to an in-memory map for local development / CI so the
 * app works without a Redis connection.
 *
 * Redis coordinates:  env.redis.url + env.redis.token
 * These are set automatically by the Vercel × Upstash integration as
 * KV_REST_API_URL / KV_REST_API_TOKEN (which env.ts resolves to env.redis.*).
 */

import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { env } from "@/lib/env";

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_REQUESTS = 20; // per window
const WINDOW = "1 m" as const;
const KEY_PREFIX = "neural:rl:chat";

// ── Persistent (Upstash) ─────────────────────────────────────────────────────
let ratelimit: Ratelimit | null = null;

if (env.redis.ready && env.redis.url && env.redis.token) {
  try {
    const redis = new Redis({ url: env.redis.url, token: env.redis.token });
    ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(MAX_REQUESTS, WINDOW),
      analytics: true,
      prefix: KEY_PREFIX,
    });
  } catch (err) {
    console.warn(
      "[rate-limiter] Failed to initialise Upstash — falling back to in-memory:",
      err instanceof Error ? err.message : err,
    );
  }
}

// ── In-memory fallback ───────────────────────────────────────────────────────
const memMap = new Map<string, number[]>();
const MEM_WINDOW_MS = 60_000;

function memCheck(ip: string): { limited: boolean; remaining: number } {
  const now = Date.now();
  const hits = (memMap.get(ip) ?? []).filter((t) => now - t < MEM_WINDOW_MS);

  if (hits.length >= MAX_REQUESTS) {
    memMap.set(ip, hits);
    return { limited: true, remaining: 0 };
  }

  hits.push(now);
  memMap.set(ip, hits);
  return { limited: false, remaining: MAX_REQUESTS - hits.length };
}

// ── Public API ───────────────────────────────────────────────────────────────

export type RateLimitResult = {
  limited: boolean;
  remaining: number;
  reset?: number; // Unix timestamp (ms) — only available with Redis
  provider: "redis" | "memory";
};

/**
 * Check whether `ip` is rate-limited. Call once per request, at the route entry.
 */
export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  if (ratelimit) {
    try {
      const { success, remaining, reset } = await ratelimit.limit(ip);
      return {
        limited: !success,
        remaining,
        reset,
        provider: "redis",
      };
    } catch (err) {
      console.warn(
        "[rate-limiter] Redis check failed, falling back to memory:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  const mem = memCheck(ip);
  return { ...mem, provider: "memory" };
}
