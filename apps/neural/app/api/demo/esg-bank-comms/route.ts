/**
 * NEURAL — ESGBankComms demo API (Sprint 3)
 * GET  /api/demo/esg-bank-comms → liste scénarios
 * POST /api/demo/esg-bank-comms { scenario_id } → verdict
 * Scenario-id only (correctif #2).
 */
import { NextRequest, NextResponse } from "next/server";

import { checkEsgScenario } from "@/lib/ai/esg-bank-comms";
import { ESG_SCENARIOS } from "@/lib/data/bank-comms-catalog";
import { withGuardrails } from "@/lib/security";

async function handler(req: NextRequest): Promise<Response> {
  if (req.method === "GET") {
    return NextResponse.json(
      {
        scenarios: ESG_SCENARIOS.map((s) => ({
          scenario_id: s.scenario_id,
          label: s.label,
          jurisdiction: s.draft.jurisdiction,
          expected_verdict: s.expected_verdict,
          claim_text: s.draft.claim_text,
        })),
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
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "Body JSON manquant." }, { status: 400 });
  }
  const scenarioId = (raw as Record<string, unknown>).scenario_id;
  if (typeof scenarioId !== "string" || !scenarioId.trim()) {
    return NextResponse.json({ error: "`scenario_id` requis." }, { status: 400 });
  }
  const allowed = new Set(ESG_SCENARIOS.map((s) => s.scenario_id));
  if (!allowed.has(scenarioId)) {
    return NextResponse.json(
      { error: `Scénario inconnu. Valeurs admises : ${[...allowed].join(", ")}.` },
      { status: 400 },
    );
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const userId = `anon:${ip.slice(0, 12)}`;
  try {
    const out = await checkEsgScenario({ scenarioId, userId });
    if (!out.ok) return NextResponse.json({ error: out.error }, { status: 400 });
    return NextResponse.json(
      { result: out.result, meta: out.meta },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "x-neural-esg-mode": out.meta.mode,
          "x-neural-esg-latency-ms": String(out.meta.latencyMs),
          "x-neural-esg-trace": out.meta.traceId,
          "x-neural-esg-scenario": out.meta.scenarioId,
        },
      },
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[esg-bank-comms] unexpected:", err);
    return NextResponse.json(
      { error: "Analyse momentanément indisponible. Réessayez." },
      { status: 500 },
    );
  }
}

export const GET = withGuardrails(handler);
export const POST = withGuardrails(handler);
