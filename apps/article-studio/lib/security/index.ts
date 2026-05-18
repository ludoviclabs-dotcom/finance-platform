/**
 * ARTICLE STUDIO — Security façade
 *
 *   withGuardrails(handler) — Next.js route wrapper: rate-limit → handler
 *   guardInput(message)     — Standalone input check (returns 400 Response if blocked)
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "./rate-limiter";
import { checkInput } from "./input-guard";

export { checkInput } from "./input-guard";
export { checkOutput } from "./output-guard";
export { checkRateLimit } from "./rate-limiter";
export type { InputGuardResult } from "./input-guard";
export type { OutputGuardResult } from "./output-guard";
export type { RateLimitResult } from "./rate-limiter";

type RouteHandler = (req: NextRequest) => Promise<Response>;

export function withGuardrails(handler: RouteHandler): RouteHandler {
  return async function guardedHandler(req: NextRequest): Promise<Response> {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

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

    const response = await handler(req);

    response.headers.set("X-RateLimit-Remaining", String(rl.remaining));
    response.headers.set("X-RateLimit-Provider", rl.provider);

    return response;
  };
}

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
