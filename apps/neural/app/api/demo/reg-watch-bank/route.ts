/**
 * NEURAL — RegWatchBank digest API (Sprint 3 scaffold)
 * GET /api/demo/reg-watch-bank?agent=AG-B001
 *
 * Retourne les digests récents, filtrable par agent affecté. Service
 * transverse — pas de POST public. Le fetch automatisé des feeds est
 * planifié en Sprint 4 (cron hebdo + classifier LLM).
 */
import { NextRequest, NextResponse } from "next/server";

import {
  getDigestsForAgent,
  getRecentDigests,
} from "@/lib/data/bank-comms-catalog";
import { withGuardrails } from "@/lib/security";

async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "GET") {
    return NextResponse.json({ error: "Méthode non autorisée." }, { status: 405 });
  }
  const url = new URL(req.url);
  const agent = url.searchParams.get("agent");
  const limitRaw = url.searchParams.get("limit");
  const limit = Math.max(1, Math.min(50, Number(limitRaw) || 10));

  const digests = agent
    ? getDigestsForAgent(agent).slice(0, limit)
    : getRecentDigests(limit);

  return NextResponse.json(
    { digests, filtered_by_agent: agent },
    {
      headers: {
        "Cache-Control": "public, max-age=600",
        "x-neural-regwatch-source": "seed-sprint3",
      },
    },
  );
}

export const GET = withGuardrails(handler);
