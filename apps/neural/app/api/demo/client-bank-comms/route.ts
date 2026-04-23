/**
 * NEURAL — ClientBankComms demo API (Sprint 4)
 * GET  /api/demo/client-bank-comms → liste scénarios
 * POST /api/demo/client-bank-comms { scenario_id } → verdict
 * Scenario-id only (correctif #2).
 */
import { NextRequest, NextResponse } from "next/server";

import { checkClientScenario } from "@/lib/ai/client-bank-comms";
import { CLIENT_SCENARIOS } from "@/lib/data/bank-comms-catalog";
import { withGuardrails } from "@/lib/security";

async function handler(req: NextRequest): Promise<Response> {
  if (req.method === "GET") {
    return NextResponse.json(
      {
        scenarios: CLIENT_SCENARIOS.map((s) => ({
          scenario_id: s.scenario_id,
          label: s.label,
          use_case_id: s.use_case_id,
          segment_id: s.segment_id,
          canal: s.canal,
          expected_verdict: s.expected_verdict,
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
  const allowed = new Set(CLIENT_SCENARIOS.map((s) => s.scenario_id));
  if (!allowed.has(scenarioId)) {
    return NextResponse.json(
      { error: `Scénario inconnu. Valeurs admises : ${[...allowed].join(", ")}.` },
      { status: 400 },
    );
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const userId = `anon:${ip.slice(0, 12)}`;
  try {
    const out = await checkClientScenario({ scenarioId, userId });
    if (!out.ok) return NextResponse.json({ error: out.error }, { status: 400 });
    return NextResponse.json(
      { result: out.result, meta: out.meta },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "x-neural-client-mode": out.meta.mode,
          "x-neural-client-latency-ms": String(out.meta.latencyMs),
          "x-neural-client-trace": out.meta.traceId,
          "x-neural-client-scenario": out.meta.scenarioId,
        },
      },
    );
  } catch (err) {
     
    console.error("[client-bank-comms] unexpected:", err);
    return NextResponse.json(
      { error: "Analyse momentanément indisponible. Réessayez." },
      { status: 500 },
    );
  }
}

export const GET = withGuardrails(handler);
export const POST = withGuardrails(handler);
