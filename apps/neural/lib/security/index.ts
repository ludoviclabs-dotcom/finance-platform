/**
 * NEURAL — Security façade (Sprint 1)
 *
 * Entry point for the three-layer guardrail stack:
 *
 *   withGuardrails(handler)  — Next.js route wrapper:
 *                              rate-limit → handler → (output guard on full responses)
 *
 *   guardInput(message)      — Standalone input check for use inside handlers
 *                              BEFORE the LLM call. Returns a 400 Response if
 *                              blocked, null otherwise.
 *
 * Usage (route file):
 *
 *   import { withGuardrails, guardInput } from "@/lib/security";
 *
 *   async function handler(req: NextRequest) {
 *     const body = await req.json();
 *     const blocked = await guardInput(body.messages.at(-1)?.content ?? "");
 *     if (blocked) return blocked;
 *     // ... call LLM
 *   }
 *
 *   export const POST = withGuardrails(handler);
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "./rate-limiter";
import { checkInput } from "./input-guard";

// Re-export primitives so callers can import everything from "@/lib/security"
export { checkInput } from "./input-guard";
export { checkOutput } from "./output-guard";
export { checkRateLimit } from "./rate-limiter";
export type { InputGuardResult } from "./input-guard";
export type { OutputGuardResult } from "./output-guard";
export type { RateLimitResult } from "./rate-limiter";

// ── Types ────────────────────────────────────────────────────────────────────

type RouteHandler = (req: NextRequest) => Promise<Response>;

// ── withGuardrails ───────────────────────────────────────────────────────────

/**
 * Wraps a Next.js App Router handler with:
 *   1. Persistent rate limiting (Upstash Redis / in-memory fallback)
 *   2. X-RateLimit-Remaining header on every response
 *
 * Note: input guard is NOT run here because the handler has not yet parsed the
 * request body. Call `guardInput()` explicitly inside your handler after parsing,
 * before the LLM call.
 */
export function withGuardrails(handler: RouteHandler): RouteHandler {
  return async function guardedHandler(req: NextRequest): Promise<Response> {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    // ── 1. Rate limit ──────────────────────────────────────────────────────
    const rl = await checkRateLimit(ip);

    if (rl.limited) {
      return NextResponse.json(
        { error: "Trop de requêtes. Réessayez dans une minute." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Remaining": "0",
            "Retry-After": "60",
          },
        },
      );
    }

    // ── 2. Run the actual handler ──────────────────────────────────────────
    const response = await handler(req);

    // Attach rate-limit headers without cloning the (possibly streaming) body
    response.headers.set("X-RateLimit-Remaining", String(rl.remaining));
    response.headers.set("X-RateLimit-Provider", rl.provider);

    return response;
  };
}

// ── guardInput ───────────────────────────────────────────────────────────────

/**
 * Runs the input guardrail on `message`.
 * Returns a 400 NextResponse if the message is blocked, `null` if it passes.
 *
 * Example:
 *   const blocked = await guardInput(lastUserMessage);
 *   if (blocked) return blocked;
 */
export async function guardInput(message: string): Promise<NextResponse | null> {
  if (!message?.trim()) return null;

  const result = await checkInput(message);

  if (result.blocked) {
    console.warn("[guardrails] Input blocked:", {
      provider: result.provider,
      score: result.score,
      reason: result.reason,
    });

    return NextResponse.json(
      { error: result.reason ?? "Requête non autorisée." },
      { status: 400 },
    );
  }

  return null;
}
