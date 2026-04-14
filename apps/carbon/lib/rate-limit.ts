import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfterSeconds: number;
}

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

const redis = url && token ? new Redis({ url, token }) : null;

const perMinute = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "60 s"),
      prefix: "rl:copilot:min",
      analytics: false,
    })
  : null;

const perDay = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(200, "86400 s"),
      prefix: "rl:copilot:day",
      analytics: false,
    })
  : null;

function failOpen(): RateLimitResult {
  return { success: true, limit: 0, remaining: 0, reset: 0, retryAfterSeconds: 0 };
}

export async function checkCopilotRateLimit(identifier: string): Promise<RateLimitResult> {
  if (!perMinute || !perDay) return failOpen();

  try {
    const [minRes, dayRes] = await Promise.all([
      perMinute.limit(identifier),
      perDay.limit(identifier),
    ]);

    const worst = minRes.success === false ? minRes : dayRes.success === false ? dayRes : minRes;
    const success = minRes.success && dayRes.success;
    const retryAfterMs = Math.max(0, worst.reset - Date.now());

    return {
      success,
      limit: worst.limit,
      remaining: Math.min(minRes.remaining, dayRes.remaining),
      reset: worst.reset,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  } catch {
    return failOpen();
  }
}

export function isRateLimitEnabled(): boolean {
  return redis !== null;
}