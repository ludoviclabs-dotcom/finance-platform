/**
 * NEURAL — Centralized environment variable validation
 *
 * All env vars consumed by the app go through this module.
 * - Zod schema = single source of truth for what is required/optional.
 * - Grouped by capability so features can check readiness at runtime.
 * - Safe to import client-side only for PUBLIC_* keys (never other groups).
 *
 * Usage:
 *   import { env } from "@/lib/env";
 *   if (env.ai.gatewayReady) { ... }
 *
 * Sprint 0 — foundations. Extended progressively through sprints 1-7.
 */

import { z } from "zod";

// ────────────────────────────────────────────────────────────────────────────
// Raw schema — source of truth
// Everything is optional at parse-time; features assert required vars at runtime.
// This keeps `next build` passing even when a given capability is not provisioned yet.
// ────────────────────────────────────────────────────────────────────────────

const rawSchema = z.object({
  // Runtime
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),

  // Database (Neon via Vercel Marketplace)
  DATABASE_URL: z.string().url().optional(),
  DIRECT_URL: z.string().url().optional(),

  // Redis (Upstash via Vercel Marketplace) — persistent rate limiting
  // Vercel Marketplace injects KV_* naming; Upstash direct dashboard uses UPSTASH_*.
  // Both are accepted — KV_* takes priority.
  KV_REST_API_URL: z.string().url().optional(),
  KV_REST_API_TOKEN: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

  // AI — Vercel AI Gateway is the preferred entry point.
  // In production on Vercel, auth is handled by OIDC; the key is only needed locally.
  AI_GATEWAY_API_KEY: z.string().min(1).optional(),

  // Legacy direct-Anthropic access (still used by app/api/chat-demo until Sprint 3 refactor)
  // Note: plain z.string().optional() — empty strings are treated as "not set" via Boolean() checks
  ANTHROPIC_API_KEY: z.string().optional(),

  // Observability (Langfuse) — Sprint 3
  LANGFUSE_PUBLIC_KEY: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),
  LANGFUSE_BASE_URL: z.string().url().default("https://cloud.langfuse.com"),

  // Evaluation (Braintrust) — Sprint 3
  BRAINTRUST_API_KEY: z.string().optional(),

  // Input guardrail (Lakera) — Sprint 1
  LAKERA_API_KEY: z.string().optional(),

  // Memory layer (Mem0) — Sprint 4
  MEM0_API_KEY: z.string().optional(),

  // Email (Resend) — Sprint 11 regulatory newsletter
  RESEND_API_KEY: z.string().optional(),
});

export type RawEnv = z.infer<typeof rawSchema>;

// ────────────────────────────────────────────────────────────────────────────
// Parse — runs once on module import, surfaces aggregated errors
// ────────────────────────────────────────────────────────────────────────────

function loadEnv(): RawEnv {
  const parsed = rawSchema.safeParse(process.env);
  if (!parsed.success) {
    // Aggregate all issues; do not throw during `next build` since every var is optional.
    // Log once, continue — capabilities will gate themselves on runtime.
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    console.warn(`[env] invalid environment variables:\n${issues}`);
    return rawSchema.parse({}); // fallbacks to defaults
  }
  return parsed.data;
}

const raw = loadEnv();

// ────────────────────────────────────────────────────────────────────────────
// Grouped API — features check readiness by capability group
// ────────────────────────────────────────────────────────────────────────────

export const env = {
  runtime: {
    nodeEnv: raw.NODE_ENV,
    vercelEnv: raw.VERCEL_ENV,
    isProduction: raw.NODE_ENV === "production" || raw.VERCEL_ENV === "production",
    isPreview: raw.VERCEL_ENV === "preview",
  },

  database: {
    url: raw.DATABASE_URL,
    directUrl: raw.DIRECT_URL ?? raw.DATABASE_URL,
    ready: Boolean(raw.DATABASE_URL),
  },

  redis: {
    url: raw.KV_REST_API_URL ?? raw.UPSTASH_REDIS_REST_URL,
    token: raw.KV_REST_API_TOKEN ?? raw.UPSTASH_REDIS_REST_TOKEN,
    ready: Boolean(
      (raw.KV_REST_API_URL ?? raw.UPSTASH_REDIS_REST_URL) &&
      (raw.KV_REST_API_TOKEN ?? raw.UPSTASH_REDIS_REST_TOKEN),
    ),
  },

  ai: {
    // When deployed on Vercel, OIDC handles auth automatically; key is only needed locally.
    gatewayKey: raw.AI_GATEWAY_API_KEY || undefined,
    gatewayReady: Boolean(raw.AI_GATEWAY_API_KEY?.trim() || raw.VERCEL_ENV),

    // Legacy direct-Anthropic path; to be deprecated after Sprint 3.
    anthropicKey: raw.ANTHROPIC_API_KEY || undefined,
    anthropicReady: Boolean(raw.ANTHROPIC_API_KEY?.trim()),
  },

  observability: {
    publicKey: raw.LANGFUSE_PUBLIC_KEY || undefined,
    secretKey: raw.LANGFUSE_SECRET_KEY || undefined,
    baseUrl: raw.LANGFUSE_BASE_URL,
    ready: Boolean(raw.LANGFUSE_PUBLIC_KEY?.trim() && raw.LANGFUSE_SECRET_KEY?.trim()),
  },

  eval: {
    braintrustKey: raw.BRAINTRUST_API_KEY || undefined,
    ready: Boolean(raw.BRAINTRUST_API_KEY?.trim()),
  },

  security: {
    lakeraKey: raw.LAKERA_API_KEY || undefined,
    inputGuardReady: Boolean(raw.LAKERA_API_KEY?.trim()),
  },

  memory: {
    mem0Key: raw.MEM0_API_KEY || undefined,
    ready: Boolean(raw.MEM0_API_KEY?.trim()),
  },

  email: {
    resendKey: raw.RESEND_API_KEY || undefined,
    ready: Boolean(raw.RESEND_API_KEY?.trim()),
  },
} as const;

// ────────────────────────────────────────────────────────────────────────────
// Helpers — runtime assertion for features that need a specific capability
// ────────────────────────────────────────────────────────────────────────────

export function requireEnv<K extends keyof typeof env>(
  group: K,
  feature: string,
): void {
  const g = env[group] as { ready: boolean };
  if (!g.ready) {
    throw new Error(
      `[env] Feature "${feature}" requires env group "${String(group)}" to be configured. ` +
        `See docs/env.md or run 'vercel env pull' to sync.`,
    );
  }
}

/** Prints a readiness report — useful in CI / dev /admin/health. */
export function envReport(): Record<string, boolean> {
  return {
    database: env.database.ready,
    redis: env.redis.ready,
    ai_gateway: env.ai.gatewayReady,
    ai_anthropic_legacy: env.ai.anthropicReady,
    observability: env.observability.ready,
    eval: env.eval.ready,
    security_input_guard: env.security.inputGuardReady,
    memory: env.memory.ready,
    email: env.email.ready,
  };
}
