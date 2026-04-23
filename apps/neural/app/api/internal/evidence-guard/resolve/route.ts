/**
 * NEURAL — BankEvidenceGuard resolve API (Sprint 6)
 *
 * POST /api/internal/evidence-guard/resolve
 * Body : {
 *   communication_type: "FINANCIAL_RESULTS" | "CRISIS_EXTERNAL" | "ESG_CLAIM" | ...,
 *   jurisdiction: "FR" | "EU",
 *   subjects: string[],
 *   freshness_policy?: "FRESH-STRICT" | "FRESH-STANDARD" | "FRESH-CLIENT",
 *   top_k?: number
 * }
 *
 * GET /api/internal/evidence-guard/resolve → retourne le testset résolu
 * (4 queries pré-chargées, pour audit et démo).
 *
 * Service interne (namespace `/api/internal/`) : pas de throttling client-facing
 * supplémentaire, mais guardrails standards conservés.
 */
import { NextRequest, NextResponse } from "next/server";

import { resolveEvidence, runResolverTestset } from "@/lib/ai/bank-evidence-guard";
import { EVIDENCE_RESOLVER_TESTSET } from "@/lib/data/bank-comms-catalog";
import { withGuardrails } from "@/lib/security";

async function handler(req: NextRequest): Promise<Response> {
  if (req.method === "GET") {
    return NextResponse.json(
      {
        testset: EVIDENCE_RESOLVER_TESTSET,
        results: runResolverTestset(),
      },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  }
  if (req.method !== "POST") {
    return NextResponse.json({ error: "Méthode non autorisée." }, { status: 405 });
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }
  try {
    const pkg = resolveEvidence(raw);
    return NextResponse.json(pkg, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "x-neural-evidence-verdict": pkg.verdict,
        "x-neural-evidence-count": String(pkg.sources.length),
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[evidence-guard] query invalid:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Query invalide. Champs requis : communication_type, jurisdiction, subjects[].",
      },
      { status: 400 },
    );
  }
}

export const GET = withGuardrails(handler);
export const POST = withGuardrails(handler);
