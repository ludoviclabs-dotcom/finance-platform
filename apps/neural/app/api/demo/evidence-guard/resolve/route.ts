/**
 * Public deterministic demo for BankEvidenceGuard.
 *
 * The internal resolver remains protected under /api/internal/*.
 * This route exposes only the closed test registry used by the public product demo.
 */
import { NextRequest, NextResponse } from "next/server";

import { resolveEvidence, runResolverTestset } from "@/lib/ai/bank-evidence-guard";
import { EVIDENCE_RESOLVER_TESTSET } from "@/lib/data/bank-comms-catalog";
import { recordAgentRun } from "@/lib/gateway/runtime-helper";
import { withGuardrails } from "@/lib/security";

async function handler(req: NextRequest): Promise<Response> {
  if (req.method === "GET") {
    return NextResponse.json(
      {
        scope: "public-demo",
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

    await recordAgentRun({
      agentId: "bank-evidence-guard",
      prompt: JSON.stringify(raw ?? {}),
      decision:
        pkg.verdict === "READY" ? "ALLOW" : pkg.verdict === "BLOCKED" ? "BLOCK" : "REVIEW",
      outcome: `evidence-guard:${pkg.verdict}:sources=${pkg.sources.length}`,
      trigger: "sandbox",
    });

    return NextResponse.json(pkg, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "x-neural-evidence-scope": "public-demo",
        "x-neural-evidence-verdict": pkg.verdict,
        "x-neural-evidence-count": String(pkg.sources.length),
      },
    });
  } catch (err) {
    console.warn("[demo/evidence-guard] query invalid:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Query invalide. Champs requis: communication_type, jurisdiction, subjects[].",
      },
      { status: 400 },
    );
  }
}

export const GET = withGuardrails(handler);
export const POST = withGuardrails(handler);
