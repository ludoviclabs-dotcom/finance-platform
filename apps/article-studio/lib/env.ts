/**
 * ARTICLE STUDIO — Centralized environment variable validation
 *
 * All env vars consumed by the app go through this module.
 * - Zod schema = single source of truth for what is required/optional.
 * - Grouped by capability so features can check readiness at runtime.
 *
 * Usage:
 *   import { env } from "@/lib/env";
 *   if (env.embeddings.ready) { ... }
 */

import { z } from "zod";

// ────────────────────────────────────────────────────────────────────────────
// Raw schema — source of truth
// Everything is optional at parse-time; features assert required vars at runtime.
// ────────────────────────────────────────────────────────────────────────────

const rawSchema = z.object({
  // Runtime
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),

  // Database (Neon — dedicated to article-studio, pgvector enabled)
  DATABASE_URL: z.string().url().optional(),
  DIRECT_URL: z.string().url().optional(),

  // Redis (Upstash) — persistent rate limiting
  KV_REST_API_URL: z.string().url().optional(),
  KV_REST_API_TOKEN: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

  // AI — Vercel AI Gateway preferred, ANTHROPIC_API_KEY for local dev
  AI_GATEWAY_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Embeddings — Voyage (primary) + OpenAI (fallback)
  VOYAGE_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  // Reranker (optional)
  COHERE_API_KEY: z.string().optional(),

  // Observability (Langfuse)
  LANGFUSE_PUBLIC_KEY: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),
  LANGFUSE_BASE_URL: z.string().url().default("https://cloud.langfuse.com"),

  // Input guardrail (Lakera) — optional
  LAKERA_API_KEY: z.string().optional(),

  // File storage (Vercel Blob)
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  // Single-tenant auth (optional bearer token gating studio access)
  INTERNAL_REVIEW_TOKEN: z.string().optional(),
});

export type RawEnv = z.infer<typeof rawSchema>;

// ────────────────────────────────────────────────────────────────────────────
// Parse — runs once on module import
// ────────────────────────────────────────────────────────────────────────────

function loadEnv(): RawEnv {
  const parsed = rawSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    console.warn(`[env] invalid environment variables:\n${issues}`);
    return rawSchema.parse({});
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
    gatewayKey: raw.AI_GATEWAY_API_KEY || undefined,
    gatewayReady: Boolean(raw.AI_GATEWAY_API_KEY?.trim() || raw.VERCEL_ENV),
    anthropicKey: raw.ANTHROPIC_API_KEY || undefined,
    anthropicReady: Boolean(raw.ANTHROPIC_API_KEY?.trim()),
  },

  embeddings: {
    voyageKey: raw.VOYAGE_API_KEY || undefined,
    openaiKey: raw.OPENAI_API_KEY || undefined,
    /** Voyage is the primary provider. */
    voyageReady: Boolean(raw.VOYAGE_API_KEY?.trim()),
    /** OpenAI is the fallback provider. */
    openaiReady: Boolean(raw.OPENAI_API_KEY?.trim()),
    /** True when at least one provider is configured. */
    ready: Boolean(raw.VOYAGE_API_KEY?.trim() || raw.OPENAI_API_KEY?.trim()),
  },

  rerank: {
    cohereKey: raw.COHERE_API_KEY || undefined,
    /** Cohere is optional — falls back to LLM-as-reranker when absent. */
    ready: Boolean(raw.COHERE_API_KEY?.trim()),
  },

  observability: {
    publicKey: raw.LANGFUSE_PUBLIC_KEY || undefined,
    secretKey: raw.LANGFUSE_SECRET_KEY || undefined,
    baseUrl: raw.LANGFUSE_BASE_URL,
    ready: Boolean(raw.LANGFUSE_PUBLIC_KEY?.trim() && raw.LANGFUSE_SECRET_KEY?.trim()),
  },

  security: {
    lakeraKey: raw.LAKERA_API_KEY || undefined,
    inputGuardReady: Boolean(raw.LAKERA_API_KEY?.trim()),
  },

  storage: {
    blobToken: raw.BLOB_READ_WRITE_TOKEN || undefined,
    ready: Boolean(raw.BLOB_READ_WRITE_TOKEN?.trim()),
  },

  auth: {
    internalReviewToken: raw.INTERNAL_REVIEW_TOKEN || undefined,
    internalReviewReady: Boolean(raw.INTERNAL_REVIEW_TOKEN?.trim()),
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
        `See .env.example or run 'vercel env pull' to sync.`,
    );
  }
}

export function envReport(): Record<string, boolean> {
  return {
    database: env.database.ready,
    redis: env.redis.ready,
    ai_gateway: env.ai.gatewayReady,
    ai_anthropic_direct: env.ai.anthropicReady,
    embeddings_voyage: env.embeddings.voyageReady,
    embeddings_openai: env.embeddings.openaiReady,
    rerank_cohere: env.rerank.ready,
    observability: env.observability.ready,
    security_input_guard: env.security.inputGuardReady,
    storage_blob: env.storage.ready,
    auth_internal: env.auth.internalReviewReady,
  };
}
