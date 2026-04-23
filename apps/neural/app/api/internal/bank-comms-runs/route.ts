/**
 * NEURAL — Inbox runs API (Tier 3 #2)
 * GET /api/internal/bank-comms-runs?agent=AG-BXXX&status=WAITING_APPROVAL&limit=50
 *
 * Lecture des runs banque persistés pour une inbox HITL externe ou un
 * dashboard de reviewer. Service interne : pas de POST, pas de mutation.
 *
 * Returns { runs, counts } — mode dégradé silencieux si DATABASE_URL absent
 * (runs=[], counts vides). Jamais d'erreur côté appelant.
 */
import { NextRequest, NextResponse } from "next/server";

import {
  BANK_COMMS_AGENT_SLUGS_ARR,
  BANK_COMMS_RUN_STATUSES,
  getBankCommsRunsCounts,
  getRecentBankCommsRuns,
  type BankCommsRunStatus,
} from "@/lib/ai/bank-comms-persistence";
import { withGuardrails } from "@/lib/security";

async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "GET") {
    return NextResponse.json({ error: "Méthode non autorisée." }, { status: 405 });
  }
  const url = new URL(req.url);
  const rawAgent = url.searchParams.get("agent");
  const rawStatus = url.searchParams.get("status");
  const rawLimit = url.searchParams.get("limit");

  const agent =
    rawAgent && (BANK_COMMS_AGENT_SLUGS_ARR as readonly string[]).includes(rawAgent)
      ? (rawAgent as (typeof BANK_COMMS_AGENT_SLUGS_ARR)[number])
      : undefined;
  const status =
    rawStatus && (BANK_COMMS_RUN_STATUSES as readonly string[]).includes(rawStatus)
      ? (rawStatus as BankCommsRunStatus)
      : undefined;
  const limit = Math.max(1, Math.min(200, Number(rawLimit) || 50));

  const [runs, counts] = await Promise.all([
    getRecentBankCommsRuns({ agentSlug: agent, status, limit }),
    getBankCommsRunsCounts(),
  ]);
  return NextResponse.json(
    {
      filters: { agent: agent ?? null, status: status ?? null, limit },
      counts,
      runs: runs.map((r) => ({
        id: r.id,
        agentId: r.agentId,
        scenarioId: r.scenarioId,
        decision: r.decision,
        status: r.status,
        model: r.model,
        startedAt: r.startedAt.toISOString(),
        completedAt: r.completedAt ? r.completedAt.toISOString() : null,
      })),
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "x-neural-inbox-count": String(runs.length),
      },
    },
  );
}

export const GET = withGuardrails(handler);
