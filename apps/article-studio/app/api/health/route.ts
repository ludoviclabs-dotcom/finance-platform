/**
 * GET /api/health
 *
 * Readiness probe surfacing the state of every capability group declared
 * in lib/env.ts. Used by:
 *   • CI smoke tests
 *   • Dashboard "État des capacités" tile
 *   • Vercel deployment health check
 *
 * Returns 200 always (the app boots even with everything off); the body
 * reports which capabilities are wired.
 */

import { NextResponse } from "next/server";
import { envReport } from "@/lib/env";
import { getAiSurfaceReadiness, getAiGatewayAuthMode } from "@/lib/ai/router";
import { getAiTelemetryReadiness } from "@/lib/telemetry/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const capabilities = envReport();
  const surfaces = getAiSurfaceReadiness();
  const telemetry = getAiTelemetryReadiness();
  const aiAuth = getAiGatewayAuthMode();

  return NextResponse.json(
    {
      ok: true,
      app: "article-studio",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
      capabilities,
      ai: { authMode: aiAuth, surfaces },
      telemetry,
    },
    { status: 200 },
  );
}
